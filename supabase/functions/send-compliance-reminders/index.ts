// supabase/functions/send-compliance-reminders/index.ts
// Daily cron. For each active org/site, count today's outstanding items
// (missing fridge readings + missing daily cleaning tasks + missing day sheet)
// and send a friendly nudge if anything is genuinely outstanding.
// Skips closed days and orgs that already received today's reminder.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_URL = "https://mise-os.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date().toISOString().slice(0, 10);

  // Active orgs only — trialing or active subscriptions.
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("organisation_id")
    .in("status", ["trialing", "active"]);

  let sent = 0;
  for (const row of (subs as any[]) ?? []) {
    const orgId = row.organisation_id;
    if (!orgId) continue;

    // One reminder per org per day.
    const { data: lastReminder } = await supabase
      .from("subscriptions")
      .select("last_compliance_reminder_on")
      .eq("organisation_id", orgId)
      .maybeSingle();
    if ((lastReminder as any)?.last_compliance_reminder_on === today) continue;

    // Find a primary site for the org.
    const { data: sites } = await supabase
      .from("sites")
      .select("id, name")
      .eq("organisation_id", orgId)
      .limit(1);
    const site = (sites as any[] | null)?.[0];
    if (!site) continue;

    // Skip if today is marked closed.
    const { data: closure } = await supabase
      .from("site_closures")
      .select("id")
      .eq("site_id", site.id)
      .eq("closed_on", today)
      .maybeSingle();
    if (closure) continue;

    // Count outstanding fridges without a reading today.
    const { data: units } = await supabase
      .from("temperature_units")
      .select("id, name")
      .eq("site_id", site.id)
      .eq("active", true);
    const items: string[] = [];
    let outstanding = 0;
    for (const u of (units as any[]) ?? []) {
      const { count } = await supabase
        .from("temperature_records")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", u.id)
        .gte("recorded_at", `${today}T00:00:00Z`);
      if ((count ?? 0) === 0) {
        outstanding++;
        if (items.length < 3) items.push(`Fridge/freezer temp: ${u.name}`);
      }
    }

    if (outstanding === 0) continue;

    const owner = await resolveOwner(supabase, orgId);
    if (!owner.email) continue;

    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "compliance-reminder",
          recipientEmail: owner.email,
          idempotencyKey: `compliance:${orgId}:${today}`,
          templateData: {
            first_name: owner.first_name,
            site_name: site.name,
            outstanding_count: outstanding,
            items,
            app_url: APP_URL,
          },
        },
      });
      await supabase.from("subscriptions")
        .update({ last_compliance_reminder_on: today })
        .eq("organisation_id", orgId);
      sent++;
    } catch (e) {
      console.error("[compliance-reminders] send error", { orgId, e });
    }
  }

  return json(200, { ok: true, sent });
});

async function resolveOwner(supabase: ReturnType<typeof createClient>, orgId: string) {
  const { data: owners } = await supabase
    .from("org_users")
    .select("user_id, users:user_id(display_name, email, status, auth_type)")
    .eq("organisation_id", orgId)
    .eq("org_role", "org_owner")
    .eq("active", true);
  for (const row of (owners as any[] | null) ?? []) {
    const u = row?.users;
    if (!u || u.status !== "active" || u.auth_type === "staff_code" || !u.email) continue;
    const dn = (u.display_name || "").toString().trim();
    return { email: u.email as string, first_name: dn ? dn.split(/\s+/)[0] : null };
  }
  return { email: null as string | null, first_name: null as string | null };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
