import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifySection, currentOpsWindow, isToday, yesterdayISO } from "@/lib/opsTime";

export type Band = "green" | "amber" | "red";

export interface SafeToTradeReason {
  label: string;
  impact: number;
  href: string;
}

export interface SafeToTradeResult {
  score: number;
  band: Band;
  reasons: SafeToTradeReason[];
  isClosed: boolean;
  breakdown: {
    temperatures: number;      // % of currently-required temps complete
    cleaning: number;          // % of currently-due cleaning complete
    daySheet: number;          // % of currently-required day-sheet items complete
    openIncidents: number;
    activeBreaches: number;    // unresolved breaches (no corrective action)
    expiredBatches: number;
    yesterdayClosingMissing: number;
    yesterdayWasClosed: boolean;
    window: "opening" | "midday" | "closing";
  };
}

/**
 * Time-aware Safe-to-Trade.
 *
 * Morning (opening/midday): only opening checks + AM temps for today,
 * plus yesterday's closing work (closing items + PM temps), drive the score.
 * Closing window adds today's closing items + PM temps.
 * Cleaning tasks only count once their due_time has passed.
 */
export function useSafeToTrade(siteId: string | undefined, dateISO: string) {
  return useQuery<SafeToTradeResult>({
    queryKey: ["safe-to-trade", siteId, dateISO],
    enabled: !!siteId,
    queryFn: async () => {
      const viewingToday = isToday(dateISO);
      // For past dates, evaluate as if the full day window has elapsed.
      const window = viewingToday ? currentOpsWindow() : "closing";
      const now = new Date();
      const yISO = yesterdayISO(dateISO);

      const dayStart = `${dateISO}T00:00:00`;
      const dayEnd = `${dateISO}T23:59:59`;
      const yStart = `${yISO}T00:00:00`;
      const yEnd = `${yISO}T23:59:59`;

      const [
        closedDayRes,
        closedYRes,
        tempUnitsRes,
        tempLogsRes,
        tempLogsYRes,
        cleaningTasksRes,
        cleaningLogsRes,
        daySheetSectionsRes,
        daySheetRes,
        daySheetYRes,
        incidentsRes,
        batchesRes,
      ] = await Promise.all([
        supabase.from("closed_days" as any).select("id").eq("site_id", siteId!).eq("closed_date", dateISO).maybeSingle(),
        supabase.from("closed_days" as any).select("id").eq("site_id", siteId!).eq("closed_date", yISO).maybeSingle(),
        supabase.from("temp_units").select("id").eq("site_id", siteId!).eq("active", true),
        supabase.from("temp_logs").select("unit_id, pass, log_type, corrective_action").eq("site_id", siteId!).gte("logged_at", dayStart).lt("logged_at", dayEnd),
        supabase.from("temp_logs").select("unit_id, log_type").eq("site_id", siteId!).gte("logged_at", yStart).lt("logged_at", yEnd),
        supabase.from("cleaning_tasks").select("id, frequency, due_time").eq("site_id", siteId!).eq("active", true),
        supabase.from("cleaning_logs").select("task_id, done").eq("site_id", siteId!).eq("log_date", dateISO),
        supabase.from("day_sheet_sections").select("id, title, default_time, day_sheet_items(id, active)").eq("site_id", siteId!).eq("active", true),
        supabase.from("day_sheets").select("id, day_sheet_entries(item_id, done)").eq("site_id", siteId!).eq("sheet_date", dateISO).maybeSingle(),
        supabase.from("day_sheets").select("id, day_sheet_entries(item_id, done)").eq("site_id", siteId!).eq("sheet_date", yISO).maybeSingle(),
        supabase.from("incidents").select("id").eq("site_id", siteId!).eq("status", "open"),
        supabase.from("batches").select("id, use_by_date, status").eq("site_id", siteId!).neq("status", "disposed"),
      ]);

      const closedDay = (closedDayRes as any)?.data ?? null;
      if (closedDay) {
        return {
          score: 100,
          band: "green" as Band,
          reasons: [],
          isClosed: true,
          breakdown: {
            temperatures: 100, cleaning: 100, daySheet: 100,
            openIncidents: 0, activeBreaches: 0, expiredBatches: 0,
            yesterdayClosingMissing: 0, yesterdayWasClosed: false, window,
          },
        };
      }

      const yesterdayWasClosed = !!(closedYRes as any)?.data;

      const tempUnits = tempUnitsRes.data ?? [];
      const tempLogs = tempLogsRes.data ?? [];
      const tempLogsY = tempLogsYRes.data ?? [];
      const cleaningTasks = (cleaningTasksRes.data ?? []).filter((t: any) => t.frequency === "daily");
      const cleaningLogs = cleaningLogsRes.data ?? [];
      const sections = (daySheetSectionsRes.data ?? []) as any[];
      const dsEntries = ((daySheetRes.data as any)?.day_sheet_entries ?? []) as any[];
      const dsEntriesY = ((daySheetYRes.data as any)?.day_sheet_entries ?? []) as any[];
      const incidents = incidentsRes.data ?? [];
      const batches = batchesRes.data ?? [];

      // --- TEMPERATURES (time-aware) ---
      const amDone = new Set(tempLogs.filter((l: any) => l.log_type === "AM Check").map((l: any) => l.unit_id));
      const pmDone = new Set(tempLogs.filter((l: any) => l.log_type === "PM Check").map((l: any) => l.unit_id));
      const unitCount = tempUnits.length;
      const pmRequiredToday = window === "closing";
      const expectedTempCount = unitCount * (pmRequiredToday ? 2 : 1);
      const doneTempCount = amDone.size + (pmRequiredToday ? pmDone.size : 0);
      const tempCompletion = expectedTempCount === 0 ? 1 : doneTempCount / expectedTempCount;

      // Unresolved breaches today (block trading)
      const activeBreaches = tempLogs.filter((l: any) => l.pass === false && !l.corrective_action).length;

      // --- CLEANING (only count tasks past their due_time) ---
      const dueCleaning = viewingToday
        ? cleaningTasks.filter((t: any) => {
            if (!t.due_time) return true;
            const [hh, mm] = String(t.due_time).slice(0, 5).split(":").map(Number);
            if (Number.isNaN(hh)) return true;
            return now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm;
          })
        : cleaningTasks;
      const doneCleaningIds = new Set(cleaningLogs.filter((l: any) => l.done).map((l: any) => l.task_id));
      const doneDueCount = dueCleaning.filter((t: any) => doneCleaningIds.has(t.id)).length;
      const cleaningCompletion = dueCleaning.length === 0 ? 1 : doneDueCount / dueCleaning.length;

      // --- DAY SHEET (split by opening/closing/midday) ---
      const openingItems: string[] = [];
      const closingItems: string[] = [];
      const middayItems: string[] = [];
      for (const s of sections) {
        const cls = classifySection(s);
        const items = (s.day_sheet_items ?? []).filter((i: any) => i.active).map((i: any) => i.id as string);
        if (cls === "opening") openingItems.push(...items);
        else if (cls === "closing") closingItems.push(...items);
        else middayItems.push(...items);
      }
      const doneIds = new Set(dsEntries.filter((e: any) => e.done).map((e: any) => e.item_id));

      // Required today depends on window
      const requiredToday: string[] = [
        ...openingItems,
        ...(window === "midday" || window === "closing" ? middayItems : []),
        ...(window === "closing" ? closingItems : []),
      ];
      const doneToday = requiredToday.filter((id) => doneIds.has(id)).length;
      const daySheetCompletion = requiredToday.length === 0 ? 1 : doneToday / requiredToday.length;

      const openingMissing = Math.max(0, openingItems.length - openingItems.filter((id) => doneIds.has(id)).length);

      // --- YESTERDAY CLOSING (morning/midday only) ---
      let yesterdayClosingMissing = 0;
      let yesterdayPmTempsMissing = 0;
      if (!yesterdayWasClosed && (window === "opening" || window === "midday")) {
        const doneY = new Set(dsEntriesY.filter((e: any) => e.done).map((e: any) => e.item_id));
        yesterdayClosingMissing = closingItems.filter((id) => !doneY.has(id)).length;
        const pmDoneY = new Set(tempLogsY.filter((l: any) => l.log_type === "PM Check").map((l: any) => l.unit_id));
        yesterdayPmTempsMissing = Math.max(0, unitCount - pmDoneY.size);
      }

      // --- INCIDENTS / BATCHES ---
      const openIncidents = incidents.length;
      const today = new Date(dateISO);
      const expiredBatches = batches.filter((b: any) => b.use_by_date && new Date(b.use_by_date) < today).length;

      // --- SCORING (per spec) ---
      let score = 100;
      const reasons: SafeToTradeReason[] = [];

      if (activeBreaches > 0) {
        const impact = activeBreaches * 25;
        score -= impact;
        reasons.push({
          label: `${activeBreaches} unresolved temp breach${activeBreaches > 1 ? "es" : ""}`,
          impact, href: "/temperatures",
        });
      }

      if ((window === "opening" || window === "midday") && openingMissing > 0) {
        const impact = Math.min(30, openingMissing * 10);
        score -= impact;
        reasons.push({
          label: `${openingMissing} opening check${openingMissing > 1 ? "s" : ""} not done`,
          impact, href: "/day-sheet",
        });
      }

      if (window === "closing" && requiredToday.length > 0 && doneToday < requiredToday.length) {
        const missing = requiredToday.length - doneToday;
        const impact = Math.min(30, missing * 10);
        score -= impact;
        reasons.push({
          label: `${missing} closing task${missing > 1 ? "s" : ""} outstanding`,
          impact, href: "/day-sheet",
        });
      }

      if (yesterdayClosingMissing > 0) {
        const impact = Math.min(30, yesterdayClosingMissing * 15);
        score -= impact;
        reasons.push({
          label: `Yesterday closing incomplete (${yesterdayClosingMissing} item${yesterdayClosingMissing > 1 ? "s" : ""})`,
          impact, href: "/day-sheet",
        });
      }

      if (yesterdayPmTempsMissing > 0) {
        const impact = Math.min(15, yesterdayPmTempsMissing * 5);
        score -= impact;
        reasons.push({
          label: `Yesterday PM temps missing (${yesterdayPmTempsMissing})`,
          impact, href: "/temperatures",
        });
      }

      if (openIncidents > 0) {
        const impact = Math.min(20, openIncidents * 10);
        score -= impact;
        reasons.push({
          label: `${openIncidents} open incident${openIncidents > 1 ? "s" : ""}`,
          impact, href: "/incidents",
        });
      }

      score = Math.max(0, Math.min(100, Math.round(score)));
      const band: Band = score >= 90 ? "green" : score >= 70 ? "amber" : "red";

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
          yesterdayClosingMissing,
          yesterdayWasClosed,
          window,
        },
      };
    },
  });
}
