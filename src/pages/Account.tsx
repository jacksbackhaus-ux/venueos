import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Sparkles, ExternalLink, ArrowUpDown } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { openCustomerPortal } from "@/lib/stripe";
import { format } from "date-fns";
import { toast } from "sonner";
import { TIERS, type Tier, formatGBP, tierMonthlyTotal } from "@/lib/tiers";

export default function Account() {
  const navigate = useNavigate();
  const { orgRole, appUser } = useAuth();
  const {
    subscription, loading, hasAccess, compedActive, trialActive, trialDaysLeft, tier,
  } = useOrgAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [siteCount, setSiteCount] = useState<number>(1);

  // Checkout intent: either trial→paid for current tier, or change of tier.
  const checkoutTier = searchParams.get("checkout") as Tier | "success" | null;
  const showCheckoutFor: Tier | null =
    checkoutTier && checkoutTier !== "success" && TIERS[checkoutTier as Tier]
      ? (checkoutTier as Tier)
      : null;

  // Fetch the org's actual site count for multi-site quantity.
  useEffect(() => {
    if (!appUser?.organisation_id) return;
    supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", appUser.organisation_id)
      .eq("active", true)
      .then(({ count }) => setSiteCount(count ?? 1));
  }, [appUser?.organisation_id]);

  // Dismiss success param after a moment so refresh is clean.
  useEffect(() => {
    if (checkoutTier === "success") {
      toast.success("Subscription activated. Welcome aboard!");
      const t = setTimeout(() => {
        searchParams.delete("checkout");
        searchParams.delete("session_id");
        setSearchParams(searchParams, { replace: true });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [checkoutTier, searchParams, setSearchParams]);

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

  const tierDef = tier ? TIERS[tier] : null;
  const monthlyTotal = tier ? tierMonthlyTotal(tier, siteCount) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" />Account & Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your VenueOS subscription.</p>
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
            {tierDef && <Badge>{tierDef.name}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {compedActive && (
            <p>You have complimentary access{subscription?.comped_until ? ` until ${format(new Date(subscription.comped_until), "d MMM yyyy")}` : " (no expiry)"}.</p>
          )}
          {!compedActive && trialActive && (
            <>
              <p>You're on a free trial — <strong>{trialDaysLeft} day(s) left</strong>.</p>
              {!tier && (
                <p className="text-warning">
                  You haven't picked a plan yet.{" "}
                  <button onClick={() => navigate("/pricing")} className="underline font-medium">Choose one now</button>.
                </p>
              )}
            </>
          )}
          {!compedActive && subscription?.status === "active" && tierDef && (
            <div className="space-y-1">
              <p>
                Plan: <strong>{tierDef.name}</strong> · {siteCount} site{siteCount === 1 ? "" : "s"}
              </p>
              <p className="text-2xl font-bold">
                {formatGBP(monthlyTotal)}<span className="text-sm font-normal text-muted-foreground">/month</span>
              </p>
              {subscription.current_period_end && (
                <p className="text-muted-foreground">Next bill: {format(new Date(subscription.current_period_end), "d MMM yyyy")}</p>
              )}
              {subscription.cancel_at_period_end && (
                <p className="text-warning">Cancels at end of period — access ends {subscription.current_period_end ? format(new Date(subscription.current_period_end), "d MMM yyyy") : ""}.</p>
              )}
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
              {subscription?.status === "active" ? "Change plan" : "Choose plan"}
            </Button>
            {subscription?.stripe_customer_id && (
              <Button variant="outline" size="sm" onClick={() => openCustomerPortal().catch(e => toast.error(e.message))}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Manage billing & invoices
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Embedded checkout — shown when ?checkout=<tier> */}
      {showCheckoutFor && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {subscription?.status === "active" ? "Switch plan" : "Subscribe"} —{" "}
              {TIERS[showCheckoutFor].name}
            </CardTitle>
            <CardDescription>
              {showCheckoutFor === "multisite"
                ? `${formatGBP(TIERS.multisite.basePrice)} for the first site + ${formatGBP(TIERS.multisite.extraSitePrice)}/site for additional sites. Currently ${siteCount} site(s).`
                : `${formatGBP(TIERS[showCheckoutFor].basePrice)} per month`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <StripeEmbeddedCheckout tier={showCheckoutFor} siteQuantity={siteCount} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
