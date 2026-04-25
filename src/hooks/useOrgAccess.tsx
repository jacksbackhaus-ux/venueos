import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TIERS, type Tier } from "@/lib/tiers";

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
  tier: Tier | null;
}

function isTier(value: string | null | undefined): value is Tier {
  return value === "starter" || value === "pro" || value === "multisite";
}

export function useOrgAccess() {
  const { appUser, staffSession } = useAuth();
  const orgId = appUser?.organisation_id || staffSession?.organisation_id || null;
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!orgId) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("organisation_id", orgId)
        .maybeSingle();

      if (error) throw error;

      const normalized = data
        ? ({
            ...data,
            tier: isTier(data.tier) ? data.tier : null,
          } as OrgSubscription)
        : null;

      setSubscription(normalized);
    } catch (error) {
      console.error("Failed to load subscription state.", error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(
        `org-access-${orgId}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
      )
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `organisation_id=eq.${orgId}`,
        },
        () => {
          void refreshRef.current();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  const now = Date.now();
  const compedActive = !!subscription?.is_comped &&
    (!subscription.comped_until || new Date(subscription.comped_until).getTime() > now);
  const trialActive = subscription?.status === "trialing" &&
    !!subscription.trial_end && new Date(subscription.trial_end).getTime() > now;
  const trialExpired = subscription?.status === "trialing" &&
    !!subscription.trial_end && new Date(subscription.trial_end).getTime() <= now;
  const paidActive = ["active", "trialing"].includes(subscription?.status || "") &&
    !trialExpired &&
    (!subscription?.current_period_end || new Date(subscription.current_period_end).getTime() > now);

  const hasAccess = compedActive || (trialActive && !trialExpired) || (paidActive && subscription?.status === "active");
  const trialDaysLeft = subscription?.trial_end
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - now) / 86400000))
    : null;

  const storedTier: Tier | null = isTier(subscription?.tier) ? subscription.tier : null;
  // During an active trial (or comp) without an explicit tier selection, treat
  // the org as Pro so they can preview all Pro-tier modules. Once the trial
  // expires or converts, the real tier from the subscription is used.
  const tier: Tier | null = storedTier
    ?? ((trialActive || compedActive) ? "pro" : null);
  const tierDef = tier ? TIERS[tier] : null;

  return {
    subscription,
    loading,
    hasAccess,
    compedActive,
    trialActive,
    trialExpired,
    trialDaysLeft,
    refresh,
    tier,
    tierDef,
  };
}
