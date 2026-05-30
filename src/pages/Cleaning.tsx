import { useState } from "react";
import { motion } from "framer-motion";
import {
  SprayCan, CheckCircle2, Circle, Clock, Loader2,
  Lock, CalendarOff, History, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DateNavigator } from "@/components/DateNavigator";
import { RetrospectiveBanner } from "@/components/RetrospectiveBanner";
import { useRetrospective } from "@/hooks/useRetrospective";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  format, eachDayOfInterval, parseISO, subDays,
} from "date-fns";

type Frequency = "daily" | "weekly" | "monthly";
type TopTab = Frequency | "history";

function getPeriodBounds(frequency: Frequency, dateStr: string) {
  const d = parseISO(dateStr);
  if (frequency === "weekly") return { from: startOfWeek(d, { weekStartsOn: 1 }), to: endOfWeek(d, { weekStartsOn: 1 }) };
  if (frequency === "monthly") return { from: startOfMonth(d), to: endOfMonth(d) };
  return { from: d, to: d };
}

const Cleaning = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";

  const [topTab, setTopTab] = useState<TopTab>("daily");
  const activeTab = topTab === "history" ? "daily" : topTab as Frequency;

  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const { isToday, isRetrospective, canEdit } = useRetrospective(selectedDate);

  const [historyDays, setHistoryDays] = useState(14);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

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

  const period = getPeriodBounds(activeTab, selectedDate);
  const periodFromStr = format(period.from, "yyyy-MM-dd");
  const periodToStr = format(period.to, "yyyy-MM-dd");

  const { data: logs = [] } = useQuery({
    queryKey: ["cleaning_logs", siteId, activeTab, periodFromStr, periodToStr],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("cleaning_logs").select("*").eq("site_id", siteId).gte("log_date", periodFromStr).lte("log_date", periodToStr);
      if (error) throw error;
      return data;
    },
    enabled: !!siteId && topTab !== "history",
  });

  const historyFrom = format(subDays(new Date(), historyDays - 1), "yyyy-MM-dd");

  const { data: historyLogs = [], isLoading: historyLoading } = useQuery({
    queryKey: ["cleaning_history_logs", siteId, historyDays],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("cleaning_logs").select("*").eq("site_id", siteId).gte("log_date", historyFrom).lte("log_date", todayStr).order("log_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!siteId && topTab === "history",
  });

  const { data: closedDays = [] } = useQuery({
    queryKey: ["closed_days_period", siteId, periodFromStr, periodToStr],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("closed_days").select("closed_date, reason").eq("site_id", siteId).gte("closed_date", periodFromStr).lte("closed_date", periodToStr);
      if (error) throw error;
      return data;
    },
    enabled: !!siteId && topTab !== "history",
  });

  const { data: historyClosedDays = [] } = useQuery({
    queryKey: ["closed_days_history", siteId, historyDays],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("closed_days").select("closed_date").eq("site_id", siteId).gte("closed_date", historyFrom).lte("closed_date", todayStr);
      if (error) throw error;
      return data;
    },
    enabled: !!siteId && topTab === "history",
  });

  const closedSet = new Set((closedDays as any[]).map((c) => c.closed_date));
  const historyClosedSet = new Set((historyClosedDays as any[]).map((c) => c.closed_date));

  const checkDays = activeTab === "daily" ? [parseISO(selectedDate)] : eachDayOfInterval({ start: period.from, end: period.to });
  const allClosed = checkDays.length > 0 && checkDays.every((d) => closedSet.has(format(d, "yyyy-MM-dd")));
  const periodReason = (closedDays as any[])[0]?.reason || null;

  const toggleTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!canEdit) throw new Error("Past cleaning records are read-only");
      if (allClosed) throw new Error("This day is marked as closed");
      const completedAt = isRetrospective
        ? new Date(`${selectedDate}T12:00:00`).toISOString()
        : new Date().toISOString();
      const existing = (logs as any[]).find((l) => l.task_id === taskId);
      if (existing) {
        const { error } = await supabase.from("cleaning_logs").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cleaning_logs").insert({
          site_id: siteId!, organisation_id: organisationId!, task_id: taskId,
          log_date: selectedDate, done: true,
          completed_by_user_id: appUser?.id || null,
          completed_by_name: userName,
          completed_at: completedAt,
          is_retrospective: isRetrospective,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cleaning_logs", siteId, activeTab, periodFromStr, periodToStr] }),
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = (tasks as any[]).filter((t) => (t.frequency || "daily").toLowerCase() === activeTab);
  const doneIds = new Set((logs as any[]).filter((l) => l.done).map((l) => l.task_id));
  const doneCount = filtered.filter((t) => doneIds.has(t.id)).length;
  const pct = filtered.length > 0 ? Math.round((doneCount / filtered.length) * 100) : 0;
  const areas = [...new Set(filtered.map((t) => t.area))] as string[];

  const periodLabel = activeTab === "weekly"
    ? `Week of ${format(period.from, "d MMM")}`
    : activeTab === "monthly"
    ? format(period.from, "MMMM yyyy")
    : format(period.from, "EEE d MMM");

  const historyDaysList = Array.from({ length: historyDays }, (_, i) => format(subDays(new Date(), i), "yyyy-MM-dd"));
  const dailyTasks = (tasks as any[]).filter((t) => (t.frequency || "daily").toLowerCase() === "daily");

  if (!siteId) return <div className="p-6 text-center text-muted-foreground">No site selected.</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <SprayCan className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground">Cleaning</h1>
              <p className="text-sm text-muted-foreground">
                {topTab === "history" ? "Audit history" : isToday ? "Track cleaning tasks" : "Historical records"}
              </p>
            </div>
          </div>
          {!isToday && !canEdit && topTab !== "history" && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" /> Read-only
            </Badge>
          )}
        </div>
        {topTab !== "history" && (
          <DateNavigator selectedDate={selectedDate} onChange={setSelectedDate} minDate={currentSite?.created_at?.slice(0, 10)} />
        )}
        {topTab !== "history" && isRetrospective && <RetrospectiveBanner date={selectedDate} />}
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
        <Tabs value={topTab} onValueChange={(v) => setTopTab(v as TopTab)}>
          <TabsList className="w-full">
            {(["daily", "weekly", "monthly"] as Frequency[]).map((f) => {
              const fTasks = (tasks as any[]).filter((t) => (t.frequency || "daily").toLowerCase() === f);
              return (
                <TabsTrigger key={f} value={f} className="flex-1 capitalize">
                  {f}
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">{fTasks.length}</Badge>
                </TabsTrigger>
              );
            })}
            <TabsTrigger value="history" className="flex-1">
              <History className="h-3.5 w-3.5 mr-1" />History
            </TabsTrigger>
          </TabsList>

          {(["daily", "weekly", "monthly"] as Frequency[]).map((f) => (
            <TabsContent key={f} value={f} className="space-y-4 mt-4">
              <Card><CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{periodLabel}</span>
                    {allClosed && (
                      <Badge variant="outline" className="gap-1 text-warning border-warning/40">
                        <CalendarOff className="h-3 w-3" />
                        Closed{periodReason ? ` — ${periodReason}` : ""}
                      </Badge>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${allClosed ? "text-muted-foreground" : pct === 100 ? "text-success" : "text-muted-foreground"}`}>
                    {allClosed ? "Exempt" : `${pct}%`}
                  </span>
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
                          const disabled = !canEdit || allClosed;
                          return (
                            <button key={task.id} onClick={() => !disabled && toggleTask.mutate(task.id)} disabled={disabled}
                              className={`w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors ${!disabled ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}`}>
                              {allClosed && !isDone
                                ? <CalendarOff className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                                : isDone
                                ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                                : <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm ${isDone ? "line-through text-muted-foreground" : "font-medium"}`}>{task.task}</span>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {task.due_time && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{task.due_time}</span>}
                                  {isDone && log?.completed_at && (
                                    <Badge variant="outline" className="text-[10px] text-success border-success/30">
                                      Done {format(parseISO(log.completed_at), "d MMM HH:mm")}
                                      {log.completed_by_name ? ` · ${log.completed_by_name}` : ""}
                                    </Badge>
                                  )}
                                  {isDone && log?.is_retrospective && (
                                    <Badge variant="outline" className="text-[10px] border-warning text-warning" title={log.retrospective_note || undefined}>Retrospective</Badge>
                                  )}
                                  {allClosed && !isDone && (
                                    <Badge variant="outline" className="text-[10px] text-warning border-warning/40">Exempt — closed</Badge>
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
          ))}

          <TabsContent value="history" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Daily cleaning completion — last {historyDays} days</p>
              <div className="flex gap-2">
                <Button size="sm" variant={historyDays === 14 ? "default" : "outline"} onClick={() => setHistoryDays(14)} className="h-7 text-xs">14 days</Button>
                <Button size="sm" variant={historyDays === 30 ? "default" : "outline"} onClick={() => setHistoryDays(30)} className="h-7 text-xs">30 days</Button>
              </div>
            </div>

            {historyLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

            {!historyLoading && (
              <div className="space-y-2">
                {historyDaysList.map((dateStr) => {
                  const isClosed = historyClosedSet.has(dateStr);
                  const dayLogs = (historyLogs as any[]).filter((l) => l.log_date === dateStr && l.done);
                  const doneTasks = new Set(dayLogs.map((l: any) => l.task_id));
                  const dayDoneCount = dailyTasks.filter((t) => doneTasks.has(t.id)).length;
                  const dayTotal = dailyTasks.length;
                  const dayPct = dayTotal > 0 ? Math.round((dayDoneCount / dayTotal) * 100) : 0;
                  const isExpanded = expandedDay === dateStr;
                  const isCurrentDay = dateStr === todayStr;

                  return (
                    <Card key={dateStr} className={isClosed ? "opacity-60" : ""}>
                      <button className="w-full" onClick={() => setExpandedDay(isExpanded ? null : dateStr)}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-24 shrink-0 text-left">
                              <p className="text-xs font-semibold">
                                {isCurrentDay ? "Today" : format(parseISO(dateStr), "EEE d MMM")}
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              {isClosed ? (
                                <div className="flex items-center gap-1.5">
                                  <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Closed — exempt</span>
                                </div>
                              ) : dayTotal === 0 ? (
                                <span className="text-xs text-muted-foreground">No tasks configured</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Progress value={dayPct} className="h-1.5 flex-1" />
                                  <span className={`text-xs font-semibold shrink-0 ${dayPct === 100 ? "text-success" : dayPct === 0 ? "text-destructive" : "text-warning"}`}>
                                    {dayPct}%
                                  </span>
                                  <span className="text-xs text-muted-foreground shrink-0">{dayDoneCount}/{dayTotal}</span>
                                </div>
                              )}
                            </div>
                            {!isClosed && dayTotal > 0 && (
                              isExpanded
                                ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </div>
                        </CardContent>
                      </button>

                      {isExpanded && !isClosed && (
                        <div className="border-t px-3 pb-3">
                          <div className="space-y-1 pt-2">
                            {dailyTasks.map((task: any) => {
                              const isDone = doneTasks.has(task.id);
                              const log = dayLogs.find((l: any) => l.task_id === task.id);
                              return (
                                <div key={task.id} className="flex items-start gap-2 py-1.5">
                                  {isDone
                                    ? <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-xs ${isDone ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>
                                      {task.task}
                                    </span>
                                    {isDone && log?.completed_at && (
                                      <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {format(parseISO(log.completed_at), "HH:mm")}
                                        {log.completed_by_name ? ` · ${log.completed_by_name}` : ""}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Cleaning;
