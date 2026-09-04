// Syncs the per-user add-on quantity on a customer's MiseOS HACCP Stripe
// subscription to match the current count of active users in their organisation
// (excluding the 1 user included with each site).
//
// Trigger:
//   - Called by the client whenever an owner invites, activates, or removes a user.
//   - Idempotent: safe to call any time. If the org is on a legacy plan it no-ops.
//
// Auth:
//   - Service-role callers (Authorization: Bearer <service role key>) pass
//     organisation_id in the body — used by internal jobs such as
//     site-transfer-cleanup after it archives a site.
//   - Otherwise the caller must be an active org_owner (or internal staff
//     impersonating one).


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

const HACCP_USER_KEYS = new Set([
  "miseos_haccp_user_monthly",
  "miseos_haccp_user_annual",
]);
const HACCP_SITE_KEYS = new Set([
  "miseos_haccp_site_monthly",
  "miseos_haccp_site_annual",
]);

const HACCP_USER_LOOKUP = { month: "miseos_haccp_user_monthly", year: "miseos_haccp_user_annual" } as const;

function isServiceRoleCaller(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token || !serviceKey) return false;
  if (token === serviceKey) return true;
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const decoded = JSON.parse(
      atob(payload.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")),
    ) as { role?: string };
    return decoded.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: { organisation_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body — fine for the authenticated-user path
  }

  let orgId: string | undefined;

  if (isServiceRoleCaller(req)) {
    orgId = body.organisation_id;
    if (!orgId) return json(400, { error: "organisation_id required" });
  } else {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "missing bearer token" });

    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
    });
    const { data: claimsData, error: claimsErr } = await caller.auth.getClaims();
    if (claimsErr || !claimsData?.claims) return json(401, { error: "invalid session" });
    const authUid = claimsData.claims.sub as string;

    const { data: appUser } = await admin.from("users")
      .select("id, organisation_id").eq("auth_user_id", authUid).eq("status", "active").maybeSingle();
    const callerOrgId = (appUser as { organisation_id?: string } | null)?.organisation_id;
    const callerAppId = (appUser as { id?: string } | null)?.id;
    if (!callerOrgId || !callerAppId) return json(403, { error: "no organisation" });

    const { data: roleRow } = await admin.from("org_users")
      .select("org_role").eq("user_id", callerAppId).eq("organisation_id", callerOrgId).eq("active", true).maybeSingle();
    if ((roleRow as { org_role?: string } | null)?.org_role !== "org_owner") {
      return json(403, { error: "owner only" });
    }
    orgId = callerOrgId;
  }

  const { data: subRow } = await admin.from("subscriptions")
    .select("stripe_subscription_id, environment, site_quantity").eq("organisation_id", orgId).maybeSingle();
  const stripeSubId = (subRow as { stripe_subscription_id?: string } | null)?.stripe_subscription_id;
  const env = ((subRow as { environment?: StripeEnv } | null)?.environment ?? "sandbox") as StripeEnv;
  const dbSiteQty = (subRow as { site_quantity?: number } | null)?.site_quantity ?? 1;
  if (!stripeSubId) return json(200, { ok: true, skipped: "no_stripe_subscription" });

  // Count active users in the org. The first user per site is included for free.
  const { count: activeUsers } = await admin.from("users")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", orgId).eq("status", "active");
  const totalActive = activeUsers ?? 1;

  const stripe = createStripeClient(env);
  const sub = await stripe.subscriptions.retrieve(stripeSubId, { expand: ["items.data.price"] });

  // Determine cycle from existing site line item
  let cycle: "month" | "year" = "month";
  let userItem: { id: string; quantity: number } | null = null;
  let stripeSiteQty: number | null = null;
  let isOnHaccp = false;
  for (const item of sub.items.data) {
    const key = item.price?.lookup_key || "";
    if (HACCP_SITE_KEYS.has(key)) {
      isOnHaccp = true;
      stripeSiteQty = Number(item.quantity || 0);
      cycle = (item.price?.recurring?.interval as "month"|"year") || cycle;
    }
    if (HACCP_USER_KEYS.has(key)) {
      userItem = { id: item.id, quantity: Number(item.quantity || 0) };
      cycle = (item.price?.recurring?.interval as "month"|"year") || cycle;
    }
  }

  // Included users = 1 per billed site. Prefer the live Stripe site quantity:
  // subscriptions.site_quantity is only written by the payments webhook, so it
  // lags immediately after a site-quantity sync (e.g. the cron archive path).
  const includedUsers = stripeSiteQty ?? dbSiteQty;
  const additionalUsers = Math.max(0, totalActive - includedUsers);

  if (!isOnHaccp) return json(200, { ok: true, skipped: "not_on_haccp", additionalUsers });


  // No-op if the quantity is already correct
  if (userItem && userItem.quantity === additionalUsers) {
    return json(200, { ok: true, unchanged: true, additionalUsers });
  }
  if (!userItem && additionalUsers === 0) {
    return json(200, { ok: true, unchanged: true, additionalUsers: 0 });
  }

  // Resolve the per-user price for the current cycle
  const userKey = HACCP_USER_LOOKUP[cycle];
  const priceList = await stripe.prices.list({ lookup_keys: [userKey], active: true, limit: 1 });
  if (!priceList.data.length) return json(500, { error: `Missing price: ${userKey}` });
  const userPriceId = priceList.data[0].id;

  if (userItem) {
    if (additionalUsers === 0) {
      // Remove the line item entirely
      await stripe.subscriptions.update(stripeSubId, {
        items: [{ id: userItem.id, deleted: true }],
        proration_behavior: "create_prorations",
      });
    } else {
      await stripe.subscriptions.update(stripeSubId, {
        items: [{ id: userItem.id, quantity: additionalUsers }],
        proration_behavior: "create_prorations",
      });
    }
  } else {
    // Add a brand-new per-user line item
    await stripe.subscriptions.update(stripeSubId, {
      items: [{ price: userPriceId, quantity: additionalUsers }],
      proration_behavior: "create_prorations",
    });
  }

  return json(200, { ok: true, additionalUsers, cycle });
});
