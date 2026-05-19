import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.96.0";
import { assertSiteAccess } from "../_shared/siteAuthz.ts";
import { assertIntelligenceTier } from "../_shared/aiTierGuard.ts";

/**
 * suggest-rota
 * POST { site_id, week_start: 'YYYY-MM-DD' (Monday), force?: boolean }
 * Returns { suggestions, gaps, warnings, summary, generated_at, cached }
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
function dowMonFirst(iso: string): number {
  // 0 = Monday … 6 = Sunday
  const d = new Date(`${iso}T00:00:00.000Z`).getUTCDay(); // 0 Sun..6 Sat
  return (d + 6) % 7;
}
function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = eh + (em || 0) / 60 - (sh + (sm || 0) / 60);
  if (h <= 0) h += 24;
  return h;
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

    const body = await req.json().catch(() => ({}));
    const { site_id, week_start, force } = body as {
      site_id?: string;
      week_start?: string;
      force?: boolean;
    };
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

    const authzFail = await assertSiteAccess({
      authUserId: claimsData.claims.sub as string,
      siteId: site_id,
      svc,
      corsHeaders,
    });
    if (authzFail) return authzFail;

    const aiFail = await assertIntelligenceTier({ siteId: site_id, svc, corsHeaders });
    if (aiFail) return aiFail;


    // ---- Cache check ----
    const nowIso = new Date().toISOString();
    if (force) {
      // invalidate any existing cached row for this week so a new one can be inserted
      await svc
        .from("ai_insights")
        .delete()
        .eq("site_id", site_id)
        .eq("insight_type", "rota_suggestion")
        .eq("content->>week_start", week_start);
    } else {
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
      if (cached?.content) {
        const c = cached.content as any;
        return new Response(
          JSON.stringify({
            suggestions: c.suggestions ?? [],
            gaps: c.gaps ?? [],
            warnings: c.warnings ?? [],
            summary: c.summary ?? "",
            generated_at: cached.generated_at,
            cached: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
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
    const eightWeeksAgo = addDays(week_start, -56);
    const eightWeeksAgoIso = `${eightWeeksAgo}T00:00:00.000Z`;
    const weekStartIso = `${week_start}T00:00:00.000Z`;

    // ---- Active staff for the site ----
    const { data: members } = await svc
      .from("memberships")
      .select("user_id, site_role, users:user_id(id, display_name, hourly_rate, status)")
      .eq("site_id", site_id)
      .eq("active", true);
    const staff = (members ?? [])
      .map((m: any) => ({
        id: m.users?.id as string,
        name: (m.users?.display_name as string) ?? "Unknown",
        site_role: m.site_role as string,
        hourly_rate: m.users?.hourly_rate ? Number(m.users.hourly_rate) : null,
      }))
      .filter((s) => s.id && (members!.find((mm: any) => mm.users?.id === s.id)!.users as any)?.status === "active");

    // ---- Availability rows ----
    const { data: availabilityRows } = await svc
      .from("staff_availability")
      .select("user_id, day_of_week, start_time, end_time, is_available")
      .eq("site_id", site_id);
    const availMap: Record<string, any[]> = {};
    (availabilityRows ?? []).forEach((a: any) => {
      (availMap[a.user_id] ||= []).push(a);
    });

    // ---- 8 weeks of historical assignments (for inference + patterns) ----
    const { data: history } = await svc
      .from("rota_assignments")
      .select("id, user_id, shift_date, start_time, end_time, position")
      .eq("site_id", site_id)
      .gte("shift_date", eightWeeksAgo)
      .lt("shift_date", week_start)
      .is("cancelled_at", null);

    // Build per-staff profile
    const byUser: Record<string, any[]> = {};
    (history ?? []).forEach((a: any) => {
      (byUser[a.user_id] ||= []).push(a);
    });

    // Site patterns: shifts per date
    const shiftsPerDate: Record<string, number> = {};
    const shiftsPerDow: Record<number, number[]> = {};
    (history ?? []).forEach((a: any) => {
      shiftsPerDate[a.shift_date] = (shiftsPerDate[a.shift_date] ?? 0) + 1;
      const dow = dowMonFirst(a.shift_date);
      (shiftsPerDow[dow] ||= []).push(1);
    });
    // group dates by week to compute per-day averages and per-staff weekly hours
    const weeklyHoursByUser: Record<string, Record<string, number>> = {};
    (history ?? []).forEach((a: any) => {
      const isoDate = a.shift_date as string;
      const d = new Date(`${isoDate}T00:00:00.000Z`);
      // Monday of that week
      const dow = (d.getUTCDay() + 6) % 7;
      d.setUTCDate(d.getUTCDate() - dow);
      const wkKey = ymd(d);
      const hrs = hoursBetween(a.start_time, a.end_time);
      (weeklyHoursByUser[a.user_id] ||= {});
      weeklyHoursByUser[a.user_id][wkKey] = (weeklyHoursByUser[a.user_id][wkKey] ?? 0) + hrs;
    });

    // typical_staff_count per day-of-week (avg over distinct dates)
    const datesByDow: Record<number, Set<string>> = {};
    Object.keys(shiftsPerDate).forEach((d) => {
      const dow = dowMonFirst(d);
      (datesByDow[dow] ||= new Set()).add(d);
    });
    const typical_staff_count_per_day: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const dates = [...(datesByDow[i] ?? [])];
      const total = dates.reduce((s, d) => s + (shiftsPerDate[d] ?? 0), 0);
      typical_staff_count_per_day[DAY_NAMES[i]] =
        dates.length > 0 ? Math.round((total / dates.length) * 10) / 10 : 0;
    }
    const dowRanked = [...Array(7).keys()]
      .map((i) => ({ day: DAY_NAMES[i], avg: typical_staff_count_per_day[DAY_NAMES[i]] }))
      .sort((a, b) => b.avg - a.avg);
    const busiest_days = dowRanked.slice(0, 3).map((x) => x.day);
    const quietest_days = dowRanked.slice(-3).reverse().map((x) => x.day);

    // operating_days: any DOW with > 0 shifts in history
    const operating_days = DAY_NAMES.filter((d, i) => (datesByDow[i]?.size ?? 0) > 0);

    // ---- Build staff profiles ----
    const staff_profiles = staff.map((s) => {
      const myShifts = byUser[s.id] ?? [];
      const dowSet = new Set<number>();
      const startTimes: string[] = [];
      const endTimes: string[] = [];
      myShifts.forEach((sh: any) => {
        dowSet.add(dowMonFirst(sh.shift_date));
        startTimes.push(sh.start_time);
        endTimes.push(sh.end_time);
      });
      const formalAvail = availMap[s.id] ?? [];
      const formalAvailDays = formalAvail
        .filter((a) => a.is_available)
        .map((a) => DAY_NAMES[a.day_of_week === 0 ? 6 : a.day_of_week - 1]); // Sun=0 in DB → Mon-first
      const availability_days =
        formalAvailDays.length > 0
          ? Array.from(new Set(formalAvailDays))
          : Array.from(dowSet).sort().map((i) => DAY_NAMES[i]);

      const mode = (arr: string[]) => {
        if (!arr.length) return null;
        const counts: Record<string, number> = {};
        arr.forEach((v) => (counts[v] = (counts[v] ?? 0) + 1));
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      };

      const weekHours = Object.values(weeklyHoursByUser[s.id] ?? {});
      const avg_weekly_hours = weekHours.length
        ? Math.round((weekHours.reduce((a, b) => a + b, 0) / weekHours.length) * 10) / 10
        : 0;
      const max_weekly_hours = weekHours.length ? Math.round(Math.max(...weekHours) * 10) / 10 : 0;

      // Position: use most common position from history, else null
      const positions = myShifts.map((sh: any) => sh.position).filter(Boolean) as string[];
      const role = mode(positions);

      return {
        id: s.id,
        name: s.name,
        role: role ?? s.site_role,
        site_role: s.site_role,
        hourly_rate: s.hourly_rate,
        availability_days,
        usual_start_time: mode(startTimes),
        usual_end_time: mode(endTimes),
        avg_weekly_hours,
        max_weekly_hours,
      };
    });

    // ---- Approved holidays overlapping requested week ----
    const { data: holidays } = await svc
      .from("holiday_requests")
      .select("user_id, start_date, end_date, users:user_id(display_name)")
      .eq("site_id", site_id)
      .eq("status", "approved")
      .lte("start_date", weekEnd)
      .gte("end_date", week_start);

    const holidaysByUser: Record<string, string[]> = {};
    (holidays ?? []).forEach((h: any) => {
      const dates: string[] = [];
      let cur = h.start_date as string;
      while (cur <= h.end_date) {
        if (cur >= week_start && cur <= weekEnd) dates.push(cur);
        cur = addDays(cur, 1);
      }
      (holidaysByUser[h.user_id] ||= []).push(...dates);
    });

    // ---- Existing shifts already on requested week ----
    const { data: existing } = await svc
      .from("rota_assignments")
      .select("id, user_id, shift_date, start_time, end_time, position, published_at, users:user_id(display_name)")
      .eq("site_id", site_id)
      .gte("shift_date", week_start)
      .lte("shift_date", weekEnd)
      .is("cancelled_at", null);

    const existing_shifts = (existing ?? []).map((s: any) => ({
      id: s.id,
      staff_name: s.users?.display_name ?? "Unknown",
      staff_id: s.user_id,
      day: DAY_NAMES[dowMonFirst(s.shift_date)],
      date: s.shift_date,
      start_time: (s.start_time as string).slice(0, 5),
      end_time: (s.end_time as string).slice(0, 5),
      position: s.position,
      acceptance: s.published_at ? "published" : "unpublished",
    }));

    // ---- Last shift end before this week per user (for 11h rest gap into Monday) ----
    const last_shift_end_by_user: Record<string, string> = {};
    Object.entries(byUser).forEach(([uid, arr]) => {
      const sorted = [...arr].sort((a: any, b: any) =>
        a.shift_date < b.shift_date ? 1 : a.shift_date > b.shift_date ? -1 : a.end_time < b.end_time ? 1 : -1,
      );
      const last = sorted[0];
      if (last) last_shift_end_by_user[uid] = `${last.shift_date}T${(last.end_time as string).slice(0, 5)}:00`;
    });

    // Attach holidays & last_shift_end to profiles
    const profiles_final = staff_profiles.map((p) => ({
      ...p,
      approved_holidays: holidaysByUser[p.id] ?? [],
      last_shift_end: last_shift_end_by_user[p.id] ?? null,
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
      staff_profiles: profiles_final,
      existing_shifts,
      site_patterns: {
        typical_staff_count_per_day,
        busiest_days,
        quietest_days,
      },
      operating_days,
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
      `You are an expert hospitality operations manager creating next week's shift rota for a UK independent food business. ` +
      `You must create an optimal rota based on the data provided. Follow these rules strictly. ` +
      `Working Time Directive: no staff member exceeds 48 hours per week. ` +
      `Rest periods: minimum 11 hours between the end of one shift and the start of the next for each person, including the gap between their last shift of the previous week (last_shift_end) and their first shift of this week. ` +
      `Availability: only schedule staff on days and times that match their availability profile. If a staff member has never worked a Sunday in the last 8 weeks, do not schedule them on Sunday unless no alternative exists. ` +
      `Holidays: never schedule staff who have approved holiday on that date. ` +
      `Existing shifts: the manager has already added some shifts (existing_shifts). Do not duplicate or replace these. Your job is to fill the gaps around them. Count their hours toward each staff member's weekly total. ` +
      `Fair distribution: distribute hours fairly across the team relative to their typical hours (avg_weekly_hours). Do not give one person 40 hours and another 8 unless their profiles indicate this is normal. ` +
      `Skills matching: match staff to positions based on their role where possible. ` +
      `Coverage: ensure every operating day has adequate coverage based on historical patterns. If Saturdays typically have 4 staff (typical_staff_count_per_day), suggest 4. ` +
      `Return your response as a JSON object with this exact structure: ` +
      `{"suggestions":[{"day":string,"date":string,"staff_name":string,"staff_id":string,"start_time":"HH:MM","end_time":"HH:MM","position":string,"reason":string}],` +
      `"gaps":[{"day":string,"date":string,"start_time":string,"end_time":string,"position":string,"reason":string}],` +
      `"warnings":[{"type":"overtime_risk"|"insufficient_rest"|"understaffed"|"unconfirmed_shift","message":string,"staff_name":string|null,"day":string|null}],` +
      `"summary":string}. ` +
      `Only return the JSON object, no other text.\n\n` +
      JSON.stringify(context);

    let raw = "";
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 3000,
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

    // Parse JSON object
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first !== -1 && last > first) {
        try {
          parsed = JSON.parse(raw.slice(first, last + 1));
        } catch (e) {
          console.error("Failed to extract JSON:", e);
        }
      }
    }
    if (!parsed || typeof parsed !== "object") {
      return new Response(
        JSON.stringify({ error: "AI returned an unparseable response. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const gaps = Array.isArray(parsed.gaps) ? parsed.gaps : [];
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    const summary = typeof parsed.summary === "string" ? parsed.summary : "";

    const cost_estimate = (inputTokens * 1.0) / 1_000_000 + (outputTokens * 5.0) / 1_000_000;
    const generatedAt = new Date().toISOString();
    const validUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const { error: insErr } = await svc.from("ai_insights").insert({
      site_id: site.id,
      organisation_id: site.organisation_id,
      insight_type: "rota_suggestion",
      content: { week_start, context, suggestions, gaps, warnings, summary },
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
      JSON.stringify({
        suggestions,
        gaps,
        warnings,
        summary,
        generated_at: generatedAt,
        cached: false,
      }),
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
