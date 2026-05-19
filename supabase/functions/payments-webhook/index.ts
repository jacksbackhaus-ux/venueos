import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhook, type StripeEnv } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type LegacyPlan = "base" | "compliance" | "business" | "bundle" | "ai";
type TierId = "essentials" | "professional" | "business_tier" | "intelligence";

interface FlagDelta {
  base?: boolean; compliance?: boolean; business?: boolean; bundle?: boolean; ai?: boolean;
}

interface LookupResult {
  cycle: "month" | "year";
  legacyPlan?: LegacyPlan;
  tier?: TierId;
  flagDelta?: FlagDelta;
}

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
  miseos_essentials_monthly:    { tier: "essentials",    cycle: "month", flagDelta: { base: true,  compliance: false, business: false, bundle: false } },
  miseos_essentials_annual:     { tier: "essentials",    cycle: "year",  flagDelta: { base: true,  compliance: false, business: false, bundle: false } },
  miseos_essentials_yearly:     { tier: "essentials",    cycle: "year",  flagDelta: { base: true,  compliance: false, business: false, bundle: false } },
  miseos_professional_monthly:  { tier: "professional",  cycle: "month", flagDelta: { base: true,  compliance: true,  business: false, bundle: false } },
  miseos_professional_annual:   { tier: "professional",  cycle: "year",  flagDelta: { base: true,  compliance: true,  business: false, bundle: false } },
  miseos_professional_yearly:   { tier: "professional",  cycle: "year",  flagDelta: { base: true,  compliance: true,  business: false, bundle: false } },
  miseos_business_tier_monthly: { tier: "business_tier", cycle: "month", flagDelta: { base: false, compliance: false, business: false, bundle: true  } },
  miseos_business_tier_annual:  { tier: "business_tier", cycle: "year",  flagDelta: { base: false, compliance: false, business: false, bundle: true  } },
  miseos_business_tier_yearly:  { tier: "business_tier", cycle: "year",  flagDelta: { base: false, compliance: false, business: false, bundle: true  } },
  miseos_intelligence_monthly:  { tier: "intelligence",  cycle: "month", flagDelta: { base: false, compliance: false, business: false, bundle: true, ai: true } },
  miseos_intelligence_annual:   { tier: "intelligence",  cycle: "year",  flagDelta: { base: false, compliance: false, business: false, bundle: true, ai: true } },
  miseos_intelligence_yearly:   { tier: "intelligence",  cycle: "year",  flagDelta: { base: false, compliance: false, business: false, bundle: true, ai: true } },
};

function flagsForLookup(lookup: string): LookupResult | null {
  const tier = TIER_MAP[lookup];
  if (tier) return { cycle: tier.cycle, tier: tier.tier, flagDelta: tier.flagDelta };
  const legacy = LEGACY_MAP[lookup];
  if (legacy) return { cycle: legacy.cycle, legacyPlan: legacy.plan };
  return null;
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

  let interval = "month";
  let siteQty = 1;
  let tier: TierId | null = null;
  let isLegacyAiOnly = false;
  let legacyFlags: { base: boolean; compliance: boolean; business: boolean; bundle: boolean; ai: boolean } = {
    base: false, compliance: false, business: false, bundle: false, ai: false,
  };

  for (const item of sub.items?.data || []) {
    const lookup = item.price?.lookup_key || "";
    interval = item.price?.recurring?.interval || interval;
    siteQty = Math.max(siteQty, Number(item.quantity || 1));
    const m = flagsForLookup(lookup);
    if (!m) continue;

    if (m.tier && m.flagDelta) {
      // New tier model — the line items directly set the tier.
      tier = m.tier;
    } else if (m.legacyPlan) {
      // Legacy lookup_key — map onto the equivalent new tier.
      if (m.legacyPlan === "base")        { legacyFlags.base = true; tier = tier ?? "essentials"; }
      else if (m.legacyPlan === "compliance") { legacyFlags.compliance = true; tier = (tier === "intelligence" || tier === "business_tier") ? tier : "professional"; }
      else if (m.legacyPlan === "business")   { legacyFlags.business = true;   tier = tier === "intelligence" ? tier : "business_tier"; }
      else if (m.legacyPlan === "bundle")     { legacyFlags.bundle = true;     tier = tier === "intelligence" ? tier : "business_tier"; }
      else if (m.legacyPlan === "ai") {
        legacyFlags.ai = true;
        // Stand-alone legacy AI add-on: leave existing tier intact, only upgrade Business → Intelligence.
        isLegacyAiOnly = !legacyFlags.base && !legacyFlags.compliance && !legacyFlags.business && !legacyFlags.bundle;
      }
    }
  }

  // Read current row so we can preserve the tier when a stand-alone AI add-on comes in.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, tier")
    .eq("organisation_id", orgId)
    .maybeSingle();

  if (isLegacyAiOnly) {
    // AI add-on on its own: keep the existing tier but escalate Business → Intelligence.
    if (existing?.tier === "business_tier") tier = "intelligence";
    else tier = existing?.tier ?? tier;
  }

  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;

  // New billing vocabulary: monthly = 12-month minimum term billed monthly,
  // year = paid up-front annually. Term end = renewal date.
  const billingInterval = interval === "year" ? "annual_upfront" : "monthly_term";
  const startMs = sub.current_period_start
    ? sub.current_period_start * 1000
    : Date.now();
  const termStart = new Date(startMs).toISOString();
  // Preserve an existing term_end for monthly_term subs so renewals don't reset early.
  // Default: start + 12 months for monthly_term, current_period_end for annual_upfront.
  let termEnd: string;
  if (billingInterval === "annual_upfront") {
    termEnd = periodEnd ?? new Date(startMs + 365 * 86400000).toISOString();
  } else {
    // 12 months from term_start unless one already exists in future
    const existingTermEnd = (existing as any)?.term_end ? new Date((existing as any).term_end).getTime() : 0;
    const computed = new Date(startMs);
    computed.setUTCMonth(computed.getUTCMonth() + 12);
    termEnd = existingTermEnd > Date.now() ? new Date(existingTermEnd).toISOString() : computed.toISOString();
  }

  // IMPORTANT: only write the new model fields. Legacy boolean columns are NOT touched here.
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
  // The DB trigger trg_sync_modules_on_sub_change will sync module_activation rows from tier.
}

async function markCanceled(sub: any, env: StripeEnv) {
  // Status -> canceled. The grace period (current_period_end) is preserved on the row.
  // Tier is left intact so the customer still sees their plan label until the grace period ends;
  // sync_org_modules takes status + period_end into account when deciding what to enable.
  await supabase.from("subscriptions").update({
    status: "canceled",
    locked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", sub.id).eq("environment", env);
}

