import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, stripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

interface Props {
  siteQuantity: number;
  hqQuantity: number;
  billingInterval: "month" | "year";
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ siteQuantity, hqQuantity, billingInterval, returnUrl }: Props) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        siteQuantity, hqQuantity, billingInterval,
        returnUrl: returnUrl || `${window.location.origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        environment: stripeEnvironment,
      },
    });
    if (error || !data?.clientSecret) throw new Error(error?.message || "Could not start checkout");
    return data.clientSecret;
  }, [siteQuantity, hqQuantity, billingInterval, returnUrl]);

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
