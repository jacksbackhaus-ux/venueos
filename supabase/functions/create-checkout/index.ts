import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

/**
 * MiseOS HACCP checkout.
 *
 * New HACCP-only model:
 *   plan: "haccp", cycle: "month"|"year",
 *   siteQuantity: number (>=1, each site billed at £4.99/mo or £49.90/yr),
 *   userQuantity: number (additional users beyond the included 1 per site)
 *
 * Legacy plan ids (base/compliance/business/bundle/essentials/...) are still
 * accepted so existing customers and historical links keep working, but the
 * customer-facing UI only ever passes plan="haccp".
 */

type LegacyPlanId =
  | "base" | "compliance" | "business" | "bundle" | "ai"
  | "essentials" | "professional" | "business_tier" | "intelligence";
type PlanId = "haccp" | LegacyPlanId;
type Cycle = "month" | "year";

const LEGACY_LOOKUP: Record<LegacyPlanId, { month: string; year: string }> = {
  base:          { month: "venueos_base_monthly",          year: "venueos_base_yearly" },
  compliance:    { month: "venueos_compliance_monthly",    year: "venueos_compliance_yearly" },
  business:      { month: "venueos_business_monthly",      year: "venueos_business_yearly" },
  bundle:        { month: "venueos_bundle_monthly",        year: "venueos_bundle_yearly" },
  ai:            { month: "venueos_ai_monthly",            year: "venueos_ai_yearly" },
  essentials:    { month: "miseos_essentials_monthly",     year: "miseos_essentials_yearly" },
  professional:  { month: "miseos_professional_monthly",   year: "miseos_professional_yearly" },
  business_tier: { month: "miseos_business_tier_monthly",  year: "miseos_business_tier_yearly" },
  intelligence:  { month: "miseos_intelligence_monthly",   year: "miseos_intelligence_yearly" },
};

const HACCP_SITE = { month: "miseos_haccp_site_monthly", year: "miseos_haccp_site_annual" } as const;
const HACCP_USER = { month: "miseos_haccp_user_monthly", year: "miseos_haccp_user_annual" } as const;

