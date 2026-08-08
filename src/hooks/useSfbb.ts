/**
 * Safer Food Better Business (SFBB) data hooks.
 *
 * All five additive tables live behind this one file so pages stay thin:
 *   reviews · probe_calibrations · fitness_to_work · safe_methods · recalls
 *
 * Nothing here creates overdue state on its own. Cadence is computed from
 * `src/lib/sfbb.ts`, which only counts production days for on_demand sites,
 * so closed / non-production days never generate a failure.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import {
  computeReviewCadence, emptyChecklist, probeCalibrationPass,
  type ReviewChecklist, type SafeMethodStatus,
} from "@/lib/sfbb";

// ──────────────────────────────────────────────────────────────────
// Shared identity helper
// ──────────────────────────────────────────────────────────────────

function useActor() {
  const { appUser, staffSession } = useAuth();
  const { currentSite } = useSite();
  return {
    userId: appUser?.id ?? staffSession?.user_id ?? null,
    userName: appUser?.display_name ?? (staffSession as any)?.display_name ?? null,
    siteId: currentSite?.id ?? null,
    orgId: currentSite?.organisation_id ?? null,
  };
}

// ──────────────────────────────────────────────────────────────────
// REVIEWS
// ──────────────────────────────────────────────────────────────────

export interface ReviewRow {
  id: string;
  site_id: string;
  period_start: string;
  period_end: string;
  production_days_covered: number | null;
  status: "due" | "in_progress" | "complete";
  problems_observed: boolean;
  problems_detail: string | null;
  action_taken: string | null;
  checklist: ReviewChecklist;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  created_at: string;
}

export function useReviews() {
  const qc = useQueryClient();
  const { siteId, orgId, userId, userName } = useActor();
  const { operatingMode } = useSite();

  const reviewsQ = useQuery<ReviewRow[]>({
    queryKey: ["sfbb-reviews", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews" as never)
        .select("*")
        .eq("site_id", siteId!)
        .order("period_end", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as ReviewRow[];
    },
  });

  const lastComplete = (reviewsQ.data ?? []).find((r) => r.status === "complete") ?? null;
  const openReview = (reviewsQ.data ?? []).find((r) => r.status !== "complete") ?? null;

  // Period start: the day after the last completed review, otherwise the
  // earliest production day / 28-day window we can see. Existing customers
  // start their first period today — nothing appears retroactively overdue.
  const firstSeen = (reviewsQ.data ?? []).length === 0;

  const productionDaysQ = useQuery<string[]>({
    queryKey: ["sfbb-review-production-days", siteId, lastComplete?.period_end ?? null],
    enabled: !!siteId && operatingMode === "on_demand",
    queryFn: async () => {
      let q = supabase
        .from("production_days" as never)
        .select("production_date")
        .eq("site_id", siteId!);
      if (lastComplete?.period_end) q = q.gt("production_date", lastComplete.period_end);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => r.production_date as string);
    },
  });

  const todayISO = new Date().toISOString().slice(0, 10);
  const periodStart = openReview?.period_start
    ?? (lastComplete ? nextDay(lastComplete.period_end) : todayISO);

  const cadence = computeReviewCadence({
    mode: operatingMode,
    periodStartISO: periodStart,
    productionDates: productionDaysQ.data ?? [],
    todayISO,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sfbb-reviews", siteId] });
    qc.invalidateQueries({ queryKey: ["priority-feed"] });
  };

  const startReview = useMutation({
    mutationFn: async () => {
      if (!siteId || !orgId) throw new Error("No site");
      if (openReview) return openReview;
      const { data, error } = await supabase
        .from("reviews" as never)
        .insert({
          site_id: siteId,
          organisation_id: orgId,
          period_start: cadence.periodStart,
          period_end: cadence.periodEnd,
          production_days_covered: operatingMode === "on_demand" ? cadence.productionDaysCovered : null,
          status: "in_progress",
          checklist: emptyChecklist(),
        } as never)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ReviewRow;
    },
    onSuccess: invalidate,
  });

  const saveReview = useMutation({
    mutationFn: async (vars: {
      id: string;
      checklist: ReviewChecklist;
      problems_observed: boolean;
      problems_detail?: string | null;
      action_taken?: string | null;
      complete?: boolean;
    }) => {
      const patch: Record<string, unknown> = {
        checklist: vars.checklist,
        problems_observed: vars.problems_observed,
        problems_detail: vars.problems_detail?.trim() || null,
        action_taken: vars.action_taken?.trim() || null,
        period_end: todayISO,
        production_days_covered: operatingMode === "on_demand" ? cadence.productionDaysCovered : null,
      };
      if (vars.complete) {
        patch.status = "complete";
        patch.completed_at = new Date().toISOString();
        patch.completed_by = userId;
        patch.completed_by_name = userName;
      }
      const { error } = await supabase.from("reviews" as never).update(patch as never).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    reviews: reviewsQ.data ?? [],
    isLoading: reviewsQ.isLoading,
    openReview,
    lastComplete,
    cadence,
    /**
     * True only when a review is genuinely due. A brand-new site's first
     * period starts today, so existing customers never see retroactive work.
     */
    isDue: cadence.due,

    startReview,
    saveReview,
  };
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────────────────────────
// PROBE CALIBRATIONS
// ──────────────────────────────────────────────────────────────────

