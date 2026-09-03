import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, DoorClosed } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useSiteTransfer } from "@/hooks/useSiteTransfer";
import { syncHaccpSiteQuantity } from "@/lib/billingSync";

/**
 * Settings → Site → Close this site.
 * Starts a 14-day grace window: the site stays editable, billing drops to one
 * fewer site immediately, and the site auto-archives at day 14.
 */
export function CloseSiteCard() {
  const { currentSite, organisationId, sites } = useSite();
  const { appUser } = useAuth();
  const { transfer, daysLeft, cancel, refetch } = useSiteTransfer();
  const [starting, setStarting] = useState(false);

  if (!currentSite) return null;

  const activeForThisSite = transfer?.from_site_id === currentSite.id;
  const otherActiveTransfer = !!transfer && !activeForThisSite;
  const isLastSite = sites.length <= 1;
  const isArchivedSite = !!currentSite.archived_at;

  const reactivate = async () => {
    if (!confirm(`Reopen ${currentSite.name}? This adds a billable site to your subscription.`)) return;
    setStarting(true);
    const { error } = await supabase
      .from("sites")
      .update({ archived_at: null, archived_reason: null, active: true } as any)
      .eq("id", currentSite.id);
    setStarting(false);
    if (error) {
      toast.error(error.message || "Could not reopen this site.");
      return;
    }
    void syncHaccpSiteQuantity();
    toast.success("Site reopened — it's billable again from your next invoice.");
    window.location.reload();
  };

  if (isArchivedSite) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DoorClosed className="h-4 w-4 text-muted-foreground" /> This site is closed
          </CardTitle>
          <CardDescription>
            Records are read-only and kept forever. You can still generate an Inspection Pack for it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={reactivate} disabled={starting}>
            {starting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Reopen this site (adds a billable site)
          </Button>
        </CardContent>
      </Card>
    );
  }


  const startClose = async () => {
    if (!organisationId) return;
    if (!confirm(`Close ${currentSite.name}? It stays editable for 14 days, then becomes read-only and drops off your billing.`)) return;
    setStarting(true);
    const { error } = await supabase.from("site_transfers" as any).insert({
      organisation_id: organisationId,
      from_site_id: currentSite.id,
      to_site_id: null,
      created_by: appUser?.id ?? null,
    } as any);
    setStarting(false);
    if (error) {
      toast.error(error.message || "Could not start the closing window.");
      return;
    }
    toast.success("Closing window started — 14 days to finish up. Billing drops when it closes.");
    await refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DoorClosed className="h-4 w-4 text-muted-foreground" /> Close this site
        </CardTitle>
        <CardDescription>
          Records are kept forever. Closed sites become read-only, and you can still generate an Inspection Pack.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeForThisSite && transfer ? (
          <>
            <Alert>
              <AlertTitle>Closing on {format(new Date(transfer.expires_at), "d MMM yyyy")}</AlertTitle>
              <AlertDescription>
                {daysLeft} day{daysLeft === 1 ? "" : "s"} left. This site stays fully editable until then.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              size="sm"
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate(undefined, {
                  onSuccess: () => toast.success("Closing cancelled — this site stays open."),
                  onError: (e: any) => toast.error(e.message ?? "Could not cancel"),
                })
              }
            >
              {cancel.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Keep this site open
            </Button>
          </>
        ) : otherActiveTransfer ? (
          <p className="text-sm text-muted-foreground">
            Another site is already in a move or closing window. Finish or cancel that one first.
          </p>
        ) : isLastSite ? (
          <p className="text-sm text-muted-foreground">
            This is your only site, so it can't be closed. Cancel your subscription instead if you're stopping.
          </p>
        ) : (
          <Button variant="outline" size="sm" onClick={startClose} disabled={starting}>
            {starting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Start 14-day closing window
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
