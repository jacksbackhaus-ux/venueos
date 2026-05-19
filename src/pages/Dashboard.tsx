import { motion } from "framer-motion";
import { useState } from "react";
import {
  Thermometer,
  Truck,
  SprayCan,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Lock,
  Unlock,
  Users,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSite } from "@/contexts/SiteContext";
import { LabourVsWasteCard } from "@/components/dashboard/LabourVsWasteCard";
import { MyTasksWidget } from "@/components/dashboard/MyTasksWidget";
import { MorningBriefingCard } from "@/components/dashboard/MorningBriefingCard";
import { SafeToTradeHero } from "@/components/dashboard/SafeToTradeHero";
import { PriorityFeed } from "@/components/dashboard/PriorityFeed";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35 },
  }),
};

const quickActions = [
  { label: "Log Temp", icon: Thermometer, href: "/temperatures", color: "bg-primary" },
  { label: "Log Delivery", icon: Truck, href: "/suppliers", color: "bg-success" },
  { label: "Cleaning Task", icon: SprayCan, href: "/cleaning", color: "bg-warning" },
  { label: "Report Issue", icon: AlertTriangle, href: "/incidents", color: "bg-breach" },
];

type TaskRow = { id: string; title: string; due: string; status: "done" | "overdue" | "pending"; module: string };
type AlertRow = { type: "breach" | "overdue"; message: string; time: string };

