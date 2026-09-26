// Add ONE permanent paid site to an existing MiseOS HACCP subscription.
//
// action "preview": read-only. Asks Stripe what adding a site would charge
//   right now (prorated). Nothing is charged or created.
// action "confirm": raises the site quantity by one on the EXISTING
//   subscription and charges the card on file immediately. The site is only
//   created in MiseOS after Stripe confirms the charge was paid.
//
// Payment safety:
//   - payment_behavior "pending_if_incomplete": if the card fails, Stripe
//     does NOT apply the quantity change (it parks it as a pending update).
//   - On failure we void the unpaid invoice so it can't be paid later and
//     silently add an unused slot. If voiding fails it's logged for review.
//   - Idempotency key per request (client-generated) stops double-clicks
//     double-charging; a completed request is recorded in billing_events and
//     never repeated.
//   - If the charge succeeds but creating the site fails, the paid slot
//     remains on the plan (shown as "Set up an unused site slot") and the
//     failure is logged — the customer never pays for nothing silently.
//
// Never starts a new subscription/checkout. Sign-up checkout is untouched.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";
import { billableSiteCount, decideAddSiteOutcome } from "../_shared/siteQuantity.ts";

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
const PREMISES: Record<string, string> = {
  commercial: "scheduled", home: "", mobile: "", manufacturing: "",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── Auth: active org owner only ─────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Please sign in again." });
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  const { data: claimsData, error: claimsErr } = await caller.auth.getClaims();
  if (claimsErr || !claimsData?.claims) return json(401, { error: "Please sign in again." });
  const authUid = claimsData.claims.sub as string;

  const { data: appUser } = await admin.from("users")
    .select("id, organisation_id").eq("auth_user_id", authUid).eq("status", "active").maybeSingle();
  const orgId = (appUser as { organisation_id?: string } | null)?.organisation_id;
  const appUserId = (appUser as { id?: string } | null)?.id;
  if (!orgId || !appUserId) return json(403, { error: "No organisation found." });
  const { data: roleRow } = await admin.from("org_users")
    .select("org_role").eq("user_id", appUserId).eq("organisation_id", orgId).eq("active", true).maybeSingle();
  if ((roleRow as { org_role?: string } | null)?.org_role !== "org_owner") {
    return json(403, { error: "Only the business owner can add sites." });
  }

  // ── Input ───────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(400, { error: "Invalid request." }); }
  const action = body.action;
  if (action !== "preview" && action !== "confirm") return json(400, { error: "Invalid action." });

  // ── Subscription ───────────────────────────────────────────────────
  const { data: subRow } = await admin.from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id, environment, status")
    .eq("organisation_id", orgId).maybeSingle();
  const sr = subRow as { stripe_subscription_id?: string; stripe_customer_id?: string; environment?: StripeEnv; status?: string } | null;
  if (!sr?.stripe_subscription_id || !sr.stripe_customer_id) {
    return json(409, { error: "No subscription found. Start a plan first." });
  }
  if (sr.status !== "active" && sr.status !== "trialing") {
    return json(409, { error: "Your subscription isn't active. Please update your card in the billing portal first." });
  }
  const env: StripeEnv = sr.environment === "live" ? "live" : "sandbox";

  // Billable sites right now (old site of an active move isn't billed).
  const { data: siteRows } = await admin.from("sites").select("id")
    .eq("organisation_id", orgId).eq("active", true);
  const { data: transfer } = await admin.from("site_transfers").select("from_site_id, to_site_id")
    .eq("organisation_id", orgId).eq("status", "active").maybeSingle();
  const billable = billableSiteCount(
    ((siteRows ?? []) as { id: string }[]).map((r) => r.id),
    (transfer as { from_site_id: string; to_site_id: string | null } | null) ?? null,
  );

  const stripe = createStripeClient(env);
  let sub;
  try {
    sub = await stripe.subscriptions.retrieve(sr.stripe_subscription_id, { expand: ["items.data.price"] });
  } catch (e) {
    console.error("add-haccp-site: retrieve failed", e);
    return json(502, { error: "Couldn't reach billing. Please try again in a minute." });
  }
  const siteItem = sub.items.data.find((it) => HACCP_SITE_KEYS.has(it.price?.lookup_key || ""));
  if (!siteItem) {
    return json(409, { error: "Your plan doesn't support adding sites here yet. Please contact support." });
  }
  const currentQty = Number(siteItem.quantity || 0);
  if (billable < currentQty) {
    return json(409, { error: "You already have an unused site slot — use \"Set up an unused site slot\" instead.", code: "free_slot" });
  }
  const targetQty = currentQty + 1;
  const unitAmount = siteItem.price?.unit_amount ?? 0;
  const currency = siteItem.price?.currency ?? "gbp";
  const interval = siteItem.price?.recurring?.interval ?? "month";

  // ── PREVIEW (read-only) ─────────────────────────────────────────────
  if (action === "preview") {
    const prorationDate = Math.floor(Date.now() / 1000);
    try {
      const preview = await stripe.invoices.createPreview({
        customer: sr.stripe_customer_id,
        subscription: sr.stripe_subscription_id,
        subscription_details: {
          items: [{ id: siteItem.id, quantity: targetQty }],
          proration_behavior: "always_invoice",
          proration_date: prorationDate,
        },
      });
      return json(200, {
        ok: true,
        amount_due_now: preview.amount_due,
        currency,
        proration_date: prorationDate,
        current_sites: currentQty,
        new_sites: targetQty,
        per_site_amount: unitAmount,
        interval,
        period_end: siteItem.current_period_end ?? null,
        trialing: sub.status === "trialing",
      });
    } catch (e) {
      console.error("add-haccp-site: preview failed", e);
      return json(502, { error: "Couldn't calculate the price. Please try again." });
    }
  }

  // ── CONFIRM ─────────────────────────────────────────────────────────
  const requestId = typeof body.request_id === "string" && UUID_RE.test(body.request_id) ? body.request_id : null;
  const prorationDate = Number(body.proration_date);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim().slice(0, 300) : "";
  const premisesType = typeof body.premises_type === "string" ? body.premises_type : "commercial";
  const operatingMode = typeof body.operating_mode === "string" ? body.operating_mode : null;
  if (!requestId) return json(400, { error: "Invalid request." });
  if (!name || name.length > 120) return json(400, { error: "Please enter a site name (up to 120 characters)." });
  if (!(premisesType in PREMISES)) return json(400, { error: "Invalid site type." });
  if (operatingMode && !/^[a-z_]{1,40}$/.test(operatingMode)) return json(400, { error: "Invalid operating mode." });
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(prorationDate) || prorationDate > nowSec + 60 || nowSec - prorationDate > 30 * 60) {
    return json(409, { error: "That price quote has expired. Please review the new amount and confirm again.", code: "quote_expired" });
  }

  // Never repeat a request that already completed.
  const { data: done } = await admin.from("billing_events").select("id")
    .eq("organisation_id", orgId).eq("event_type", "add_site_completed")
    .eq("payload->>request_id", requestId).limit(1);
  if (done && done.length) return json(409, { error: "This site has already been added. Refresh the page." });

  let updated;
  try {
    updated = await stripe.subscriptions.update(sr.stripe_subscription_id, {
      items: [{ id: siteItem.id, quantity: targetQty }],
      proration_behavior: "always_invoice",
      proration_date: prorationDate,
      payment_behavior: "pending_if_incomplete",
      expand: ["latest_invoice", "items.data.price"],
    }, { idempotencyKey: `add-site-${orgId}-${requestId}` });
  } catch (e) {
    const msg = (e as { message?: string }).message || "unknown";
    console.error("add-haccp-site: update failed", msg);
    await admin.from("billing_events").insert({
      organisation_id: orgId, event_type: "add_site_payment_failed",
      payload: { request_id: requestId, stage: "update", error: msg },
    });
    return json(402, { error: "Your card was declined or needs confirming, so no site was added and you weren't charged. Please update your card in the billing portal and try again." });
  }

  const inv = (updated.latest_invoice && typeof updated.latest_invoice === "object") ? updated.latest_invoice : null;
  const newItem = updated.items.data.find((it) => it.id === siteItem.id);
  const outcome = decideAddSiteOutcome({
    pendingUpdate: updated.pending_update,
    siteItemQuantity: newItem ? Number(newItem.quantity || 0) : null,
    expectedQuantity: targetQty,
    invoiceStatus: inv?.status ?? null,
    invoiceAmountDue: inv ? inv.amount_remaining ?? inv.amount_due : null,
  });

  if (outcome !== "paid") {
    let voided = false;
    if (outcome === "payment_failed" && inv?.id && inv.status === "open") {
      try { await stripe.invoices.voidInvoice(inv.id); voided = true; }
      catch (e) { console.error("add-haccp-site: void failed", inv.id, e); }
    }
    await admin.from("billing_events").insert({
      organisation_id: orgId,
      event_type: outcome === "payment_failed" ? "add_site_payment_failed" : "add_site_needs_review",
      payload: {
        request_id: requestId, invoice_id: inv?.id ?? null, invoice_status: inv?.status ?? null,
        invoice_voided: voided, pending_update: !!updated.pending_update, target_quantity: targetQty,
      },
    });
    if (outcome === "payment_failed") {
      return json(402, { error: "Your card was declined, so no site was added and you weren't charged. Please update your card in the billing portal and try again." });
    }
    return json(409, { error: "We couldn't confirm the payment, so no site was added. Our team has been notified and will check your billing — please don't retry yet." });
  }

  // Paid — now (and only now) create the site.
  await admin.from("subscriptions").update({ site_quantity: targetQty, updated_at: new Date().toISOString() })
    .eq("organisation_id", orgId);

  const { data: created, error: siteErr } = await admin.from("sites").insert({
    organisation_id: orgId,
    name,
    address: address || null,
    owner_user_id: appUserId,
    premises_type: premisesType,
    ...(operatingMode ? { operating_mode: operatingMode } : {}),
  }).select("id").maybeSingle();

  await admin.from("billing_events").insert({
    organisation_id: orgId, event_type: "add_site_completed",
    payload: {
      request_id: requestId, invoice_id: inv?.id ?? null, amount_paid: inv?.amount_paid ?? null,
      target_quantity: targetQty, site_id: (created as { id?: string } | null)?.id ?? null,
      site_create_error: siteErr?.message ?? null,
    },
  });

  // More billed sites = more included users; re-sync the user add-on.
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/sync-haccp-user-quantity`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ organisation_id: orgId }),
    });
  } catch (e) { console.error("add-haccp-site: user sync failed", e); }

  if (siteErr || !created) {
    console.error("add-haccp-site: site insert failed after payment", siteErr);
    return json(200, {
      ok: true, site_created: false,
      message: "Payment went through, but we couldn't create the site. Use \"Set up an unused site slot\" to finish — you won't be charged again.",
    });
  }
  return json(200, { ok: true, site_created: true, site_id: (created as { id: string }).id, amount_paid: inv?.amount_paid ?? 0, currency });
});
