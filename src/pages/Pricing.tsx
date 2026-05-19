import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, Sparkles, Loader2, ShieldCheck } from "lucide-react";
import {
  TIERS, TIER_ORDER, MODULE_LABELS, formatGBP, deriveTierFromFlags,
  type TierId, type BillingCycle,
} from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";


/**
 * Pricing page — 4-tier model. Trial users can switch tiers freely
 * (flag-set on the subscriptions row); paid users go via Stripe checkout.
 */
export default function Pricing() {
  const navigate = useNavigate();
  const { appUser, isLoading: authLoading } = useAuth();
  const { subscription, loading, plan, trialActive, trialDaysLeft } = useOrgAccess();
  const [selecting, setSelecting] = useState<TierId | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>("month");

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <SEO
          title="Pricing — MiseOS"
          description="Simple per-site pricing for UK food businesses. Essentials, Professional, Business and Intelligence plans with a 14-day free trial."
          path="/pricing"
        />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  const isTrialing = subscription?.status === "trialing";
  const hasPaidSub = subscription?.status === "active";
  const currentTier: TierId | null =
    (subscription as { tier?: TierId | null } | null)?.tier ?? deriveTierFromFlags(plan);

  // During trial: pick a tier = set tier on the subscription row. No Stripe.
  // Module activation is updated automatically by trg_sync_modules_on_sub_change.
  const startTrialWithTier = async (tierId: TierId) => {
    if (!appUser?.organisation_id) return;
    setSelecting(tierId);
    const tier = TIERS[tierId];
    const { error } = await supabase
      .from("subscriptions")
      .update({
        billing_interval: cycle,
        tier: tierId,
      })
      .eq("organisation_id", appUser.organisation_id);
    setSelecting(null);
    if (error) {
      toast.error("Could not save plan: " + error.message);
      return;
    }
    toast.success(`Welcome to ${tier.name} — your free trial continues.`);
    navigate("/", { replace: true });
  };

  const goToCheckout = (tierId: TierId) => {
    navigate(`/account?checkout=${tierId}&cycle=${cycle}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Pricing — MiseOS"
        description="Simple per-site pricing for UK food businesses. Essentials, Professional, Business and Intelligence plans with a 14-day free trial."
        path="/pricing"
      />
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">

        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            14-day free trial — no card required
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            Choose your tier
          </h1>
          <p className="text-muted-foreground">
            Per site, per {cycle === "month" ? "month" : "year"}. Each tier builds on the last.
            {isTrialing && trialDaysLeft !== null && trialDaysLeft > 0 && (
              <span className="block mt-1 text-foreground font-medium">
                You have {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left on your trial.
              </span>
            )}
          </p>

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
                ~17% off
              </Badge>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIER_ORDER.map((tierId) => {
            const t = TIERS[tierId];
            const isCurrent = currentTier === tierId;
            const price = cycle === "year" ? t.yearlyPrice : t.monthlyPrice;
            const monthlyEquivalent = cycle === "year" ? t.yearlyPrice / 12 : null;

            return (
              <Card
                key={tierId}
                className={`relative flex flex-col ${
                  t.highlight ? "border-primary border-2 shadow-lg" : ""
                } ${t.ai ? "border-2 border-indigo-400/40 bg-gradient-to-br from-indigo-500/5 to-purple-500/10 shadow-md" : ""}`}
              >
                {t.highlight && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Most popular
                  </Badge>
                )}
                {t.ai && !isCurrent && (
                  <Badge variant="secondary" className="absolute -top-2.5 right-3">
                    AI
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-2.5 right-3 bg-success text-success-foreground">
                    Current
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    {t.ai && <Sparkles className="h-4 w-4 text-indigo-500" />}
                    {t.name}
                  </CardTitle>
                  <CardDescription className="text-xs">{t.tagline}</CardDescription>
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
                    {t.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <Check className={`h-4 w-4 shrink-0 mt-0.5 ${t.ai ? "text-indigo-500" : "text-success"}`} />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">All modules</summary>
                    <ul className="mt-2 space-y-0.5 pl-2">
                      {t.modules.map((m) => (
                        <li key={m}>• {MODULE_LABELS[m]}</li>
                      ))}
                    </ul>
                  </details>

                  {(() => {
                    const isCurrentPaid = isCurrent && hasPaidSub;
                    const trialSwitch = isTrialing && !isCurrent;

                    let label: React.ReactNode = "Subscribe now";
                    if (selecting === tierId) label = <Loader2 className="h-4 w-4 animate-spin" />;
                    else if (isCurrentPaid) label = "Current plan";
                    else if (isCurrent && isTrialing) label = "Subscribe now";
                    else if (trialSwitch) label = "Switch & continue trial";
                    else if (hasPaidSub) label = "Switch to this tier";

                    const onClick = () => {
                      if (trialSwitch) startTrialWithTier(tierId);
                      else goToCheckout(tierId);
                    };

                    return (
                      <Button
                        className="w-full"
                        variant={t.highlight ? "default" : "outline"}
                        disabled={isCurrentPaid || selecting !== null}
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
