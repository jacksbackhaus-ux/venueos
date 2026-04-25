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

  // During trial: pick a plan = update flags only. No Stripe.
  const startTrialWithPlan = async (planId: PlanId) => {
    if (!appUser?.organisation_id) return;
    setSelecting(planId);
    const flags = {
      base_active: planId === "base",
      compliance_active: planId === "compliance",
      business_active: planId === "business",
      bundle_active: planId === "bundle",
      billing_interval: cycle,
    };
    const { error } = await supabase
      .from("subscriptions")
      .update(flags)
      .eq("organisation_id", appUser.organisation_id);
    setSelecting(null);
    if (error) {
      toast.error("Could not save plan: " + error.message);
      return;
    }
    toast.success(`Welcome to ${PLANS[planId].name}! Your 14-day free trial has started.`);
    navigate("/", { replace: true });
  };

  // Post-trial / change-of-plan goes via the Account page (Stripe checkout).
  const goToCheckout = (planId: PlanId) => {
    navigate(`/account?checkout=${planId}&cycle=${cycle}`);
  };

  const handleSelect = (planId: PlanId) => {
    if (hasPaidSub) goToCheckout(planId);
    else if (isTrialing) startTrialWithPlan(planId);
    else goToCheckout(planId);
  };

  const planIds: PlanId[] = ["base", "compliance", "business", "bundle"];

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

                  <Button
                    className="w-full"
                    variant={p.highlight ? "default" : "outline"}
                    disabled={isCurrent || selecting !== null}
                    onClick={() => handleSelect(planId)}
                  >
                    {selecting === planId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrent ? (
                      "Current plan"
                    ) : isTrialing ? (
                      "Start 14-day free trial"
                    ) : hasPaidSub ? (
                      "Switch to this plan"
                    ) : (
                      "Choose plan"
                    )}
                  </Button>
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
