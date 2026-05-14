import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.49.13";

/**
 * detect-equipment-drift
 * POST { site_id: string }
 * Returns { alerts: [{ unit_name, narrative }], generated_at, cached }
 */

interface DriftUnit {
  unit_name: string;
  recent_avg: number;
  previous_avg: number;
  max_temp: number;
  min_temp: number;
  direction: "up" | "down";
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

    const { site_id } = await req.json();
    if (!site_id || typeof site_id !== "string") {
      return new Response(JSON.stringify({ error: "site_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- Cache check ----
    const nowIso = new Date().toISOString();
    const { data: cached } = await svc
      .from("ai_insights")
      .select("content, narrative, generated_at, valid_until")
      .eq("site_id", site_id)
      .eq("insight_type", "equipment_alert")
      .gt("valid_until", nowIso)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      const cachedAlerts = (cached.content as any)?.alerts ?? [];
      return new Response(
        JSON.stringify({
          alerts: cachedAlerts,
          generated_at: cached.generated_at,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Site lookup ----
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

    const today = new Date();
    const d7 = new Date(today); d7.setDate(d7.getDate() - 7);
    const d14 = new Date(today); d14.setDate(d14.getDate() - 14);
    const validUntil = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const generatedAt = new Date().toISOString();

    // ---- Drift detection ----
    const { data: units } = await svc
      .from("temp_units")
      .select("id, name, min_temp, max_temp")
      .eq("site_id", site_id)
      .eq("active", true);

    const drifts: DriftUnit[] = [];
    for (const u of units ?? []) {
      const { data: rows } = await svc
        .from("temp_logs")
        .select("value, logged_at")
        .eq("unit_id", u.id)
        .gte("logged_at", d14.toISOString())
        .lte("logged_at", today.toISOString());
      const recent = (rows ?? []).filter((l: any) => new Date(l.logged_at) >= d7);
      const prev = (rows ?? []).filter((l: any) => new Date(l.logged_at) < d7);
      if (recent.length === 0 || prev.length === 0) continue;
      const avg = (arr: any[]) =>
        arr.reduce((s, l) => s + Number(l.value), 0) / arr.length;
      const recentAvg = avg(recent);
      const prevAvg = avg(prev);
      const maxT = Number(u.max_temp);
      const minT = Number(u.min_temp);

      // Upward drift toward max
      if (
        !isNaN(maxT) &&
        recentAvg > prevAvg + 0.5 &&
        maxT - recentAvg <= (maxT - prevAvg) * 0.2
      ) {
        drifts.push({
          unit_name: u.name,
          recent_avg: Number(recentAvg.toFixed(2)),
          previous_avg: Number(prevAvg.toFixed(2)),
          max_temp: maxT,
          min_temp: minT,
          direction: "up",
        });
        continue;
      }
      // Downward drift toward min
      if (
        !isNaN(minT) &&
        recentAvg < prevAvg - 0.5 &&
        recentAvg - minT <= (prevAvg - minT) * 0.2
      ) {
        drifts.push({
          unit_name: u.name,
          recent_avg: Number(recentAvg.toFixed(2)),
          previous_avg: Number(prevAvg.toFixed(2)),
          max_temp: maxT,
          min_temp: minT,
          direction: "down",
        });
      }
    }

    // ---- No drift: cache empty result, skip AI ----
    if (drifts.length === 0) {
      await svc.from("ai_insights").insert({
        site_id: site.id,
        organisation_id: site.organisation_id,
        insight_type: "equipment_alert",
        content: { alerts: [] },
        narrative: null,
        generated_at: generatedAt,
        valid_until: validUntil,
        model_used: null,
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_estimate: 0,
      });
      return new Response(
        JSON.stringify({ alerts: [], generated_at: generatedAt, cached: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Anthropic call ----
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const anthropic = new Anthropic({ apiKey });

    const userPrompt = `You are a food safety equipment specialist for a UK bakery. Based on the temperature trend data below, write a 2-3 sentence alert for each flagged unit. Explain the risk in plain English and recommend a specific action. Be concise and practical.\n\n${JSON.stringify(drifts)}`;

    let narrative = "";
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20250415",
        max_tokens: 400,
        temperature: 0.3,
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

    const alerts = drifts.map((d) => ({
      unit_name: d.unit_name,
      narrative,
    }));

    await svc.from("ai_insights").insert({
      site_id: site.id,
      organisation_id: site.organisation_id,
      insight_type: "equipment_alert",
      content: { alerts, drifts },
      narrative,
      generated_at: generatedAt,
      valid_until: validUntil,
      model_used: "claude-haiku-4-5",
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      cost_estimate,
    });

    // ---- Update ai_usage ----
    const month = new Date().toISOString().slice(0, 7);
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
      JSON.stringify({ alerts, generated_at: generatedAt, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("detect-equipment-drift error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
