import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, CreditCard, Sparkles, ExternalLink, Building2, Users,
  AlertCircle, Calendar, ShieldCheck,
} from "lucide-react";
import { openCustomerPortal } from "@/lib/stripe";
import { format } from "date-fns";
import { toast } from "sonner";
import { LoginUrlCard } from "@/components/LoginUrlCard";
import { ClimatePledge } from "@/components/StripeClimateBadge";

// Launch pricing — single MiseOS HACCP plan.
const SITE_MONTHLY = 4.99;
const SITE_ANNUAL = 49.90;
const USER_MONTHLY = 1.00;
const USER_ANNUAL = 10.00;

export default function Account() {
  const navigate = useNavigate();
  const { orgRole, appUser } = useAuth();
  const {
    subscription, loading, hasAccess, compedActive, trialActive, trialDaysLeft,
    cycle, paidActive,
  } = useOrgAccess();
  const [siteCount, setSiteCount] = useState<number>(1);
  const [userCount, setUserCount] = useState<number>(1);
  const [savingCycle, setSavingCycle] = useState(false);

  useEffect(() => {
    if (!appUser?.organisation_id) return;
    void (async () => {
      const [{ count: sCount }, { count: uCount }] = await Promise.all([
        supabase.from("sites").select("id", { count: "exact", head: true })
          .eq("organisation_id", appUser.organisation_id).eq("active", true),
        supabase.from("users").select("id", { count: "exact", head: true })
          .eq("organisation_id", appUser.organisation_id).eq("status", "active"),
      ]);
      setSiteCount(Math.max(1, sCount ?? 1));
      setUserCount(Math.max(1, uCount ?? 1));
    })();
  }, [appUser?.organisation_id]);

  if (orgRole?.org_role !== "org_owner") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Only the organisation owner can manage billing.
        </CardContent></Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const sitePrice = cycle === "year" ? SITE_ANNUAL : SITE_MONTHLY;
  const userPrice = cycle === "year" ? USER_ANNUAL : USER_MONTHLY;
  const extraUsers = Math.max(0, userCount - 1);
  const total = (siteCount * sitePrice) + (extraUsers * userPrice);
  const monthlyEquivalent = cycle === "year" ? total / 12 : total;

  const switchCycle = async (next: "month" | "year") => {
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
    const termEnd = (subscription as any)?.term_end || subscription?.current_period_end;
    const endLabel = termEnd ? format(new Date(termEnd), "d MMM yyyy") : "the end of your current term";
    if (!confirm(`Cancel renewal? Your plan stays active until ${endLabel}.`)) return;
    const { error } = await supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("organisation_id", appUser.organisation_id);
    if (error) toast.error(error.message);
    else toast.success(`Cancellation scheduled. You'll keep access until ${endLabel}.`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto pb-24">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" />Account & Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Your MiseOS HACCP subscription.</p>
      </div>

      {/* Current plan */}
      <Card className="border-primary/40 border-2">
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="font-heading text-xl flex items-center gap-2">
                MiseOS HACCP
                {compedActive && (
                  <Badge className="bg-success/15 text-success border-success/30">
                    <Sparkles className="h-3 w-3 mr-1" />Complimentary
                  </Badge>
                )}
                {!compedActive && subscription && (
                  <Badge variant="outline">{subscription.status}</Badge>
                )}
              </CardTitle>
              <CardDescription>Digital HACCP & food safety for UK small food businesses.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          {compedActive && (
            <p>You have complimentary access{subscription?.comped_until ? ` until ${format(new Date(subscription.comped_until), "d MMM yyyy")}` : " (no expiry)"}.</p>
          )}
          {!compedActive && trialActive && (
            <p className="rounded-md bg-success/10 text-success px-3 py-2 font-medium">
              Free trial — {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left. No card required.
            </p>
          )}

          {/* Price breakdown */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What you pay</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{siteCount} site{siteCount === 1 ? "" : "s"} × £{sitePrice.toFixed(2)}</span>
                <span className="font-medium">£{(siteCount * sitePrice).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{extraUsers} extra user{extraUsers === 1 ? "" : "s"} × £{userPrice.toFixed(2)}</span>
                <span className="font-medium">£{(extraUsers * userPrice).toFixed(2)}</span>
              </div>
              <div className="flex items-end justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">Total {cycle === "year" ? "per year" : "per month"}</span>
                <div className="text-right">
                  <p className="text-2xl font-bold">£{total.toFixed(2)}</p>
                  {cycle === "year" && (
                    <p className="text-[11px] text-muted-foreground">≈ £{monthlyEquivalent.toFixed(2)}/month</p>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Adding a user adds £{USER_MONTHLY.toFixed(2)}/month to your subscription. Owner is included free.
            </p>
          </div>

          {paidActive && subscription?.current_period_end && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Next renewal: <strong>{format(new Date(subscription.current_period_end), "d MMM yyyy")}</strong></span>
            </div>
          )}
          {subscription?.cancel_at_period_end && (
            <div className="p-3 rounded-md bg-warning/10 border border-warning/30 text-sm">
              <p className="text-warning flex items-center gap-1.5 font-medium"><AlertCircle className="h-4 w-4" />Cancellation scheduled</p>
              {subscription.current_period_end && (
                <p className="text-xs mt-1">You'll keep access until {format(new Date(subscription.current_period_end), "d MMM yyyy")}. Data retained for 7 years.</p>
              )}
            </div>
          )}

          {!hasAccess && !trialActive && (
            <p className="text-destructive">
              No active access. <button onClick={() => navigate("/pricing")} className="underline">Subscribe</button> to continue.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {!paidActive && (
              <Button size="sm" onClick={() => navigate("/pricing")}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />Subscribe
              </Button>
            )}
            {subscription?.stripe_customer_id && (
              <Button variant="outline" size="sm" onClick={() => openCustomerPortal().catch(e => toast.error(e.message))}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Invoices & payment method
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Login URL */}
      {appUser?.organisation_id && <LoginUrlCard organisationId={appUser.organisation_id} />}

      {/* Billing cycle */}
      {paidActive && (
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
              Switching takes effect on your next renewal.
            </p>
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

      <Card>
        <CardContent className="py-6 space-y-2">
          <p className="text-xs flex items-start gap-2 text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-success" />
            <span>5% of every subscription goes to carbon removal via Stripe Climate.</span>
          </p>
          <ClimatePledge />
        </CardContent>
      </Card>
    </div>
  );
}
