import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Band = "green" | "amber" | "red";

export interface SafeToTradeReason {
  label: string;
  impact: number; // points subtracted from 100 (positive number)
  href: string;
}

export interface SafeToTradeResult {
  score: number;             // 0-100
  band: Band;
  reasons: SafeToTradeReason[]; // top 3, descending impact
  isClosed: boolean;
  breakdown: {
    temperatures: number;    // 0-100 completion
    cleaning: number;
    daySheet: number;
    openIncidents: number;   // count
    activeBreaches: number;  // count
    expiredBatches: number;  // count
  };
}

/**
 * Derives a single "Safe to Trade" score from existing data. Closed days
 * short-circuit to a green 100 so the score is honest about non-trading days.
 *
 * Scoring model (transparent on purpose):
 *   - Each completion domain (temps, cleaning, day sheet) contributes
 *     up to a weighted share of the score. Missed work eats into that share.
 *   - Active temp breaches without corrective action and open incidents are
 *     hard deductions on top — they represent real-time safety risk.
 *   - Expired/use-by batches deduct a smaller fixed amount each, capped.
 */
export function useSafeToTrade(siteId: string | undefined, dateISO: string) {
  return useQuery<SafeToTradeResult>({
    queryKey: ["safe-to-trade", siteId, dateISO],
    enabled: !!siteId,
    queryFn: async () => {
      const dayStart = `${dateISO}T00:00:00`;
      const dayEnd = `${dateISO}T23:59:59`;

      const [
        closedDayRes,
        tempUnitsRes,
        tempLogsRes,
        cleaningTasksRes,
        cleaningLogsRes,
        daySheetSectionsRes,
        daySheetRes,
        incidentsRes,
        batchesRes,
      ] = await Promise.all([
        supabase.from("closed_days" as any).select("id").eq("site_id", siteId!).eq("closed_date", dateISO).maybeSingle(),
        supabase.from("temp_units").select("id").eq("site_id", siteId!).eq("active", true),
        supabase.from("temp_logs").select("unit_id, pass, log_type, corrective_action").eq("site_id", siteId!).gte("logged_at", dayStart).lt("logged_at", dayEnd),
        supabase.from("cleaning_tasks").select("id, frequency").eq("site_id", siteId!).eq("active", true),
        supabase.from("cleaning_logs").select("task_id, done").eq("site_id", siteId!).eq("log_date", dateISO),
        supabase.from("day_sheet_sections").select("id, day_sheet_items(id, active)").eq("site_id", siteId!).eq("active", true),
        supabase.from("day_sheets").select("id, day_sheet_entries(item_id, done)").eq("site_id", siteId!).eq("sheet_date", dateISO).maybeSingle(),
        supabase.from("incidents").select("id").eq("site_id", siteId!).eq("status", "open"),
        supabase.from("batches").select("id, use_by_date, status").eq("site_id", siteId!).neq("status", "discarded"),
      ]);

      const closedDay = (closedDayRes as any)?.data ?? null;
      if (closedDay) {
        return {
          score: 100,
          band: "green" as Band,
          reasons: [],
          isClosed: true,
          breakdown: { temperatures: 100, cleaning: 100, daySheet: 100, openIncidents: 0, activeBreaches: 0, expiredBatches: 0 },
        };
      }

      const tempUnits = tempUnitsRes.data ?? [];
      const tempLogs = tempLogsRes.data ?? [];
      const cleaningTasks = (cleaningTasksRes.data ?? []).filter((t: any) => t.frequency === "daily");
      const cleaningLogs = cleaningLogsRes.data ?? [];
      const daySheetSections = daySheetSectionsRes.data ?? [];
      const daySheetEntries = (daySheetRes.data as any)?.day_sheet_entries ?? [];
      const incidents = incidentsRes.data ?? [];
      const batches = batchesRes.data ?? [];

      // Completion ratios (1 = fully done; default 1 when no scheduled work).
      const amDone = new Set(tempLogs.filter((l: any) => l.log_type === "AM Check").map((l: any) => l.unit_id));
      const pmDone = new Set(tempLogs.filter((l: any) => l.log_type === "PM Check").map((l: any) => l.unit_id));
      const tempExpected = tempUnits.length * 2;
      const tempCompletion = tempExpected === 0 ? 1 : (amDone.size + pmDone.size) / tempExpected;

      const doneCleaningIds = new Set(cleaningLogs.filter((l: any) => l.done).map((l: any) => l.task_id));
      const cleaningCompletion = cleaningTasks.length === 0 ? 1 : doneCleaningIds.size / cleaningTasks.length;

      const dsItems = daySheetSections.flatMap((s: any) => (s.day_sheet_items ?? []).filter((i: any) => i.active));
      const doneItemIds = new Set(daySheetEntries.filter((e: any) => e.done).map((e: any) => e.item_id));
      const daySheetCompletion = dsItems.length === 0 ? 1 : doneItemIds.size / dsItems.length;

      // Hard deductions
      const activeBreaches = tempLogs.filter((l: any) => l.pass === false && !l.corrective_action).length;
      const openIncidents = incidents.length;
      const today = new Date(dateISO);
      const expiredBatches = batches.filter((b: any) => b.use_by_date && new Date(b.use_by_date) < today).length;

      // Weights: completion domains share 60 points, hard issues take the rest.
      const tempPts = tempCompletion * 25;          // up to 25
      const cleanPts = cleaningCompletion * 20;     // up to 20
      const daySheetPts = daySheetCompletion * 15;  // up to 15
      const baseline = 40;                          // remaining 40 is "no critical issues"
      const breachPenalty = Math.min(20, activeBreaches * 10);
      const incidentPenalty = Math.min(15, openIncidents * 5);
      const expiredPenalty = Math.min(10, expiredBatches * 2);

      const score = Math.max(0, Math.round(
        tempPts + cleanPts + daySheetPts + baseline - breachPenalty - incidentPenalty - expiredPenalty
      ));

      const band: Band = score >= 85 ? "green" : score >= 65 ? "amber" : "red";

      // Build reasons — biggest impacts first
      const reasons: SafeToTradeReason[] = [];
      if (activeBreaches > 0) {
        reasons.push({
          label: `${activeBreaches} temp breach${activeBreaches > 1 ? "es" : ""} without corrective action`,
          impact: breachPenalty,
          href: "/temperatures",
        });
      }
      if (openIncidents > 0) {
        reasons.push({
          label: `${openIncidents} open incident${openIncidents > 1 ? "s" : ""}`,
          impact: incidentPenalty,
          href: "/incidents",
        });
      }
      if (tempCompletion < 1) {
        reasons.push({
          label: `Temperature checks ${Math.round(tempCompletion * 100)}% complete`,
          impact: Math.round((1 - tempCompletion) * 25),
          href: "/temperatures",
        });
      }
      if (cleaningCompletion < 1) {
        reasons.push({
          label: `Cleaning ${Math.round(cleaningCompletion * 100)}% complete`,
          impact: Math.round((1 - cleaningCompletion) * 20),
          href: "/cleaning",
        });
      }
      if (daySheetCompletion < 1) {
        reasons.push({
          label: `Day sheet ${Math.round(daySheetCompletion * 100)}% complete`,
          impact: Math.round((1 - daySheetCompletion) * 15),
          href: "/day-sheet",
        });
      }
      if (expiredBatches > 0) {
        reasons.push({
          label: `${expiredBatches} batch${expiredBatches > 1 ? "es" : ""} past use-by`,
          impact: expiredPenalty,
          href: "/batches",
        });
      }

      reasons.sort((a, b) => b.impact - a.impact);

      return {
        score,
        band,
        reasons: reasons.slice(0, 3),
        isClosed: false,
        breakdown: {
          temperatures: Math.round(tempCompletion * 100),
          cleaning: Math.round(cleaningCompletion * 100),
          daySheet: Math.round(daySheetCompletion * 100),
          openIncidents,
          activeBreaches,
          expiredBatches,
        },
      };
    },
  });
}
