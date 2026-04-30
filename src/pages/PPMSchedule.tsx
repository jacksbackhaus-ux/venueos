import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Wrench, Plus, Loader2, CheckCircle2, History, CalendarClock,
  AlertTriangle, Trash2, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  format, parseISO, addDays, addMonths, differenceInDays,
} from "date-fns";

type Frequency = "weekly" | "monthly" | "quarterly" | "biannual" | "annual";
type Category =
  | "electrical" | "plumbing" | "hvac" | "fire_safety"
  | "pest_control" | "equipment" | "building" | "other";

const FREQUENCIES: { value: Frequency; label: string; order: number }[] = [
  { value: "weekly", label: "Weekly", order: 1 },
  { value: "monthly", label: "Monthly", order: 2 },
  { value: "quarterly", label: "Quarterly", order: 3 },
  { value: "biannual", label: "Biannual", order: 4 },
  { value: "annual", label: "Annual", order: 5 },
];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "hvac", label: "HVAC" },
  { value: "fire_safety", label: "Fire Safety" },
  { value: "pest_control", label: "Pest Control" },
  { value: "equipment", label: "Equipment" },
  { value: "building", label: "Building" },
  { value: "other", label: "Other" },
];

const FREQ_LABEL = Object.fromEntries(FREQUENCIES.map(f => [f.value, f.label])) as Record<Frequency, string>;
const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label])) as Record<Category, string>;

function nextDueFor(frequency: Frequency, from: Date): Date {
  switch (frequency) {
    case "weekly": return addDays(from, 7);
    case "monthly": return addMonths(from, 1);
    case "quarterly": return addMonths(from, 3);
    case "biannual": return addMonths(from, 6);
    case "annual": return addMonths(from, 12);
  }
}

interface PpmTask {
  id: string;
  site_id: string;
  organisation_id: string;
  task_name: string;
  description: string | null;
  frequency: Frequency;
  category: Category;
  assigned_to: string | null;
  contractor_name: string | null;
  estimated_duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

interface PpmCompletion {
  id: string;
  task_id: string;
  site_id: string;
  completed_by: string | null;
  completed_date: string;
  next_due_date: string;
  notes: string | null;
  cost: number | null;
  created_at: string;
}

type Status = "overdue" | "due_soon" | "on_track" | "never";

function statusFor(nextDue: string | null): { status: Status; days: number | null; label: string } {
  if (!nextDue) return { status: "never", days: null, label: "Not yet completed" };
  const days = differenceInDays(parseISO(nextDue), new Date());
  if (days < 0) return { status: "overdue", days, label: `${Math.abs(days)}d overdue` };
  if (days <= 14) return { status: "due_soon", days, label: `Due in ${days}d` };
  return { status: "on_track", days, label: `Due in ${days}d` };
}

function statusClasses(s: Status): string {
  if (s === "overdue") return "bg-breach/10 text-breach border-breach/30";
  if (s === "due_soon") return "bg-warning/10 text-warning border-warning/30";
  if (s === "on_track") return "bg-success/10 text-success border-success/30";
  return "bg-muted text-muted-foreground border-border";
}

const PPMSchedule = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const { isSupervisorPlus } = useRole();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userId = appUser?.id || staffSession?.user_id || null;

  const [activeTab, setActiveTab] = useState<"schedule" | "history">("schedule");

