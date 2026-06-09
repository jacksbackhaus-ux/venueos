import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { BillingCycle, PlanId, TierId } from "@/lib/plans";

export interface OrgSubscription {
  id: string;
  status: string;
  is_comped: boolean;
  comped_until: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_interval: BillingCycle | null;
  site_quantity: number;
  hq_quantity: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  /** @deprecated kept for backwards-compatibility — do not gate on these. Use `tier`. */
  base_active: boolean;
  /** @deprecated */ compliance_active: boolean;
  /** @deprecated */ business_active: boolean;
  /** @deprecated */ bundle_active: boolean;
  /** @deprecated */ ai_active: boolean;
  tier: TierId | null;
  locked_at: string | null;
  organisation_id: string;
  updated_at: string | null;
}

/** Snapshot of plan state for the org. Shape preserved for existing consumers; values are now derived from `tier`. */
export interface PlanState {
  /** Essentials modules unlocked. */
  base: boolean;
  compliance: boolean;
  business: boolean;
  /** True for Business or Intelligence tier — keeps existing call sites working. */
  bundle: boolean;
  ai: boolean;
  hasAnyPlan: boolean;
  /** Whether the org has an Intelligence tier (AI insights). */
  intelligence: boolean;
  label: string;
  primary: PlanId | null;
}

const TIER_LABEL: Record<TierId, string> = {
  essentials: "Essentials",
  compliance: "Compliance",
  profit: "Profit",
  intelligence: "Intelligence",
};

function planFromTier(tier: TierId | null): PlanState {
  if (!tier) {
    return {
      base: false, compliance: false, business: false, bundle: false, ai: false,
      hasAnyPlan: false, intelligence: false, label: "No plan", primary: null,
    };
  }
  const hasEssentials = true;
  const hasCompliance = tier === "compliance" || tier === "profit" || tier === "intelligence";
  const hasBusiness   = tier === "profit" || tier === "intelligence";
  const hasIntelligence = tier === "intelligence";
  // `bundle` historically meant "full set of modules". Treat Profit/Intelligence as bundle-equivalent.
  const bundle = hasBusiness;
  return {
    base: hasEssentials,
    compliance: hasCompliance,
    business: hasBusiness,
    bundle,
    ai: hasIntelligence,
    intelligence: hasIntelligence,
    hasAnyPlan: true,
    label: TIER_LABEL[tier],
    primary: hasBusiness ? "bundle"
           : hasCompliance ? "compliance"
           : "base",
  };
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
      setSubscription((data as unknown as OrgSubscription) ?? null);
    } catch (error) {
      console.error("Failed to load subscription state.", error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`org-access-${orgId}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "subscriptions", filter: `organisation_id=eq.${orgId}` },
        () => { void refreshRef.current(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orgId]);

  const now = Date.now();
  const compedActive = !!subscription?.is_comped &&
    (!subscription.comped_until || new Date(subscription.comped_until).getTime() > now);
  const trialActive = subscription?.status === "trialing" &&
    !!subscription.trial_end && new Date(subscription.trial_end).getTime() > now;
  const trialExpired = subscription?.status === "trialing" &&
    !!subscription.trial_end && new Date(subscription.trial_end).getTime() <= now;
  const paidActive = ["active"].includes(subscription?.status || "") &&
    (!subscription?.current_period_end || new Date(subscription.current_period_end).getTime() > now);
  const canceledWithGrace =
    subscription?.status === "canceled" &&
    !!subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() > now;
  const isLocked = !!subscription?.locked_at || (trialExpired && !paidActive && !compedActive);

  const hasAccess = compedActive || trialActive || paidActive || canceledWithGrace;
  const trialDaysLeft = subscription?.trial_end
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - now) / 86400000))
    : null;

  // Source of truth: subscriptions.tier. Trial without tier → grant Essentials view.
  const effectiveTier: TierId | null = subscription?.tier
    ?? (trialActive ? "essentials" : null);
  const plan = planFromTier(effectiveTier);

  return {
    subscription,
    loading,
    hasAccess,
    compedActive,
    trialActive,
    trialExpired,
    trialDaysLeft,
    paidActive,
    canceledWithGrace,
    isLocked,
    refresh,
    plan,
    tier: effectiveTier,
    cycle: (subscription?.billing_interval ?? "month") as BillingCycle,
  };
}
