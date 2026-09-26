// Pure decision logic for reconciling a Stripe HACCP site-quantity line item
// with an organisation's real count of active sites. Kept dependency-free so
// it can be imported both by the Deno edge function and by a Node/Vitest test.

/** Never bill for fewer than one site, even if every site is somehow archived. */
export const MIN_SITE_QUANTITY = 1;

export interface SiteQuantityDecision {
  /** The quantity Stripe's site line item should be set to. */
  targetQuantity: number;
  /** Whether targetQuantity differs from what Stripe currently has. */
  changed: boolean;
}

/**
 * Given the org's real count of active sites and Stripe's current site
 * line-item quantity (null if there is no such item yet), decide what
 * Stripe's quantity should be and whether it needs updating.
 */
export function decideSiteQuantity(
  activeSiteCount: number,
  currentStripeQuantity: number | null,
): SiteQuantityDecision {
  const targetQuantity = Math.max(MIN_SITE_QUANTITY, activeSiteCount);
  return {
    targetQuantity,
    changed: currentStripeQuantity !== targetQuantity,
  };
}

/**
 * Number of sites the org should be billed for right now.
 *
 * During an active MOVE (a transfer with a new site), the site being moved
 * away from is not billed — the 14-day overlap is free. A plain CLOSE
 * window (no new site) keeps billing the closing site until it archives.
 */
export function billableSiteCount(
  activeSiteIds: string[],
  activeTransfer: { from_site_id: string; to_site_id: string | null } | null,
): number {
  const isMove = !!activeTransfer && !!activeTransfer.to_site_id;
  if (!isMove) return activeSiteIds.length;
  return activeSiteIds.filter((id) => id !== activeTransfer!.from_site_id).length;
}

export interface AddSiteOutcomeInput {
  /** Subscription.pending_update from Stripe after the update call. */
  pendingUpdate: unknown;
  /** Site line-item quantity on the returned subscription. */
  siteItemQuantity: number | null;
  /** Quantity we asked for. */
  expectedQuantity: number;
  /** Status of the invoice Stripe raised for the change (null if none). */
  invoiceStatus: string | null;
  /** Amount still due on that invoice, in minor units. */
  invoiceAmountDue: number | null;
}

/**
 * Decide whether an "add a site" subscription update was actually paid and
 * applied. Only "paid" means the site may be created. Anything uncertain is
 * treated as not paid — we would rather refuse a site than give one away or
 * create one Stripe hasn't billed for.
 */
export function decideAddSiteOutcome(i: AddSiteOutcomeInput): "paid" | "payment_failed" | "needs_review" {
  if (i.pendingUpdate) return "payment_failed";
  if (i.siteItemQuantity !== i.expectedQuantity) return "needs_review";
  if (i.invoiceStatus === null) return "needs_review";
  if (i.invoiceStatus === "paid") return "paid";
  if (i.invoiceAmountDue === 0 && i.invoiceStatus !== "void" && i.invoiceStatus !== "uncollectible") return "paid";
  return "needs_review";
}