export interface ProbeCalibrationRow {
  id: string;
  probe_name: string | null;
  iced_water_reading: number;
  boiling_water_reading: number;
  pass: boolean;
  calibrated_by_name: string | null;
  calibrated_at: string;
  notes: string | null;
}

export function useProbeCalibrations() {
  const qc = useQueryClient();
  const { siteId, orgId, userId, userName } = useActor();

  const q = useQuery<ProbeCalibrationRow[]>({
    queryKey: ["probe-calibrations", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("probe_calibrations" as never)
        .select("*")
        .eq("site_id", siteId!)
        .order("calibrated_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as unknown as ProbeCalibrationRow[];
    },
  });

  const latest = (q.data ?? [])[0] ?? null;
  const dueThisMonth = (() => {
    if (!latest) return true;
    const days = (Date.now() - new Date(latest.calibrated_at).getTime()) / 86400000;
    return days > 31;
  })();

  const log = useMutation({
    mutationFn: async (vars: { probe_name?: string; iced: number; boiling: number; notes?: string }) => {
      if (!siteId || !orgId) throw new Error("No site");
      const { error } = await supabase.from("probe_calibrations" as never).insert({
        site_id: siteId,
        organisation_id: orgId,
        probe_name: vars.probe_name?.trim() || null,
        iced_water_reading: vars.iced,
        boiling_water_reading: vars.boiling,
        pass: probeCalibrationPass(vars.iced, vars.boiling),
        calibrated_by: userId,
        calibrated_by_name: userName,
        notes: vars.notes?.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["probe-calibrations", siteId] }),
  });

  return { calibrations: q.data ?? [], isLoading: q.isLoading, latest, dueThisMonth, log };
}

// ──────────────────────────────────────────────────────────────────
// FITNESS TO WORK
// ──────────────────────────────────────────────────────────────────

export interface FitnessRow {
  id: string;
  staff_name: string;
  user_id: string | null;
  reported_date: string;
  symptoms: string | null;
  excluded_from: string | null;
  cleared_to_return: string | null;
  status: "excluded" | "cleared";
  notes: string | null;
  recorded_by_name: string | null;
  created_at: string;
}

export function useFitnessToWork() {
  const qc = useQueryClient();
  const { siteId, orgId, userId, userName } = useActor();

  const q = useQuery<FitnessRow[]>({
    queryKey: ["fitness-to-work", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fitness_to_work" as never)
        .select("*")
        .eq("site_id", siteId!)
        .order("reported_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as FitnessRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["fitness-to-work", siteId] });

  const report = useMutation({
    mutationFn: async (vars: {
      staff_name: string; user_id?: string | null; symptoms?: string;
      excluded_from?: string; cleared_to_return?: string | null; notes?: string;
    }) => {
      if (!siteId || !orgId) throw new Error("No site");
      const { error } = await supabase.from("fitness_to_work" as never).insert({
        site_id: siteId,
        organisation_id: orgId,
        staff_name: vars.staff_name.trim(),
        user_id: vars.user_id ?? null,
        symptoms: vars.symptoms?.trim() || null,
        excluded_from: vars.excluded_from ?? new Date().toISOString().slice(0, 10),
        cleared_to_return: vars.cleared_to_return ?? null,
        status: "excluded",
        notes: vars.notes?.trim() || null,
        recorded_by: userId,
        recorded_by_name: userName,
      } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const clear = useMutation({
    mutationFn: async (vars: { id: string; cleared_to_return: string }) => {
      const { error } = await supabase
        .from("fitness_to_work" as never)
        .update({ status: "cleared", cleared_to_return: vars.cleared_to_return } as never)
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { records: q.data ?? [], isLoading: q.isLoading, report, clear };
}

// ──────────────────────────────────────────────────────────────────
// SAFE METHODS
// ──────────────────────────────────────────────────────────────────

export interface SafeMethodRow {
  id: string;
  method_key: string;
  category: string;
  status: SafeMethodStatus;
  how_text: string | null;
  updated_by_name: string | null;
  updated_at: string;
}

export function useSafeMethods() {
  const qc = useQueryClient();
  const { siteId, orgId, userId, userName } = useActor();

  const q = useQuery<SafeMethodRow[]>({
    queryKey: ["safe-methods", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safe_methods" as never)
        .select("*")
        .eq("site_id", siteId!);
      if (error) throw error;
      return (data ?? []) as unknown as SafeMethodRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (vars: {
      method_key: string; category: string; status: SafeMethodStatus; how_text?: string | null;
    }) => {
      if (!siteId || !orgId) throw new Error("No site");
      const { error } = await supabase.from("safe_methods" as never).upsert({
        site_id: siteId,
        organisation_id: orgId,
        method_key: vars.method_key,
        category: vars.category,
        status: vars.status,
        how_text: vars.how_text?.trim() || null,
        updated_by: userId,
        updated_by_name: userName,
      } as never, { onConflict: "site_id,method_key" } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["safe-methods", siteId] }),
  });

  const byKey: Record<string, SafeMethodRow> = {};
  (q.data ?? []).forEach((r) => { byKey[r.method_key] = r; });

  return { rows: q.data ?? [], byKey, isLoading: q.isLoading, save };
}

// ──────────────────────────────────────────────────────────────────
// RECALLS
// ──────────────────────────────────────────────────────────────────

export interface RecallRow {
  id: string;
  item_type: "batch" | "ingredient" | "product";
  item_ref: string;
  reason: string;
  source: string | null;
  affected_batch_ids: string[];
  action_taken: string | null;
  customers_informed: boolean;
  recorded_by_name: string | null;
  created_at: string;
}

export function useRecalls() {
  const qc = useQueryClient();
  const { siteId, orgId, userId, userName } = useActor();

  const q = useQuery<RecallRow[]>({
    queryKey: ["recalls", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recalls" as never)
        .select("*")
        .eq("site_id", siteId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as RecallRow[];
    },
  });

  const create = useMutation({
    mutationFn: async (vars: {
      item_type: "batch" | "ingredient" | "product";
      item_ref: string;
      reason: string;
      source?: string | null;
      affected_batch_ids?: string[];
      action_taken?: string;
      customers_informed?: boolean;
    }) => {
      if (!siteId || !orgId) throw new Error("No site");
      const { error } = await supabase.from("recalls" as never).insert({
        site_id: siteId,
        organisation_id: orgId,
        item_type: vars.item_type,
        item_ref: vars.item_ref.trim(),
        reason: vars.reason,
        source: vars.source ?? null,
        affected_batch_ids: vars.affected_batch_ids ?? [],
        action_taken: vars.action_taken?.trim() || null,
        customers_informed: !!vars.customers_informed,
        recorded_by: userId,
        recorded_by_name: userName,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recalls", siteId] }),
  });

  return { recalls: q.data ?? [], isLoading: q.isLoading, create };
}
