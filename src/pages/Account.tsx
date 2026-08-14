import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CreditCard, Sparkles, ExternalLink, Building2, Users,
  AlertCircle, Calendar, ShieldCheck, Settings2, Mail,
} from "lucide-react";
import { openCustomerPortal } from "@/lib/stripe";
import { format } from "date-fns";
import { toast } from "sonner";
import { LoginUrlCard } from "@/components/LoginUrlCard";
import { ClimatePledge } from "@/components/StripeClimateBadge";


// Launch pricing — single MiseOS HACCP plan. Used only as a sanity check;
// the displayed numbers below come from Stripe (single source of truth).
const USER_MONTHLY = 1.0;

type BillingSummary = {
  cycle: "month" | "year";
  site_quantity: number;
  extra_user_quantity: number;
  site_unit_amount: number;
  user_unit_amount: number;
  currency: string;
  total: number;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export default function Account() {
  const navigate = useNavigate();
  const { orgRole, appUser } = useAuth();
  const {
    subscription, loading, hasAccess, compedActive, trialActive, trialDaysLeft,
    cycle, paidActive,
  } = useOrgAccess();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const hasStripeSub = Boolean(paidActive && subscription?.stripe_subscription_id);

  const fetchSummary = useCallback(async () => {
    if (!hasStripeSub) {
      setSummary(null);
      setSummaryError(null);
      return;
    }
    setSummaryLoading(true);
    setSummaryError(null);
    const { data, error } = await supabase.functions.invoke("get-haccp-billing-summary", { body: {} });
    if (error || !data?.ok) {
      setSummary(null);
      setSummaryError((data as { error?: string })?.error || error?.message || "Unable to load billing details");
    } else {
      setSummary(data as BillingSummary);
    }
    setSummaryLoading(false);
  }, [hasStripeSub]);

  useEffect(() => { void fetchSummary(); }, [fetchSummary]);

  // Re-read Stripe's truth whenever the customer comes back to this tab
  // (e.g. after returning from the Stripe customer portal).
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") void fetchSummary();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchSummary]);

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

  const displayCycle = summary?.cycle ?? cycle;
  const monthlyEquivalent = summary ? (summary.cycle === "year" ? summary.total / 12 : summary.total) : 0;
  // Cancellation + renewal state come from Stripe only.
  const cancelScheduled = summary?.cancel_at_period_end ?? false;
  const periodEnd = summary?.current_period_end ?? null;

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      await openCustomerPortal(`${window.location.origin}/account`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "We couldn't open your billing portal.";
      toast.error(msg);
      setPortalLoading(false);
    }
  };

  const billingContactHref = (() => {
    const orgId = appUser?.organisation_id ?? "unknown";
    const email = appUser?.email ?? "";
    const status = subscription?.status ?? "none";
    const customerId = subscription?.stripe_customer_id ?? "none";
    const subject = `Billing question — MiseOS HACCP (org ${orgId})`;
    const body = [
      "Hi MiseOS support,",
      "",
      "I have a billing question about my MiseOS HACCP account.",
      "",
      `Organisation ID: ${orgId}`,
      email ? `Account email: ${email}` : "",
      `Subscription status: ${status}`,
      `Stripe customer ID: ${customerId}`,
      "",
      "Please describe your question here:",
      "",
    ].join("\n");
    return `mailto:miseos@outlook.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  })();


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
              Free trial — {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left. No charge until your trial ends.
            </p>
          )}

          {/* Price breakdown — sourced from Stripe (single source of truth) */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What you pay</p>

            {summaryLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your billing details…
              </div>
            )}

            {!summaryLoading && summaryError && (
              <p className="text-sm text-destructive">
                We couldn't load your billing details. Please refresh or try again later.
              </p>
            )}

            {!summaryLoading && !summaryError && !paidActive && (
              <p className="text-sm text-muted-foreground">
                {trialActive
                  ? "You're on a free trial. Billing details will appear here once your subscription starts."
                  : "No active subscription yet."}
              </p>
            )}

            {!summaryLoading && !summaryError && summary && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{summary.site_quantity} site{summary.site_quantity === 1 ? "" : "s"} × £{summary.site_unit_amount.toFixed(2)}</span>
                    <span className="font-medium">£{(summary.site_quantity * summary.site_unit_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{summary.extra_user_quantity} extra user{summary.extra_user_quantity === 1 ? "" : "s"} × £{summary.user_unit_amount.toFixed(2)}</span>
                    <span className="font-medium">£{(summary.extra_user_quantity * summary.user_unit_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex items-end justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Total {displayCycle === "year" ? "per year" : "per month"}</span>
                    <div className="text-right">
                      <p className="text-2xl font-bold">£{summary.total.toFixed(2)}</p>
                      {displayCycle === "year" && (
                        <p className="text-[11px] text-muted-foreground">≈ £{monthlyEquivalent.toFixed(2)}/month</p>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Adding a user adds £{USER_MONTHLY.toFixed(2)}/month to your subscription on the next invoice. Owner is included free.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Users are counted once across your whole account, no matter how many sites they work at.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  This reflects what you are currently billed for via Stripe. To change your user count, manage users in Settings.
                </p>
              </>
            )}
          </div>

          {periodEnd && !cancelScheduled && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Next renewal: <strong>{format(new Date(periodEnd), "d MMM yyyy")}</strong> ({displayCycle === "year" ? "annual" : "monthly"})</span>
            </div>
          )}
          {cancelScheduled && (
            <div className="p-3 rounded-md bg-warning/10 border border-warning/30 text-sm">
              <p className="text-warning flex items-center gap-1.5 font-medium"><AlertCircle className="h-4 w-4" />Cancellation scheduled</p>
              {periodEnd && (
                <p className="text-xs mt-1">You'll keep access until {format(new Date(periodEnd), "d MMM yyyy")}. Data retained for 7 years.</p>
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
              <Button size="sm" onClick={handleOpenPortal} disabled={portalLoading}>
                {portalLoading
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <Settings2 className="h-3.5 w-3.5 mr-1.5" />}
                Manage subscription
              </Button>
            )}
          </div>
          {subscription?.stripe_customer_id && (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                Cancel, switch between monthly and annual, update your payment method, and view or download invoices
                in your secure Stripe billing portal. You'll come straight back to this page when you're done.
              </span>
            </p>
          )}
          <a
            href={billingContactHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            <Mail className="h-3 w-3" />
            Contact us about billing
          </a>
        </CardContent>
      </Card>

      {/* Login URL */}
      {appUser?.organisation_id && <LoginUrlCard organisationId={appUser.organisation_id} />}


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
