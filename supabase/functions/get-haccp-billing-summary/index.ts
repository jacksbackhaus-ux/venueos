// Returns the live Stripe billing summary for the caller's organisation.
// Single source of truth for what the customer is currently billed for.
//
// Output (200):
//   {
//     ok: true,
//     cycle: "month" | "year",
//     site_quantity: number,
//     extra_user_quantity: number,
//     site_unit_amount: number,   // in major units, e.g. 4.99
//     user_unit_amount: number,   // in major units, e.g. 1.00
//     currency: string,
//     total: number,              // major units per cycle
//     status: string,
//     current_period_end: string | null,
//     cancel_at_period_end: boolean
//   }
//
// Errors return { ok: false, error: string } with appropriate status.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const HACCP_SITE_KEYS = new Set(["miseos_haccp_site_monthly", "miseos_haccp_site_annual"]);
const HACCP_USER_KEYS = new Set(["miseos_haccp_user_monthly", "miseos_haccp_user_annual"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method not allowed" });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { ok: false, error: "missing bearer token" });

    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
    });
    const { data: claimsData, error: claimsErr } = await caller.auth.getClaims();
    if (claimsErr || !claimsData?.claims) return json(401, { ok: false, error: "invalid session" });
    const authUid = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: appUser } = await admin.from("users")
      .select("id, organisation_id").eq("auth_user_id", authUid).eq("status", "active").maybeSingle();
    const orgId = (appUser as { organisation_id?: string } | null)?.organisation_id;
    const callerAppId = (appUser as { id?: string } | null)?.id;
    if (!orgId || !callerAppId) return json(403, { ok: false, error: "no organisation" });

    const { data: roleRow } = await admin.from("org_users")
      .select("org_role").eq("user_id", callerAppId).eq("organisation_id", orgId).eq("active", true).maybeSingle();
    if ((roleRow as { org_role?: string } | null)?.org_role !== "org_owner") {
      return json(403, { ok: false, error: "owner only" });
    }

    const { data: subRow } = await admin.from("subscriptions")
      .select("stripe_subscription_id, environment").eq("organisation_id", orgId).maybeSingle();
    const stripeSubId = (subRow as { stripe_subscription_id?: string } | null)?.stripe_subscription_id;
    const env = ((subRow as { environment?: StripeEnv } | null)?.environment ?? "sandbox") as StripeEnv;
    if (!stripeSubId) return json(404, { ok: false, error: "no_stripe_subscription" });

    const stripe = createStripeClient(env);
    const sub = await stripe.subscriptions.retrieve(stripeSubId, { expand: ["items.data.price"] });

    let cycle: "month" | "year" = "month";
    let siteQty = 0, userQty = 0;
    let siteUnit = 0, userUnit = 0;
    let currency = "gbp";
    for (const item of sub.items.data) {
      const key = item.price?.lookup_key || "";
      const qty = Number(item.quantity || 0);
      const unit = (item.price?.unit_amount ?? 0) / 100;
      currency = item.price?.currency || currency;
      if (HACCP_SITE_KEYS.has(key)) {
        siteQty = qty; siteUnit = unit;
        cycle = (item.price?.recurring?.interval as "month"|"year") || cycle;
      } else if (HACCP_USER_KEYS.has(key)) {
        userQty = qty; userUnit = unit;
        cycle = (item.price?.recurring?.interval as "month"|"year") || cycle;
      }
    }

    const total = siteQty * siteUnit + userQty * userUnit;
    const periodEnd = (sub.items.data[0] as any)?.current_period_end ?? (sub as any).current_period_end;

    return json(200, {
      ok: true,
      cycle,
      site_quantity: siteQty,
      extra_user_quantity: userQty,
      site_unit_amount: siteUnit,
      user_unit_amount: userUnit,
      currency,
      total,
      status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    });
  } catch (e) {
    console.error("get-haccp-billing-summary error:", e);
    return json(500, { ok: false, error: (e as Error).message || "unknown" });
  }
});
