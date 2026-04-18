import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  CalendarClock, Plus, Clock, CheckCircle2, Circle, AlertTriangle,
  ChevronDown, ChevronUp, Trash2, Save, X, Thermometer, SprayCan,
  ClipboardList, Truck, User, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";

const shiftColors = [
  "bg-primary/10 text-primary border-primary/20",
  "bg-success/10 text-success border-success/20",
  "bg-warning/10 text-warning border-warning/20",
  "bg-breach/10 text-breach border-breach/20",
];
const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const moduleIcons: Record<string, React.ElementType> = {
  Temperatures: Thermometer, Cleaning: SprayCan, "Day Sheet": ClipboardList, Deliveries: Truck, General: CalendarClock,
};

const ShiftAssignment = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const qc = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";
  const today = new Date().toISOString().split("T")[0];

  const [activeTab, setActiveTab] = useState("today");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedShiftForTask, setSelectedShiftForTask] = useState("");
  const [viewAs, setViewAs] = useState("all");
  const [shiftForm, setShiftForm] = useState({ name: "", startTime: "06:00", endTime: "12:00", assignedStaff: [] as string[], daysActive: ["Mon","Tue","Wed","Thu","Fri","Sat"] });
  const [taskForm, setTaskForm] = useState({ title: "", dueTime: "", module: "General", recurring: true, assignedTo: "" });

  // ─── Queries ───
  const { data: staffMembers = [] } = useQuery({
    queryKey: ["org_staff", organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase.from("users").select("id, display_name")
        .eq("organisation_id", organisationId).eq("status", "active");
      if (error) throw error;
      return (data || []).map((u: any) => ({
        id: u.id, name: u.display_name,
        initials: (u.display_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
      }));
    },
    enabled: !!organisationId,
  });

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ["shifts", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("shifts")
        .select("*, shift_staff(user_id)")
        .eq("site_id", siteId).eq("active", true).order("start_time");
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["shift_tasks", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("shift_tasks").select("*")
        .eq("site_id", siteId).eq("active", true).order("due_time");
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["shift_task_completions", siteId, today],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("shift_task_completions").select("*")
        .eq("site_id", siteId).eq("completion_date", today);
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });

  // ─── Mutations ───
  const createShift = useMutation({
    mutationFn: async () => {
      if (!siteId || !organisationId) throw new Error("No site");
      const color = shiftColors[shifts.length % shiftColors.length];
      const { data: newShift, error } = await supabase.from("shifts").insert({
        site_id: siteId, organisation_id: organisationId,
        name: shiftForm.name, start_time: shiftForm.startTime, end_time: shiftForm.endTime,
        color, days_active: shiftForm.daysActive,
      }).select("id").single();
      if (error) throw error;
      if (shiftForm.assignedStaff.length > 0) {
        const { error: ssErr } = await supabase.from("shift_staff").insert(
          shiftForm.assignedStaff.map((uid) => ({ shift_id: newShift!.id, user_id: uid }))
        );
        if (ssErr) throw ssErr;
      }
    },
    onSuccess: () => {
      toast.success("Shift created");
      setShowAddShift(false);
      setShiftForm({ name: "", startTime: "06:00", endTime: "12:00", assignedStaff: [], daysActive: ["Mon","Tue","Wed","Thu","Fri","Sat"] });
      qc.invalidateQueries({ queryKey: ["shifts", siteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shifts").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Shift deactivated"); qc.invalidateQueries({ queryKey: ["shifts", siteId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const createTask = useMutation({
    mutationFn: async () => {
      if (!siteId || !organisationId) throw new Error("No site");
      const { error } = await supabase.from("shift_tasks").insert({
        site_id: siteId, organisation_id: organisationId,
        shift_id: selectedShiftForTask, title: taskForm.title, due_time: taskForm.dueTime,
        module: taskForm.module, recurring: taskForm.recurring,
        assigned_to_user_id: taskForm.assignedTo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task added");
      setShowAddTask(false);
      setTaskForm({ title: "", dueTime: "", module: "General", recurring: true, assignedTo: "" });
      qc.invalidateQueries({ queryKey: ["shift_tasks", siteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shift_tasks").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task removed"); qc.invalidateQueries({ queryKey: ["shift_tasks", siteId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleComplete = useMutation({
    mutationFn: async (taskId: string) => {
      if (!siteId) throw new Error("No site");
      const existing = completions.find((c: any) => c.task_id === taskId);
      if (existing) {
        const { error } = await supabase.from("shift_task_completions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shift_task_completions").insert({
          site_id: siteId, task_id: taskId, completion_date: today,
          completed_by_user_id: appUser?.id || null, completed_by_name: userName,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shift_task_completions", siteId, today] }),
    onError: (e: any) => toast.error(e.message),
  });

  if (!siteId) return <div className="p-6 text-center text-muted-foreground">No site selected.</div>;

  // Derived
  const completedTaskIds = new Set(completions.map((c: any) => c.task_id));
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t: any) => completedTaskIds.has(t.id)).length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const filteredTasks = viewAs === "all" ? tasks : tasks.filter((t: any) => t.assigned_to_user_id === viewAs);
  const todayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Shifts & Tasks</h1>
            <p className="text-sm text-muted-foreground">{todayLabel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAddShift(true)}>
            <Plus className="h-3 w-3" /> Shift
          </Button>
          <Button size="sm" className="gap-1" disabled={shifts.length === 0}
            onClick={() => { setSelectedShiftForTask(shifts[0]?.id || ""); setShowAddTask(true); }}>
            <Plus className="h-3 w-3" /> Task
          </Button>
        </div>
      </div>

      {shiftsLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {!shiftsLoading && shifts.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No shifts created yet</p>
          <p className="text-sm mt-1">Create your first shift to start assigning staff and tasks.</p>
        </CardContent></Card>
      )}

      {shifts.length > 0 && (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="today" className="flex-1">Today's Tasks</TabsTrigger>
          <TabsTrigger value="shifts" className="flex-1">Manage Shifts</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Select value={viewAs} onValueChange={setViewAs}>
                <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staffMembers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-success font-semibold">{doneTasks} done</span>
              <span className="text-muted-foreground">{totalTasks - doneTasks} pending</span>
            </div>
          </div>

          <Card><CardContent className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">{pct}% complete</span>
              <span className="text-xs text-muted-foreground">{doneTasks}/{totalTasks}</span>
            </div>
            <Progress value={pct} className="h-2" />
          </CardContent></Card>

          {shifts.map((shift: any) => {
            const shiftTasks = filteredTasks.filter((t: any) => t.shift_id === shift.id);
            if (shiftTasks.length === 0) return null;
            const shiftDone = shiftTasks.filter((t: any) => completedTaskIds.has(t.id)).length;
            const isExpanded = expanded.includes(shift.id);
            const assignedStaffIds = (shift.shift_staff || []).map((ss: any) => ss.user_id);

            return (
              <motion.div key={shift.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Collapsible open={isExpanded} onOpenChange={() => setExpanded((p) => p.includes(shift.id) ? p.filter(s => s !== shift.id) : [...p, shift.id])}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={`${shift.color} border text-xs`}>{shift.name}</Badge>
                            <span className="text-xs text-muted-foreground">{shift.start_time}–{shift.end_time}</span>
                            <Badge variant="outline" className="text-[10px]">{shiftDone}/{shiftTasks.length}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                              {assignedStaffIds.map((sid: string) => {
                                const s = staffMembers.find((st) => st.id === sid);
                                return s ? (
                                  <div key={sid} className="h-6 w-6 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-[9px] font-bold text-primary">
                                    {s.initials}
                                  </div>
                                ) : null;
                              })}
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="space-y-1">
                          {shiftTasks.map((task: any) => {
                            const ModIcon = moduleIcons[task.module] || CalendarClock;
                            const staff = staffMembers.find((s) => s.id === task.assigned_to_user_id);
                            const done = completedTaskIds.has(task.id);
                            const completion = completions.find((c: any) => c.task_id === task.id);
                            return (
                              <button key={task.id} onClick={() => toggleComplete.mutate(task.id)}
                                className={`w-full flex items-center gap-3 p-2.5 rounded-md text-left transition-colors hover:bg-muted/50 ${done ? "opacity-60" : ""}`}>
                                {done ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <span className={`text-sm ${done ? "line-through text-muted-foreground" : "font-medium"}`}>{task.title}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {task.due_time}</span>
                                    {staff && <span className="text-xs text-muted-foreground">· {staff.name}</span>}
                                    {done && completion && <span className="text-[10px] text-success">Done {new Date(completion.completed_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <ModIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                  <Badge variant="outline" className="text-[10px]">{task.module}</Badge>
                                  {task.recurring && <Badge variant="secondary" className="text-[10px]">↻</Badge>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-muted-foreground gap-1"
                          onClick={(e) => { e.stopPropagation(); setSelectedShiftForTask(shift.id); setShowAddTask(true); }}>
                          <Plus className="h-3 w-3" /> Add task to {shift.name}
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </motion.div>
            );
          })}
        </TabsContent>

        <TabsContent value="shifts" className="mt-4 space-y-4">
          {shifts.map((shift: any) => {
            const shiftTasks = tasks.filter((t: any) => t.shift_id === shift.id);
            const assignedStaffIds = (shift.shift_staff || []).map((ss: any) => ss.user_id);
            return (
              <Card key={shift.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${shift.color} border text-xs`}>{shift.name}</Badge>
                        <span className="text-sm text-muted-foreground">{shift.start_time} – {shift.end_time}</span>
                      </div>
                      <div className="flex gap-1 mb-2">
                        {(shift.days_active || []).map((day: string) => (
                          <Badge key={day} variant="secondary" className="text-[10px]">{day}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-breach hover:text-breach" onClick={() => deleteShift.mutate(shift.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Assigned Staff</p>
                    <div className="flex flex-wrap gap-2">
                      {assignedStaffIds.map((sid: string) => {
                        const s = staffMembers.find((st) => st.id === sid);
                        return s ? (
                          <div key={sid} className="flex items-center gap-1.5 bg-muted rounded-full px-2 py-1">
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">{s.initials}</div>
                            <span className="text-xs">{s.name}</span>
                          </div>
                        ) : null;
                      })}
                      {assignedStaffIds.length === 0 && <span className="text-xs text-muted-foreground">None assigned</span>}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Required Tasks ({shiftTasks.length})</p>
                    <div className="space-y-1">
                      {shiftTasks.map((t: any) => {
                        const ModIcon = moduleIcons[t.module] || CalendarClock;
                        return (
                          <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                            <div className="flex items-center gap-2">
                              <ModIcon className="h-3 w-3 text-muted-foreground" />
                              <span>{t.title}</span>
                              {t.recurring && <Badge variant="secondary" className="text-[9px]">↻</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{t.due_time}</span>
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-breach hover:text-breach" onClick={() => deleteTask.mutate(t.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {shiftTasks.length === 0 && <p className="text-xs text-muted-foreground italic">No tasks yet</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-heading font-semibold">Historical record</p>
                  <p className="text-xs text-muted-foreground mt-1">Shifts and tasks are deactivated (not deleted) to preserve completion history for inspections.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}

      {/* Add Shift Dialog */}
      <Dialog open={showAddShift} onOpenChange={setShowAddShift}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Create Shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Shift name</Label>
              <Input placeholder="e.g. AM Prep, Bake, Close..." value={shiftForm.name} onChange={(e) => setShiftForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">Start</Label><Input type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))} /></div>
              <div><Label className="text-sm">End</Label><Input type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))} /></div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Active days</Label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => (
                  <Button key={day} variant={shiftForm.daysActive.includes(day) ? "default" : "outline"} size="sm" className="text-xs"
                    onClick={() => setShiftForm((f) => ({ ...f, daysActive: f.daysActive.includes(day) ? f.daysActive.filter((d) => d !== day) : [...f.daysActive, day] }))}>
                    {day}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Assign staff</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {staffMembers.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={shiftForm.assignedStaff.includes(s.id)}
                      onCheckedChange={(checked) => setShiftForm((f) => ({ ...f, assignedStaff: checked ? [...f.assignedStaff, s.id] : f.assignedStaff.filter((id) => id !== s.id) }))} />
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">{s.initials}</div>
                      <span className="text-sm">{s.name}</span>
                    </div>
                  </label>
                ))}
                {staffMembers.length === 0 && <p className="text-xs text-muted-foreground italic">No staff yet — add some in Settings → Users.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddShift(false)}>Cancel</Button>
            <Button disabled={!shiftForm.name || createShift.isPending} onClick={() => createShift.mutate()}>
              <Save className="h-3 w-3 mr-1" /> {createShift.isPending ? "Saving..." : "Create Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Add Task to Shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Shift</Label>
              <Select value={selectedShiftForTask} onValueChange={setSelectedShiftForTask}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {shifts.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-sm">Task title</Label>
              <Input placeholder="e.g. Fridge 3 AM temp..." value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div><Label className="text-sm">Due time</Label>
              <Input type="time" value={taskForm.dueTime} onChange={(e) => setTaskForm((f) => ({ ...f, dueTime: e.target.value }))} /></div>
            <div>
              <Label className="text-sm">Module</Label>
              <Select value={taskForm.module} onValueChange={(v) => setTaskForm((f) => ({ ...f, module: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Temperatures">Temperatures</SelectItem>
                  <SelectItem value="Cleaning">Cleaning</SelectItem>
                  <SelectItem value="Day Sheet">Day Sheet</SelectItem>
                  <SelectItem value="Deliveries">Deliveries</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Assign to (optional)</Label>
              <Select value={taskForm.assignedTo || "any"} onValueChange={(v) => setTaskForm((f) => ({ ...f, assignedTo: v === "any" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Any shift member..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any shift member</SelectItem>
                  {staffMembers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={taskForm.recurring} onCheckedChange={(checked) => setTaskForm((f) => ({ ...f, recurring: !!checked }))} />
              <span className="text-sm">Recurring (repeats every active day)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTask(false)}>Cancel</Button>
            <Button disabled={!taskForm.title || !taskForm.dueTime || !selectedShiftForTask || createTask.isPending} onClick={() => createTask.mutate()}>
              <Save className="h-3 w-3 mr-1" /> {createTask.isPending ? "Saving..." : "Add Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftAssignment;
