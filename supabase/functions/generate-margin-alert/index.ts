import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.96.0";
import { assertSiteAccess } from "../_shared/siteAuthz.ts";
import { assertIntelligenceTier } from "../_shared/aiTierGuard.ts";

/**
 * generate-margin-alert
 * POST { site_id: string, payload: {...} }
 * Returns { narrative, generated_at, cached }
 *
 * The frontend computes flagged recipes (using True Margin Engine) and posts
 * them here. We turn the structured payload into a manager-facing narrative
 * with Claude Haiku, cache it in ai_insights, and update ai_usage.
 */

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const site_id: string | undefined = body?.site_id;
    const payload: any = body?.payload;
    if (!site_id || typeof site_id !== "string" || !payload || typeof payload !== "object") {
      return new Response(JSON.stringify({ error: "site_id and payload required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authzFail = await assertSiteAccess({
      authUserId: claimsData.claims.sub as string,
      siteId: site_id,
      svc,
      corsHeaders,
    });
    if (authzFail) return authzFail;

    const aiFail = await assertIntelligenceTier({ siteId: site_id, svc, corsHeaders });
    if (aiFail) return aiFail;

    // Server-controlled date — never trust client input for cache keys or usage
    // bucketing (prevents cache bypass and usage-reporting corruption).
    const todayStr = ymd(new Date());

    // Allowlist + sanitize the fields we actually use in the AI prompt. This
    // prevents authenticated users from injecting instructions into the model.
    const ALLOWED_CURRENCIES = new Set(["GBP", "EUR", "USD"]);
    const rawCurrency = typeof payload.currency === "string" ? payload.currency.toUpperCase() : "GBP";
    const currency = ALLOWED_CURRENCIES.has(rawCurrency) ? rawCurrency : "GBP";

    const safeStr = (v: unknown, max = 80) =>
      typeof v === "string" ? v.replace(/[\r\n\t`]+/g, " ").slice(0, max) : null;
    const safeNum = (v: unknown) => {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      return Number.isFinite(n) ? n : null;
    };

    const rawFlagged: any[] = Array.isArray(payload.flagged_recipes) ? payload.flagged_recipes : [];
    const flagged = rawFlagged.slice(0, 25).map((r: any) => ({
      name: safeStr(r?.name, 120) ?? "Unnamed recipe",
      current_gp_pct: safeNum(r?.current_gp_pct),
      target_gp_pct: safeNum(r?.target_gp_pct),
      sale_price: safeNum(r?.sale_price),
      food_cost: safeNum(r?.food_cost),
      suggested_new_price: safeNum(r?.suggested_new_price),
      top_cost_drivers: Array.isArray(r?.top_cost_drivers)
        ? r.top_cost_drivers.slice(0, 5).map((d: any) => safeStr(d, 80)).filter(Boolean)
        : [],
    }));

    const safePayload = { currency, generated_for_date: todayStr, flagged_recipes: flagged };

    // Cache check — same site, same day, still valid
    const nowIso = new Date().toISOString();
    const { data: cached } = await svc
      .from("ai_insights")
      .select("id, narrative, content, generated_at, valid_until")
      .eq("site_id", site_id)
      .eq("insight_type", "margin_alert")
      .gt("valid_until", nowIso)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.narrative && (cached.content as any)?.generated_for_date === todayStr) {
      return new Response(
        JSON.stringify({
          narrative: cached.narrative,
          generated_at: cached.generated_at,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: site, error: siteErr } = await svc
      .from("sites")
      .select("id, name, organisation_id")
      .eq("id", site_id)
      .maybeSingle();
    if (siteErr || !site) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const flagged: any[] = Array.isArray(payload.flagged_recipes) ? payload.flagged_recipes : [];

    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const generatedAt = new Date().toISOString();

    // Empty case — no AI call needed
    if (flagged.length === 0) {
      const narrative = "All recipes are within target margins.";
      await svc.from("ai_insights").insert({
        site_id: site.id,
        organisation_id: site.organisation_id,
        insight_type: "margin_alert",
        content: payload,
        narrative,
        generated_at: generatedAt,
        valid_until: validUntil.toISOString(),
        model_used: "none",
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_estimate: 0,
      });
      return new Response(
        JSON.stringify({ narrative, generated_at: generatedAt, cached: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const anthropic = new Anthropic({ apiKey });

    const currency = payload.currency || "GBP";
    const userPrompt = `You are an operations advisor for a UK independent bakery/café called ${site.name}. The following recipes have GP% below their target. Write a concise, manager-facing narrative.

Strict formatting rules:
- Plain text only.
- No markdown, no bullets, no asterisks, no hash symbols, no headings.
- Use short skimmable paragraphs separated by blank lines.
- Reference the actual numbers (current GP%, target GP%, sale price, food cost) for each flagged recipe.
- For each recipe, briefly explain the likely cause using the top cost drivers, then recommend ONE clear action: either raise price to the suggested_new_price (if provided), or propose a sensible new price using the figures, or suggest a simple recipe adjustment based on the top cost drivers.
- End with a short final paragraph titled in plain text "What I would do today" (no formatting marks) summarising the priority action.
- Currency is ${currency}. Round prices to 2 decimal places and percentages to 1 decimal place.
- Never invent data that isn't provided.

Data:
${JSON.stringify(payload)}`;

    let narrative = "";
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        temperature: 0.2,
        messages: [{ role: "user", content: userPrompt }],
      });
      const block = resp.content[0];
      narrative = block && block.type === "text" ? block.text : "";
      inputTokens = resp.usage?.input_tokens ?? 0;
      outputTokens = resp.usage?.output_tokens ?? 0;
    } catch (aiErr) {
      console.error("Anthropic API error:", aiErr);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cost_estimate = (inputTokens * 1.0) / 1_000_000 + (outputTokens * 5.0) / 1_000_000;

    const { error: insErr } = await svc.from("ai_insights").insert({
      site_id: site.id,
      organisation_id: site.organisation_id,
      insight_type: "margin_alert",
      content: payload,
      narrative,
      generated_at: generatedAt,
      valid_until: validUntil.toISOString(),
      model_used: "claude-haiku-4-5-20251001",
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      cost_estimate,
    });
    if (insErr) console.error("ai_insights insert error:", insErr);

    const month = todayStr.slice(0, 7);
    const { data: usageRow } = await svc
      .from("ai_usage")
      .select("id, total_requests, total_tokens, total_cost")
      .eq("organisation_id", site.organisation_id)
      .eq("month", month)
      .maybeSingle();
    if (usageRow) {
      await svc
        .from("ai_usage")
        .update({
          total_requests: (usageRow.total_requests ?? 0) + 1,
          total_tokens: (usageRow.total_tokens ?? 0) + inputTokens + outputTokens,
          total_cost: Number(usageRow.total_cost ?? 0) + cost_estimate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", usageRow.id);
    } else {
      await svc.from("ai_usage").insert({
        organisation_id: site.organisation_id,
        month,
        total_requests: 1,
        total_tokens: inputTokens + outputTokens,
        total_cost: cost_estimate,
      });
    }

    return new Response(
      JSON.stringify({ narrative, generated_at: generatedAt, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-margin-alert error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
