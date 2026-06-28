import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const authUid = userData.user.id;

    let body: { returnUrl?: string; environment?: StripeEnv } = {};
    try { body = await req.json(); } catch { /* allow empty body */ }
    const env: StripeEnv = body.environment === "live" ? "live" : "sandbox";
    const returnUrl = body.returnUrl || `${req.headers.get("origin") ?? "https://mise-os.app"}/account`;

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: appUser } = await service.from("users")
      .select("id, organisation_id")
      .eq("auth_user_id", authUid).eq("status", "active").maybeSingle();
    if (!appUser?.organisation_id) return json({ error: "No organisation linked to this account." }, 400);

    // Only the organisation owner can manage billing.
    const { data: roleRow } = await service.from("org_users")
      .select("org_role")
      .eq("user_id", (appUser as { id: string }).id)
      .eq("organisation_id", (appUser as { organisation_id: string }).organisation_id)
      .eq("active", true)
      .maybeSingle();
    if ((roleRow as { org_role?: string } | null)?.org_role !== "org_owner") {
      return json({ error: "Only the organisation owner can manage billing." }, 403);
    }

    const { data: sub } = await service.from("subscriptions")
      .select("stripe_customer_id")
      .eq("organisation_id", appUser.organisation_id).maybeSingle();
    if (!sub?.stripe_customer_id) {
      return json({ error: "No Stripe customer linked to this organisation yet. Start a subscription first." }, 400);
    }

    console.log("[customer-portal] env=", env, "customer=", sub.stripe_customer_id, "return_url=", returnUrl);

    const stripe = createStripeClient(env);
    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: returnUrl,
      });
      return json({ url: portal.url });
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      console.error("[customer-portal] Stripe error:", msg);

      if (/No configuration provided|customer portal/i.test(msg)) {
        return json({
          error: "Stripe Customer Portal isn't set up yet. An admin needs to enable and save the portal in the Stripe Dashboard (Settings → Billing → Customer portal).",
        }, 500);
      }
      if (/No such customer|resource_missing/i.test(msg)) {
        return json({
          error: "This billing account can't be opened — the linked Stripe customer wasn't found in this Stripe environment. Please contact support.",
        }, 500);
      }
      return json({ error: msg || "Could not open the Stripe billing portal." }, 500);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[customer-portal] fatal:", msg);
    return json({ error: msg || "Could not open the Stripe billing portal." }, 500);
  }
});
