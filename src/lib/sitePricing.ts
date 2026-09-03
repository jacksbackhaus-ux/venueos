import { PLANS, TIERS, type PlanId, type TierId, type BillingCycle } from "@/lib/plans";
import { LAUNCH_MODE } from "@/lib/launchFlags";

export const HACCP_LAUNCH = LAUNCH_MODE === "haccp";
export const HACCP_SITE_MONTHLY = 4.99;
export const HACCP_SITE_ANNUAL = 49.90;

export type SubLike = {
  base_active: boolean; compliance_active: boolean; business_active: boolean; bundle_active: boolean;
  ai_active?: boolean;
  tier?: TierId | null;
} | null;

/**
 * Plan id used by Stripe checkout when the customer adds a site.
 * - New tier subs → use the tier id directly.
 * - Legacy subs → fall back to base/compliance/business/bundle from flags.
 */
export function resolveCurrentPlan(sub: SubLike): PlanId | null {
  if (!sub) return null;
  if (sub.tier && (sub.tier as string) in TIERS) return sub.tier as unknown as PlanId;
  if (sub.bundle_active) return "bundle";
  if (sub.base_active) return "base";
  if (sub.compliance_active) return "compliance";
  if (sub.business_active) return "business";
  return null;
}

/** Per-site cost per period — tier price if set, else legacy module stack. */
export function perSiteCost(sub: SubLike, cycle: BillingCycle): number {
  if (!sub) return 0;
  if (sub.tier && (sub.tier as string) in TIERS) {
    const t = TIERS[sub.tier];
    return cycle === "year" ? t.yearlyPrice : t.monthlyPrice;
  }
  const legacyPrice = (id: "base" | "compliance" | "business" | "bundle") =>
    cycle === "year" ? PLANS[id].yearlyPrice : PLANS[id].monthlyPrice;
  if (sub.bundle_active) return legacyPrice("bundle");
  let total = 0;
  if (sub.base_active) total += legacyPrice("base");
  if (sub.compliance_active) total += legacyPrice("compliance");
  if (sub.business_active) total += legacyPrice("business");
  return total;
}

/** The price shown to the customer for one additional site, HACCP-launch aware. */
export function additionalSitePriceFor(sub: SubLike, cycle: BillingCycle): number {
  if (HACCP_LAUNCH) return cycle === "year" ? HACCP_SITE_ANNUAL : HACCP_SITE_MONTHLY;
  return perSiteCost(sub, cycle);
}

/** Whether the org has an active subscription that can carry an extra site. */
export function hasActivePlanFor(sub: SubLike): boolean {
  if (HACCP_LAUNCH) return true;
  return !!resolveCurrentPlan(sub) &&
    !!(sub?.base_active || sub?.bundle_active || sub?.compliance_active || sub?.business_active);
}

/**
 * Map the stored `subscriptions.billing_interval` ("monthly_term" /
 * "annual_upfront", written by the Stripe webhook) onto the "month" | "year"
 * cycle the pricing helpers and checkout expect. Casting the raw column
 * straight to BillingCycle silently treated annual customers as monthly.
 */
export function cycleFromInterval(interval?: string | null): BillingCycle {
  return interval === "annual_upfront" || interval === "year" || interval === "annual"
    ? "year"
    : "month";
}
