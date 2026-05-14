import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.96.0";

/**
 * generate-morning-briefing
 * POST { site_id: string }
 * Returns { narrative, generated_at, cached }
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

    // Auth client (verifies user JWT)
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

    // Service role client for data queries
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- Cache check ----
    const nowIso = new Date().toISOString();
    const { data: cached } = await svc
      .from("ai_insights")
      .select("narrative, generated_at, valid_until")
      .eq("site_id", site_id)
      .eq("insight_type", "morning_briefing")
      .gt("valid_until", nowIso)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.narrative) {
      return new Response(
        JSON.stringify({
          narrative: cached.narrative,
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
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = ymd(today);
    const yStr = ymd(yesterday);

    // Window dates for temp trend
    const d7 = new Date(today); d7.setDate(d7.getDate() - 7);
    const d14 = new Date(today); d14.setDate(d14.getDate() - 14);

    // ---- Closed yesterday? ----
    const { data: closedRow } = await svc
      .from("closed_days")
      .select("id")
      .eq("site_id", site_id)
      .eq("closed_date", yStr)
      .maybeSingle();
    const wasClosed = !!closedRow;

    // ---- Day sheet completion ----
    let day_sheet_pct = 0;
    const { data: ds } = await svc
      .from("day_sheets")
      .select("id")
      .eq("site_id", site_id)
      .eq("sheet_date", yStr)
      .maybeSingle();
    if (ds?.id) {
      const { data: entries } = await svc
        .from("day_sheet_entries")
        .select("done")
        .eq("day_sheet_id", ds.id);
      const total = entries?.length ?? 0;
      const done = entries?.filter((e) => e.done).length ?? 0;
      day_sheet_pct = total > 0 ? Math.round((done / total) * 100) : 0;
    }

    // ---- Temp logs yesterday ----
    const yStart = `${yStr}T00:00:00.000Z`;
    const yEnd = `${yStr}T23:59:59.999Z`;
    const { data: tempLogs } = await svc
      .from("temp_logs")
      .select("pass, log_type, logged_at")
      .eq("site_id", site_id)
      .gte("logged_at", yStart)
      .lte("logged_at", yEnd);
    const temp_total = tempLogs?.length ?? 0;
    const temp_breaches = tempLogs?.filter((l) => l.pass === false).length ?? 0;
    const late_pm_checks = (tempLogs ?? []).some((l) => {
      if (l.log_type !== "pm") return false;
      const h = new Date(l.logged_at as string).getUTCHours();
      return h >= 17;
    });

    // ---- Cleaning ----
    const { data: cleaningTasks } = await svc
      .from("cleaning_tasks")
      .select("id")
      .eq("site_id", site_id)
      .eq("active", true)
      .eq("frequency", "daily");
    const totalDaily = cleaningTasks?.length ?? 0;
    const { data: cleaningLogs } = await svc
      .from("cleaning_logs")
      .select("done")
      .eq("site_id", site_id)
      .eq("log_date", yStr);
    const cleaningDone = cleaningLogs?.filter((c) => c.done).length ?? 0;
    const cleaning_pct = totalDaily > 0 ? Math.round((cleaningDone / totalDaily) * 100) : 0;

    // ---- Today's shifts ----
    const { data: shifts } = await svc
      .from("rota_assignments")
      .select("start_time, end_time, position, user_id, users:user_id(display_name)")
      .eq("site_id", site_id)
      .eq("shift_date", todayStr)
      .is("cancelled_at", null);
    const todays_shifts = (shifts ?? []).map((s: any) => ({
      name: s.users?.display_name ?? "Unknown",
      start: s.start_time,
      end: s.end_time,
      position: s.position,
    }));

    // ---- Open incidents ----
    const { count: openIncidents } = await svc
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("site_id", site_id)
      .eq("status", "open");

    // ---- Yesterday waste cost ----
    const { data: waste } = await svc
      .from("waste_logs")
      .select("estimated_cost")
      .eq("site_id", site_id)
      .eq("shift_date", yStr);
    const yesterday_waste_cost = (waste ?? []).reduce(
      (sum, w: any) => sum + (Number(w.estimated_cost) || 0),
      0,
    );

    // ---- Temp trends per unit ----
    const { data: units } = await svc
      .from("temp_units")
      .select("id, name, max_temp")
      .eq("site_id", site_id)
      .eq("active", true);
    const temp_trends: any[] = [];
    for (const u of units ?? []) {
      const { data: recentLogs } = await svc
        .from("temp_logs")
        .select("value, logged_at")
        .eq("unit_id", u.id)
        .gte("logged_at", d14.toISOString())
        .lte("logged_at", today.toISOString());
      const recent = (recentLogs ?? []).filter(
        (l: any) => new Date(l.logged_at) >= d7,
      );
      const prev = (recentLogs ?? []).filter(
        (l: any) => new Date(l.logged_at) < d7,
      );
      const avg = (arr: any[]) =>
        arr.length ? arr.reduce((s, l) => s + Number(l.value), 0) / arr.length : null;
      const avg_7d = avg(recent);
      const avg_prev_7d = avg(prev);
      const maxT = Number(u.max_temp);
      const trending_up =
        avg_7d !== null &&
        avg_prev_7d !== null &&
        avg_7d > avg_prev_7d &&
        !isNaN(maxT) &&
        maxT - avg_7d <= 1;
      if (trending_up) {
        temp_trends.push({
          name: u.name,
          avg_7d: avg_7d !== null ? Number(avg_7d.toFixed(2)) : null,
          avg_prev_7d: avg_prev_7d !== null ? Number(avg_prev_7d.toFixed(2)) : null,
          max_temp: maxT,
          trending_up: true,
        });
      }
    }

    const context = {
      site_name: site.name,
      today: todayStr,
      yesterday_was_closed: wasClosed,
      yesterday: {
        day_sheet_pct,
        temp_total,
        temp_breaches,
        cleaning_pct,
        late_pm_checks,
      },
      todays_shifts,
      open_incidents: openIncidents ?? 0,
      yesterday_waste_cost: Number(yesterday_waste_cost.toFixed(2)),
      temp_trends,
    };

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

    const userPrompt = `You are a food safety operations manager for a UK independent bakery/café called ${site.name}. Write a concise morning briefing (4-6 sentences) for the owner. Be specific — reference actual numbers from the data. Flag compliance risks. Suggest one or two actions for today. Use a warm but professional tone. If the site was closed yesterday, note that compliance tracking was paused. Never invent data that isn't provided.\n\n${JSON.stringify(context)}`;

    let narrative = "";
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
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

    // End of today UTC
    const validUntil = new Date(`${todayStr}T23:59:59.000Z`);
    const generatedAt = new Date().toISOString();

    const { error: insErr } = await svc.from("ai_insights").insert({
      site_id: site.id,
      organisation_id: site.organisation_id,
      insight_type: "morning_briefing",
      content: context,
      narrative,
      generated_at: generatedAt,
      valid_until: validUntil.toISOString(),
      model_used: "claude-haiku-4-5-20251001",
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      cost_estimate,
    });
    if (insErr) console.error("ai_insights insert error:", insErr);

    // ---- Update ai_usage (upsert by org+month) ----
    const month = todayStr.slice(0, 7); // YYYY-MM
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
    console.error("generate-morning-briefing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
