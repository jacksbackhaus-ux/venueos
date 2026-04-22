import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

// Tier → price lookup_keys
const TIER_PRICES: Record<string, { base: string; extra?: string }> = {
  starter:   { base: "venueos_starter_monthly" },
  pro:       { base: "venueos_pro_monthly" },
  multisite: { base: "venueos_multisite_base", extra: "venueos_multisite_extra_site" },
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

    const { tier, siteQuantity = 1, returnUrl, environment } = await req.json();
    if (!tier || !TIER_PRICES[tier]) {
      return new Response(JSON.stringify({ error: "Invalid tier" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Resolve org for this user
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

    const lookupKeys = [TIER_PRICES[tier].base];
    const extraSites = Math.max(0, Number(siteQuantity) - 1);
    if (tier === "multisite" && extraSites > 0 && TIER_PRICES[tier].extra) {
      lookupKeys.push(TIER_PRICES[tier].extra!);
    }

    const priceList = await stripe.prices.list({ lookup_keys: lookupKeys });
    const priceMap: Record<string, string> = {};
    priceList.data.forEach((p) => { if (p.lookup_key) priceMap[p.lookup_key] = p.id; });

    const lineItems: any[] = [{ price: priceMap[TIER_PRICES[tier].base], quantity: 1 }];
    if (tier === "multisite" && extraSites > 0 && TIER_PRICES[tier].extra) {
      lineItems.push({ price: priceMap[TIER_PRICES[tier].extra!], quantity: extraSites });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      line_items: lineItems,
      return_url: returnUrl || `${req.headers.get("origin")}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      ...(userEmail && { customer_email: userEmail }),
      metadata: { organisation_id: organisationId, tier },
      subscription_data: {
        metadata: { organisation_id: organisationId, tier },
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
