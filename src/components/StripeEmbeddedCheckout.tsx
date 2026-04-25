import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, stripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";
import type { PlanId, BillingCycle } from "@/lib/plans";

interface Props {
  plan: PlanId;
  cycle: BillingCycle;
  siteQuantity?: number;
  /** When true, this is an add-on bought alongside an existing plan (no separate checkout — go via portal). */
  returnUrl?: string;
}

/**
 * Embedded Stripe Checkout for the *primary* plan (Base or Bundle).
 * Add-ons (Compliance / Business) are managed via the customer portal once
 * a paid subscription exists. New subscriptions can also include add-ons by
 * passing a comma-separated `withAddons` list to create-checkout.
 */
export function StripeEmbeddedCheckout({
  plan, cycle, siteQuantity = 1, returnUrl,
}: Props) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        plan, cycle, siteQuantity,
        returnUrl: returnUrl || `${window.location.origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        environment: stripeEnvironment,
      },
    });
    if (error || !data?.clientSecret) throw new Error(error?.message || "Could not start checkout");
    return data.clientSecret;
  }, [plan, cycle, siteQuantity, returnUrl]);

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
