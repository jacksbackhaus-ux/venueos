import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, stripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useMemo } from "react";
import type { PlanId, BillingCycle } from "@/lib/plans";

interface Props {
  /** Plan id. Use "haccp" for the new MiseOS HACCP launch product. */
  plan: PlanId | "haccp";
  cycle: BillingCycle;
  siteQuantity?: number;
  /** Additional users beyond the included 1 per site (HACCP only). */
  userQuantity?: number;
  returnUrl?: string;
  addSiteMode?: boolean;
}

/**
 * Embedded Stripe Checkout. For the HACCP launch, pass plan="haccp" and
 * the per-site + per-user quantities; the edge function turns these into
 * two Stripe line items using the new lookup keys.
 */
export function StripeEmbeddedCheckout({
  plan, cycle, siteQuantity = 1, userQuantity = 0, returnUrl, addSiteMode = false,
}: Props) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        plan, cycle, siteQuantity, userQuantity, addSiteMode,
        returnUrl: returnUrl || `${window.location.origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        environment: stripeEnvironment,
      },
    });
    if (error || !data?.clientSecret) throw new Error(error?.message || "Could not start checkout");
    return data.clientSecret;
  }, [plan, cycle, siteQuantity, userQuantity, returnUrl, addSiteMode]);

  const checkoutOptions = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={checkoutOptions}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
