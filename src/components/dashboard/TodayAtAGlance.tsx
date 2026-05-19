import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Thermometer, SprayCan, Users, ClipboardCheck, ChevronRight } from "lucide-react";

interface Props { siteId: string | undefined; dateISO: string; }

interface Tile {
  href: string;
  label: string;
  icon: any;
  lines: { text: string; tone?: "ok" | "warn" | "bad" | "muted" }[];
}

const toneCls: Record<string, string> = {
  ok: "text-success",
  warn: "text-warning",
  bad: "text-breach",
  muted: "text-muted-foreground",
};

export function TodayAtAGlance({ siteId, dateISO }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-today-glance", siteId, dateISO],
    enabled: !!siteId,
    queryFn: async () => {
      const dayStart = `${dateISO}T00:00:00`;
      const dayEnd = `${dateISO}T23:59:59`;

      const [closed, tempUnits, tempLogs, cleanTasks, cleanLogs, daySheet, shifts] = await Promise.all([
        supabase.from("closed_days" as any).select("id").eq("site_id", siteId!).eq("closed_date", dateISO).maybeSingle(),
        supabase.from("temp_units").select("id, name").eq("site_id", siteId!).eq("active", true),
        supabase.from("temp_logs").select("unit_id, log_type, pass, logged_at, food_item").eq("site_id", siteId!).gte("logged_at", dayStart).lt("logged_at", dayEnd),
        supabase.from("cleaning_tasks").select("id").eq("site_id", siteId!).eq("active", true).eq("frequency", "daily"),
        supabase.from("cleaning_logs").select("task_id, done").eq("site_id", siteId!).eq("log_date", dateISO),
        supabase.from("day_sheets").select("id, signed_off_at, day_sheet_entries(item_id, done, completed_at)").eq("site_id", siteId!).eq("sheet_date", dateISO).maybeSingle(),
        supabase.from("rota_assignments").select("id, user_id, start_time, end_time").eq("site_id", siteId!).eq("shift_date", dateISO).is("cancelled_at", null),
      ]);

      return {
        isClosed: !!(closed as any)?.data,
        units: tempUnits.data ?? [],
        tempLogs: tempLogs.data ?? [],
        cleanTotal: (cleanTasks.data ?? []).length,
        cleanDone: (cleanLogs.data ?? []).filter((l: any) => l.done).length,
        cleanMissed: (cleanTasks.data ?? []).length - (cleanLogs.data ?? []).filter((l: any) => l.done).length,
        daySheet: daySheet.data as any,
        shifts: shifts.data ?? [],
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  if (data.isClosed) return null;

  // Temperatures
  const fridgeUnits = data.units;
  const amDone = new Set(data.tempLogs.filter((l: any) => l.log_type === "AM Check").map((l: any) => l.unit_id));
  const pmDone = new Set(data.tempLogs.filter((l: any) => l.log_type === "PM Check").map((l: any) => l.unit_id));
  const fridgeDone = Math.min(fridgeUnits.length, amDone.size + pmDone.size === fridgeUnits.length * 2 ? fridgeUnits.length : Math.floor((amDone.size + pmDone.size) / 2));
  const processChecks = data.tempLogs.filter((l: any) => l.log_type && !["AM Check", "PM Check"].includes(l.log_type)).length;
  const breaches = data.tempLogs.filter((l: any) => l.pass === false).length;

  // Day sheet
  const dsEntries = (data.daySheet?.day_sheet_entries ?? []) as any[];
  const dsDone = dsEntries.filter((e) => e.done).length;
  const dsTotal = dsEntries.length;
  const dsComplete = !!data.daySheet?.signed_off_at;
  const lastLog = dsEntries
    .filter((e) => e.completed_at)
    .map((e) => new Date(e.completed_at as string))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const minutesAgo = lastLog ? Math.round((Date.now() - lastLog.getTime()) / 60000) : null;

  // Shifts
  const now = new Date();
  const onShiftNow = data.shifts.filter((s: any) => {
    const [sh, sm] = (s.start_time ?? "00:00").split(":").map(Number);
    const [eh, em] = (s.end_time ?? "00:00").split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= start && cur <= end;
  }).length;

  const tiles: Tile[] = [
    {
      href: "/temperatures", label: "Temperatures", icon: Thermometer,
      lines: [
        { text: `Fridges ${fridgeDone}/${fridgeUnits.length}`, tone: fridgeDone === fridgeUnits.length ? "ok" : "warn" },
        { text: `Process checks ${processChecks}`, tone: "muted" },
        { text: `Breaches: ${breaches}`, tone: breaches > 0 ? "bad" : "muted" },
      ],
    },
    {
      href: "/cleaning", label: "Cleaning", icon: SprayCan,
      lines: [
        { text: `Due: ${data.cleanTotal}`, tone: "muted" },
        { text: `Done: ${data.cleanDone}`, tone: "ok" },
        { text: `Missed: ${data.cleanMissed}`, tone: data.cleanMissed > 0 ? "warn" : "muted" },
      ],
    },
    {
      href: "/shifts", label: "Staff", icon: Users,
      lines: [
        { text: `On shift: ${onShiftNow}`, tone: "ok" },
        { text: `Scheduled: ${data.shifts.length}`, tone: "muted" },
      ],
    },
    {
      href: "/day-sheet", label: "Day Sheet", icon: ClipboardCheck,
      lines: [
        { text: dsComplete ? "Complete" : dsTotal > 0 ? `In progress ${dsDone}/${dsTotal}` : "Not started", tone: dsComplete ? "ok" : dsDone > 0 ? "warn" : "muted" },
        { text: minutesAgo == null ? "No logs yet" : minutesAgo < 60 ? `Last log: ${minutesAgo}m ago` : `Last log: ${Math.round(minutesAgo / 60)}h ago`, tone: "muted" },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <Link key={t.label} to={t.href} className="group">
          <Card className="p-4 h-full hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <t.icon className="h-4 w-4 text-muted-foreground" />
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">{t.label}</p>
            <ul className="mt-1.5 space-y-0.5">
              {t.lines.map((l, i) => (
                <li key={i} className={`text-sm font-medium ${toneCls[l.tone ?? "muted"]}`}>{l.text}</li>
              ))}
            </ul>
          </Card>
        </Link>
      ))}
    </div>
  );
}
