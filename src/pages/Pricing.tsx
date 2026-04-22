import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Loader2, ShieldCheck } from "lucide-react";
import { TIERS, type Tier, formatGBP } from "@/lib/tiers";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";

/**
 * Pricing page shown after onboarding (trial start) and reachable from
 * Account & Billing for tier changes. No card required to start the trial.
 */
export default function Pricing() {
  const navigate = useNavigate();
  const { appUser, isLoading: authLoading } = useAuth();
  const { subscription, loading, tier: currentTier, trialActive, trialDaysLeft } = useOrgAccess();
  const [selecting, setSelecting] = useState<Tier | null>(null);

  // If they already have a paid subscription, send them back to billing.
  useEffect(() => {
    if (!loading && subscription?.status === "active" && currentTier) {
      // allow viewing, but no auto-redirect — they may want to change tier
    }
  }, [loading, subscription, currentTier]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isTrialing = subscription?.status === "trialing";
  const hasPaidSub = subscription?.status === "active";

  // Picking a tier during trial = just record it on the subscription row.
  // No Stripe checkout, no card. They'll be prompted to add card when trial ends.
  const startTrialWithTier = async (tier: Tier) => {
    if (!appUser?.organisation_id) return;
    setSelecting(tier);
    const { error } = await supabase
      .from("subscriptions")
      .update({ tier })
      .eq("organisation_id", appUser.organisation_id);
    setSelecting(null);
    if (error) {
      toast.error("Could not save plan: " + error.message);
      return;
    }
    toast.success(`Welcome to ${TIERS[tier].name}! Your 14-day free trial has started.`);
    navigate("/", { replace: true });
  };

  // Picking a tier after trial / for change = open Stripe checkout in Account page.
  const goToCheckout = (tier: Tier) => {
    navigate(`/account?checkout=${tier}`);
  };

  const handleSelect = (tier: Tier) => {
    if (hasPaidSub) {
      goToCheckout(tier);
    } else if (isTrialing) {
      startTrialWithTier(tier);
    } else {
      // expired trial / canceled — needs payment
      goToCheckout(tier);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            14-day free trial — no card required
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            Choose the plan that fits your venue
          </h1>
          <p className="text-muted-foreground">
            Try any tier free for 14 days. Add payment details before your trial ends to keep going.
            {isTrialing && trialDaysLeft !== null && trialDaysLeft > 0 && (
              <span className="block mt-1 text-foreground font-medium">
                You have {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left on your trial.
              </span>
            )}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {(Object.keys(TIERS) as Tier[]).map((tierId) => {
            const t = TIERS[tierId];
            const isCurrent = currentTier === tierId;
            return (
              <Card
                key={tierId}
                className={`relative flex flex-col ${
                  t.highlight ? "border-primary border-2 shadow-lg" : ""
                }`}
              >
                {t.highlight && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Most popular
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-2.5 right-3 bg-success text-success-foreground">
                    Current plan
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="font-heading text-xl">{t.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">
                      {formatGBP(t.basePrice)}
                    </span>
                    <span className="text-sm text-muted-foreground"> / site / month</span>
                  </CardDescription>
                  {t.extraSitePrice > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      + {formatGBP(t.extraSitePrice)} per additional site
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <ul className="space-y-2 text-sm flex-1">
                    {t.modules.map((m) => (
                      <li key={m} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        <span>{m}</span>
                      </li>
                    ))}
                    <li className="flex items-start gap-2 text-muted-foreground">
                      <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        {t.staffLimit === null
                          ? "Unlimited staff per site"
                          : `Up to ${t.staffLimit} staff per site`}
                      </span>
                    </li>
                  </ul>

                  <Button
                    className="w-full"
                    variant={t.highlight ? "default" : "outline"}
                    disabled={isCurrent || selecting !== null}
                    onClick={() => handleSelect(tierId)}
                  >
                    {selecting === tierId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrent ? (
                      "Current plan"
                    ) : isTrialing ? (
                      "Start free trial"
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

        <p className="text-center text-xs text-muted-foreground">
          All prices in GBP, billed monthly. Cancel anytime — you'll keep access until the end of your billing period.
        </p>
      </div>
    </div>
  );
}
