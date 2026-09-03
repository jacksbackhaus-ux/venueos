import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, MoveRight, AlertTriangle, Store, Home, Truck, Factory } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { useSiteTransfer } from "@/hooks/useSiteTransfer";
import { PREMISES_TYPES, defaultOperatingMode, premisesBadge, type PremisesType } from "@/lib/premises";
import { resolveCurrentPlan, cycleFromInterval } from "@/lib/sitePricing";
import { AddSiteCheckoutPanel } from "@/components/settings/AddSiteCheckoutPanel";
import type { BillingCycle } from "@/lib/plans";

/**
 * Settings → Site → Move to a new site.
 * Dedicated flow for "I'm moving premises": set up the new site, then open a
 * 14-day transfer window on the old one. Both sites stay editable for 14
 * days, billing stays at the current site count, and the old site
 * auto-archives (and drops off billing) at day 14.
 */
export function MoveSiteCard() {
  const { appUser, orgRole } = useAuth();
  const { organisationId, sites } = useSite();
  const { subscription } = useOrgAccess();
  const { transfer, refetch } = useSiteTransfer();

  const isOwner = orgRole?.org_role === "org_owner";

  const [open, setOpen] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newPremisesType, setNewPremisesType] = useState<PremisesType>("commercial");
  const [fromSiteId, setFromSiteId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOwner) return null;

  const activeSites = sites.filter((s) => s.active);
  const siteQuantity = subscription?.site_quantity ?? 1;
  const siteCount = activeSites.length;
  const needsSlot = siteCount >= siteQuantity;
  const cycle: BillingCycle = cycleFromInterval(subscription?.billing_interval);
  const currentPlan = resolveCurrentPlan(subscription);

  const otherActiveTransfer = !!transfer;

  const resetForm = () => {
    setNewSiteName("");
    setNewSiteAddress("");
    setNewPremisesType("commercial");
    setFromSiteId("");
    setShowCheckout(false);
  };

  const handleSubmit = async () => {
    if (!organisationId || !appUser) return;
    if (!newSiteName.trim()) {
      toast.error("Please enter a name for the new site.");
      return;
    }
    if (needsSlot) {
      toast.error("You don't have a free site slot — buy one below first.");
      return;
    }
    const leavingId = activeSites.length > 1 ? (fromSiteId || activeSites[0]?.id) : activeSites[0]?.id;
    if (!leavingId) {
      toast.error("Could not determine which site you're leaving.");
      return;
    }

    setSubmitting(true);
    const { data: created, error } = await supabase
      .from("sites")
      .insert({
        organisation_id: organisationId,
        name: newSiteName.trim(),
        address: newSiteAddress.trim() || null,
        owner_user_id: appUser.id,
        premises_type: newPremisesType,
        operating_mode: defaultOperatingMode(newPremisesType),
      } as any)
      .select("id")
      .maybeSingle();
    if (error) {
      setSubmitting(false);
      console.error("Create site failed", error);
      toast.error(error.message || "Could not create the new site.");
      return;
    }

    const { error: transferError } = await supabase.from("site_transfers" as any).insert({
      organisation_id: organisationId,
      from_site_id: leavingId,
      to_site_id: created?.id ?? null,
      created_by: appUser.id,
    } as any);
    setSubmitting(false);
    if (transferError) {
      console.error("Transfer window failed", transferError);
      toast.error(
        transferError.message?.includes("one_active_per_org")
          ? "You already have a move in progress. Finish or cancel it first."
          : "New site created, but the move window could not be started.",
      );
      return;
    }

    toast.success("Move started — you have 14 days to finish setting up.");
    setOpen(false);
    resetForm();
    await refetch();
    // The new site has to appear in the site switcher / SiteContext, which is
    // loaded once per session — same reload pattern as CloseSiteCard.
    window.location.reload();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MoveRight className="h-4 w-4 text-muted-foreground" /> Move to a new site
          </CardTitle>
          <CardDescription>
            Moving premises? Set up the new site and get a 14-day window to finish the move — the old site stays
            editable and billing doesn't change until it closes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {otherActiveTransfer ? (
            <p className="text-sm text-muted-foreground">
              A move or closing window is already active. Finish or cancel that one first.
            </p>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              Start a move
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Move to a new site</DialogTitle>
            <DialogDescription>
              Set up your new site. You'll get 14 days where both sites stay editable before the old one closes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="move-site-name">New site name</Label>
              <Input
                id="move-site-name"
                placeholder="e.g. Mill Lane"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="move-site-address">Address (optional)</Label>
              <Input
                id="move-site-address"
                placeholder="Street, city, postcode"
                value={newSiteAddress}
                onChange={(e) => setNewSiteAddress(e.target.value)}
              />
            </div>

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

            {activeSites.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="move-from">Which site are you leaving?</Label>
                <select
                  id="move-from"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={fromSiteId || activeSites[0]?.id || ""}
                  onChange={(e) => setFromSiteId(e.target.value)}
                >
                  {activeSites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              New site type: {premisesBadge(newPremisesType)}. You can change this later in Settings → Site.
            </p>

            {needsSlot && (
              <div className="space-y-2">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You don't have a free site slot. Buy one to continue — it'll be prorated against your current
                    billing cycle.
                  </AlertDescription>
                </Alert>
                {showCheckout ? (
                  <AddSiteCheckoutPanel
                    currentPlan={currentPlan}
                    cycle={cycle}
                    siteQuantity={siteQuantity}
                    returnUrl={`${window.location.origin}/settings?tab=site&checkout=success&session_id={CHECKOUT_SESSION_ID}`}
                    onCancel={() => setShowCheckout(false)}
                  />
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowCheckout(true)}>
                    Buy a site slot
                  </Button>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || needsSlot}>
              {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Start the move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
