import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

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

    const { siteQuantity = 1, hqQuantity = 0, billingInterval = "month", returnUrl, environment } = await req.json();
    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Resolve our org for this user via the app's users table
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

    // Resolve price IDs
    const baseKey = billingInterval === "year" ? "base_yearly" : "base_monthly";
    const siteKey = billingInterval === "year" ? "site_yearly" : "site_monthly";
    const hqKey = billingInterval === "year" ? "hq_yearly" : "hq_monthly";

    const lookupKeys = [baseKey];
    const extraSites = Math.max(0, Number(siteQuantity) - 1);
    if (extraSites > 0) lookupKeys.push(siteKey);
    if (hqQuantity > 0) lookupKeys.push(hqKey);

    const priceList = await stripe.prices.list({ lookup_keys: lookupKeys });
    const priceMap: Record<string, string> = {};
    priceList.data.forEach(p => { if (p.lookup_key) priceMap[p.lookup_key] = p.id; });

    const lineItems: any[] = [{ price: priceMap[baseKey], quantity: 1 }];
    if (extraSites > 0) lineItems.push({ price: priceMap[siteKey], quantity: extraSites });
    if (hqQuantity > 0) lineItems.push({ price: priceMap[hqKey], quantity: Number(hqQuantity) });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      line_items: lineItems,
      return_url: returnUrl || `${req.headers.get("origin")}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      ...(userEmail && { customer_email: userEmail }),
      metadata: { organisation_id: organisationId, billing_interval: billingInterval },
      subscription_data: { metadata: { organisation_id: organisationId, billing_interval: billingInterval } },
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
