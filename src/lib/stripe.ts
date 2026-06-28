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

/**
 * Opens the Stripe Customer Portal in the SAME tab.
 * Throws an Error with the server-provided message on any failure — callers
 * must surface the message; do NOT navigate the user anywhere on error.
 */
export async function openCustomerPortal(returnUrl?: string) {
  const target = returnUrl || `${window.location.origin}/account`;
  const { data, error } = await supabase.functions.invoke("customer-portal", {
    body: { returnUrl: target, environment: stripeEnvironment },
  });

  // Prefer the server's error message (works for FunctionsHttpError + any
  // function that returns { error } with a non-2xx status).
  if (error) {
    let serverMsg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) serverMsg = body.error;
      }
    } catch { /* ignore */ }
    throw new Error(serverMsg || "Could not open the Stripe billing portal.");
  }

  // Defensive: function returned 2xx but no URL (shouldn't happen).
  if (!data?.url || typeof data.url !== "string") {
    throw new Error(
      (data as { error?: string } | null)?.error
        || "The billing portal didn't return a URL. Please try again.",
    );
  }

  window.location.href = data.url;
}
