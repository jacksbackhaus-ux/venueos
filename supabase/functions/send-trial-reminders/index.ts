// supabase/functions/send-trial-reminders/index.ts
// Runs daily (pg_cron). Sends a "trial ends in 3 days" email to org owners whose
// subscription is trialing and whose trial_end is roughly 3 days away. Idempotent:
// records trial_reminder_sent_at on the subscriptions row so we never double-send.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_URL = "https://mise-os.app";
const BILLING_URL = `${APP_URL}/settings?tab=billing`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  // Window: between 2.5 and 3.5 days from now, so a daily cron always catches each org once.
  const lower = new Date(now.getTime() + 2.5 * 86400 * 1000).toISOString();
  const upper = new Date(now.getTime() + 3.5 * 86400 * 1000).toISOString();

  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("organisation_id, trial_end, trial_reminder_sent_at, status")
    .eq("status", "trialing")
    .is("trial_reminder_sent_at", null)
    .gte("trial_end", lower)
    .lte("trial_end", upper);

  if (error) {
    console.error("[trial-reminders] query error", error);
    return json(500, { error: "query failed" });
  }

  let sent = 0;
  for (const sub of (subs as any[]) ?? []) {
    const orgId = sub.organisation_id;
    if (!orgId) continue;
    const owner = await resolveOwner(supabase, orgId);
    if (!owner.email) continue;
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "trial-reminder",
          recipientEmail: owner.email,
          idempotencyKey: `trial-reminder:${orgId}:${sub.trial_end}`,
          templateData: {
            first_name: owner.first_name,
            trial_end_date: sub.trial_end,
            billing_url: BILLING_URL,
          },
        },
      });
      await supabase.from("subscriptions")
        .update({ trial_reminder_sent_at: new Date().toISOString() })
        .eq("organisation_id", orgId);
      sent++;
    } catch (e) {
      console.error("[trial-reminders] send error", { orgId, e });
    }
  }

  return json(200, { ok: true, considered: subs?.length ?? 0, sent });
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
