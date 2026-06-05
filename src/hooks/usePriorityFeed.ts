import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Severity = "critical" | "important" | "operational";

export interface PriorityItem {
  id: string;
  severity: Severity;
  title: string;
  subtitle?: string;
  href: string;
  actionLabel: string;
  /** Sort key: lower = more urgent within a severity band. */
  rank: number;
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  important: 1,
  operational: 2,
};

/**
 * Unified "what should I do right now" feed, derived from existing data only.
 * Capped at 8 items so it stays scannable. Returns [] for closed days.
 */
export function usePriorityFeed(
  siteId: string | undefined,
  dateISO: string,
  currentUserId: string | null,
) {
  return useQuery<PriorityItem[]>({
    queryKey: ["priority-feed", siteId, dateISO, currentUserId],
    enabled: !!siteId,
    queryFn: async () => {
      const dayStart = `${dateISO}T00:00:00`;
      const dayEnd = `${dateISO}T23:59:59`;
      const yesterday = new Date(dateISO);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = yesterday.toISOString().slice(0, 10);
      const in7days = new Date(dateISO);
      in7days.setDate(in7days.getDate() + 7);
      const in7daysISO = in7days.toISOString().slice(0, 10);

      // Pull a window of closed_days covering yesterday → today (and a small
      // back-window for any recent breaches that may sit on a closed date).
      const backWindow = new Date(dateISO);
      backWindow.setDate(backWindow.getDate() - 14);
      const backWindowISO = backWindow.toISOString().slice(0, 10);

      const [
        closedDayRes,
        closedDaysWindowRes,
        tempBreachesRes,
        tempUnitsRes,
        tempLogsTodayRes,
        cleaningTasksRes,
        cleaningLogsYesterdayRes,
        incidentsRes,
        trainingExpiringRes,
        shiftsTodayRes,
        batchesExpiredRes,
      ] = await Promise.all([
        supabase.from("closed_days" as any).select("id").eq("site_id", siteId!).eq("closed_date", dateISO).maybeSingle(),
        supabase.from("closed_days" as any).select("closed_date").eq("site_id", siteId!).gte("closed_date", backWindowISO).lte("closed_date", dateISO),
        supabase.from("temp_logs").select("id, value, unit_id, logged_at, food_item").eq("site_id", siteId!).eq("pass", false).is("corrective_action", null).order("logged_at", { ascending: false }).limit(5),
        supabase.from("temp_units").select("id, name").eq("site_id", siteId!).eq("active", true),
        supabase.from("temp_logs").select("unit_id, log_type").eq("site_id", siteId!).gte("logged_at", dayStart).lt("logged_at", dayEnd),
        supabase.from("cleaning_tasks").select("id, task").eq("site_id", siteId!).eq("active", true).eq("frequency", "daily"),
        supabase.from("cleaning_logs").select("task_id, done").eq("site_id", siteId!).eq("log_date", yesterdayISO),
        supabase.from("incidents").select("id, title, type, reported_at").eq("site_id", siteId!).eq("status", "open").order("reported_at", { ascending: false }).limit(5),
        supabase.from("training_records").select("id, training_name, expiry_date, user_id").eq("site_id", siteId!).not("expiry_date", "is", null).lte("expiry_date", in7daysISO).gte("expiry_date", dateISO),
        currentUserId
          ? supabase.from("rota_assignments").select("id, start_time, end_time, position").eq("site_id", siteId!).eq("shift_date", dateISO).eq("user_id", currentUserId).is("cancelled_at", null)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("batches").select("id, product_name, use_by_date").eq("site_id", siteId!).neq("status", "disposed").lt("use_by_date", dateISO).limit(5),
      ]);

      if ((closedDayRes as any)?.data) return [];

      const items: PriorityItem[] = [];
      const unitNameById = new Map((tempUnitsRes.data ?? []).map((u: any) => [u.id, u.name as string]));

      // 🔴 Temperature breaches with no corrective action
      (tempBreachesRes.data ?? []).forEach((b: any) => {
        const label = unitNameById.get(b.unit_id) ?? b.food_item ?? "Unit";
        items.push({
          id: `breach-${b.id}`,
          severity: "critical",
          title: `${label} temp breach — log corrective action`,
          subtitle: `Recorded ${b.value}°C`,
          href: "/temperatures",
          actionLabel: "Fix now",
          rank: 0,
        });
      });

      // 🟠 Open incidents
      (incidentsRes.data ?? []).forEach((inc: any) => {
        items.push({
          id: `incident-${inc.id}`,
          severity: "important",
          title: inc.title,
          subtitle: `Open ${inc.type ?? "incident"}`,
          href: "/incidents",
          actionLabel: "Review",
          rank: 1,
        });
      });

      // 🟠 Today's missed temp checks (only after expected time has passed)
      const now = new Date();
      const isToday = dateISO === now.toISOString().slice(0, 10);
      const amOverdue = !isToday || now.getHours() >= 11;
      const pmOverdue = !isToday || now.getHours() >= 18;
      const amDone = new Set((tempLogsTodayRes.data ?? []).filter((l: any) => l.log_type === "AM Check").map((l: any) => l.unit_id));
      const pmDone = new Set((tempLogsTodayRes.data ?? []).filter((l: any) => l.log_type === "PM Check").map((l: any) => l.unit_id));
      (tempUnitsRes.data ?? []).forEach((u: any) => {
        if (amOverdue && !amDone.has(u.id)) {
          items.push({
            id: `temp-am-${u.id}`,
            severity: "important",
            title: `${u.name} AM temperature overdue`,
            href: "/temperatures",
            actionLabel: "Log",
            rank: 2,
          });
        }
        if (pmOverdue && !pmDone.has(u.id)) {
          items.push({
            id: `temp-pm-${u.id}`,
            severity: "important",
            title: `${u.name} PM temperature overdue`,
            href: "/temperatures",
            actionLabel: "Log",
            rank: 3,
          });
        }
      });

      // 🟠 Cleaning tasks missed yesterday
      const yDoneIds = new Set((cleaningLogsYesterdayRes.data ?? []).filter((l: any) => l.done).map((l: any) => l.task_id));
      (cleaningTasksRes.data ?? []).forEach((t: any) => {
        if (!yDoneIds.has(t.id)) {
          items.push({
            id: `clean-y-${t.id}`,
            severity: "important",
            title: `Cleaning missed yesterday — ${t.task}`,
            href: "/cleaning",
            actionLabel: "Catch up",
            rank: 4,
          });
        }
      });

      // 🟠 Staff training expiring soon
      (trainingExpiringRes.data ?? []).forEach((t: any) => {
        const days = Math.max(
          0,
          Math.round((new Date(t.expiry_date).getTime() - new Date(dateISO).getTime()) / 86400000),
        );
        items.push({
          id: `train-${t.id}`,
          severity: "important",
          title: `${t.training_name} expires in ${days} day${days === 1 ? "" : "s"}`,
          href: "/staff-training",
          actionLabel: "Renew",
          rank: 5,
        });
      });

      // 🟠 Batches past use-by
      (batchesExpiredRes.data ?? []).forEach((b: any) => {
        items.push({
          id: `batch-exp-${b.id}`,
          severity: "important",
          title: `${b.product_name} past use-by`,
          subtitle: `Use-by ${b.use_by_date}`,
          href: "/batches",
          actionLabel: "Discard",
          rank: 6,
        });
      });

      // 🔵 Your shifts today
      (shiftsTodayRes.data ?? []).forEach((s: any) => {
        items.push({
          id: `shift-${s.id}`,
          severity: "operational",
          title: `Your shift today · ${s.start_time}–${s.end_time}`,
          subtitle: s.position ?? undefined,
          href: "/shifts",
          actionLabel: "View",
          rank: 7,
        });
      });

      items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.rank - b.rank);
      // Dashboard rule: max 5 priority items — keep scannable.
      return items.slice(0, 5);
    },
  });
}
