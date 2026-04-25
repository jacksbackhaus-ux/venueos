import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhook, type StripeEnv } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * Maps a Stripe price lookup_key to the per-plan boolean flags on subscriptions.
 * Returns null for unknown keys.
 */
function flagsForLookup(lookup: string): { plan: "base" | "compliance" | "business" | "bundle"; cycle: "month" | "year" } | null {
  const map: Record<string, { plan: "base" | "compliance" | "business" | "bundle"; cycle: "month" | "year" }> = {
    venueos_base_monthly:        { plan: "base",       cycle: "month" },
    venueos_base_yearly:         { plan: "base",       cycle: "year"  },
    venueos_compliance_monthly:  { plan: "compliance", cycle: "month" },
    venueos_compliance_yearly:   { plan: "compliance", cycle: "year"  },
    venueos_business_monthly:    { plan: "business",   cycle: "month" },
    venueos_business_yearly:     { plan: "business",   cycle: "year"  },
    venueos_bundle_monthly:      { plan: "bundle",     cycle: "month" },
    venueos_bundle_yearly:       { plan: "bundle",     cycle: "year"  },
  };
  return map[lookup] || null;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const env = (new URL(req.url).searchParams.get("env") || "sandbox") as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("event:", event.type, "env:", env);

    await supabase.from("billing_events").insert({
      event_type: event.type,
      stripe_event_id: event.id,
      payload: event as any,
      organisation_id: (event.data.object as any)?.metadata?.organisation_id || null,
    }).then(() => {}, (e) => console.error("event log fail", e));

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSubscription(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await markCanceled(event.data.object, env);
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

async function upsertSubscription(sub: any, env: StripeEnv) {
  const orgId = sub.metadata?.organisation_id;
  if (!orgId) {
    console.error("no organisation_id in subscription metadata");
    return;
  }

  let base = false, compliance = false, business = false, bundle = false;
  let interval = "month";
  let siteQty = 1;
  for (const item of sub.items?.data || []) {
    const lookup = item.price?.lookup_key || "";
    interval = item.price?.recurring?.interval || interval;
    siteQty = Math.max(siteQty, Number(item.quantity || 1));
    const m = flagsForLookup(lookup);
    if (!m) continue;
    if (m.plan === "base") base = true;
    if (m.plan === "compliance") compliance = true;
    if (m.plan === "business") business = true;
    if (m.plan === "bundle") bundle = true;
  }

  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;

  await supabase.from("subscriptions").upsert({
    organisation_id: orgId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer,
    status: sub.status,
    billing_interval: interval,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    trial_end: trialEnd,
    cancel_at_period_end: sub.cancel_at_period_end || false,
    site_quantity: siteQty,
    base_active: base,
    compliance_active: compliance,
    business_active: business,
    bundle_active: bundle,
    locked_at: null,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organisation_id" });
  // The DB trigger trg_sync_modules_on_sub_change will sync module_activation rows.
}

async function markCanceled(sub: any, env: StripeEnv) {
  // Status -> canceled. The grace period (current_period_end) is preserved on the row.
  // Module flags are turned off so navigation hides modules immediately.
  // Data is RETAINED — never delete logs/records.
  await supabase.from("subscriptions").update({
    status: "canceled",
    base_active: false,
    compliance_active: false,
    business_active: false,
    bundle_active: false,
    locked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", sub.id).eq("environment", env);
}
