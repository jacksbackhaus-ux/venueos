import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

/**
 * VenueOS plan checkout.
 *
 * Body: { plan: "base"|"compliance"|"business"|"bundle", cycle: "month"|"year", siteQuantity?: number, returnUrl?: string, environment: "sandbox"|"live" }
 *
 * Sites > 1 get a 15% multi-site discount on the per-site line via Stripe coupon.
 * The site quantity is passed as the `quantity` on the line item (per-site pricing).
 */

type PlanId = "base" | "compliance" | "business" | "bundle";
type Cycle = "month" | "year";

const LOOKUP: Record<PlanId, { month: string; year: string }> = {
  base:       { month: "venueos_base_monthly",       year: "venueos_base_yearly" },
  compliance: { month: "venueos_compliance_monthly", year: "venueos_compliance_yearly" },
  business:   { month: "venueos_business_monthly",   year: "venueos_business_yearly" },
  bundle:     { month: "venueos_bundle_monthly",     year: "venueos_bundle_yearly" },
};

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

    const { plan, cycle = "month", siteQuantity = 1, returnUrl, environment } = await req.json();
    if (!plan || !LOOKUP[plan as PlanId]) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cycle !== "month" && cycle !== "year") {
      return new Response(JSON.stringify({ error: "Invalid cycle" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: appUser } = await service
      .from("users")
      .select("organisation_id")
      .eq("auth_user_id", claimsData.claims.sub)
      .eq("status", "active")
      .maybeSingle();
    if (!appUser?.organisation_id) {
      return new Response(JSON.stringify({ error: "No organisation found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const organisationId = appUser.organisation_id;

    // Resolve price
    const lookupKey = LOOKUP[plan as PlanId][cycle as Cycle];
    const priceList = await stripe.prices.list({ lookup_keys: [lookupKey] });
    if (!priceList.data.length) {
      return new Response(JSON.stringify({ error: `Price not found: ${lookupKey}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripePrice = priceList.data[0];
    const qty = Math.max(1, Number(siteQuantity) || 1);

    // Multi-site discount: 15% off when > 1 site.
    // Apply as a coupon to the entire subscription (simplest), only if >1 site.
    const discounts: Array<{ coupon: string }> = [];
    if (qty > 1) {
      // Reuse / create a coupon. Stripe allows GET by id; we use a deterministic id.
      const couponId = "venueos_multisite_15";
      try {
        await stripe.coupons.retrieve(couponId);
      } catch (_e) {
        await stripe.coupons.create({
          id: couponId,
          percent_off: 15,
          duration: "forever",
          name: "Multi-site 15% off (per-site)",
        });
      }
      discounts.push({ coupon: couponId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      line_items: [{ price: stripePrice.id, quantity: qty }],
      ...(discounts.length ? { discounts } : {}),
      return_url: returnUrl || `${req.headers.get("origin")}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      ...(userEmail && { customer_email: userEmail }),
      metadata: { organisation_id: organisationId, plan, cycle },
      subscription_data: {
        metadata: { organisation_id: organisationId, plan, cycle },
      },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
