import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, CreditCard, Sparkles, ExternalLink, ArrowUpDown, Plus,
  Building2, AlertCircle, Calendar, CheckCircle2,
} from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { openCustomerPortal } from "@/lib/stripe";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  PLANS, MODULE_LABELS, formatGBP, calcTotalCost,
  type PlanId, type BillingCycle, type ModuleName,
  BASE_MODULES, COMPLIANCE_MODULES, BUSINESS_MODULES,
} from "@/lib/plans";

export default function Account() {
  const navigate = useNavigate();
  const { orgRole, appUser } = useAuth();
  const {
    subscription, loading, hasAccess, compedActive, trialActive, trialDaysLeft,
    plan, cycle, paidActive,
  } = useOrgAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [siteCount, setSiteCount] = useState<number>(1);
  const [savingCycle, setSavingCycle] = useState(false);

  const checkoutPlan = searchParams.get("checkout") as PlanId | "success" | null;
  const checkoutCycle = (searchParams.get("cycle") as BillingCycle | null) ?? cycle;
  const showCheckoutFor: PlanId | null =
    checkoutPlan && checkoutPlan !== "success" && PLANS[checkoutPlan as PlanId]
      ? (checkoutPlan as PlanId) : null;

  useEffect(() => {
    if (!appUser?.organisation_id) return;
    supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", appUser.organisation_id)
      .eq("active", true)
      .then(({ count }) => setSiteCount(count ?? 1));
  }, [appUser?.organisation_id]);

  useEffect(() => {
    if (checkoutPlan === "success") {
      toast.success("Subscription activated. Welcome aboard!");
      const t = setTimeout(() => {
        searchParams.delete("checkout");
        searchParams.delete("session_id");
        searchParams.delete("cycle");
        setSearchParams(searchParams, { replace: true });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [checkoutPlan, searchParams, setSearchParams]);

  // Active modules + savings hint (modules paid for but not enabled on any site)
  const [unusedHint, setUnusedHint] = useState<{ compliance: boolean; business: boolean }>({ compliance: false, business: false });
  useEffect(() => {
    if (!appUser?.organisation_id || (!plan.compliance && !plan.business && !plan.bundle)) {
      setUnusedHint({ compliance: false, business: false });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("module_activation")
        .select("module_name, is_active, sites!inner(organisation_id)")
        .eq("sites.organisation_id", appUser.organisation_id)
        .eq("is_active", true);
      const activeSet = new Set((data ?? []).map((r: any) => r.module_name as ModuleName));
      const complianceUsed = COMPLIANCE_MODULES.some(m => activeSet.has(m));
      const businessUsed = BUSINESS_MODULES.some(m => activeSet.has(m));
      setUnusedHint({
        compliance: !plan.bundle && plan.compliance && !complianceUsed,
        business: !plan.bundle && plan.business && !businessUsed,
      });
    })();
  }, [appUser?.organisation_id, plan.compliance, plan.business, plan.bundle]);

  const totals = useMemo(
    () => calcTotalCost({ ...plan, cycle, sites: siteCount }),
    [plan, cycle, siteCount]
  );

  if (orgRole?.org_role !== "org_owner") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Only the organisation manager can manage billing.
        </CardContent></Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // Active modules covered by current plan
  const activeModuleNames: ModuleName[] = plan.bundle
    ? [...BASE_MODULES, ...COMPLIANCE_MODULES, ...BUSINESS_MODULES]
    : [
        ...(plan.base ? BASE_MODULES : []),
        ...(plan.compliance ? COMPLIANCE_MODULES : []),
        ...(plan.business ? BUSINESS_MODULES : []),
      ];

  const switchCycle = async (next: BillingCycle) => {
    if (!appUser?.organisation_id || next === cycle) return;
    setSavingCycle(true);
    const { error } = await supabase
      .from("subscriptions")
      .update({ billing_interval: next })
      .eq("organisation_id", appUser.organisation_id);
    setSavingCycle(false);
    if (error) toast.error(error.message);
    else toast.success(`Switched to ${next === "year" ? "annual" : "monthly"} billing.`);
  };

  const handleCancel = async () => {
    if (!appUser?.organisation_id) return;
    if (!confirm("Cancel your subscription? You'll keep access until the end of your current billing period. Your data is retained for 7 years.")) return;
    const { error } = await supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("organisation_id", appUser.organisation_id);
    if (error) toast.error(error.message);
    else toast.success("Cancellation scheduled. You'll keep access until your period ends.");
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto pb-24">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" />Account & Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your VenueOS subscription, modules, and invoices.</p>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Current plan
            {compedActive && (
              <Badge className="bg-success/15 text-success border-success/30">
                <Sparkles className="h-3 w-3 mr-1" />Complimentary
              </Badge>
            )}
            {!compedActive && subscription && (
              <Badge variant="outline">{subscription.status}</Badge>
            )}
            {plan.hasAnyPlan && <Badge>{plan.label}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {compedActive && (
            <p>You have complimentary access{subscription?.comped_until ? ` until ${format(new Date(subscription.comped_until), "d MMM yyyy")}` : " (no expiry)"}.</p>
          )}
          {!compedActive && trialActive && (
            <>
              <p>You're on a free trial — <strong>{trialDaysLeft} day(s) left</strong>.</p>
              {!plan.hasAnyPlan && (
                <p className="text-warning">
                  You haven't picked a plan yet.{" "}
                  <button onClick={() => navigate("/pricing")} className="underline font-medium">Choose one now</button>.
                </p>
              )}
            </>
          )}

          {plan.hasAnyPlan && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Sites</p>
                <p className="font-semibold flex items-center gap-1.5"><Building2 className="h-4 w-4" />{siteCount} site{siteCount === 1 ? "" : "s"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total {cycle === "year" ? "annual" : "monthly"} cost</p>
                <p className="text-2xl font-bold">
                  {formatGBP(totals.total)}<span className="text-sm font-normal text-muted-foreground">/{cycle === "year" ? "yr" : "mo"}</span>
                </p>
                {totals.saving > 0 && (
                  <p className="text-[11px] text-success">Saving {formatGBP(totals.saving)} with multi-site discount</p>
                )}
              </div>
              {paidActive && subscription?.current_period_end && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Next billing date</p>
                  <p className="font-semibold">{format(new Date(subscription.current_period_end), "d MMM yyyy")}</p>
                </div>
              )}
              {subscription?.cancel_at_period_end && (
                <div className="space-y-1 sm:col-span-2 p-2 rounded-md bg-warning/10 border border-warning/30">
                  <p className="text-warning flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />Cancellation scheduled</p>
                  {subscription.current_period_end && (
                    <p className="text-xs">You'll keep access until {format(new Date(subscription.current_period_end), "d MMM yyyy")}. Data retained for 7 years.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {plan.hasAnyPlan && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Active modules</p>
              <div className="flex flex-wrap gap-1.5">
                {activeModuleNames.map(m => (
                  <Badge key={m} variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-success" />{MODULE_LABELS[m]}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {!hasAccess && !trialActive && (
            <p className="text-destructive">
              No active access. <button onClick={() => navigate("/pricing")} className="underline">Choose a plan</button> to continue.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              {paidActive ? "Change plan" : "Choose plan"}
            </Button>
            {subscription?.stripe_customer_id && (
              <Button variant="outline" size="sm" onClick={() => openCustomerPortal().catch(e => toast.error(e.message))}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Invoices & payment method
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Savings hints */}
      {(unusedHint.compliance || unusedHint.business) && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-4 text-sm space-y-1">
            <p className="font-medium flex items-center gap-2"><AlertCircle className="h-4 w-4 text-warning" />Save on add-ons you're not using</p>
            {unusedHint.compliance && (
              <p className="text-muted-foreground">No site is using any Compliance module. You could remove the Compliance Add-on to save {formatGBP(PLANS.compliance.monthlyPrice)}/site/month.</p>
            )}
            {unusedHint.business && (
              <p className="text-muted-foreground">No site is using any Business module. You could remove the Business Add-on to save {formatGBP(PLANS.business.monthlyPrice)}/site/month.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Billing cycle */}
      {plan.hasAnyPlan && (
        <Card>
          <CardHeader><CardTitle className="text-base">Billing cycle</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className={cycle === "month" ? "font-semibold" : "text-muted-foreground"}>Monthly</span>
              <Switch
                checked={cycle === "year"}
                disabled={savingCycle}
                onCheckedChange={(v) => switchCycle(v ? "year" : "month")}
              />
              <span className={cycle === "year" ? "font-semibold" : "text-muted-foreground"}>
                Annual <Badge variant="outline" className="ml-1 border-success/40 bg-success/10 text-success text-[10px]">2 months free</Badge>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Switching takes effect on your next renewal. Stripe will pro-rate any difference.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add-ons (only if not on bundle) */}
      {plan.hasAnyPlan && !plan.bundle && (
        <Card>
          <CardHeader><CardTitle className="text-base">Add-ons</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!plan.compliance && (
              <AddOnRow
                planId="compliance"
                cycle={cycle}
                onAdd={() => navigate(`/account?checkout=compliance&cycle=${cycle}`)}
              />
            )}
            {!plan.business && (
              <AddOnRow
                planId="business"
                cycle={cycle}
                onAdd={() => navigate(`/account?checkout=business&cycle=${cycle}`)}
              />
            )}
            <div className="pt-2">
              <Button variant="default" size="sm" onClick={() => navigate(`/account?checkout=bundle&cycle=${cycle}`)}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />Upgrade to Full Bundle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-site */}
      {plan.hasAnyPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sites</CardTitle>
            <CardDescription>Add additional sites — 15% discount applies from the second site.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>You currently have <strong>{siteCount}</strong> active site{siteCount === 1 ? "" : "s"}.</p>
            <p className="text-xs text-muted-foreground">
              Per-site cost: {formatGBP(totals.perSite)} · Each additional site: {formatGBP(totals.discountedSiteCost)} ({100 - 15}% of base).
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Add a site in Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cancel */}
      {paidActive && !subscription?.cancel_at_period_end && (
        <Card>
          <CardHeader><CardTitle className="text-base text-muted-foreground">Cancel subscription</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>You'll keep access until the end of your current billing period. Your data is retained for 7 years after cancellation.</p>
            <Button variant="outline" size="sm" onClick={handleCancel}>Cancel subscription</Button>
          </CardContent>
        </Card>
      )}

      {/* Embedded checkout */}
      {showCheckoutFor && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {paidActive ? "Switch / add" : "Subscribe"} — {PLANS[showCheckoutFor].name}
            </CardTitle>
            <CardDescription>
              {formatGBP(checkoutCycle === "year" ? PLANS[showCheckoutFor].yearlyPrice : PLANS[showCheckoutFor].monthlyPrice)} per site / {checkoutCycle === "year" ? "year" : "month"} · {siteCount} site(s) · 15% off from site 2
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <StripeEmbeddedCheckout plan={showCheckoutFor} cycle={checkoutCycle} siteQuantity={siteCount} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AddOnRow({ planId, cycle, onAdd }: { planId: "compliance" | "business"; cycle: BillingCycle; onAdd: () => void }) {
  const p = PLANS[planId];
  const price = cycle === "year" ? p.yearlyPrice : p.monthlyPrice;
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-md border">
      <div>
        <p className="font-medium">{p.name}</p>
        <p className="text-xs text-muted-foreground">{p.modules.map(m => MODULE_LABELS[m]).join(" · ")}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-sm">{formatGBP(price)}<span className="text-xs text-muted-foreground">/{cycle === "year" ? "yr" : "mo"}</span></p>
        <Button size="sm" variant="outline" className="mt-1" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" />Add
        </Button>
      </div>
    </div>
  );
}
