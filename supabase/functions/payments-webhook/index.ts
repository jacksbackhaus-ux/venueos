// supabase/functions/payments-webhook/index.ts
// Routes Stripe webhook events to subscription state changes + branded customer emails.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhook, type StripeEnv } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const APP_URL = "https://mise-os.app";
const BILLING_URL = `${APP_URL}/settings?tab=billing`;
const REACTIVATE_URL = `${APP_URL}/pricing`;

type LegacyPlan = "base" | "compliance" | "business" | "bundle" | "ai";
type TierId = "essentials" | "professional" | "business_tier" | "intelligence";

interface FlagDelta { base?: boolean; compliance?: boolean; business?: boolean; bundle?: boolean; ai?: boolean; }
interface LookupResult { cycle: "month" | "year"; legacyPlan?: LegacyPlan; tier?: TierId; flagDelta?: FlagDelta; }

const LEGACY_MAP: Record<string, { plan: LegacyPlan; cycle: "month" | "year" }> = {
  venueos_base_monthly:        { plan: "base",       cycle: "month" },
  venueos_base_yearly:         { plan: "base",       cycle: "year"  },
  venueos_compliance_monthly:  { plan: "compliance", cycle: "month" },
  venueos_compliance_yearly:   { plan: "compliance", cycle: "year"  },
  venueos_business_monthly:    { plan: "business",   cycle: "month" },
  venueos_business_yearly:     { plan: "business",   cycle: "year"  },
  venueos_bundle_monthly:      { plan: "bundle",     cycle: "month" },
  venueos_bundle_yearly:       { plan: "bundle",     cycle: "year"  },
  venueos_ai_monthly:          { plan: "ai",         cycle: "month" },
  venueos_ai_yearly:           { plan: "ai",         cycle: "year"  },
};

const TIER_MAP: Record<string, { tier: TierId; cycle: "month" | "year"; flagDelta: FlagDelta }> = {
  miseos_haccp_site_monthly:    { tier: "essentials",    cycle: "month", flagDelta: { base: true } },
  miseos_haccp_site_annual:     { tier: "essentials",    cycle: "year",  flagDelta: { base: true } },
  miseos_haccp_user_monthly:    { tier: "essentials",    cycle: "month", flagDelta: {} },
  miseos_haccp_user_annual:     { tier: "essentials",    cycle: "year",  flagDelta: {} },
  miseos_essentials_monthly:    { tier: "essentials",    cycle: "month", flagDelta: { base: true } },
  miseos_essentials_annual:     { tier: "essentials",    cycle: "year",  flagDelta: { base: true } },
  miseos_essentials_yearly:     { tier: "essentials",    cycle: "year",  flagDelta: { base: true } },
  miseos_professional_monthly:  { tier: "professional",  cycle: "month", flagDelta: { base: true, compliance: true } },
  miseos_professional_annual:   { tier: "professional",  cycle: "year",  flagDelta: { base: true, compliance: true } },
  miseos_professional_yearly:   { tier: "professional",  cycle: "year",  flagDelta: { base: true, compliance: true } },
  miseos_business_tier_monthly: { tier: "business_tier", cycle: "month", flagDelta: { bundle: true } },
  miseos_business_tier_annual:  { tier: "business_tier", cycle: "year",  flagDelta: { bundle: true } },
  miseos_business_tier_yearly:  { tier: "business_tier", cycle: "year",  flagDelta: { bundle: true } },
  miseos_intelligence_monthly:  { tier: "intelligence",  cycle: "month", flagDelta: { bundle: true, ai: true } },
  miseos_intelligence_annual:   { tier: "intelligence",  cycle: "year",  flagDelta: { bundle: true, ai: true } },
  miseos_intelligence_yearly:   { tier: "intelligence",  cycle: "year",  flagDelta: { bundle: true, ai: true } },
};

const USER_ADDON_KEYS = new Set(["miseos_haccp_user_monthly", "miseos_haccp_user_annual"]);

