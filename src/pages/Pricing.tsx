import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, Sparkles, Loader2, ShieldCheck } from "lucide-react";
import { PLANS, MODULE_LABELS, formatGBP, type PlanId, type BillingCycle } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Pricing page — shown after onboarding and reachable from Account & Billing.
 * 14-day trial starts the moment a plan is picked. No card required.
 */
export default function Pricing() {
  const navigate = useNavigate();
  const { appUser, isLoading: authLoading } = useAuth();
  const { subscription, loading, plan, trialActive, trialDaysLeft } = useOrgAccess();
  const [selecting, setSelecting] = useState<PlanId | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("month");

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isTrialing = subscription?.status === "trialing";
  const hasPaidSub = subscription?.status === "active";
  const hasBaseAccess = plan.base || plan.bundle;

  // During trial: pick a plan = update flags only. No Stripe.
  // Add-ons stack on top of Base; they cannot be picked standalone (except AI).
  const startTrialWithPlan = async (planId: PlanId) => {
    if (!appUser?.organisation_id) return;
    if ((planId === "compliance" || planId === "business") && !hasBaseAccess) {
      toast.error("Add-ons require the Base plan. Pick Base or the Full Bundle first.");
      return;
    }
    setSelecting(planId);

    // Build flags depending on which card was picked.
    const flags: {
      billing_interval: BillingCycle;
      base_active?: boolean;
      compliance_active?: boolean;
      business_active?: boolean;
      bundle_active?: boolean;
      ai_active?: boolean;
    } = { billing_interval: cycle };
    if (planId === "ai") {
      // AI is independent — flip ai_active only, leave everything else as-is.
      flags.ai_active = true;
    } else if (planId === "bundle") {
      flags.base_active = false;
      flags.compliance_active = false;
      flags.business_active = false;
      flags.bundle_active = true;
    } else if (planId === "base") {
      // Switching to Base alone clears add-ons / bundle.
      flags.base_active = true;
      flags.compliance_active = false;
      flags.business_active = false;
      flags.bundle_active = false;
    } else {
      // Add-on: keep base on, turn on this add-on, leave the other add-on as-is.
      flags.base_active = true;
      flags.bundle_active = false;
      if (planId === "compliance") flags.compliance_active = true;
      if (planId === "business") flags.business_active = true;
    }

    const { error } = await supabase
      .from("subscriptions")
      .update(flags)
      .eq("organisation_id", appUser.organisation_id);
    setSelecting(null);
    if (error) {
      toast.error("Could not save plan: " + error.message);
      return;
    }
    const isAddon = planId === "compliance" || planId === "business" || planId === "ai";
    const msg = isAddon
      ? `${PLANS[planId].name} added to your trial.`
      : `Welcome to ${PLANS[planId].name}! Your 14-day free trial has started.`;
    toast.success(msg);
    navigate("/", { replace: true });
  };

  // Post-trial / change-of-plan goes via the Account page (Stripe checkout).
  const goToCheckout = (planId: PlanId) => {
    if ((planId === "compliance" || planId === "business") && !hasBaseAccess) {
      toast.error("Add-ons require the Base plan. Subscribe to Base or the Full Bundle first.");
      return;
    }
    navigate(`/account?checkout=${planId}&cycle=${cycle}`);
  };


  const planIds: PlanId[] = ["base", "compliance", "business", "bundle", "ai"];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            14-day free trial — no card required
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            Choose what your venue needs
          </h1>
          <p className="text-muted-foreground">
            All plans are per site, per {cycle === "month" ? "month" : "year"}. Add or remove anytime.
            {isTrialing && trialDaysLeft !== null && trialDaysLeft > 0 && (
              <span className="block mt-1 text-foreground font-medium">
                You have {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left on your trial.
              </span>
            )}
          </p>

          {/* Billing cycle toggle */}
          <div className="inline-flex items-center gap-3 rounded-full border bg-card p-1 px-4">
            <span className={`text-sm font-medium ${cycle === "month" ? "text-foreground" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <Switch
              checked={cycle === "year"}
              onCheckedChange={(v) => setCycle(v ? "year" : "month")}
              aria-label="Toggle annual billing"
            />
            <span className={`text-sm font-medium flex items-center gap-2 ${cycle === "year" ? "text-foreground" : "text-muted-foreground"}`}>
              Annual
              <Badge variant="outline" className="border-success/40 bg-success/10 text-success text-[10px]">
                2 months free
              </Badge>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {planIds.map((planId) => {
            const p = PLANS[planId];
            const isCurrent =
              (planId === "bundle" && plan.bundle) ||
              (planId === "base" && plan.base && !plan.bundle) ||
              (planId === "compliance" && plan.compliance && !plan.bundle) ||
              (planId === "business" && plan.business && !plan.bundle);
            const price = cycle === "year" ? p.yearlyPrice : p.monthlyPrice;
            const monthlyEquivalent = cycle === "year" ? p.yearlyPrice / 12 : null;

            return (
              <Card
                key={planId}
                className={`relative flex flex-col ${
                  p.highlight ? "border-primary border-2 shadow-lg" : ""
                }`}
              >
                {p.highlight && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Best value
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-2.5 right-3 bg-success text-success-foreground">
                    Current
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="font-heading text-lg">{p.name}</CardTitle>
                  <CardDescription className="text-xs">{p.tagline}</CardDescription>
                  <div className="pt-2">
                    <span className="text-3xl font-bold text-foreground">{formatGBP(price)}</span>
                    <span className="text-sm text-muted-foreground"> / site / {cycle === "year" ? "yr" : "mo"}</span>
                    {monthlyEquivalent !== null && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        ≈ {formatGBP(monthlyEquivalent)}/mo
                      </p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <ul className="space-y-1.5 text-sm flex-1">
                    {p.modules.map((m) => (
                      <li key={m} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        <span>{MODULE_LABELS[m]}</span>
                      </li>
                    ))}
                  </ul>

                  {(() => {
                    const isAddon = planId === "compliance" || planId === "business";
                    const needsBaseFirst = isAddon && !hasBaseAccess;
                    const isCurrentPaid = isCurrent && hasPaidSub;
                    const isCurrentTrial = isCurrent && isTrialing;
                    const trialSwitch = isTrialing && !isCurrent;

                    let label: React.ReactNode = "Subscribe now";
                    if (selecting === planId) label = <Loader2 className="h-4 w-4 animate-spin" />;
                    else if (needsBaseFirst) label = "Requires Base plan";
                    else if (isCurrentPaid) label = "Current plan";
                    else if (isCurrentTrial) label = "Subscribe now";
                    else if (trialSwitch) label = isAddon ? "Add to trial" : "Switch & continue trial";
                    else if (hasPaidSub) label = isAddon ? "Add to plan" : "Switch to this plan";

                    const onClick = () => {
                      if (trialSwitch) startTrialWithPlan(planId);
                      else goToCheckout(planId);
                    };

                    return (
                      <Button
                        className="w-full"
                        variant={p.highlight ? "default" : "outline"}
                        disabled={isCurrentPaid || needsBaseFirst || selecting !== null}
                        onClick={onClick}
                      >
                        {label}
                      </Button>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            All prices in GBP. Multi-site discount of 15% applies from the second site.
          </p>
          <p>Cancel anytime — you keep access until the end of your billing period. Data is retained for 7 years.</p>
        </div>
      </div>
    </div>
  );
}