  // Task dialog state
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<PpmTask | null>(null);
  const [taskName, setTaskName] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskFreq, setTaskFreq] = useState<Frequency>("monthly");
  const [taskCat, setTaskCat] = useState<Category>("equipment");
  const [taskAssigned, setTaskAssigned] = useState("");
  const [taskContractor, setTaskContractor] = useState("");
  const [taskDuration, setTaskDuration] = useState("");

  // Completion dialog state
  const [completingTask, setCompletingTask] = useState<PpmTask | null>(null);
  const [completedDate, setCompletedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [completionNotes, setCompletionNotes] = useState("");
  const [completionCost, setCompletionCost] = useState("");

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["ppm_tasks", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("ppm_tasks")
        .select("*")
        .eq("site_id", siteId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as PpmTask[];
    },
    enabled: !!siteId,
  });

  const { data: completions = [], isLoading: completionsLoading } = useQuery({
    queryKey: ["ppm_completions", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("ppm_completions")
        .select("*")
        .eq("site_id", siteId)
        .order("completed_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as PpmCompletion[];
    },
    enabled: !!siteId,
  });

  // Latest completion per task
  const latestByTask = useMemo(() => {
    const map = new Map<string, PpmCompletion>();
    for (const c of completions) {
      const existing = map.get(c.task_id);
      if (!existing || c.completed_date > existing.completed_date) {
        map.set(c.task_id, c);
      }
    }
    return map;
  }, [completions]);

  const activeTasks = tasks.filter(t => t.is_active);

  const tasksByFrequency = useMemo(() => {
    const map = new Map<Frequency, PpmTask[]>();
    for (const f of FREQUENCIES) map.set(f.value, []);
    for (const t of activeTasks) map.get(t.frequency)?.push(t);
    return map;
  }, [activeTasks]);

  const taskById = useMemo(() => {
    const map = new Map<string, PpmTask>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  function resetTaskForm() {
    setEditingTask(null);
    setTaskName(""); setTaskDesc(""); setTaskFreq("monthly"); setTaskCat("equipment");
    setTaskAssigned(""); setTaskContractor(""); setTaskDuration("");
  }

  function openEditTask(t: PpmTask) {
    setEditingTask(t);
    setTaskName(t.task_name);
    setTaskDesc(t.description || "");
    setTaskFreq(t.frequency);
    setTaskCat(t.category);
    setTaskAssigned(t.assigned_to || "");
    setTaskContractor(t.contractor_name || "");
    setTaskDuration(t.estimated_duration_minutes?.toString() || "");
    setShowTaskDialog(true);
  }

  const saveTask = useMutation({
    mutationFn: async () => {
      if (!siteId || !organisationId) throw new Error("No site selected");
      if (!taskName.trim()) throw new Error("Task name is required");
      const payload = {
        task_name: taskName.trim(),
        description: taskDesc.trim() || null,
        frequency: taskFreq,
        category: taskCat,
        assigned_to: taskAssigned.trim() || null,
        contractor_name: taskContractor.trim() || null,
        estimated_duration_minutes: taskDuration ? Number(taskDuration) : null,
      };
      if (editingTask) {
        const { error } = await supabase.from("ppm_tasks").update(payload).eq("id", editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ppm_tasks").insert({
          site_id: siteId,
          organisation_id: organisationId,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingTask ? "Task updated" : "Task added");
      queryClient.invalidateQueries({ queryKey: ["ppm_tasks", siteId] });
      setShowTaskDialog(false);
      resetTaskForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ppm_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey: ["ppm_tasks", siteId] });
      queryClient.invalidateQueries({ queryKey: ["ppm_completions", siteId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openComplete(t: PpmTask) {
    setCompletingTask(t);
    setCompletedDate(format(new Date(), "yyyy-MM-dd"));
    setCompletionNotes("");
    setCompletionCost("");
  }

  const logCompletion = useMutation({
    mutationFn: async () => {
      if (!completingTask || !siteId) throw new Error("Missing task or site");
      const completed = parseISO(completedDate);
      const nextDue = nextDueFor(completingTask.frequency, completed);
      const { error } = await supabase.from("ppm_completions").insert({
        task_id: completingTask.id,
        site_id: siteId,
        completed_by: userId,
        completed_date: completedDate,
        next_due_date: format(nextDue, "yyyy-MM-dd"),
        notes: completionNotes.trim() || null,
        cost: completionCost ? Number(completionCost) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Completion logged");
      queryClient.invalidateQueries({ queryKey: ["ppm_completions", siteId] });
      setCompletingTask(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renderTaskCard = (t: PpmTask) => {
    const latest = latestByTask.get(t.id);
    const s = statusFor(latest?.next_due_date || null);
    return (
      <motion.div
        key={t.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-border rounded-lg p-3 space-y-2 bg-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-heading font-semibold text-sm truncate">{t.task_name}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">{CAT_LABEL[t.category]}</Badge>
              {t.contractor_name && <span>· {t.contractor_name}</span>}
              {t.assigned_to && <span>· {t.assigned_to}</span>}
            </div>
          </div>
          <Badge variant="outline" className={`shrink-0 ${statusClasses(s.status)}`}>
            {s.status === "overdue" && <AlertTriangle className="h-3 w-3 mr-1" />}
            {s.label}
          </Badge>
        </div>

        {t.description && (
          <p className="text-xs text-muted-foreground">{t.description}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground">
            {latest ? (
              <>Last: {format(parseISO(latest.completed_date), "d MMM yyyy")}</>
            ) : (
              <>Never completed</>
            )}
          </div>
          <div className="flex gap-1.5">
            {isSupervisorPlus && (
              <>
                <Button size="sm" variant="ghost" onClick={() => openEditTask(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete "${t.task_name}"? All completion history will also be removed.`)) {
                      deleteTask.mutate(t.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-breach" />
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => openComplete(t)}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Log
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="h-7 w-7 text-primary" />
            PPM Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planned preventative maintenance — keep equipment serviced and compliant.
          </p>
        </div>
        {isSupervisorPlus && (
          <Button onClick={() => { resetTaskForm(); setShowTaskDialog(true); }} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            Add Task
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "schedule" | "history")}>
        <TabsList className="grid grid-cols-2 w-full max-w-sm">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* SCHEDULE */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          {tasksLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeTasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No PPM tasks set up yet.
                {isSupervisorPlus && (
                  <div className="mt-3">
                    <Button size="sm" onClick={() => { resetTaskForm(); setShowTaskDialog(true); }}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add your first task
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            FREQUENCIES.map(f => {
              const list = tasksByFrequency.get(f.value) || [];
              if (list.length === 0) return null;
              return (
                <Card key={f.value}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-heading flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-primary" />
                        {f.label}
                      </CardTitle>
                      <Badge variant="secondary" className="font-semibold">
                        {list.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">{list.map(renderTaskCard)}</div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Completion History
                </CardTitle>
                <Badge variant="secondary" className="font-semibold">
                  {completions.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {completionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : completions.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No completions logged yet.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {completions.map(c => {
                    const t = taskById.get(c.task_id);
                    return (
                      <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                              {t?.task_name || "Unknown task"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(parseISO(c.completed_date), "d MMM yyyy")}
                              {" · Next due "}
                              {format(parseISO(c.next_due_date), "d MMM yyyy")}
                              {c.cost != null && ` · £${Number(c.cost).toFixed(2)}`}
                            </div>
                            {c.notes && (
                              <div className="text-xs text-muted-foreground mt-1 italic">
                                "{c.notes}"
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* TASK DIALOG */}
      <Dialog open={showTaskDialog} onOpenChange={(o) => { setShowTaskDialog(o); if (!o) resetTaskForm(); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingTask ? "Edit PPM Task" : "Add PPM Task"}
            </DialogTitle>
            <DialogDescription>
              Define a recurring maintenance task with a frequency and category.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="tname">Task name</Label>
              <Input
                id="tname"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g. Service ovens"
              />
            </div>

            <div>
              <Label htmlFor="tdesc">Description (optional)</Label>
              <Textarea
                id="tdesc"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Notes or instructions"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tfreq">Frequency</Label>
                <Select value={taskFreq} onValueChange={(v) => setTaskFreq(v as Frequency)}>
                  <SelectTrigger id="tfreq"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tcat">Category</Label>
                <Select value={taskCat} onValueChange={(v) => setTaskCat(v as Category)}>
                  <SelectTrigger id="tcat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tassign">Assigned to</Label>
                <Input
                  id="tassign"
                  value={taskAssigned}
                  onChange={(e) => setTaskAssigned(e.target.value)}
                  placeholder="Internal staff"
                />
              </div>
              <div>
                <Label htmlFor="tcontractor">Contractor</Label>
                <Input
                  id="tcontractor"
                  value={taskContractor}
                  onChange={(e) => setTaskContractor(e.target.value)}
                  placeholder="External company"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="tdur">Estimated duration (minutes)</Label>
              <Input
                id="tdur"
                type="number"
                min="0"
                inputMode="numeric"
                value={taskDuration}
                onChange={(e) => setTaskDuration(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTaskDialog(false); resetTaskForm(); }}>
              Cancel
            </Button>
            <Button onClick={() => saveTask.mutate()} disabled={saveTask.isPending}>
              {saveTask.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingTask ? "Save Changes" : "Add Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COMPLETE DIALOG */}
      <Dialog open={!!completingTask} onOpenChange={(o) => { if (!o) setCompletingTask(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Log Completion</DialogTitle>
            <DialogDescription>
              {completingTask?.task_name} · {completingTask && FREQ_LABEL[completingTask.frequency]}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="cdate">Completed date</Label>
              <Input
                id="cdate"
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
              />
              {completingTask && (
                <p className="text-xs text-muted-foreground mt-1">
                  Next due: {format(nextDueFor(completingTask.frequency, parseISO(completedDate)), "d MMM yyyy")}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="ccost">Cost (£)</Label>
              <Input
                id="ccost"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={completionCost}
                onChange={(e) => setCompletionCost(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="cnotes">Notes (optional)</Label>
              <Textarea
                id="cnotes"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="What was done, parts replaced, issues found"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletingTask(null)}>Cancel</Button>
            <Button onClick={() => logCompletion.mutate()} disabled={logCompletion.isPending}>
              {logCompletion.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Log Completion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PPMSchedule;
