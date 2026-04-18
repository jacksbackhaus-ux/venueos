import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CreditCard, Sparkles, ExternalLink } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { openCustomerPortal } from "@/lib/stripe";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Account() {
  const { orgRole } = useAuth();
  const { subscription, loading, hasAccess, compedActive, trialActive, trialDaysLeft } = useOrgAccess();
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [siteQty, setSiteQty] = useState(1);
  const [hqQty, setHqQty] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);

  const monthly = useMemo(() => 4.99 + Math.max(0, siteQty - 1) * 2 + hqQty * 1, [siteQty, hqQty]);
  const yearly = useMemo(() => {
    const softwareMonthly = 4.99 + Math.max(0, siteQty - 1) * 2;
    return softwareMonthly * 12 * 0.9 + hqQty * 12;
  }, [siteQty, hqQty]);

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

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" />Account & Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your VenueOS subscription.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Current plan
            {compedActive && <Badge className="bg-success/15 text-success border-success/30"><Sparkles className="h-3 w-3 mr-1" />Complimentary</Badge>}
            {!compedActive && subscription && <Badge variant="outline">{subscription.status}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {compedActive && (
            <p>You have complimentary access{subscription?.comped_until ? ` until ${format(new Date(subscription.comped_until), "d MMM yyyy")}` : " (no expiry)"}.</p>
          )}
          {!compedActive && trialActive && (
            <p>You're on a free trial — <strong>{trialDaysLeft} day(s) left</strong>.</p>
          )}
          {!compedActive && subscription?.status === "active" && (
            <>
              <p>Plan: <strong>{subscription.site_quantity} site(s)</strong>{subscription.hq_quantity > 0 ? `, ${subscription.hq_quantity} HQ user(s)` : ""}, billed {subscription.billing_interval}ly.</p>
              {subscription.current_period_end && <p className="text-muted-foreground">Renews {format(new Date(subscription.current_period_end), "d MMM yyyy")}</p>}
              {subscription.cancel_at_period_end && <p className="text-warning">Cancels at end of period.</p>}
            </>
          )}
          {!hasAccess && <p className="text-destructive">No active access. Choose a plan below.</p>}

          {subscription?.stripe_customer_id && (
            <Button variant="outline" size="sm" onClick={() => openCustomerPortal().catch(e => toast.error(e.message))}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Manage billing
            </Button>
          )}
        </CardContent>
      </Card>

      {!compedActive && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose your plan</CardTitle>
            <CardDescription>£4.99/mo includes 1 site. +£2/mo per extra site. +£1/mo per HQ user. Annual = 10% off software.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={interval} onValueChange={v => setInterval(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="month">Monthly</TabsTrigger>
                <TabsTrigger value="year">Yearly (save 10%)</TabsTrigger>
              </TabsList>
            </Tabs>

            <QtyRow label="Active sites" value={siteQty} onChange={setSiteQty} min={1} />
            <QtyRow label="HQ dashboard users" value={hqQty} onChange={setHqQty} min={0} />

            <div className="rounded-lg border p-4 bg-muted/30 space-y-1">
              <p className="text-2xl font-bold">
                £{(interval === "month" ? monthly : yearly).toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">/{interval}</span>
              </p>
              {interval === "year" && (
                <p className="text-xs text-muted-foreground">
                  10% off £{((4.99 + Math.max(0, siteQty - 1) * 2) * 12).toFixed(2)} software, plus £{(hqQty * 12).toFixed(2)} HQ
                </p>
              )}
            </div>

            {!showCheckout ? (
              <Button className="w-full" onClick={() => setShowCheckout(true)}>
                {subscription?.status === "active" ? "Update subscription" : "Subscribe"}
              </Button>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <StripeEmbeddedCheckout siteQuantity={siteQty} hqQuantity={hqQty} billingInterval={interval} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QtyRow({ label, value, onChange, min }: { label: string; value: number; onChange: (n: number) => void; min: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onChange(Math.max(min, value - 1))}>−</Button>
        <span className="w-8 text-center font-medium">{value}</span>
        <Button variant="outline" size="sm" onClick={() => onChange(value + 1)}>+</Button>
      </div>
    </div>
  );
}
