import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { BillingCycle, PlanId } from "@/lib/plans";

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
  base_active: boolean;
  compliance_active: boolean;
  business_active: boolean;
  bundle_active: boolean;
  locked_at: string | null;
}

/** Snapshot of plan state for the org. */
export interface PlanState {
  base: boolean;
  compliance: boolean;
  business: boolean;
  bundle: boolean;
  /** Convenience: which named plans are "owned" */
  hasAnyPlan: boolean;
  /** Best label for current selection. */
  label: string;
  primary: PlanId | null;
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

  const flags: PlanState = (() => {
    const base = !!subscription?.base_active;
    const compliance = !!subscription?.compliance_active;
    const business = !!subscription?.business_active;
    const bundle = !!subscription?.bundle_active;
    const hasAnyPlan = base || compliance || business || bundle;
    let primary: PlanId | null = null;
    let label = "No plan";
    if (bundle) { primary = "bundle"; label = "Full Bundle"; }
    else if (base && compliance && business) { primary = "bundle"; label = "Base + Compliance + Business"; }
    else if (base && compliance) { primary = "base"; label = "Base + Compliance"; }
    else if (base && business) { primary = "base"; label = "Base + Business"; }
    else if (base) { primary = "base"; label = "Base Platform"; }
    else if (compliance) { primary = "compliance"; label = "Compliance Add-on"; }
    else if (business) { primary = "business"; label = "Business Add-on"; }
    return { base, compliance, business, bundle, hasAnyPlan, label, primary };
  })();

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
    plan: flags,
    cycle: (subscription?.billing_interval ?? "month") as BillingCycle,
  };
}