function flagsForLookup(lookup: string): LookupResult | null {
  const tier = TIER_MAP[lookup];
  if (tier) return { cycle: tier.cycle, tier: tier.tier, flagDelta: tier.flagDelta };
  const legacy = LEGACY_MAP[lookup];
  if (legacy) return { cycle: legacy.cycle, legacyPlan: legacy.plan };
  return null;
}

// ───── Email helpers ───────────────────────────────────────────────────────

async function resolveOrgOwnerContact(orgId: string): Promise<{ email: string | null; first_name: string | null; organisation_name: string | null }> {
  const [{ data: org }, { data: owners }] = await Promise.all([
    supabase.from("organisations").select("name").eq("id", orgId).maybeSingle(),
    supabase
      .from("org_users")
      .select("user_id, users:user_id(display_name, email, status, auth_type)")
      .eq("organisation_id", orgId)
      .eq("org_role", "org_owner")
      .eq("active", true),
  ]);
  let email: string | null = null;
  let first_name: string | null = null;
  for (const row of (owners as any[] | null) ?? []) {
    const u = row?.users;
    if (!u) continue;
    if (u.status && u.status !== "active") continue;
    if (u.auth_type === "staff_code") continue;
    if (u.email) {
      email = u.email;
      const dn = (u.display_name || "").toString().trim();
      first_name = dn ? dn.split(/\s+/)[0] : null;
      break;
    }
  }
  return { email, first_name, organisation_name: (org as any)?.name ?? null };
}

async function sendBillingEmail(orgId: string, templateName: string, extraData: Record<string, unknown>, idempotencyKey: string) {
  try {
    const owner = await resolveOrgOwnerContact(orgId);
    if (!owner.email) {
      console.log("[billing-email] no owner email", { orgId, templateName });
      return;
    }
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName,
        recipientEmail: owner.email,
        idempotencyKey,
        templateData: {
          first_name: owner.first_name,
          organisation_name: owner.organisation_name,
          ...extraData,
        },
      },
    });
    if (error) console.error("[billing-email] invoke error", { templateName, orgId, error });
  } catch (e) {
    console.error("[billing-email] unexpected", { templateName, orgId, e });
  }
}

function summariseAmount(sub: any): string | null {
  try {
    const item = sub.items?.data?.[0];
    const cents = Number(item?.price?.unit_amount ?? 0);
    const currency = (item?.price?.currency || "gbp").toUpperCase();
    const interval = item?.price?.recurring?.interval || "month";
    if (!cents) return null;
    const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "USD" ? "$" : "";
    return `${symbol}${(cents / 100).toFixed(2)} per ${interval}`;
  } catch { return null; }
}

// ───── Webhook ──────────────────────────────────────────────────────────────

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
        await upsertSubscription(event.data.object, env, event.id);
        break;
      case "customer.subscription.deleted":
        await markCanceled(event.data.object, env, event.id);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object, event.id);
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

