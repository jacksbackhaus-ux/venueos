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

  const shiftDate = (days: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    const next = d.toISOString().slice(0, 10);
    if (next > todayStr) return;
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
  const complianceScore = data?.compliance ?? 100;
  const pillars = data?.pillars ?? [
    { name: "Hygienic Handling", score: 100, icon: ClipboardCheck },
    { name: "Premises & Cleanliness", score: 100, icon: SprayCan },
    { name: "Management Confidence", score: 100, icon: ShieldCheck },
  ];

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

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">{greeting} 👋</h1>
            <p className="text-sm text-muted-foreground">{dateStr}</p>
          </div>
          <Badge
            variant="outline"
            className={`text-xs self-start sm:self-auto ${
              complianceScore >= 80
                ? "border-success text-success"
                : complianceScore >= 60
                ? "border-warning text-warning"
                : "border-breach text-breach"
            }`}
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            {complianceScore}% compliant {isToday ? "today" : "this day"}
          </Badge>
        </div>

        {/* Date navigation */}
        <div className="mt-3 flex items-center justify-between rounded-lg border bg-card px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => shiftDate(-1)}
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
      </motion.div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  alert.type === "breach"
                    ? "bg-breach/10 text-breach"
                    : "bg-warning/10 text-warning"
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="flex-1">{alert.message}</span>
                <span className="text-xs opacity-70">{alert.time}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.href}>
              <Button
                variant="outline"
                className="w-full h-auto flex-col gap-2 py-4 border-2 hover:border-primary/30 transition-all"
              >
                <div className={`h-10 w-10 rounded-xl ${action.color} flex items-center justify-center`}>
                  <action.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xs font-semibold text-foreground">{action.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Completed", value: stats.completed, total: stats.total, color: "text-success" },
            { label: "Remaining", value: Math.max(0, stats.total - stats.completed - stats.overdue), color: "text-muted-foreground" },
            { label: "Overdue", value: stats.overdue, color: "text-warning" },
            { label: "Breaches", value: stats.breaches, color: "text-breach" },
          ].map((stat) => (
            <Card key={stat.label} className="border">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-heading font-bold ${stat.color}`}>
                  {stat.value}
                  {"total" in stat && (
                    <span className="text-sm font-normal text-muted-foreground">/{stat.total}</span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Two-column layout on desktop */}
      <div className="grid md:grid-cols-5 gap-5">
        {/* My Tasks */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={4}
          variants={fadeUp}
          className="md:col-span-3"
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading">{isToday ? "My Tasks Today" : "Tasks for this day"}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {tasks.filter((t) => t.status === "done").length}/{tasks.length}
                </Badge>
              </div>
              <Progress
                value={tasks.length > 0 ? (tasks.filter((t) => t.status === "done").length / tasks.length) * 100 : 0}
                className="h-1.5"
              />
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No tasks set up yet. Configure modules in Settings.</p>
              ) : (
                <div className="divide-y">
                  {tasks.slice(0, 12).map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 py-2.5 ${
                        task.status === "done" ? "opacity-60" : ""
                      }`}
                    >
                      {statusIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${
                            task.status === "done" ? "line-through" : ""
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground">Due {task.due}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0"
                      >
                        {task.module}
                      </Badge>
                      {task.status === "pending" && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Inspection Readiness */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={5}
          variants={fadeUp}
          className="md:col-span-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading">Inspection Readiness</CardTitle>
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
                  </div>
                  <Progress value={pillar.score} className="h-1.5" />
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
