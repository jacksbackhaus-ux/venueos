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
    body: { returnUrl: returnUrl || `${window.location.origin}/account`, environment: stripeEnvironment },
  });
  // FunctionsHttpError exposes the JSON body via error.context.
  if (error) {
    let serverMsg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) serverMsg = body.error;
      }
    } catch { /* ignore */ }
    throw new Error(serverMsg || "Could not open billing portal");
  }
  if (!data?.url) throw new Error("Could not open billing portal");
  window.location.href = data.url;
}
