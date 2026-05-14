import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.96.0";

/**
 * suggest-rota
 * POST { site_id: string, week_start: 'YYYY-MM-DD' (Monday) }
 * Returns { suggestions: Day[], generated_at, cached }
 */

const MODEL = "claude-haiku-4-5-20251001";
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
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

    const { site_id, week_start } = await req.json();
    if (!site_id || typeof site_id !== "string" || !week_start || typeof week_start !== "string") {
      return new Response(JSON.stringify({ error: "site_id and week_start required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
      return new Response(JSON.stringify({ error: "week_start must be YYYY-MM-DD" }), {
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
      .eq("insight_type", "rota_suggestion")
      .eq("content->>week_start", week_start)
      .gt("valid_until", nowIso)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.content && (cached.content as any).suggestions) {
      return new Response(
        JSON.stringify({
          suggestions: (cached.content as any).suggestions,
          generated_at: cached.generated_at,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Site ----
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

    const weekEnd = addDays(week_start, 6);
    const fourWeeksAgo = addDays(week_start, -28);
    const fourWeeksAgoStart = `${fourWeeksAgo}T00:00:00.000Z`;
    const weekStartIso = `${week_start}T00:00:00.000Z`;

    // ---- Staff for the site (active memberships) ----
    const { data: members } = await svc
      .from("memberships")
      .select("user_id, site_role, users:user_id(id, display_name, hourly_rate, status)")
      .eq("site_id", site_id)
      .eq("active", true);

    const staff = (members ?? [])
      .map((m: any) => ({
        id: m.users?.id,
        name: m.users?.display_name ?? "Unknown",
        role: m.site_role,
        hourly_rate: m.users?.hourly_rate ? Number(m.users.hourly_rate) : null,
        status: m.users?.status,
      }))
      .filter((s) => s.id && s.status === "active");

    // ---- Availability ----
    const { data: availability } = await svc
      .from("staff_availability")
      .select("user_id, day_of_week, start_time, end_time, is_available")
      .eq("site_id", site_id);

    const availabilityByUser: Record<string, any[]> = {};
    (availability ?? []).forEach((a: any) => {
      (availabilityByUser[a.user_id] ||= []).push({
        day_of_week: a.day_of_week,
        start: a.start_time,
        end: a.end_time,
        available: a.is_available,
      });
    });

    // ---- Historical rota (previous 4 weeks) ----
    const { data: history } = await svc
      .from("rota_assignments")
      .select("user_id, shift_date, start_time, end_time, position, users:user_id(display_name)")
      .eq("site_id", site_id)
      .gte("shift_date", fourWeeksAgo)
      .lt("shift_date", week_start)
      .is("cancelled_at", null);

    // Summarise by day-of-week
    const dayOfWeekStats: Record<string, { staff_count: number[]; shifts: any[] }> = {};
    DAY_NAMES.forEach((d) => (dayOfWeekStats[d] = { staff_count: [], shifts: [] }));
    const byDate: Record<string, any[]> = {};
    (history ?? []).forEach((s: any) => {
      (byDate[s.shift_date] ||= []).push(s);
    });
    Object.entries(byDate).forEach(([date, shifts]) => {
      const d = new Date(`${date}T00:00:00.000Z`).getUTCDay(); // 0 Sun..6 Sat
      const idx = (d + 6) % 7; // Mon-first
      const name = DAY_NAMES[idx];
      dayOfWeekStats[name].staff_count.push(shifts.length);
      shifts.forEach((s: any) => {
        dayOfWeekStats[name].shifts.push({
          staff_name: s.users?.display_name ?? "Unknown",
          start: s.start_time,
          end: s.end_time,
          position: s.position,
        });
      });
    });

    const historical_patterns: Record<string, any> = {};
    DAY_NAMES.forEach((day) => {
      const counts = dayOfWeekStats[day].staff_count;
      const avgStaff = counts.length
        ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10
        : 0;
      // typical shift times: take most common (start,end) pairs per staff
      const seen = new Map<string, number>();
      dayOfWeekStats[day].shifts.forEach((sh: any) => {
        const key = `${sh.staff_name}|${sh.start}-${sh.end}|${sh.position ?? ""}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      });
      const typical = [...seen.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([k, count]) => {
          const [staff_name, range, position] = k.split("|");
          return { staff_name, range, position: position || null, frequency: count };
        });
      historical_patterns[day] = { typical_staff_count: avgStaff, typical_shifts: typical };
    });

    // ---- Timesheets (avg hours/week per staff over last 4 weeks) ----
    const { data: timesheets } = await svc
      .from("timesheet_entries")
      .select("user_id, clock_in, clock_out, break_minutes")
      .eq("site_id", site_id)
      .gte("clock_in", fourWeeksAgoStart)
      .lt("clock_in", weekStartIso);

    const hoursByUser: Record<string, number> = {};
    (timesheets ?? []).forEach((t: any) => {
      if (!t.clock_out) return;
      const ms = new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime();
      const hrs = Math.max(0, ms / 3_600_000 - (t.break_minutes ?? 0) / 60);
      hoursByUser[t.user_id] = (hoursByUser[t.user_id] ?? 0) + hrs;
    });
    const avg_hours_per_week: Record<string, number> = {};
    staff.forEach((s) => {
      const total = hoursByUser[s.id!] ?? 0;
      avg_hours_per_week[s.name] = Math.round((total / 4) * 10) / 10;
    });

    // ---- Approved holidays overlapping requested week ----
    const { data: holidays } = await svc
      .from("holiday_requests")
      .select("user_id, start_date, end_date, users:user_id(display_name)")
      .eq("site_id", site_id)
      .eq("status", "approved")
      .lte("start_date", weekEnd)
      .gte("end_date", week_start);

    const approved_holidays = (holidays ?? []).map((h: any) => ({
      staff_name: h.users?.display_name ?? "Unknown",
      user_id: h.user_id,
      start_date: h.start_date,
      end_date: h.end_date,
    }));

    // Week dates list
    const week_dates = Array.from({ length: 7 }, (_, i) => ({
      day: DAY_NAMES[i],
      date: addDays(week_start, i),
    }));

    const context = {
      site_name: site.name,
      week_start,
      week_dates,
      staff: staff.map((s) => ({ id: s.id, name: s.name, role: s.role, hourly_rate: s.hourly_rate })),
      availability: availabilityByUser,
      approved_holidays,
      historical_patterns,
      avg_hours_per_week_last_4_weeks: avg_hours_per_week,
    };

    // ---- Anthropic ----
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const anthropic = new Anthropic({ apiKey });

    const prompt =
      `You are a hospitality operations manager creating next week's shift rota for a UK independent bakery/café. ` +
      `Based on the data below, suggest a complete weekly rota. For each day Monday to Sunday, suggest which staff members should work and their start and end times. ` +
      `Follow these rules strictly: No staff member should exceed 48 hours per week as per the Working Time Directive. ` +
      `There must be at least 11 hours rest between shifts for each person (no clopens). ` +
      `Distribute hours fairly across the team. ` +
      `Respect any approved holidays — do not schedule staff who are on holiday. ` +
      `Base your suggestions on historical patterns — if the site typically has 3 staff on Saturdays, suggest 3. If a staff member typically works mornings, keep them on mornings. ` +
      `Return your response as a JSON array with this exact structure: ` +
      `[{day: 'Monday', date: '2026-05-18', shifts: [{staff_name: 'Daisy', staff_id: 'uuid', start_time: '07:00', end_time: '15:00', position: 'Baker'}]}]. ` +
      `Only return the JSON array, no other text.\n\n` +
      JSON.stringify(context);

    let raw = "";
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      });
      const block = resp.content[0];
      raw = block && block.type === "text" ? block.text : "";
      inputTokens = resp.usage?.input_tokens ?? 0;
      outputTokens = resp.usage?.output_tokens ?? 0;
    } catch (aiErr) {
      console.error("Anthropic API error:", aiErr);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse JSON array
    let suggestions: any[] | null = null;
    try {
      suggestions = JSON.parse(raw);
    } catch {
      const first = raw.indexOf("[");
      const last = raw.lastIndexOf("]");
      if (first !== -1 && last !== -1 && last > first) {
        try {
          suggestions = JSON.parse(raw.slice(first, last + 1));
        } catch (e) {
          console.error("Failed to extract JSON:", e, raw);
        }
      }
    }
    if (!Array.isArray(suggestions)) {
      return new Response(
        JSON.stringify({ error: "AI returned an unparseable response. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cost_estimate = (inputTokens * 1.0) / 1_000_000 + (outputTokens * 5.0) / 1_000_000;
    const generatedAt = new Date().toISOString();
    const validUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const { error: insErr } = await svc.from("ai_insights").insert({
      site_id: site.id,
      organisation_id: site.organisation_id,
      insight_type: "rota_suggestion",
      content: { week_start, context, suggestions },
      narrative: raw,
      generated_at: generatedAt,
      valid_until: validUntil,
      model_used: MODEL,
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      cost_estimate,
    });
    if (insErr) console.error("ai_insights insert error:", insErr);

    // Update ai_usage
    const month = generatedAt.slice(0, 7);
    const { data: usageRow } = await svc
      .from("ai_usage")
      .select("id, total_requests, total_tokens, total_cost")
      .eq("organisation_id", site.organisation_id)
      .eq("month", month)
      .maybeSingle();
    if (usageRow) {
      await svc.from("ai_usage").update({
        total_requests: (usageRow.total_requests ?? 0) + 1,
        total_tokens: (usageRow.total_tokens ?? 0) + inputTokens + outputTokens,
        total_cost: Number(usageRow.total_cost ?? 0) + cost_estimate,
        updated_at: new Date().toISOString(),
      }).eq("id", usageRow.id);
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
      JSON.stringify({ suggestions, generated_at: generatedAt, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("suggest-rota error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
