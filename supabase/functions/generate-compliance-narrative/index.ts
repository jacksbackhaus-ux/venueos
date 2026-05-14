import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.49.13";

/**
 * generate-compliance-narrative
 * POST { site_id: string, date_range: '7days'|'4weeks'|'3months'|'12months' }
 * Returns { narrative, generated_at, cached }
 */

const RANGE_LABELS: Record<string, { days: number; label: string }> = {
  "7days": { days: 7, label: "Last 7 days" },
  "4weeks": { days: 28, label: "Last 4 weeks" },
  "3months": { days: 90, label: "Last 3 months" },
  "12months": { days: 365, label: "Last 12 months" },
};

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

    const { site_id, date_range } = await req.json();
    if (!site_id || typeof site_id !== "string") {
      return new Response(JSON.stringify({ error: "site_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rangeMeta = RANGE_LABELS[date_range];
    if (!rangeMeta) {
      return new Response(JSON.stringify({ error: "Invalid date_range" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- Cache check: must match date_range stored in content ----
    const nowIso = new Date().toISOString();
    const { data: cachedRows } = await svc
      .from("ai_insights")
      .select("narrative, generated_at, content")
      .eq("site_id", site_id)
      .eq("insight_type", "compliance_narrative")
      .gt("valid_until", nowIso)
      .order("generated_at", { ascending: false })
      .limit(10);

    const cached = (cachedRows ?? []).find(
      (r: any) => r.content?.date_range === date_range,
    );
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

    const now = new Date();
    const start = new Date(now.getTime() - rangeMeta.days * 86400000);
    const startIso = start.toISOString();
    const endIso = now.toISOString();
    const startDate = startIso.slice(0, 10);
    const endDate = endIso.slice(0, 10);

    // ---- Temperature ----
    const { data: tempLogs } = await svc
      .from("temp_logs")
      .select("pass")
      .eq("site_id", site_id)
      .gte("logged_at", startIso)
      .lte("logged_at", endIso);
    const tempTotal = tempLogs?.length ?? 0;
    const tempFails = tempLogs?.filter((l: any) => l.pass === false).length ?? 0;
    const tempPassPct = tempTotal > 0 ? Math.round(((tempTotal - tempFails) / tempTotal) * 100) : null;

    // ---- Cleaning (daily-task logs) ----
    const { data: dailyTaskRows } = await svc
      .from("cleaning_tasks")
      .select("id")
      .eq("site_id", site_id)
      .eq("frequency", "daily");
    const dailyTaskIds = (dailyTaskRows ?? []).map((r: any) => r.id);
    let cleaningTotal = 0;
    let cleaningDone = 0;
    if (dailyTaskIds.length > 0) {
      const { data: cleaningLogs } = await svc
        .from("cleaning_logs")
        .select("done")
        .eq("site_id", site_id)
        .in("task_id", dailyTaskIds)
        .gte("log_date", startDate)
        .lte("log_date", endDate);
      cleaningTotal = cleaningLogs?.length ?? 0;
      cleaningDone = cleaningLogs?.filter((c: any) => c.done).length ?? 0;
    }
    const cleaningPct = cleaningTotal > 0 ? Math.round((cleaningDone / cleaningTotal) * 100) : null;

    // ---- Day sheets ----
    const { data: daySheets } = await svc
      .from("day_sheets")
      .select("signed_off")
      .eq("site_id", site_id)
      .gte("sheet_date", startDate)
      .lte("sheet_date", endDate);
    const daySheetTotal = daySheets?.length ?? 0;
    const daySheetSigned = daySheets?.filter((d: any) => d.signed_off).length ?? 0;
    const daySheetSignPct = daySheetTotal > 0 ? Math.round((daySheetSigned / daySheetTotal) * 100) : null;

    // ---- Incidents ----
    const { data: incidents } = await svc
      .from("incidents")
      .select("status, type")
      .eq("site_id", site_id)
      .gte("reported_at", startIso)
      .lte("reported_at", endIso);
    const incidentsTotal = incidents?.length ?? 0;
    const incidentsOpen = incidents?.filter((i: any) => i.status === "open").length ?? 0;
    const incidentsByType: Record<string, number> = {};
    for (const i of incidents ?? []) {
      const t = (i as any).type || "unknown";
      incidentsByType[t] = (incidentsByType[t] ?? 0) + 1;
    }

    // ---- Deliveries ----
    const { data: deliveries } = await svc
      .from("delivery_logs")
      .select("accepted")
      .eq("site_id", site_id)
      .gte("logged_at", startIso)
      .lte("logged_at", endIso);
    const deliveriesTotal = deliveries?.length ?? 0;
    const deliveriesAccepted = deliveries?.filter((d: any) => d.accepted).length ?? 0;
    const deliveryAcceptPct = deliveriesTotal > 0 ? Math.round((deliveriesAccepted / deliveriesTotal) * 100) : null;

    // ---- Waste ----
    const { data: waste } = await svc
      .from("waste_logs")
      .select("estimated_cost")
      .eq("site_id", site_id)
      .gte("shift_date", startDate)
      .lte("shift_date", endDate);
    const wasteCost = (waste ?? []).reduce(
      (sum, w: any) => sum + (Number(w.estimated_cost) || 0),
      0,
    );

    // ---- Open pest / maintenance ----
    const { count: openPest } = await svc
      .from("pest_logs")
      .select("id", { count: "exact", head: true })
      .eq("site_id", site_id)
      .eq("resolved", false);
    const { count: openMaint } = await svc
      .from("maintenance_logs")
      .select("id", { count: "exact", head: true })
      .eq("site_id", site_id)
      .neq("status", "resolved");

    // ---- Closed days ----
    const { data: closed } = await svc
      .from("closed_days")
      .select("id")
      .eq("site_id", site_id)
      .gte("closed_date", startDate)
      .lte("closed_date", endDate);
    const closedDaysCount = closed?.length ?? 0;

    const context: Record<string, any> = {
      date_range,
      date_range_label: rangeMeta.label,
      site_name: site.name,
      period_start: startDate,
      period_end: endDate,
      temperature: { total_logs: tempTotal, breaches: tempFails, pass_rate_pct: tempPassPct },
      cleaning: { total_expected: cleaningTotal, completed: cleaningDone, completion_pct: cleaningPct },
      day_sheets: { total: daySheetTotal, signed_off: daySheetSigned, sign_off_pct: daySheetSignPct },
      incidents: { total: incidentsTotal, open: incidentsOpen, by_type: incidentsByType },
      deliveries: { total: deliveriesTotal, accepted: deliveriesAccepted, acceptance_pct: deliveryAcceptPct },
      waste: { total_cost_gbp: Number(wasteCost.toFixed(2)) },
      open_pest_logs: openPest ?? 0,
      open_maintenance_issues: openMaint ?? 0,
      closed_days_in_period: closedDaysCount,
    };

    // ---- Anthropic ----
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const anthropic = new Anthropic({ apiKey });

    const userPrompt = `You are a UK Environmental Health Officer reviewing a food business's compliance records for the period specified below. Write a professional 3-paragraph assessment. Paragraph 1: Overall compliance and strengths with specific data points. Paragraph 2: Areas of concern with specific numbers and patterns. Paragraph 3: Top 3 recommended actions ranked by priority. Be factual, reference the numbers provided, do not invent data. Write in a professional but accessible tone. This text will be included in a formal EHO inspection pack.\n\n${JSON.stringify(context)}`;

    let narrative = "";
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const resp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20250415",
        max_tokens: 800,
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
    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const generatedAt = new Date().toISOString();

    await svc.from("ai_insights").insert({
      site_id: site.id,
      organisation_id: site.organisation_id,
      insight_type: "compliance_narrative",
      content: context,
      narrative,
      generated_at: generatedAt,
      valid_until: validUntil,
      model_used: "claude-haiku-4-5",
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      cost_estimate,
    });

    // ---- ai_usage ----
    const month = generatedAt.slice(0, 7);
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
    console.error("generate-compliance-narrative error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
