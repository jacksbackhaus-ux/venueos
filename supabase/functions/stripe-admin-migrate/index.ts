// Staff-only Stripe billing migration utility.
//
// Provides three idempotent actions for cleaning up legacy Stripe products as
// part of the MiseOS HACCP launch. Each call requires:
//   - A valid JWT for an active internal_staff member
//   - A reason (min 5 chars), recorded in admin_actions_log
//   - environment ("live" | "sandbox")
//
// Actions:
//   audit_legacy            — lists all customer-facing products and flags legacy ones
//   archive_legacy          — sets all legacy products (and their prices) to active=false
//   migrate_legacy_subs     — for each subscription on a legacy price, swap line items
//                             to the new HACCP site price (+ optional user add-on) while
//                             preserving the existing billing interval and trial period.
//
// Nothing is ever deleted. Stripe products/prices are only archived, and the
// customer's existing billing cycle / trial is preserved across migrations.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Lookup keys for the new HACCP launch product (must already exist in Stripe).
const HACCP_SITE = { month: "miseos_haccp_site_monthly", year: "miseos_haccp_site_annual" } as const;
const HACCP_USER = { month: "miseos_haccp_user_monthly", year: "miseos_haccp_user_annual" } as const;

// Any product whose name starts with one of these is considered legacy.
const LEGACY_NAME_PREFIXES = [
  "VenueOS",
  "MiseOS Essentials",
  "MiseOS Professional",
  "MiseOS Business",
  "MiseOS Intelligence",
  "MiseOS AI Insights",
  "HQ Dashboard User",
  "Additional Site",
];

function isLegacyProductName(name: string | null | undefined): boolean {
  if (!name) return false;
  return LEGACY_NAME_PREFIXES.some(p => name.toLowerCase().startsWith(p.toLowerCase()));
}