async function upsertSubscription(sub: any, env: StripeEnv, eventId: string) {
  const orgId = sub.metadata?.organisation_id;
  if (!orgId) { console.error("no organisation_id in subscription metadata"); return; }

  let interval = "month";
  let siteQty = 1;
  let userQty = 0;
  let tier: TierId | null = null;
  let isLegacyAiOnly = false;
  let legacyFlags = { base: false, compliance: false, business: false, bundle: false, ai: false };

  for (const item of sub.items?.data || []) {
    const lookup = item.price?.lookup_key || "";
    interval = item.price?.recurring?.interval || interval;
    if (!USER_ADDON_KEYS.has(lookup)) {
      siteQty = Math.max(siteQty, Number(item.quantity || 1));
    } else {
      userQty += Number(item.quantity || 0);
    }
    const m = flagsForLookup(lookup);
    if (!m) continue;
    if (m.tier && m.flagDelta) { tier = m.tier; }
    else if (m.legacyPlan) {
      if (m.legacyPlan === "base") { legacyFlags.base = true; tier = tier ?? "essentials"; }
      else if (m.legacyPlan === "compliance") { legacyFlags.compliance = true; tier = (tier === "intelligence" || tier === "business_tier") ? tier : "professional"; }
      else if (m.legacyPlan === "business") { legacyFlags.business = true; tier = tier === "intelligence" ? tier : "business_tier"; }
      else if (m.legacyPlan === "bundle") { legacyFlags.bundle = true; tier = tier === "intelligence" ? tier : "business_tier"; }
      else if (m.legacyPlan === "ai") {
        legacyFlags.ai = true;
        isLegacyAiOnly = !legacyFlags.base && !legacyFlags.compliance && !legacyFlags.business && !legacyFlags.bundle;
      }
    }
  }

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, tier, status, subscription_active_emailed_at")
    .eq("organisation_id", orgId)
    .maybeSingle();

  if (isLegacyAiOnly) {
    if ((existing as any)?.tier === "business_tier") tier = "intelligence";
    else tier = (existing as any)?.tier ?? tier;
  }

  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;

  const billingInterval = interval === "year" ? "annual_upfront" : "monthly_term";
  const startMs = sub.current_period_start ? sub.current_period_start * 1000 : Date.now();
  const termStart = new Date(startMs).toISOString();
  let termEnd: string;
  if (billingInterval === "annual_upfront") {
    termEnd = periodEnd ?? new Date(startMs + 365 * 86400000).toISOString();
  } else {
    const existingTermEnd = (existing as any)?.term_end ? new Date((existing as any).term_end).getTime() : 0;
    const computed = new Date(startMs);
    computed.setUTCMonth(computed.getUTCMonth() + 12);
    termEnd = existingTermEnd > Date.now() ? new Date(existingTermEnd).toISOString() : computed.toISOString();
  }

  await supabase.from("subscriptions").upsert({
    organisation_id: orgId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer,
    status: sub.status,
    billing_interval: billingInterval,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    trial_end: trialEnd,
    term_start: termStart,
    term_end: termEnd,
    cancel_at_period_end: sub.cancel_at_period_end || false,
    site_quantity: siteQty,
    tier: tier,
    locked_at: null,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organisation_id" });

  // Send "subscription active" email when status flips into active and we haven't emailed yet.
  const wasActive = (existing as any)?.status === "active";
  const becameActive = sub.status === "active" && !wasActive;
  const alreadyEmailed = !!(existing as any)?.subscription_active_emailed_at;
  if (becameActive && !alreadyEmailed) {
    await sendBillingEmail(
      orgId,
      "subscription-active",
      {
        sites: siteQty,
        users: userQty,
        amount_summary: summariseAmount(sub),
        billing_url: BILLING_URL,
      },
      `sub-active:${sub.id}`,
    );
    await supabase.from("subscriptions")
      .update({ subscription_active_emailed_at: new Date().toISOString() })
      .eq("organisation_id", orgId);
  }
}

async function markCanceled(sub: any, env: StripeEnv, _eventId: string) {
  await supabase.from("subscriptions").update({
    status: "canceled",
    locked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", sub.id).eq("environment", env);

  const orgId = sub.metadata?.organisation_id;
  if (!orgId) return;
  const endsOn = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  await sendBillingEmail(
    orgId,
    "subscription-canceled",
    { ends_on: endsOn, reactivate_url: REACTIVATE_URL },
    `sub-canceled:${sub.id}`,
  );
}

async function handlePaymentFailed(invoice: any, eventId: string) {
  // Stripe places organisation_id in subscription_data metadata; the invoice itself
  // links back via the subscription id, so look it up.
  const subId = invoice.subscription;
  if (!subId) return;
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("organisation_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  const orgId = (sub as any)?.organisation_id;
  if (!orgId) return;
  await sendBillingEmail(
    orgId,
    "payment-failed",
    { billing_url: BILLING_URL },
    `pay-failed:${invoice.id}`,
  );
}
