import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, Sparkles, Loader2, ShieldCheck, Users, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { ClimatePledge } from "@/components/StripeClimateBadge";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

/**
 * MiseOS HACCP — single launch plan.
 *   £4.99 per site / month (includes 1 user)
 *   + £1 per additional user / month
 *   Annual: 2 months free (× 10 months)
 *   14-day free trial, no card required, cancel anytime.
 */

const SITE_MONTHLY = 4.99;
const SITE_ANNUAL = 49.90;
const USER_MONTHLY = 1.00;
const USER_ANNUAL = 10.00;

type Cycle = "month" | "year";

export default function Pricing() {
  const navigate = useNavigate();
  const { appUser, isLoading: authLoading } = useAuth();
  const { subscription, loading, trialActive, trialDaysLeft, paidActive } = useOrgAccess();

  // Persist user choices across tab switches / re-renders so an embedded
  // checkout in progress is never accidentally reset.
  const SS_KEY = "miseos.pricing.draft";
  const loadDraft = () => {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      return raw ? (JSON.parse(raw) as { cycle?: Cycle; sites?: number; users?: number; showCheckout?: boolean }) : null;
    } catch { return null; }
  };
  const draft = loadDraft();

  const [cycle, setCycle] = useState<Cycle>(draft?.cycle ?? "month");
  const [sites, setSites] = useState(draft?.sites ?? 1);
  const [users, setUsers] = useState(draft?.users ?? 1);
  const [showCheckout, setShowCheckout] = useState(Boolean(draft?.showCheckout));

  useEffect(() => {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ cycle, sites, users, showCheckout })); } catch { /* noop */ }
  }, [cycle, sites, users, showCheckout]);

  useEffect(() => {
    if (!appUser?.organisation_id) return;
    if (draft) return; // don't overwrite restored draft
    void (async () => {
      const [{ count: siteCount }, { count: userCount }] = await Promise.all([
        supabase.from("sites").select("id", { count: "exact", head: true })
          .eq("organisation_id", appUser.organisation_id).eq("active", true),
        supabase.from("users").select("id", { count: "exact", head: true })
          .eq("organisation_id", appUser.organisation_id).eq("status", "active"),
      ]);
      setSites(Math.max(1, siteCount ?? 1));
      setUsers(Math.max(1, userCount ?? 1));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.organisation_id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <SEO title="Pricing — MiseOS HACCP" description="Digital HACCP and food safety for UK small food businesses. £4.99 per site + £1 per extra user. 14-day free trial." path="/pricing" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sitePrice = cycle === "year" ? SITE_ANNUAL : SITE_MONTHLY;
  const userPrice = cycle === "year" ? USER_ANNUAL : USER_MONTHLY;
  const extraUsers = Math.max(0, users - 1);
  const total = (sites * sitePrice) + (extraUsers * userPrice);
  const monthlyEquivalent = cycle === "year" ? total / 12 : total;

  const isTrialing = subscription?.status === "trialing";

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Pricing — MiseOS HACCP"
        description="Digital HACCP and food safety for UK small food businesses. £4.99 per site + £1 per extra user. 14-day free trial, no card required."
        path="/pricing"
      />
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            14-day free trial — card required, no charge until trial ends
          </div>

          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            Simple pricing. One plan. No surprises.
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Digital HACCP and food safety for UK small food businesses.
            {isTrialing && trialDaysLeft !== null && trialDaysLeft > 0 && (
              <span className="block mt-1 text-foreground font-medium">
                You have {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left on your trial.
              </span>
            )}
          </p>

          <div className="inline-flex items-center gap-3 rounded-full border bg-card p-1 px-4">
            <span className={`text-sm font-medium ${cycle === "month" ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
            <Switch checked={cycle === "year"} onCheckedChange={(v) => setCycle(v ? "year" : "month")} aria-label="Toggle annual billing" />
            <span className={`text-sm font-medium flex items-center gap-2 ${cycle === "year" ? "text-foreground" : "text-muted-foreground"}`}>
              Annual
              <Badge variant="outline" className="border-success/40 bg-success/10 text-success text-[10px]">2 months free</Badge>
            </span>
          </div>
        </div>

        <Card className="border-primary border-2 shadow-lg">
          <CardHeader className="text-center">
            <Badge className="mx-auto bg-primary text-primary-foreground w-fit">MiseOS HACCP</Badge>
            <CardTitle className="font-heading text-2xl mt-2">Everything you need to stay inspection-ready</CardTitle>
            <CardDescription>Replace paper, log digitally, export your Inspection Pack in seconds.</CardDescription>
            <div className="pt-4">
              <span className="text-5xl font-bold text-foreground">£{SITE_MONTHLY.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground"> / site / month</span>
              <p className="text-sm text-muted-foreground mt-1">
                Includes 1 user · + £{USER_MONTHLY.toFixed(2)} per additional user / month
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Annual: £{SITE_ANNUAL.toFixed(2)}/site/yr · £{USER_ANNUAL.toFixed(2)} per extra user/yr (2 months free)
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="grid sm:grid-cols-2 gap-2 text-sm">
              {[
                "Dashboard — Inspection Readiness score",
                "Day Sheet — opening/closing checks",
                "Temperatures, Cleaning, Pest, Maintenance",
                "HACCP Plan & Allergens (PPDS labels)",
                "Suppliers & Deliveries",
                "Incidents & PPM Schedule",
                "Staff Training records",
                "Customer Feedback log",
                "Inspection Pack (EHO-ready PDF/Excel)",
                "7-year record retention",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="h-4 w-4 shrink-0 mt-0.5 text-success" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your estimate</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="space-y-1">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-3.5 w-3.5" />Sites</span>
                  <input type="number" min={1} value={sites} onChange={(e) => setSites(Math.max(1, parseInt(e.target.value || "1", 10)))} className="w-full rounded border px-2 py-1" />
                </label>
                <label className="space-y-1">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5" />Total users</span>
                  <input type="number" min={1} value={users} onChange={(e) => setUsers(Math.max(1, parseInt(e.target.value || "1", 10)))} className="w-full rounded border px-2 py-1" />
                </label>
              </div>
              <div className="flex items-end justify-between pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">{sites} site × £{sitePrice.toFixed(2)} + {extraUsers} extra user × £{userPrice.toFixed(2)}</p>
                  <p className="text-2xl font-bold">£{total.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/{cycle === "year" ? "yr" : "mo"}</span></p>
                  {cycle === "year" && (
                    <p className="text-[11px] text-muted-foreground">≈ £{monthlyEquivalent.toFixed(2)}/month</p>
                  )}
                </div>
              </div>
            </div>

            {showCheckout && appUser ? (
              <div className="rounded-lg border overflow-hidden">
                <StripeEmbeddedCheckout
                  plan="haccp"
                  cycle={cycle}
                  siteQuantity={sites}
                  userQuantity={extraUsers}
                  returnUrl={`${window.location.origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`}
                />
                <div className="p-2 border-t bg-muted/20 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowCheckout(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  if (paidActive) { navigate("/account"); return; }
                  if (!appUser) { navigate("/auth"); return; }
                  setShowCheckout(true);
                }}
              >
                {paidActive
                  ? "Manage subscription"
                  : isTrialing
                    ? "Subscribe to continue"
                    : "Start 14-day free trial"}
              </Button>
            )}
            <p className="text-xs text-muted-foreground text-center">
              {showCheckout
                ? (isTrialing
                    ? "Your subscription starts after your trial ends. Cancel anytime."
                    : "Cancel anytime.")
                : (paidActive
                    ? "Cancel anytime."
                    : isTrialing
                      ? "Add payment to keep access after your trial ends."
                      : "No card required for your 14-day trial. Cancel anytime.")}
            </p>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground space-y-2 max-w-2xl mx-auto">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Prices in GBP. VAT not currently charged. Data retained for 7 years after cancellation.
          </p>
          <p>5% of every subscription goes to carbon removal via Stripe Climate.</p>
        </div>

        <div className="pt-4 border-t">
          <ClimatePledge />
        </div>
      </div>
    </div>
  );
}
