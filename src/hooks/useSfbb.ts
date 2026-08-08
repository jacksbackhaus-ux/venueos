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

  // Period start: the day after the last completed review, otherwise today —
  // so existing customers never see retroactive overdue work.
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
  status: string;
  how_text: string | null;
  responses: Record<string, any> | null;
  notes: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
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
      method_key: string;
      category: string;
      status: string;
      responses?: Record<string, any> | null;
      notes?: string | null;
      /** Legacy single free-text field, still written for older records. */
      how_text?: string | null;
    }) => {
      if (!siteId || !orgId) throw new Error("No site");
      const completed = vars.status === "completed" || vars.status === "documented";
      const { error } = await supabase.from("safe_methods" as never).upsert({
        site_id: siteId,
        organisation_id: orgId,
        method_key: vars.method_key,
        category: vars.category,
        status: vars.status,
        responses: vars.responses ?? {},
        notes: vars.notes?.trim() || null,
        how_text: vars.how_text?.trim() || null,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? userId : null,
        completed_by_name: completed ? userName : null,
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
// FOOD SAFETY MANAGEMENT SYSTEM (route + review dates)
// ──────────────────────────────────────────────────────────────────

export type SfbbRoute = "undecided" | "in_app" | "uploaded" | "both";

export interface SfbbSystemRow {
  id: string;
  site_id: string;
  route: SfbbRoute;
  first_completed_at: string | null;
  last_reviewed_at: string | null;
  reviewed_by_name: string | null;
  review_reminder_dismissed_at: string | null;
  notes: string | null;
}

export function useSfbbSystem() {
  const qc = useQueryClient();
  const { siteId, orgId, userId, userName } = useActor();

  const q = useQuery<SfbbSystemRow | null>({
    queryKey: ["sfbb-system", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sfbb_system" as never)
        .select("*")
        .eq("site_id", siteId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as SfbbSystemRow | null;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<SfbbSystemRow> & { markReviewed?: boolean }) => {
      if (!siteId || !orgId) throw new Error("No site");
      const { markReviewed, ...rest } = patch;
      const row: Record<string, any> = { site_id: siteId, organisation_id: orgId, ...rest };
      if (markReviewed) {
        row.last_reviewed_at = new Date().toISOString().slice(0, 10);
        row.reviewed_by = userId;
        row.reviewed_by_name = userName;
      }
      const { error } = await supabase
        .from("sfbb_system" as never)
        .upsert(row as never, { onConflict: "site_id" } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sfbb-system", siteId] }),
  });

  return { system: q.data ?? null, isLoading: q.isLoading, update };
}

// ──────────────────────────────────────────────────────────────────
// UPLOADED SFBB PACK DOCUMENTS
// ──────────────────────────────────────────────────────────────────

export interface SfbbDocumentRow {
  id: string;
  site_id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  date_completed: string | null;
  review_date: string | null;
  notes: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export const SFBB_BUCKET = "sfbb-packs";

export function useSfbbDocuments() {
  const qc = useQueryClient();
  const { siteId, orgId, userId, userName } = useActor();

  const q = useQuery<SfbbDocumentRow[]>({
    queryKey: ["sfbb-documents", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sfbb_documents" as never)
        .select("*")
        .eq("site_id", siteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SfbbDocumentRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sfbb-documents", siteId] });
    qc.invalidateQueries({ queryKey: ["sfbb-system", siteId] });
  };

  const upload = useMutation({
    mutationFn: async (vars: {
      file: File; name: string; date_completed?: string | null;
      review_date?: string | null; notes?: string | null;
    }) => {
      if (!siteId || !orgId) throw new Error("No site");
      const ext = vars.file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `${siteId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(SFBB_BUCKET).upload(path, vars.file, {
        contentType: vars.file.type || undefined,
        upsert: false,
      });
      if (up.error) throw up.error;

      const { error } = await supabase.from("sfbb_documents" as never).insert({
        site_id: siteId,
        organisation_id: orgId,
        name: vars.name.trim() || vars.file.name,
        storage_path: path,
        mime_type: vars.file.type || null,
        file_size: vars.file.size,
        date_completed: vars.date_completed || null,
        review_date: vars.review_date || null,
        notes: vars.notes?.trim() || null,
        uploaded_by: userId,
        uploaded_by_name: userName,
      } as never);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (doc: SfbbDocumentRow) => {
      await supabase.storage.from(SFBB_BUCKET).remove([doc.storage_path]);
      const { error } = await supabase.from("sfbb_documents" as never).delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  async function signedUrl(path: string): Promise<string | null> {
    const { data } = await supabase.storage.from(SFBB_BUCKET).createSignedUrl(path, 60 * 10);
    return data?.signedUrl ?? null;
  }

  return { docs: q.data ?? [], isLoading: q.isLoading, upload, remove, signedUrl };
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