const statusIcon = (status: string) => {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "overdue":
      return <XCircle className="h-4 w-4 text-breach animate-pulse-breach" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const Dashboard = () => {
  const { currentSite, currentMembership } = useSite();
  const { staffSession, appUser } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id;
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const isToday = selectedDate === todayStr;
  const viewedDate = new Date(`${selectedDate}T12:00:00`);
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = isToday
    ? viewedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : viewedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const role = currentMembership?.site_role || staffSession?.site_role;
  const canCloseDay = role === "owner" || role === "supervisor";

  const minDate = currentSite?.created_at?.slice(0, 10);
  const isAtFloor = !!minDate && selectedDate <= minDate;

  const shiftDate = (days: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    const next = d.toISOString().slice(0, 10);
    if (next > todayStr) return;
    if (minDate && next < minDate) return;
    setSelectedDate(next);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", siteId, selectedDate],
    enabled: !!siteId,
    queryFn: async () => {
      const today = selectedDate;
      const isViewingToday = today === todayStr;
      const [
        cleaningTasksRes,
        cleaningLogsRes,
        tempUnitsRes,
        tempLogsRes,
        daySheetSectionsRes,
        daySheetRes,
        incidentsRes,
        closedDayRes,
      ] = await Promise.all([
        supabase.from("cleaning_tasks").select("id, task, area, frequency, due_time").eq("site_id", siteId!).eq("active", true),
        supabase.from("cleaning_logs").select("task_id, done, completed_at").eq("site_id", siteId!).eq("log_date", today),
        supabase.from("temp_units").select("id, name, min_temp, max_temp").eq("site_id", siteId!).eq("active", true),
        supabase.from("temp_logs").select("unit_id, value, pass, logged_at, log_type").eq("site_id", siteId!).gte("logged_at", `${today}T00:00:00`).lt("logged_at", `${today}T23:59:59`),
        supabase.from("day_sheet_sections").select("id, title, default_time, day_sheet_items(id, label, active)").eq("site_id", siteId!).eq("active", true),
        supabase.from("day_sheets").select("id, day_sheet_entries(item_id, done)").eq("site_id", siteId!).eq("sheet_date", today).maybeSingle(),
        supabase.from("incidents").select("id, title, status, reported_at").eq("site_id", siteId!).eq("status", "open"),
        supabase.from("closed_days" as any).select("id, reason, closed_by_name, created_at").eq("site_id", siteId!).eq("closed_date", today).maybeSingle(),
      ]);

      const closedDay = (closedDayRes as any)?.data ?? null;
      const cleaningTasks = cleaningTasksRes.data ?? [];
      const cleaningLogs = cleaningLogsRes.data ?? [];
      const tempUnits = tempUnitsRes.data ?? [];
      const tempLogs = tempLogsRes.data ?? [];
      const daySheetSections = daySheetSectionsRes.data ?? [];
      const daySheetEntries = (daySheetRes.data as any)?.day_sheet_entries ?? [];
      const incidents = incidentsRes.data ?? [];

      const tasks: TaskRow[] = [];
      const alerts: AlertRow[] = [];

      // Daily cleaning tasks
      const doneCleaningIds = new Set(cleaningLogs.filter((l: any) => l.done).map((l: any) => l.task_id));
      cleaningTasks
        .filter((t: any) => t.frequency === "daily")
        .forEach((t: any) => {
          tasks.push({
            id: `cleaning-${t.id}`,
            title: t.task,
            due: t.due_time || "—",
            status: doneCleaningIds.has(t.id) ? "done" : "pending",
            module: "Cleaning",
          });
        });

      // Temperature checks (AM + PM per unit)
      const amDone = new Set(tempLogs.filter((l: any) => l.log_type === "AM Check").map((l: any) => l.unit_id));
      const pmDone = new Set(tempLogs.filter((l: any) => l.log_type === "PM Check").map((l: any) => l.unit_id));
      const hourNow = now.getHours();
      const amOverdue = isViewingToday ? hourNow >= 11 : true;
      const pmOverdue = isViewingToday ? hourNow >= 18 : true;
      const cleaningOverdue = !isViewingToday;
      tempUnits.forEach((u: any) => {
        tasks.push({
          id: `temp-am-${u.id}`,
          title: `${u.name} AM temp`,
          due: "09:00",
          status: amDone.has(u.id) ? "done" : amOverdue ? "overdue" : "pending",
          module: "Temps",
        });
        tasks.push({
          id: `temp-pm-${u.id}`,
          title: `${u.name} PM temp`,
          due: "16:00",
          status: pmDone.has(u.id) ? "done" : pmOverdue ? "overdue" : "pending",
          module: "Temps",
        });
      });

      // Mark cleaning overdue for past dates
      if (cleaningOverdue) {
        tasks.forEach((t) => {
          if (t.module === "Cleaning" && t.status === "pending") t.status = "overdue";
        });
      }

      // Day sheet items
      const doneItemIds = new Set(daySheetEntries.filter((e: any) => e.done).map((e: any) => e.item_id));
      daySheetSections.forEach((s: any) => {
        (s.day_sheet_items ?? []).filter((i: any) => i.active).forEach((i: any) => {
          tasks.push({
            id: `ds-${i.id}`,
            title: i.label,
            due: s.default_time,
            status: doneItemIds.has(i.id) ? "done" : cleaningOverdue ? "overdue" : "pending",
            module: s.title,
          });
        });
      });

      // Temperature breaches for the viewed day
      tempLogs.filter((l: any) => !l.pass).forEach((l: any) => {
        const unit = tempUnits.find((u: any) => u.id === l.unit_id);
        alerts.push({
          type: "breach",
          message: `${unit?.name ?? "Unit"} at ${l.value}°C — action required`,
          time: new Date(l.logged_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        });
      });
      // Overdue temp checks
      tempUnits.forEach((u: any) => {
        if (!amDone.has(u.id) && amOverdue) {
          alerts.push({ type: "overdue", message: `${u.name} AM temp overdue`, time: "09:00" });
        }
      });
      // Open incidents (only relevant for today)
      if (isViewingToday) {
        incidents.forEach((inc: any) => {
          alerts.push({
            type: "breach",
            message: inc.title,
            time: new Date(inc.reported_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
          });
        });
      }

      const total = tasks.length;
      const completed = tasks.filter((t) => t.status === "done").length;
      const overdue = tasks.filter((t) => t.status === "overdue").length;
      const breaches = tempLogs.filter((l: any) => !l.pass).length;
      const compliance = total > 0 ? Math.round((completed / total) * 100) : 100;

      // Pillars (simple heuristic from real data)
      const tempCompliance = tempUnits.length > 0
        ? Math.round(((amDone.size + pmDone.size) / (tempUnits.length * 2)) * 100)
        : 100;
      const cleaningCompliance = cleaningTasks.filter((t: any) => t.frequency === "daily").length > 0
        ? Math.round((doneCleaningIds.size / cleaningTasks.filter((t: any) => t.frequency === "daily").length) * 100)
        : 100;
      const dsItems = daySheetSections.flatMap((s: any) => (s.day_sheet_items ?? []).filter((i: any) => i.active));
      const dsCompliance = dsItems.length > 0 ? Math.round((doneItemIds.size / dsItems.length) * 100) : 100;

      const pillars = [
        { name: "Hygienic Handling", score: tempCompliance, icon: ClipboardCheck },
        { name: "Premises & Cleanliness", score: cleaningCompliance, icon: SprayCan },
        { name: "Management Confidence", score: dsCompliance, icon: ShieldCheck },
      ];

      return { tasks, alerts, stats: { completed, total, overdue, breaches }, compliance, pillars, closedDay };
    },
  });

  const closedDay = (data as any)?.closedDay ?? null;
  const isClosed = !!closedDay;
  const tasks = data?.tasks ?? [];
  const alerts = isClosed ? [] : (data?.alerts ?? []);
  const stats = data?.stats ?? { completed: 0, total: 0, overdue: 0, breaches: 0 };
  const complianceScore = isClosed ? 100 : (data?.compliance ?? 100);
  const pillars = (isClosed
    ? [
        { name: "Hygienic Handling", score: 100, icon: ClipboardCheck },
        { name: "Premises & Cleanliness", score: 100, icon: SprayCan },
        { name: "Management Confidence", score: 100, icon: ShieldCheck },
      ]
    : data?.pillars) ?? [
    { name: "Hygienic Handling", score: 100, icon: ClipboardCheck },
    { name: "Premises & Cleanliness", score: 100, icon: SprayCan },
    { name: "Management Confidence", score: 100, icon: ShieldCheck },
  ];

  // Current user id (works for both email auth and staff session)
  const currentUserId = appUser?.id ?? staffSession?.user_id ?? null;

  // Today's shifts (rota) — only show on the actual current day
  const { data: todayShifts } = useQuery({
    queryKey: ["dashboard-today-shifts", siteId, todayStr],
    enabled: !!siteId && isToday,
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("rota_assignments")
        .select("id, user_id, start_time, end_time, position")
        .eq("site_id", siteId!)
        .eq("shift_date", todayStr)
        .order("start_time", { ascending: true });

      const list = (assignments ?? []) as Array<{ id: string; user_id: string; start_time: string; end_time: string; position: string | null }>;
      if (list.length === 0) return { shifts: [], myLinkedTaskIds: new Set<string>() };

      const userIds = Array.from(new Set(list.map((a) => a.user_id)));
      const { data: usersData } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", userIds);
      const nameById = new Map((usersData ?? []).map((u: any) => [u.id, u.display_name as string]));

      // Linked tasks for the logged-in user's shifts today
      const myAssignmentIds = currentUserId
        ? list.filter((a) => a.user_id === currentUserId).map((a) => a.id)
        : [];
      let myLinkedTaskIds = new Set<string>();
      if (myAssignmentIds.length > 0) {
        const { data: links } = await supabase
          .from("rota_assignment_tasks")
          .select("task_id, task_type")
          .in("rota_assignment_id", myAssignmentIds);
        myLinkedTaskIds = new Set((links ?? []).map((l: any) => `${l.task_type}:${l.task_id}`));
      }

      const shifts = list.map((a) => ({
        id: a.id,
        user_id: a.user_id,
        name: nameById.get(a.user_id) ?? "Unknown",
        start_time: a.start_time,
        end_time: a.end_time,
        isMe: currentUserId === a.user_id,
      }));

      return { shifts, myLinkedTaskIds };
    },
  });

  const myLinkedTaskIds = todayShifts?.myLinkedTaskIds ?? new Set<string>();
  const isTaskLinkedToMe = (task: TaskRow) => {
    if (myLinkedTaskIds.size === 0) return false;
    if (task.id.startsWith("ds-")) return myLinkedTaskIds.has(`day_sheet_item:${task.id.slice(3)}`);
    if (task.id.startsWith("cleaning-")) return myLinkedTaskIds.has(`cleaning_task:${task.id.slice(9)}`);
    return false;
  };

  const closeDayMutation = useMutation({
    mutationFn: async (close: boolean) => {
      if (!siteId || !currentSite) throw new Error("No site");
      if (close) {
        const { error } = await supabase.from("closed_days" as any).insert({
          site_id: siteId,
          organisation_id: currentSite.organisation_id,
          closed_date: selectedDate,
          closed_by_user_id: appUser?.id ?? null,
          closed_by_name: appUser?.display_name ?? (staffSession as any)?.display_name ?? null,
        } as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("closed_days" as any)
          .delete()
          .eq("site_id", siteId)
          .eq("closed_date", selectedDate);
        if (error) throw error;
      }
    },
    onSuccess: (_d, close) => {
      toast.success(close ? "Day marked as closed" : "Day reopened");
      queryClient.invalidateQueries({ queryKey: ["dashboard", siteId, selectedDate] });
    },
    onError: (e: any) => toast.error(e.message ?? "Action failed"),
  });

  const handleToggleClosed = () => {
    if (!canCloseDay) return;
    if (isClosed) {
      if (!confirm("Reopen this day? Tasks and tracking will resume counting.")) return;
      closeDayMutation.mutate(false);
    } else {
      if (!confirm(`Mark ${isToday ? "today" : dateStr} as a closed day? It won't count toward compliance.`)) return;
      closeDayMutation.mutate(true);
    }
  };

  // ---- Derived: unified today plan ----
  const completedCount = tasks.filter((t) => t.status === "done").length;
  const overdueCount = tasks.filter((t) => t.status === "overdue").length;
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  const moduleHref = (module: string, taskId: string) => {
    if (taskId.startsWith("temp-")) return "/temperatures";
    if (taskId.startsWith("cleaning-")) return "/cleaning";
    if (taskId.startsWith("ds-")) return "/day-sheet";
    if (module === "Cleaning") return "/cleaning";
    if (module === "Temps") return "/temperatures";
    return "/day-sheet";
  };

  const dueToMinutes = (due: string) => {
    if (!due || due === "—") return 99 * 60;
    const [h, m] = due.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(h)) return 99 * 60;
    return h * 60 + (m || 0);
  };
  const statusOrder: Record<string, number> = { overdue: 0, pending: 1, done: 2 };

  // Sort by status then time-of-day so the manager sees what to act on first.
  const sortedTasks = [...tasks].sort(
    (a, b) => (statusOrder[a.status] - statusOrder[b.status]) || (dueToMinutes(a.due) - dueToMinutes(b.due))
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* ============================================================
          SAFE TO TRADE — the single answer to "are we OK?"
          ============================================================ */}
      <SafeToTradeHero
        siteId={siteId}
        dateISO={selectedDate}
        greeting={isToday ? greeting : undefined}
        displayName={appUser?.display_name ?? (staffSession as any)?.display_name ?? undefined}
      />

      {/* Quick actions — kept tight under the hero */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {quickActions.map((action) => (
          <Link key={action.label} to={action.href}>
            <Button
              variant="outline"
              className="w-full h-auto flex-col gap-1.5 py-3 bg-card/80 backdrop-blur border hover:border-primary/40 hover:bg-card transition-all"
            >
              <div className={`h-9 w-9 rounded-lg ${action.color} flex items-center justify-center shadow-sm`}>
                <action.icon className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <span className="text-xs font-semibold text-foreground">{action.label}</span>
            </Button>
          </Link>
        ))}
      </div>

      {/* ============================================================
          DATE NAV + CLOSED-DAY CONTROL
          ============================================================ */}
      <motion.div initial="hidden" animate="visible" custom={0.5} variants={fadeUp} className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border bg-card px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => shiftDate(-1)}
            disabled={isAtFloor}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span>{isToday ? "Today" : dateStr}</span>
            {!isToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Jump to today
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => shiftDate(1)}
            disabled={isToday}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {(isClosed || canCloseDay) && (
          <div
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
              isClosed ? "bg-muted/40 border-muted-foreground/20" : "bg-card"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isClosed ? (
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <Unlock className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <p className="text-xs sm:text-sm text-foreground truncate">
                {isClosed
                  ? `This day is marked as closed${closedDay?.closed_by_name ? ` by ${closedDay.closed_by_name}` : ""}.`
                  : "Site closed on this day? Mark it so it doesn't count against compliance."}
              </p>
            </div>
            {canCloseDay && (
              <Button
                size="sm"
                variant={isClosed ? "outline" : "secondary"}
                onClick={handleToggleClosed}
                disabled={closeDayMutation.isPending}
                className="shrink-0"
              >
                {isClosed ? "Reopen day" : "Mark as closed"}
              </Button>
            )}
          </div>
        )}
      </motion.div>

      {/* ============================================================
          PRIORITY FEED — the primary interaction surface
          ============================================================ */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-5">
          <PriorityFeed
            siteId={siteId}
            dateISO={selectedDate}
            currentUserId={currentUserId}
          />

          {/* Messenger tasks assigned to me — kept; complements the feed */}
          <MyTasksWidget />

          {isToday && !isClosed && <MorningBriefingCard />}
        </div>


        {/* Right column: Today's shift + Inspection readiness */}
        <div className="md:col-span-1 space-y-5">
          {/* Today's shift */}
          {isToday && !isClosed && (
            <motion.div initial="hidden" animate="visible" custom={2.5} variants={fadeUp}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-heading flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      On shift today
                    </CardTitle>
                    {(todayShifts?.shifts.length ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {todayShifts!.shifts.length}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {(todayShifts?.shifts.length ?? 0) === 0 ? (
                    <div className="py-4 text-center space-y-2">
                      <p className="text-sm text-muted-foreground">No shifts scheduled.</p>
                      <Link to="/shifts">
                        <Button variant="outline" size="sm" className="text-xs">
                          Open rota
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {todayShifts!.shifts.map((s) => (
                        <li
                          key={s.id}
                          className={`flex items-center justify-between py-2 text-sm ${
                            s.isMe ? "font-semibold text-foreground" : "text-foreground"
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0 truncate">
                            {s.isMe && <Star className="h-3.5 w-3.5 text-primary shrink-0" />}
                            <span className="truncate">{s.name}{s.isMe ? " (you)" : ""}</span>
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-3">
                            {s.start_time}–{s.end_time}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Inspection readiness */}
          <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading">Inspection readiness</CardTitle>
                <p className="text-xs text-muted-foreground">3 pillars of food hygiene rating</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {pillars.map((pillar) => (
                  <div key={pillar.name} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <pillar.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium">{pillar.name}</span>
                      </div>
                      {isClosed ? (
                        <span className="text-xs font-bold text-muted-foreground inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Closed
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-bold ${
                            pillar.score >= 80
                              ? "text-success"
                              : pillar.score >= 60
                              ? "text-warning"
                              : "text-breach"
                          }`}
                        >
                          {pillar.score}%
                        </span>
                      )}
                    </div>
                    {!isClosed && <Progress value={pillar.score} className="h-1.5" />}
                  </div>
                ))}

                <div className="pt-2 border-t">
                  <Link to="/reports">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      <FileTextIcon className="h-3.5 w-3.5 mr-1.5" />
                      Generate Inspection Pack
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Labour vs waste — kept as supporting business view */}
      {siteId && currentSite?.organisation_id && !isClosed && (
        <motion.div initial="hidden" animate="visible" custom={4} variants={fadeUp}>
          <LabourVsWasteCard
            siteId={siteId}
            organisationId={currentSite.organisation_id}
            date={selectedDate}
          />
        </motion.div>
      )}
    </div>
  );
};

// Small helper so we don't import FileText twice
function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
    </svg>
  );
}

export default Dashboard;
