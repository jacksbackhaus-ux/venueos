import { useState } from "react";
import { motion } from "framer-motion";
import { SprayCan, CheckCircle2, Circle, Clock, Camera, Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DateNavigator } from "@/components/DateNavigator";

const Cleaning = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";
  const [activeTab, setActiveTab] = useState("daily");
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const isToday = selectedDate === todayStr;
  const today = selectedDate; // queries scoped to selected date

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

  const { data: logs = [] } = useQuery({
    queryKey: ["cleaning_logs", siteId, today],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("cleaning_logs").select("*").eq("site_id", siteId).eq("log_date", today);
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  const toggleTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!isToday) throw new Error("Past cleaning records are read-only");
      const existing = logs.find((l: any) => l.task_id === taskId);
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cleaning_logs", siteId, today] }),
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = tasks.filter((t: any) => t.frequency === activeTab);
  const doneIds = new Set(logs.filter((l: any) => l.done).map((l: any) => l.task_id));
  const doneCount = filtered.filter((t: any) => doneIds.has(t.id)).length;
  const pct = filtered.length > 0 ? Math.round((doneCount / filtered.length) * 100) : 0;
  const areas = [...new Set(filtered.map((t: any) => t.area))];

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
        <DateNavigator selectedDate={selectedDate} onChange={setSelectedDate} />
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            {["daily", "weekly", "monthly"].map((f) => (
              <TabsTrigger key={f} value={f} className="flex-1 capitalize">
                {f}
                <Badge variant="secondary" className="ml-1.5 text-[10px]">
                  {tasks.filter((t: any) => t.frequency === f && doneIds.has(t.id)).length}/{tasks.filter((t: any) => t.frequency === f).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{doneCount}/{filtered.length} tasks complete</span>
                <span className={`text-sm font-bold ${pct === 100 ? "text-success" : "text-muted-foreground"}`}>{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </CardContent></Card>

            {areas.map((area) => (
              <motion.div key={area} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">{area}</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {filtered.filter((t: any) => t.area === area).map((task: any) => {
                        const isDone = doneIds.has(task.id);
                        const log = logs.find((l: any) => l.task_id === task.id);
                        return (
                          <button key={task.id} onClick={() => isToday && toggleTask.mutate(task.id)} disabled={!isToday}
                            className={`w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors ${isToday ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"} ${isDone ? "opacity-60" : ""}`}>
                            {isDone ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm ${isDone ? "line-through text-muted-foreground" : "font-medium"}`}>{task.task}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {task.due_time && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {task.due_time}</span>}
                                {task.assigned_to_name && <span className="text-xs text-muted-foreground">· {task.assigned_to_name}</span>}
                                {isDone && log?.completed_at && (
                                  <Badge variant="outline" className="text-[10px] text-success border-success/30">
                                    Done {new Date(log.completed_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
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
