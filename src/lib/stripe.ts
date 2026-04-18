import { loadStripe, Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
export const stripeEnvironment: "sandbox" | "live" =
  clientToken?.startsWith("pk_live_") ? "live" : "sandbox";

let stripePromise: Promise<Stripe | null> | null = null;
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN not set");
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export async function openCustomerPortal(returnUrl?: string) {
  const { data, error } = await supabase.functions.invoke("customer-portal", {
    body: { returnUrl: returnUrl || window.location.href, environment: stripeEnvironment },
  });
  if (error || !data?.url) throw new Error(error?.message || "Could not open billing portal");
  window.open(data.url, "_blank");
}
