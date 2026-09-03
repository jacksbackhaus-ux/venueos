import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Building2, Plus, ExternalLink, Loader2, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { formatGBP, TIERS, type TierId, type BillingCycle } from "@/lib/plans";
import { AddSiteCheckoutPanel } from "@/components/settings/AddSiteCheckoutPanel";
import { openCustomerPortal } from "@/lib/stripe";
import {
  HACCP_LAUNCH, type SubLike, resolveCurrentPlan, additionalSitePriceFor, hasActivePlanFor, cycleFromInterval,
} from "@/lib/sitePricing";
import {
  PREMISES_TYPES, defaultOperatingMode, premisesBadge, type PremisesType,
} from "@/lib/premises";
import { Store, Home, Truck, Factory } from "lucide-react";

type SiteRow = {
  id: string;
  name: string;
  address: string | null;
  site_code: string | null;
  active: boolean;
  created_at: string;
};

export function SitesBillingSection() {
  const { appUser, orgRole } = useAuth();
  const { subscription, refresh: refreshSubscription } = useOrgAccess();
  const [searchParams, setSearchParams] = useSearchParams();

  const isOwner = orgRole?.org_role === "org_owner";
  const orgId = appUser?.organisation_id ?? null;

  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // post-checkout flow
  const checkoutSuccess = searchParams.get("checkout") === "success" && searchParams.get("tab") === "sites";
  const [polling, setPolling] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newPremisesType, setNewPremisesType] = useState<PremisesType>("commercial");
  const [creating, setCreating] = useState(false);


  const loadSites = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("sites")
      .select("id, name, address, site_code, active, created_at")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load sites", error);
      toast.error("Could not load your sites.");
    } else {
      setSites((data ?? []) as SiteRow[]);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadSites(); }, [loadSites]);

  const cycle: BillingCycle = cycleFromInterval(subscription?.billing_interval);
  const currentPlan = resolveCurrentPlan(subscription);
  const siteQuantity = subscription?.site_quantity ?? 1;
  const activeSites = sites.filter(s => s.active);
  const siteCount = activeSites.length;
  const slotsAvailable = Math.max(0, siteQuantity - siteCount);

  const additionalSitePrice = additionalSitePriceFor(subscription, cycle);
  const hasActivePlan = hasActivePlanFor(subscription);

  // Poll for site_quantity bump after checkout success
  useEffect(() => {
    if (!checkoutSuccess || !orgId) return;
    setPolling(true);
    const startedAt = Date.now();
    const startQty = siteQuantity;
    const interval = setInterval(async () => {
      await refreshSubscription();
      const { data } = await supabase
        .from("subscriptions").select("site_quantity").eq("organisation_id", orgId).maybeSingle();
      if (data && (data.site_quantity ?? 0) > startQty) {
        clearInterval(interval);
        setPolling(false);
        toast.success("Payment successful — extra site is ready to set up.");
        setShowCreateDialog(true);
      } else if (Date.now() - startedAt > 20_000) {
        clearInterval(interval);
        setPolling(false);
        // Allow manual setup fallback
        setShowCreateDialog(true);
      }
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutSuccess, orgId]);

  const clearSuccessParams = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    next.delete("session_id");
    setSearchParams(next, { replace: true });
  };

  const handleAddSite = () => {
    if (!hasActivePlan) {
      toast.error("Activate a subscription before adding sites.");
      return;
    }
    setShowCheckout(true);
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      await openCustomerPortal(`${window.location.origin}/settings?tab=sites`);
    } catch (e) {
      toast.error((e as Error).message || "Could not open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCreateSite = async () => {
    if (!orgId || !appUser) return;
    if (!newSiteName.trim()) {
      toast.error("Please enter a site name.");
      return;
    }
    if (siteCount >= siteQuantity) {
      toast.error("You don't have any unused site slots on your subscription.");
      return;
    }
    setCreating(true);
    const { error } = await supabase
      .from("sites")
      .insert({
        organisation_id: orgId,
        name: newSiteName.trim(),
        address: newSiteAddress.trim() || null,
        owner_user_id: appUser.id,
        premises_type: newPremisesType,
        operating_mode: defaultOperatingMode(newPremisesType),
      } as any)
      .select("id")
      .maybeSingle();
    if (error) {
      setCreating(false);
      console.error("Create site failed", error);
      toast.error(error.message || "Could not create site.");
      return;
    }
    toast.success("New site created.");

    setCreating(false);
    setShowCreateDialog(false);
    setNewSiteName("");
    setNewSiteAddress("");
    setNewPremisesType("commercial");
    clearSuccessParams();
    await loadSites();
  };


  // ──────────────────────────── UI ────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Success banner */}
      {checkoutSuccess && (
        <Alert className="border-success/40 bg-success/5">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertTitle>Payment received</AlertTitle>
          <AlertDescription>
            {polling
              ? "Finishing setup — your new site slot will appear in a few seconds…"
              : "Your subscription has been updated. Add the details for your new site below."}
          </AlertDescription>
        </Alert>
      )}

      {/* Current sites */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Your sites
              </CardTitle>
              <CardDescription>
                {siteCount} of {siteQuantity} site{siteQuantity === 1 ? "" : "s"} used on your subscription
              </CardDescription>
            </div>
            {slotsAvailable > 0 && (
              <Badge variant="outline" className="border-success/40 text-success">
                {slotsAvailable} slot{slotsAvailable === 1 ? "" : "s"} available
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sites yet.</p>
          ) : (
            sites.map(site => (
              <div key={site.id} className="flex items-center justify-between gap-3 p-3 rounded-md border bg-card">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{site.name}</p>
                  {site.address && <p className="text-xs text-muted-foreground truncate">{site.address}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!site.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  {site.site_code && (
                    <Badge variant="outline" className="text-xs font-mono">{site.site_code}</Badge>
                  )}
                </div>
              </div>
            ))
          )}

          {slotsAvailable > 0 && isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Set up an unused site slot
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Add another site */}
      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add another site</CardTitle>
            <CardDescription>
              {HACCP_LAUNCH
                ? "Each site is £4.99/month. The first user is included. Each additional user is £1/month. Annual billing gives 2 months free."
                : "Each additional site is billed at the same per-site price as your current plan."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Moving premises instead? Use "Move to a new site" in Settings → Site.
            </p>
            {!hasActivePlan ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No active subscription</AlertTitle>
                <AlertDescription>
                  Activate a plan in <strong>Account &amp; Billing</strong> before adding extra sites.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Each additional site</span>
                    <span className="text-lg font-semibold">
                      {formatGBP(additionalSitePrice)}
                      <span className="text-xs text-muted-foreground font-normal"> /{cycle === "year" ? "yr" : "mo"}</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {HACCP_LAUNCH ? (
                      <>
                        MiseOS HACCP — £4.99/month per site, first user included, £1/month per additional user.
                        {" Billed "}{cycle === "year" ? "yearly (2 months free)" : "monthly"}.
                        {" Prices in GBP. VAT not currently charged."}
                      </>
                    ) : (
                      <>
                        Based on your current plan
                        {subscription?.tier && (subscription.tier as string) in TIERS && ` (${TIERS[subscription.tier as TierId].name})`}
                        {!subscription?.tier && subscription?.bundle_active && " (Full Bundle)"}
                        {!subscription?.tier && !subscription?.bundle_active && (
                          <>
                            {" ("}
                            {[
                              subscription?.base_active && "Base",
                              subscription?.compliance_active && "Compliance",
                              subscription?.business_active && "Business",
                            ].filter(Boolean).join(" + ")}
                            {")"}
                          </>
                        )}
                        {" — billed "}{cycle === "year" ? "yearly" : "monthly"}.
                      </>
                    )}
                  </p>
                </div>

                {showCheckout && (HACCP_LAUNCH || currentPlan) ? (
                  <AddSiteCheckoutPanel
                    currentPlan={currentPlan}
                    cycle={cycle}
                    siteQuantity={siteQuantity}
                    returnUrl={`${window.location.origin}/settings?tab=sites&checkout=success&session_id={CHECKOUT_SESSION_ID}`}
                    onCancel={() => setShowCheckout(false)}
                  />
                ) : (
                  <Button onClick={handleAddSite} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add a site — {formatGBP(additionalSitePrice)}/{cycle === "year" ? "yr" : "mo"}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Owner only</AlertTitle>
          <AlertDescription>
            Only the organisation owner can add or manage sites and billing.
          </AlertDescription>
        </Alert>
      )}

      {/* Manage billing */}
      {isOwner && subscription?.stripe_customer_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manage billing</CardTitle>
            <CardDescription>
              Update payment details, view invoices, or remove sites in the secure billing portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={portalLoading}>
              {portalLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
              Open billing portal
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create new site dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Set up your new site</DialogTitle>
            <DialogDescription>
              Give your new site a name. You can add more details later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-site-name">Site name</Label>
              <Input
                id="new-site-name"
                placeholder="e.g. Mill Lane"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-site-address">Address (optional)</Label>
              <Input
                id="new-site-address"
                placeholder="Street, city, postcode"
                value={newSiteAddress}
                onChange={(e) => setNewSiteAddress(e.target.value)}
              />
            </div>

            {/* Premises type — 2x2 picker, same wording as onboarding */}
            <div className="space-y-1.5">
              <Label>What kind of place is it?</Label>
              <div className="grid grid-cols-2 gap-2">
                {PREMISES_TYPES.map((p) => {
                  const Icon = p.icon === "Home" ? Home : p.icon === "Truck" ? Truck : p.icon === "Factory" ? Factory : Store;
                  const active = newPremisesType === p.type;
                  return (
                    <button
                      key={p.type}
                      type="button"
                      onClick={() => setNewPremisesType(p.type)}
                      className={`rounded-lg border p-3 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <Icon className={`h-4 w-4 mb-1.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="text-xs font-semibold leading-tight">{p.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight">{p.examples}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              You can change the premises type later in Settings → Site. New site type: {premisesBadge(newPremisesType)}.
            </p>

            {siteCount >= siteQuantity && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You don't have any unused site slots. Add one above first.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSite} disabled={creating || siteCount >= siteQuantity}>
              {creating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
