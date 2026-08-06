import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";

export interface ProductionDayRow {
  id: string;
  site_id: string;
  production_date: string;
  started_at: string;
  started_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  is_retrospective: boolean;
  notes: string | null;
}

const TABLE = "production_days" as never;

/**
 * Production days for on-demand sites (home kitchens, market traders,
 * bake-to-order production units).
 *
 * A production day is the unit of compliance for these sites. Calendar days
 * with no production day are neutral — never counted, never scored, never
 * nagged about.
 */
export function useProductionDays(siteId: string | undefined, limit = 30) {
  return useQuery<ProductionDayRow[]>({
    queryKey: ["production-days", siteId, limit],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("site_id", siteId!)
        .order("production_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as ProductionDayRow[];
    },
  });
}

/**
 * The production day for a specific date, plus one-tap start / finish.
 * Starting is a single insert — no modal, no form, no confirmation.
 */
export function useProductionDay(siteId: string | undefined, dateISO: string) {
  const queryClient = useQueryClient();
  const { appUser, staffSession } = useAuth();
  const { currentSite } = useSite();
  const userId = appUser?.id ?? staffSession?.user_id ?? null;
  const orgId = currentSite?.organisation_id ?? null;

  const query = useQuery<ProductionDayRow | null>({
    queryKey: ["production-day", siteId, dateISO],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("site_id", siteId!)
        .eq("production_date", dateISO)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ProductionDayRow | null;
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["production-day", siteId] });
    queryClient.invalidateQueries({ queryKey: ["production-days", siteId] });
    queryClient.invalidateQueries({ queryKey: ["safe-to-trade", siteId] });
    queryClient.invalidateQueries({ queryKey: ["priority-feed", siteId] });
  }, [queryClient, siteId]);

  const start = useMutation({
    mutationFn: async (date: string = dateISO) => {
      if (!siteId || !orgId) throw new Error("No site");
      const todayISO = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          site_id: siteId,
          organisation_id: orgId,
          production_date: date,
          started_by: userId,
          // Honest audit trail: recorded now, but for a past production date.
          is_retrospective: date < todayISO,
        } as never)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ProductionDayRow;
    },
    onSuccess: invalidate,
  });

  const finish = useMutation({
    mutationFn: async (notes?: string) => {
      const row = query.data;
      if (!row) throw new Error("No production day to finish");
      const { error } = await supabase
        .from(TABLE)
        .update({
          completed_at: new Date().toISOString(),
          completed_by: userId,
          notes: notes?.trim() || null,
        } as never)
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const finishById = useMutation({
    mutationFn: async (vars: { id: string; notes?: string }) => {
      const { error } = await supabase
        .from(TABLE)
        .update({
          completed_at: new Date().toISOString(),
          completed_by: userId,
          notes: vars.notes?.trim() || null,
        } as never)
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    productionDay: query.data ?? null,
    isLoading: query.isLoading,
    hasProductionDay: !!query.data,
    isActive: !!query.data && !query.data.completed_at,
    start,
    finish,
    finishById,
  };
}
