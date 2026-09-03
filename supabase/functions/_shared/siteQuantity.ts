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
