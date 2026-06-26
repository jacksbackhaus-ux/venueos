import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, stripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import type { PlanId, BillingCycle } from "@/lib/plans";

export interface UserQuotaConflict {
  activeUserCount: number;
  allowedUserCount: number;
  mustDeactivate: number;
  deactivatable: Array<{ id: string; name: string; email: string | null; auth_type: string; is_owner: boolean }>;
}

interface Props {
  /** Plan id. Use "haccp" for the new MiseOS HACCP launch product. */
  plan: PlanId | "haccp";
  cycle: BillingCycle;
  siteQuantity?: number;
  /** Additional users beyond the included 1 per site (HACCP only). */
  userQuantity?: number;
  returnUrl?: string;
  addSiteMode?: boolean;
  /** Called when the requested seat count is lower than current active users. */
  onUserQuotaConflict?: (conflict: UserQuotaConflict) => void;
}

/**
 * Embedded Stripe Checkout for the HACCP launch.
 * Surfaces failures from create-checkout instead of hanging on the
 * Stripe-internal skeleton forever.
 */
export function StripeEmbeddedCheckout({
  plan, cycle, siteQuantity = 1, userQuantity = 0, returnUrl, addSiteMode = false,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setSecret(null);

    const timeout = window.setTimeout(() => {
      if (!cancelled && !secret) {
        setError("Checkout is taking longer than expected. Please try again.");
      }
    }, 12000);

    (async () => {
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke("create-checkout", {
          body: {
            plan, cycle, siteQuantity, userQuantity, addSiteMode,
            returnUrl: returnUrl || `${window.location.origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            environment: stripeEnvironment,
          },
        });
        if (cancelled) return;
        if (invokeErr || !data?.clientSecret) {
          const msg = (data && (data as { error?: string }).error) || invokeErr?.message || "Could not start checkout";
          console.error("[create-checkout] failed", { invokeErr, data });
          setError(msg);
          return;
        }
        setSecret(data.clientSecret as string);
      } catch (e) {
        if (cancelled) return;
        console.error("[create-checkout] threw", e);
        setError((e as Error).message || "Could not start checkout");
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [plan, cycle, siteQuantity, userQuantity, returnUrl, addSiteMode, attempt]);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    // Stripe's provider calls this once; we already have it.
    if (secret) return secret;
    throw new Error("Checkout not ready");
  }, [secret]);

  const checkoutOptions = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  if (error) {
    return (
      <div className="p-6 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  if (!secret) {
    return (
      <div className="p-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Preparing secure checkout…</span>
      </div>
    );
  }

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={checkoutOptions}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
