import { syncHaccpSiteQuantity, syncHaccpUserQuantity } from "@/lib/billingSync";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";

export interface SiteTransfer {
  id: string;
  organisation_id: string;
  from_site_id: string;
  to_site_id: string | null;
  started_at: string;
  expires_at: string;
  status: "active" | "completed" | "cancelled";
}

/**
 * The org's single active move / close window (one per org, enforced by a
 * partial unique index). Used by the slim dismissible banner and by
 * Settings → Site so the operator always knows the close date.
 */
export function useSiteTransfer() {
  const { organisationId, currentSite, sites, archivedSites } = useSite();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["site-transfer", organisationId],
    enabled: !!organisationId,
    queryFn: async (): Promise<SiteTransfer | null> => {
      const { data, error } = await supabase
        .from("site_transfers" as any)
        .select("*")
        .eq("organisation_id", organisationId!)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });

  const transfer = query.data ?? null;
  const allSites = [...sites, ...archivedSites];
  const fromSite = transfer ? allSites.find((s) => s.id === transfer.from_site_id) ?? null : null;
  const toSite = transfer?.to_site_id
    ? allSites.find((s) => s.id === transfer.to_site_id) ?? null
    : null;

  const relevantToCurrentSite =
    !!transfer &&
    !!currentSite &&
    (currentSite.id === transfer.from_site_id || currentSite.id === transfer.to_site_id);

  const cancel = useMutation({
    mutationFn: async () => {
      if (!transfer) return;
      // Cancelling a MOVE closes the new site (the customer stays at the old
      // one). Archive first: if that fails, the move stays active and nothing
      // is left half-done. Records are kept; the site can be reopened later.
      if (transfer.to_site_id) {
        const { error: siteErr } = await supabase
          .from("sites")
          .update({
            active: false,
            archived_at: new Date().toISOString(),
            archived_reason: "move_cancelled",
          } as any)
          .eq("id", transfer.to_site_id);
        if (siteErr) throw siteErr;
      }
      const { error } = await supabase
        .from("site_transfers" as any)
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", transfer.id);
      if (error) throw error;
      if (transfer.to_site_id) {
        // Idempotent re-check of billing; should already be one site.
        await syncHaccpSiteQuantity();
        await syncHaccpUserQuantity();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-transfer", organisationId] });
    },
  });

  const daysLeft = transfer
    ? Math.max(
        0,
        Math.ceil((new Date(transfer.expires_at).getTime() - Date.now()) / 86_400_000),
      )
    : 0;

  return {
    transfer,
    fromSite,
    toSite,
    daysLeft,
    relevantToCurrentSite,
    isLoading: query.isLoading,
    cancel,
    refetch: query.refetch,
  };
}
