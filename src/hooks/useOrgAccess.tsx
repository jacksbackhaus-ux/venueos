import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OrgSubscription {
  id: string;
  status: string;
  is_comped: boolean;
  comped_until: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_interval: string | null;
  site_quantity: number;
  hq_quantity: number;
  stripe_customer_id: string | null;
}

/** Returns the org's subscription row + a derived hasAccess flag. */
export function useOrgAccess() {
  const { appUser, staffSession } = useAuth();
  const orgId = appUser?.organisation_id || staffSession?.organisation_id || null;
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("subscriptions")
      .select("*").eq("organisation_id", orgId).maybeSingle();
    setSubscription(data as OrgSubscription | null);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime updates
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase.channel(`sub-${orgId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "subscriptions",
        filter: `organisation_id=eq.${orgId}`,
      }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, refresh]);

  const now = Date.now();
  const compedActive = !!subscription?.is_comped &&
    (!subscription.comped_until || new Date(subscription.comped_until).getTime() > now);
  const trialActive = subscription?.status === "trialing" &&
    !!subscription.trial_end && new Date(subscription.trial_end).getTime() > now;
  const paidActive = ["active", "trialing"].includes(subscription?.status || "") &&
    (!subscription?.current_period_end || new Date(subscription.current_period_end).getTime() > now);

  const hasAccess = compedActive || trialActive || paidActive;
  const trialDaysLeft = subscription?.trial_end
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - now) / 86400000))
    : null;

  return { subscription, loading, hasAccess, compedActive, trialActive, trialDaysLeft, refresh };
}
