import { useState } from "react";
import { motion } from "framer-motion";
import { SprayCan, CheckCircle2, Circle, Clock, Loader2, Lock, CalendarOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DateNavigator } from "@/components/DateNavigator";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, eachDayOfInterval, parseISO, isSameDay,
} from "date-fns";

type Frequency = "daily" | "weekly" | "monthly";

// Period boundaries for a given selected date.
// Weekly: Monday → Sunday (reset Sunday midnight = Monday is fresh week).
function getPeriodBounds(frequency: Frequency, dateStr: string) {
  const d = parseISO(dateStr);
  if (frequency === "weekly") {
    return { from: startOfWeek(d, { weekStartsOn: 1 }), to: endOfWeek(d, { weekStartsOn: 1 }) };
  }
  if (frequency === "monthly") {
    return { from: startOfMonth(d), to: endOfMonth(d) };
  }
  return { from: d, to: d };
}

const Cleaning = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";
  const [activeTab, setActiveTab] = useState<Frequency>("daily");
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const isToday = selectedDate === todayStr;
  const today = selectedDate;

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["cleaning_tasks", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("cleaning_tasks").select("*").eq("site_id", siteId).eq("active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // Period-scoped logs for current tab.
  const period = getPeriodBounds(activeTab, selectedDate);
  const periodFromStr = format(period.from, "yyyy-MM-dd");
  const periodToStr = format(period.to, "yyyy-MM-dd");

  const { data: logs = [] } = useQuery({
    queryKey: ["cleaning_logs", siteId, activeTab, periodFromStr, periodToStr],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("cleaning_logs")
        .select("*")
        .eq("site_id", siteId)
        .gte("log_date", periodFromStr)
        .lte("log_date", periodToStr);
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // Closed days within the current period — used to compute exemption.
  const { data: closedDays = [] } = useQuery({
    queryKey: ["closed_days_period", siteId, periodFromStr, periodToStr],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("closed_days")
        .select("closed_date, reason")
        .eq("site_id", siteId)
        .gte("closed_date", periodFromStr)
        .lte("closed_date", periodToStr);
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // For daily view, exemption = today is closed.
  // For weekly/monthly = every day in period (up to today, capped at period end) is closed.
  const periodDays = eachDayOfInterval({ from: period.from, to: period.to });
  const closedSet = new Set((closedDays as any[]).map((c) => c.closed_date));
  const todayDate = parseISO(todayStr);
  const relevantDays = periodDays.filter((d) => d <= todayDate || activeTab !== "daily" ? true : isSameDay(d, todayDate));
  // For weekly/monthly: exempt only if every relevant day in the period is closed AND there is at least one day.
  const checkDays = activeTab === "daily"
    ? [parseISO(selectedDate)]
    : periodDays;
  const allClosed = checkDays.length > 0 && checkDays.every((d) => closedSet.has(format(d, "yyyy-MM-dd")));
  const periodReason = (closedDays as any[])[0]?.reason || null;

  const toggleTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!isToday) throw new Error("Past cleaning records are read-only");
      if (allClosed) throw new Error(activeTab === "daily" ? "Today is marked as closed" : `This ${activeTab === "weekly" ? "week" : "month"} is fully closed`);
      // For daily: existing log is for today. For weekly/monthly: any log within period counts.
      const existing = (logs as any[]).find((l) =>
        l.task_id === taskId && (activeTab === "daily" ? l.log_date === today : true)
      );
      if (existing) {
        const { error } = await supabase.from("cleaning_logs").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cleaning_logs").insert({
          site_id: siteId!, organisation_id: organisationId!, task_id: taskId, log_date: today,
          done: true, completed_by_user_id: appUser?.id || null, completed_by_name: userName, completed_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cleaning_logs", siteId, activeTab, periodFromStr, periodToStr] }),
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = (tasks as any[]).filter((t) => (t.frequency || "daily").toLowerCase() === activeTab);
  // A task is "done" in the current period if there's any log for it within the period bounds.
  const doneIds = new Set(
    (logs as any[]).filter((l) => l.done).map((l) => l.task_id)
  );
  const doneCount = filtered.filter((t) => doneIds.has(t.id)).length;
  const pct = filtered.length > 0 ? Math.round((doneCount / filtered.length) * 100) : 0;
  const areas = [...new Set(filtered.map((t) => t.area))] as string[];

  // Tab badge counts — need closed-day data for each frequency to mark exempt visually.
  const countsFor = (f: Frequency) => {
    const fTasks = (tasks as any[]).filter((t) => (t.frequency || "daily").toLowerCase() === f);
    if (f === activeTab) {
      return { done: fTasks.filter((t) => doneIds.has(t.id)).length, total: fTasks.length };
    }
    // For other tabs we only know the current tab's logs — show total only.
    return { done: 0, total: fTasks.length };
  };

  const periodLabel = activeTab === "weekly"
    ? `Week of ${format(period.from, "d MMM")}`
    : activeTab === "monthly"
      ? format(period.from, "MMMM yyyy")
      : format(period.from, "EEE d MMM");

  if (!siteId) return <div className="p-6 text-center text-muted-foreground">No site selected.</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><SprayCan className="h-5 w-5 text-primary" /></div>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">Cleaning & Sanitation</h1>
              <p className="text-sm text-muted-foreground">
                {isToday ? "Track cleaning completion by area and frequency" : "Historical cleaning records"}
              </p>
            </div>
          </div>
          {!isToday && (
            <Badge variant="outline" className="gap-1 border-muted-foreground/30 text-muted-foreground">
              <Lock className="h-3 w-3" /> Read-only
            </Badge>
          )}
        </div>
        <DateNavigator selectedDate={selectedDate} onChange={setSelectedDate} minDate={currentSite?.created_at?.slice(0, 10)} />
      </div>

      {tasksLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {!tasksLoading && tasks.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <SprayCan className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No cleaning tasks configured</p>
          <p className="text-sm mt-1">Add cleaning tasks in Settings to start tracking.</p>
        </CardContent></Card>
      )}

      {tasks.length > 0 && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Frequency)}>
          <TabsList className="w-full">
            {(["daily", "weekly", "monthly"] as Frequency[]).map((f) => {
              const c = countsFor(f);
              return (
                <TabsTrigger key={f} value={f} className="flex-1 capitalize">
                  {f}
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">
                    {f === activeTab ? `${c.done}/${c.total}` : c.total}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{periodLabel}</span>
                  {allClosed && (
                    <Badge variant="outline" className="gap-1 text-warning border-warning/40">
                      <CalendarOff className="h-3 w-3" />
                      {activeTab === "daily" ? "Closed today" : `Closed all ${activeTab === "weekly" ? "week" : "month"}`}
                      {periodReason ? ` — ${periodReason}` : ""}
                    </Badge>
                  )}
                </div>
                <span className={`text-sm font-bold ${allClosed ? "text-muted-foreground" : pct === 100 ? "text-success" : "text-muted-foreground"}`}>
                  {allClosed ? "Exempt" : `${pct}%`}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{doneCount}/{filtered.length} tasks complete this {activeTab === "daily" ? "day" : activeTab === "weekly" ? "week" : "month"}</span>
              </div>
              <Progress value={allClosed ? 100 : pct} className="h-2" />
            </CardContent></Card>

            {areas.map((area) => (
              <motion.div key={area} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">{area}</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {filtered.filter((t) => t.area === area).map((task: any) => {
                        const isDone = doneIds.has(task.id);
                        const log = (logs as any[]).find((l) => l.task_id === task.id && l.done);
                        const disabled = !isToday || allClosed;
                        return (
                          <button key={task.id} onClick={() => !disabled && toggleTask.mutate(task.id)} disabled={disabled}
                            className={`w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors ${!disabled ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"} ${isDone || allClosed ? "opacity-60" : ""}`}>
                            {allClosed && !isDone ? (
                              <CalendarOff className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                            ) : isDone ? (
                              <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm ${isDone ? "line-through text-muted-foreground" : "font-medium"}`}>{task.task}</span>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {task.due_time && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {task.due_time}</span>}
                                {task.assigned_to_name && <span className="text-xs text-muted-foreground">· {task.assigned_to_name}</span>}
                                {isDone && log?.completed_at && (
                                  <Badge variant="outline" className="text-[10px] text-success border-success/30">
                                    Done {format(parseISO(log.completed_at), "d MMM HH:mm")}
                                    {log.completed_by_name ? ` · ${log.completed_by_name}` : ""}
                                  </Badge>
                                )}
                                {allClosed && !isDone && (
                                  <Badge variant="outline" className="text-[10px] text-warning border-warning/40">
                                    Exempt — {activeTab === "daily" ? "closed today" : `closed all ${activeTab === "weekly" ? "week" : "month"}`}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Cleaning;
