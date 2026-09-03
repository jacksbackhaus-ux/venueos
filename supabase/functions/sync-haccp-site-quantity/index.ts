// Syncs the site-quantity line item on a customer's MiseOS HACCP Stripe
// subscription to match the org's real count of active sites
// (sites.active = true).
//
// Trigger:
//   - Called server-side (service-role) by site-transfer-cleanup after it
//     archives a site whose move/close window expired.
//   - Called client-side by CloseSiteCard's "Reopen this site" action.
//   - Idempotent: safe to call any time. No-ops if already correct or if the
//     org isn't on a HACCP subscription.
//
// Auth:
//   - Service-role callers (Authorization: Bearer <service role key>) pass
//     organisation_id in the body directly — used by internal jobs.
//   - Otherwise the caller must be an authenticated, active org_owner, same
//     as get-haccp-billing-summary.
//
// Failure handling:
//   - Billing sync must never block archiving/reopening a site. Stripe
//     errors are caught, logged to billing_events for manual follow-up, and
//     the function still returns 200.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";
import { decideSiteQuantity } from "../_shared/siteQuantity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const HACCP_SITE_KEYS = new Set([
  "miseos_haccp_site_monthly",
  "miseos_haccp_site_annual",
]);

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
    .select("stripe_subscription_id, environment").eq("organisation_id", orgId).maybeSingle();
  const stripeSubId = (subRow as { stripe_subscription_id?: string } | null)?.stripe_subscription_id;
  const env = ((subRow as { environment?: StripeEnv } | null)?.environment ?? "sandbox") as StripeEnv;
  if (!stripeSubId) return json(200, { ok: true, skipped: "no_stripe_subscription" });

  const { count: activeSites } = await admin.from("sites")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", orgId).eq("active", true);
  const activeSiteCount = activeSites ?? 0;

  try {
    const stripe = createStripeClient(env);
    const sub = await stripe.subscriptions.retrieve(stripeSubId, { expand: ["items.data.price"] });

    let cycle: "month" | "year" = "month";
    let siteItem: { id: string; quantity: number } | null = null;
    let isOnHaccp = false;
    for (const item of sub.items.data) {
      const key = item.price?.lookup_key || "";
      if (HACCP_SITE_KEYS.has(key)) {
        isOnHaccp = true;
        siteItem = { id: item.id, quantity: Number(item.quantity || 0) };
        cycle = (item.price?.recurring?.interval as "month" | "year") || cycle;
      }
    }
    if (!isOnHaccp || !siteItem) {
      return json(200, { ok: true, skipped: "not_on_haccp", activeSiteCount });
    }

    const { targetQuantity, changed } = decideSiteQuantity(activeSiteCount, siteItem.quantity);
    if (!changed) {
      return json(200, { ok: true, unchanged: true, quantity: targetQuantity });
    }

    await stripe.subscriptions.update(stripeSubId, {
      items: [{ id: siteItem.id, quantity: targetQuantity }],
      proration_behavior: "create_prorations",
    });

    return json(200, { ok: true, quantity: targetQuantity, cycle });
  } catch (e) {
    console.error("sync-haccp-site-quantity: stripe sync failed", e);
    await admin.from("billing_events").insert({
      event_type: "site_quantity_sync_failed",
      organisation_id: orgId,
      payload: { error: (e as Error).message || "unknown", activeSiteCount },
    }).then(() => {}, (logErr) => console.error("sync-haccp-site-quantity: failed to log billing event", logErr));
    // Never block the caller's own action (archive/reopen) on billing sync.
    return json(200, { ok: false, error: "stripe_sync_failed" });
  }
});