function isMissingStripeCustomerError(error: unknown): boolean {
  const err = error as { code?: string; raw?: { code?: string }; message?: string; statusCode?: number };
  return (
    err?.code === "resource_missing" ||
    err?.raw?.code === "resource_missing" ||
    (err?.statusCode === 404 && /No such customer/i.test(err?.message ?? "")) ||
    /No such customer/i.test(err?.message ?? "")
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userEmail = claimsData.claims.email as string | undefined;

    const body = await req.json();
    const plan = (body.plan ?? "haccp") as PlanId;
    const cycle = (body.cycle ?? "month") as Cycle;
    const siteQuantity = Math.max(1, Number(body.siteQuantity) || 1);
    const userQuantity = Math.max(0, Number(body.userQuantity) || 0);
    const returnUrl = body.returnUrl as string | undefined;
    const environment = (body.environment ?? "sandbox") as StripeEnv;
    const addSiteMode = Boolean(body.addSiteMode);

    if (cycle !== "month" && cycle !== "year") {
      return new Response(JSON.stringify({ error: "Invalid cycle" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (plan !== "haccp" && !(plan in LEGACY_LOOKUP)) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(environment);
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: appUser } = await service
      .from("users")
      .select("id, organisation_id")
      .eq("auth_user_id", claimsData.claims.sub)
      .eq("status", "active")
      .maybeSingle();
    if (!appUser?.organisation_id) {
      return new Response(JSON.stringify({ error: "No organisation found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const organisationId = appUser.organisation_id;

    const { data: roleRow } = await service
      .from("org_users")
      .select("org_role")
      .eq("user_id", (appUser as { id: string }).id)
      .eq("organisation_id", organisationId)
      .eq("active", true)
      .maybeSingle();
    if ((roleRow as { org_role?: string } | null)?.org_role !== "org_owner") {
      return new Response(JSON.stringify({ error: "Only the organisation owner can manage billing." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Trial eligibility + Stripe customer reuse -----------------------
    // Per-org rule: a free trial is granted at most ONCE. We look up the
    // existing subscription row to decide both (a) whether to block this
    // checkout (already actively paying) and (b) whether to attach
    // trial_period_days to the new session.
    const { data: existingSub } = await service
      .from("subscriptions")
      .select("id, status, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, trial_end, has_used_trial")
      .eq("organisation_id", organisationId)
      .maybeSingle();

    const nowMs = Date.now();
    const periodActive = !existingSub?.current_period_end ||
      new Date(existingSub.current_period_end).getTime() > nowMs;
    const alreadyPaying =
      existingSub?.stripe_subscription_id &&
      ["active", "trialing", "past_due"].includes(existingSub.status || "") &&
      periodActive &&
      !existingSub.cancel_at_period_end;

    if (alreadyPaying) {
      return new Response(JSON.stringify({
        error: "Your organisation already has an active subscription. Manage it from the billing portal.",
        portalRedirect: true,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- HACCP user-quota guard --------------------------------------
    // The billed seat count (siteQuantity + userQuantity) must cover every
    // currently-active user in the organisation. If the owner asks to
    // subscribe for fewer than they have active, return a structured 409
    // so the frontend can show a "choose who to deactivate" flow.
    // The owner themselves is always included — they are returned with
    // is_owner=true so the UI can lock the checkbox.
    if (plan === "haccp" && !addSiteMode) {
      const includedAndPaid = siteQuantity + userQuantity; // total seats requested
      const { data: orgUsers } = await service
        .from("users")
        .select("id, display_name, email, auth_type")
        .eq("organisation_id", organisationId)
        .eq("status", "active");
      const activeUsers = (orgUsers ?? []) as Array<{ id: string; display_name: string; email: string | null; auth_type: string }>;
      const activeCount = activeUsers.length;

      if (activeCount > includedAndPaid) {
        // Identify the owner so the UI can exclude them from deactivation
        const { data: ownerRows } = await service
          .from("org_users")
          .select("user_id")
          .eq("organisation_id", organisationId)
          .eq("org_role", "org_owner")
          .eq("active", true);
        const ownerIds = new Set(((ownerRows ?? []) as Array<{ user_id: string }>).map(r => r.user_id));
        const deactivatable = activeUsers
          .filter(u => !ownerIds.has(u.id))
          .map(u => ({
            id: u.id,
            name: u.display_name,
            email: u.email,
            auth_type: u.auth_type,
            is_owner: false,
          }));
        return new Response(JSON.stringify({
          code: "user_quota_too_low",
          error: `You have ${activeCount} active user${activeCount === 1 ? "" : "s"} but the plan you selected only covers ${includedAndPaid}. Choose ${activeCount - includedAndPaid} user${activeCount - includedAndPaid === 1 ? "" : "s"} to deactivate, or increase the number of paid users.`,
          activeUserCount: activeCount,
          allowedUserCount: includedAndPaid,
          mustDeactivate: activeCount - includedAndPaid,
          deactivatable,
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const trialUsed = Boolean(
      existingSub?.has_used_trial ||
      existingSub?.trial_end ||
      existingSub?.stripe_subscription_id
    );

    // Reuse the org's Stripe customer if we have one; otherwise create a
    // single customer and persist it so future checkouts cannot mint a
    // brand-new customer (which would let users get another free trial).
    async function createAndStoreStripeCustomer(): Promise<string> {
      const created = await stripe.customers.create({
        ...(userEmail && { email: userEmail }),
        metadata: { organisation_id: organisationId },
      });
      await service.from("subscriptions").upsert({
        organisation_id: organisationId,
        stripe_customer_id: created.id,
        status: existingSub?.status ?? "incomplete",
        environment,
      }, { onConflict: "organisation_id" });
      return created.id;
    }

    let stripeCustomerId: string | null = existingSub?.stripe_customer_id ?? null;
    if (stripeCustomerId) {
      // Verify the stored customer still exists in the current Stripe
      // account/mode. Stored IDs from another mode (or deleted customers)
      // produce "No such customer" errors at checkout — recover by
      // creating a fresh one and overwriting the stale id.
      try {
        const existing = await stripe.customers.retrieve(stripeCustomerId);
        if ((existing as { deleted?: boolean }).deleted) stripeCustomerId = null;
      } catch (err) {
        if (isMissingStripeCustomerError(err)) {
          stripeCustomerId = null;
        } else {
          throw err;
        }
      }
    }
    if (!stripeCustomerId) {
      stripeCustomerId = await createAndStoreStripeCustomer();
    }

    // Resolve lookup keys → Stripe price ids.
    async function resolvePrice(lookupKey: string): Promise<string> {
      const list = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
      if (!list.data.length) throw new Error(`Price not found: ${lookupKey}`);
      return list.data[0].id;
    }

    const lineItems: Array<{ price: string; quantity: number }> = [];

    if (plan === "haccp") {
      const sitePriceId = await resolvePrice(HACCP_SITE[cycle]);
      lineItems.push({ price: sitePriceId, quantity: siteQuantity });
      if (userQuantity > 0) {
        const userPriceId = await resolvePrice(HACCP_USER[cycle]);
        lineItems.push({ price: userPriceId, quantity: userQuantity });
      }
    } else {
      const legacyKey = LEGACY_LOOKUP[plan as LegacyPlanId][cycle];
      const legacyPriceId = await resolvePrice(legacyKey);
      lineItems.push({ price: legacyPriceId, quantity: siteQuantity });
    }

    const isHaccp = plan === "haccp";
    const trialEligible = isHaccp && !addSiteMode && !trialUsed;
    const sessionParams = {
      mode: "subscription" as const,
      ui_mode: "embedded_page" as const,
      line_items: lineItems,
      return_url: returnUrl || `${req.headers.get("origin")}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      customer: stripeCustomerId,
      // MiseOS does not collect VAT. We intentionally do NOT enable
      // managed_payments — it would (a) reject automatic_tax:false and
      // (b) add +3.5% per transaction, both undesired for the HACCP launch.
      automatic_tax: { enabled: false },
      allow_promotion_codes: false,
      payment_method_collection: "always" as const,
      metadata: {
        organisation_id: organisationId, plan, cycle,
        add_site_mode: addSiteMode ? "true" : "false",
      },
      subscription_data: {
        metadata: { organisation_id: organisationId, plan, cycle, add_site_mode: addSiteMode ? "true" : "false" },
        // 14-day free trial ONLY for orgs that have never used one.
        // Card is required at signup (payment_method_collection above),
        // so the subscription auto-activates when the trial ends.
        ...(trialEligible && { trial_period_days: 14 }),
      },
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (err) {
      if (!isMissingStripeCustomerError(err)) throw err;
      stripeCustomerId = await createAndStoreStripeCustomer();
      session = await stripe.checkout.sessions.create({ ...sessionParams, customer: stripeCustomerId });
    }

    // Lock the trial flag the moment a trial session is minted, so a
    // refresh / re-attempt in the same browser cannot produce a second
    // trial even before Stripe webhooks land.
    if (trialEligible) {
      await service.from("subscriptions").upsert({
        organisation_id: organisationId,
        stripe_customer_id: stripeCustomerId,
        status: existingSub?.status ?? "incomplete",
        environment,
        has_used_trial: true,
      }, { onConflict: "organisation_id" });
    }



    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Unable to start checkout" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