interface Body {
  action?: "audit_legacy" | "archive_legacy" | "migrate_legacy_subs";
  environment?: StripeEnv;
  reason?: string;
  dry_run?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "missing bearer token" });

  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "invalid session" });
  const callerId = userData.user.id;

  const { data: isStaff, error: staffErr } = await caller.rpc("is_internal_staff");
  if (staffErr) return json(500, { error: "auth check failed" });
  if (!isStaff)  return json(403, { error: "internal staff only" });

  let body: Body;
  try { body = await req.json() as Body; } catch { return json(400, { error: "invalid json" }); }

  const action      = body.action;
  const environment = body.environment ?? "live";
  const reason      = (body.reason ?? "").trim();
  const dryRun      = Boolean(body.dry_run);

  if (!action) return json(400, { error: "action required" });
  if (reason.length < 5) return json(400, { error: "reason required (min 5 chars)" });
  if (environment !== "live" && environment !== "sandbox") {
    return json(400, { error: "invalid environment" });
  }

  const stripe = createStripeClient(environment);
  const admin  = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const writeAudit = async (extras: Record<string, unknown>) => {
    try {
      const { error } = await admin.from("admin_actions_log").insert({
        performed_by: callerId,
        action_type: `stripe_admin:${action}`,
        target_organisation_id: null,
        reason,
        metadata: { environment, dry_run: dryRun, ...extras },
      });
      if (error) console.error("audit write failed", error);
    } catch (e) { console.error("audit write failed", e); }
  };

  try {
    // ── audit_legacy ──────────────────────────────────────────────────────
    if (action === "audit_legacy") {
      const products: Array<{ id: string; name: string; active: boolean; legacy: boolean; price_count: number }> = [];
      let starting_after: string | undefined = undefined;
      // Paginate through all products
      while (true) {
        const page = await stripe.products.list({ limit: 100, ...(starting_after && { starting_after }) });
        for (const p of page.data) {
          const prices = await stripe.prices.list({ product: p.id, limit: 100 });
          products.push({
            id: p.id, name: p.name, active: p.active,
            legacy: isLegacyProductName(p.name),
            price_count: prices.data.length,
          });
        }
        if (!page.has_more) break;
        starting_after = page.data[page.data.length - 1].id;
      }
      const summary = {
        total: products.length,
        active_legacy: products.filter(p => p.legacy && p.active).length,
        archived_legacy: products.filter(p => p.legacy && !p.active).length,
        active_haccp: products.filter(p => !p.legacy && p.active).length,
      };
      await writeAudit({ summary });
      return json(200, { ok: true, summary, products });
    }

    // ── archive_legacy ────────────────────────────────────────────────────
    if (action === "archive_legacy") {
      const archived: string[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];
      let starting_after: string | undefined = undefined;
      while (true) {
        const page = await stripe.products.list({ limit: 100, active: true, ...(starting_after && { starting_after }) });
        for (const p of page.data) {
          if (!isLegacyProductName(p.name)) { skipped.push({ id: p.id, reason: "not legacy" }); continue; }
          if (dryRun) { archived.push(p.id); continue; }
          // Archive every active price under this product first
          const prices = await stripe.prices.list({ product: p.id, active: true, limit: 100 });
          for (const pr of prices.data) {
            try { await stripe.prices.update(pr.id, { active: false }); }
            catch (e) { console.warn("price archive failed", pr.id, e); }
          }
          // Then archive the product itself
          try { await stripe.products.update(p.id, { active: false }); archived.push(p.id); }
          catch (e) { skipped.push({ id: p.id, reason: (e as Error).message }); }
        }
        if (!page.has_more) break;
        starting_after = page.data[page.data.length - 1].id;
      }
      await writeAudit({ archived_count: archived.length, skipped_count: skipped.length });
      return json(200, { ok: true, archived, skipped });
    }

    // ── migrate_legacy_subs ───────────────────────────────────────────────
    if (action === "migrate_legacy_subs") {
      // Resolve target HACCP price ids
      const resolve = async (key: string) => {
        const l = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
        if (!l.data.length) throw new Error(`Missing required HACCP price: ${key}`);
        return l.data[0].id;
      };
      const haccpSiteMonthly = await resolve(HACCP_SITE.month);
      const haccpSiteAnnual  = await resolve(HACCP_SITE.year);
      const haccpUserMonthly = await resolve(HACCP_USER.month);
      const haccpUserAnnual  = await resolve(HACCP_USER.year);

      const migrated: Array<{ sub_id: string; from: string[]; to: string; cycle: string }> = [];
      const skipped:  Array<{ sub_id: string; reason: string }> = [];

      let starting_after: string | undefined = undefined;
      while (true) {
        const page = await stripe.subscriptions.list({
          status: "all", limit: 100, expand: ["data.items.data.price.product"],
          ...(starting_after && { starting_after }),
        });
        for (const sub of page.data) {
          if (sub.status === "canceled" || sub.status === "incomplete_expired") {
            skipped.push({ sub_id: sub.id, reason: `status=${sub.status}` }); continue;
          }
          // Determine whether any line item points at a legacy product
          let hasLegacy = false;
          let cycle: "month" | "year" = "month";
          let siteQty = 1;
          let userQty = 0;
          for (const item of sub.items.data) {
            const prod = item.price?.product as { name?: string } | string | null | undefined;
            const name = (typeof prod === "object" && prod !== null) ? prod.name : "";
            if (isLegacyProductName(name)) hasLegacy = true;
            cycle = (item.price?.recurring?.interval as "month"|"year") || cycle;
            siteQty = Math.max(siteQty, Number(item.quantity || 1));
          }
          if (!hasLegacy) { skipped.push({ sub_id: sub.id, reason: "already on HACCP / non-legacy" }); continue; }

          const newSitePriceId = cycle === "year" ? haccpSiteAnnual  : haccpSiteMonthly;
          const newUserPriceId = cycle === "year" ? haccpUserAnnual  : haccpUserMonthly;

          // Build the line items: keep the existing site quantity. Per-user quantity
          // is left at 0 here — the post-migration backfill (sync-haccp-user-quantity)
          // sets it from the current active staff count.
          const items: Array<Record<string, unknown>> = sub.items.data.map((it, idx) => ({
            id: it.id,
            ...(idx === 0
              ? { price: newSitePriceId, quantity: siteQty }
              : { deleted: true }),
          }));
          // Add the per-user line item if we have additional users
          if (userQty > 0) items.push({ price: newUserPriceId, quantity: userQty });

          if (dryRun) {
            migrated.push({ sub_id: sub.id, from: sub.items.data.map(i => i.price?.id || ""), to: newSitePriceId, cycle });
            continue;
          }

          try {
            await stripe.subscriptions.update(sub.id, {
              items,
              // Preserve trial. Do not prorate the swap — customers should not be
              // charged retroactively for the change in catalogue.
              proration_behavior: "none",
              metadata: {
                ...(sub.metadata ?? {}),
                plan: "haccp",
                cycle,
                migrated_from_legacy: "true",
                migrated_at: new Date().toISOString(),
              },
            });
            migrated.push({ sub_id: sub.id, from: sub.items.data.map(i => i.price?.id || ""), to: newSitePriceId, cycle });
          } catch (e) {
            skipped.push({ sub_id: sub.id, reason: (e as Error).message });
          }
        }
        if (!page.has_more) break;
        starting_after = page.data[page.data.length - 1].id;
      }

      await writeAudit({ migrated_count: migrated.length, skipped_count: skipped.length });
      return json(200, { ok: true, migrated, skipped });
    }

    return json(400, { error: "unknown action" });
  } catch (e) {
    console.error("stripe-admin error", e);
    await writeAudit({ error: (e as Error).message });
    return json(500, { error: (e as Error).message || "internal error" });
  }
});
