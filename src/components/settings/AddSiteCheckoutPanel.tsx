import { Button } from "@/components/ui/button";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { HACCP_LAUNCH } from "@/lib/sitePricing";
import type { PlanId, BillingCycle } from "@/lib/plans";

interface AddSiteCheckoutPanelProps {
  currentPlan: PlanId | null;
  cycle: BillingCycle;
  /** Site quantity currently on the subscription — checkout buys one more than this. */
  siteQuantity: number;
  returnUrl: string;
  onCancel: () => void;
}

/**
 * Embedded Stripe checkout for buying one additional HACCP site slot.
 * Shared by "Add another site" and "Move to a new site" so the purchase
 * flow only exists in one place.
 */
export function AddSiteCheckoutPanel({ currentPlan, cycle, siteQuantity, returnUrl, onCancel }: AddSiteCheckoutPanelProps) {
  if (!HACCP_LAUNCH && !currentPlan) return null;
  return (
    <div className="rounded-lg border overflow-hidden">
      <StripeEmbeddedCheckout
        plan={HACCP_LAUNCH ? "haccp" : (currentPlan as PlanId)}
        cycle={cycle}
        siteQuantity={siteQuantity + 1}
        addSiteMode
        returnUrl={returnUrl}
      />
      <div className="p-2 border-t bg-muted/20 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
