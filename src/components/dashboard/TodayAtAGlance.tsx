import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Thermometer, SprayCan, Users, ClipboardCheck, ChevronRight, Package } from "lucide-react";
import { classifySection, currentOpsWindow, isToday, parseHHMM } from "@/lib/opsTime";

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

      const [closed, tempUnits, tempLogs, cleanTasks, cleanLogs, daySheet, sections, shifts, batchesToday] = await Promise.all([
        supabase.from("closed_days" as any).select("id").eq("site_id", siteId!).eq("closed_date", dateISO).maybeSingle(),
        supabase.from("temp_units").select("id, name").eq("site_id", siteId!).eq("active", true),
        supabase.from("temp_logs").select("unit_id, log_type, pass, logged_at, food_item").eq("site_id", siteId!).gte("logged_at", dayStart).lt("logged_at", dayEnd),
        supabase.from("cleaning_tasks").select("id, due_time, frequency").eq("site_id", siteId!).eq("active", true).eq("frequency", "daily"),
        supabase.from("cleaning_logs").select("task_id, done").eq("site_id", siteId!).eq("log_date", dateISO),
        supabase.from("day_sheets").select("id, signed_off_at, day_sheet_entries(item_id, done, completed_at)").eq("site_id", siteId!).eq("sheet_date", dateISO).maybeSingle(),
        supabase.from("day_sheet_sections").select("id, title, default_time, day_sheet_items(id, active)").eq("site_id", siteId!).eq("active", true),
        supabase.from("rota_assignments").select("id, user_id, start_time, end_time").eq("site_id", siteId!).eq("shift_date", dateISO).is("cancelled_at", null),
        supabase.from("batches").select("id, quantity_produced, date_produced, created_at").eq("site_id", siteId!).or(`date_produced.eq.${dateISO},and(date_produced.is.null,created_at.gte.${dayStart},created_at.lt.${dayEnd})`),
      ]);

      return {
        isClosed: !!(closed as any)?.data,
        units: tempUnits.data ?? [],
        tempLogs: tempLogs.data ?? [],
        cleanTasks: (cleanTasks.data ?? []) as any[],
        cleanLogs: (cleanLogs.data ?? []) as any[],
        daySheet: daySheet.data as any,
        sections: (sections.data ?? []) as any[],
        shifts: shifts.data ?? [],
        batchesToday: (batchesToday.data ?? []) as any[],
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  if (data.isClosed) return null;

  const viewingToday = isToday(dateISO);
  const window = viewingToday ? currentOpsWindow() : "closing";
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // -------- TEMPERATURES --------
  const units = data.units;
  const amDone = new Set(data.tempLogs.filter((l: any) => l.log_type === "AM Check").map((l: any) => l.unit_id));
  const pmDone = new Set(data.tempLogs.filter((l: any) => l.log_type === "PM Check").map((l: any) => l.unit_id));
  const breaches = data.tempLogs.filter((l: any) => l.pass === false).length;
  const tempLines: Tile["lines"] = [];
  tempLines.push({
    text: `AM ${amDone.size}/${units.length}`,
    tone: units.length === 0 ? "muted" : amDone.size === units.length ? "ok" : "warn",
  });
  if (window === "closing") {
    tempLines.push({
      text: `PM ${pmDone.size}/${units.length}`,
      tone: units.length === 0 ? "muted" : pmDone.size === units.length ? "ok" : "warn",
    });
  } else {
    tempLines.push({ text: "PM — not due yet", tone: "muted" });
  }
  tempLines.push({ text: `Breaches: ${breaches}`, tone: breaches > 0 ? "bad" : "muted" });

  // -------- CLEANING --------
  const doneIds = new Set(data.cleanLogs.filter((l: any) => l.done).map((l: any) => l.task_id));
  const dueNow = viewingToday
    ? data.cleanTasks.filter((t: any) => {
        const due = parseHHMM(t.due_time);
        return due == null || nowMin >= due;
      })
    : data.cleanTasks;
  const overdue = dueNow.filter((t: any) => !doneIds.has(t.id)).length;
  const doneCount = data.cleanTasks.filter((t: any) => doneIds.has(t.id)).length;
  const cleanLines: Tile["lines"] = [
    { text: `Due now: ${dueNow.length}`, tone: "muted" },
    { text: `Done: ${doneCount}`, tone: doneCount > 0 ? "ok" : "muted" },
    { text: `Overdue: ${overdue}`, tone: overdue > 0 ? "warn" : "muted" },
  ];

  // -------- DAY SHEET (split opening / closing) --------
  const openingItemIds: string[] = [];
  const closingItemIds: string[] = [];
  const middayItemIds: string[] = [];
  for (const s of data.sections) {
    const cls = classifySection(s);
    const ids = (s.day_sheet_items ?? []).filter((i: any) => i.active).map((i: any) => i.id as string);
    if (cls === "opening") openingItemIds.push(...ids);
    else if (cls === "closing") closingItemIds.push(...ids);
    else middayItemIds.push(...ids);
  }
  const dsEntries = (data.daySheet?.day_sheet_entries ?? []) as any[];
  const doneEntryIds = new Set(dsEntries.filter((e) => e.done).map((e) => e.item_id));
  const openDone = openingItemIds.filter((id) => doneEntryIds.has(id)).length;
  const closeDone = closingItemIds.filter((id) => doneEntryIds.has(id)).length;

  const dsLines: Tile["lines"] = [];
  if (openingItemIds.length > 0) {
    dsLines.push({
      text: `Opening ${openDone}/${openingItemIds.length}`,
      tone: openDone === openingItemIds.length ? "ok" : "warn",
    });
  }
  if (closingItemIds.length > 0) {
    if (window === "closing") {
      dsLines.push({
        text: `Closing ${closeDone}/${closingItemIds.length}`,
        tone: closeDone === closingItemIds.length ? "ok" : "warn",
      });
    } else {
      dsLines.push({ text: `Closing — not due yet`, tone: "muted" });
    }
  }
  if (middayItemIds.length > 0 && (window === "midday" || window === "closing")) {
    const midDone = middayItemIds.filter((id) => doneEntryIds.has(id)).length;
    dsLines.push({
      text: `Midday ${midDone}/${middayItemIds.length}`,
      tone: midDone === middayItemIds.length ? "ok" : "warn",
    });
  }
  if (dsLines.length === 0) dsLines.push({ text: "No tasks scheduled", tone: "muted" });

  // -------- SHIFTS --------
  const onShiftNow = data.shifts.filter((s: any) => {
    const start = parseHHMM(s.start_time) ?? 0;
    const end = parseHHMM(s.end_time) ?? 0;
    return nowMin >= start && nowMin <= end;
  }).length;

  // -------- PRODUCTION --------
  const batchCount = data.batchesToday.length;
  const unitsProduced = data.batchesToday.reduce((s: number, b: any) => s + (Number(b.quantity_produced) || 0), 0);
  const prodLines: Tile["lines"] = batchCount === 0
    ? [
        { text: "No batches yet today", tone: "muted" },
        { text: "Tap to log a batch", tone: "muted" },
      ]
    : [
        { text: `${batchCount} batch${batchCount === 1 ? '' : 'es'}`, tone: "ok" },
        { text: `${unitsProduced.toLocaleString()} units`, tone: unitsProduced > 0 ? "ok" : "muted" },
      ];

  const allTiles: (Tile & { mod?: string })[] = [
    { href: "/temperatures", label: "Temperatures", icon: Thermometer, lines: tempLines },
    { href: "/cleaning", label: "Cleaning", icon: SprayCan, lines: cleanLines },
    { href: "/shifts", label: "Staff", icon: Users, mod: "shifts", lines: [
      { text: `On shift: ${onShiftNow}`, tone: onShiftNow > 0 ? "ok" : "muted" },
      { text: `Scheduled: ${data.shifts.length}`, tone: "muted" },
    ]},
    { href: "/day-sheet", label: "Day Sheet", icon: ClipboardCheck, lines: dsLines },
    { href: "/batches", label: "Production", icon: Package, lines: prodLines },
  ];

  // Hide Staff card in HACCP launch mode (shifts module disabled via launch flag).
  const tiles = allTiles.filter((t) => !(t.mod === "shifts" && !showOperationalCommercialModules));

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
