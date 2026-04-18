import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  Plus,
  Users,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Save,
  X,
  Thermometer,
  SprayCan,
  ClipboardList,
  Truck,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Types ───
type StaffMember = { id: string; name: string; initials: string };
type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  assignedStaff: string[];
  daysActive: string[];
};

type ShiftTask = {
  id: string;
  shiftId: string;
  title: string;
  dueTime: string;
  module: string;
  recurring: boolean;
  assignedTo?: string;
  status: "pending" | "done" | "overdue";
  completedAt?: string;
  completedBy?: string;
};

// ─── Empty defaults — populated from the database at runtime ───
const defaultShifts: Shift[] = [];
const defaultTasks: ShiftTask[] = [];

const shiftColors = [
  "bg-primary/10 text-primary border-primary/20",
  "bg-success/10 text-success border-success/20",
  "bg-warning/10 text-warning border-warning/20",
  "bg-breach/10 text-breach border-breach/20",
  "bg-purple-100 text-purple-700 border-purple-200",
];

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const moduleIcons: Record<string, React.ElementType> = {
  Temperatures: Thermometer,
  Cleaning: SprayCan,
  "Day Sheet": ClipboardList,
  Deliveries: Truck,
  General: CalendarClock,
};

// ─── Component ───
const ShiftAssignment = () => {
  const { currentSite } = useSite();
  const [activeTab, setActiveTab] = useState("today");
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>(defaultShifts);
  const [tasks, setTasks] = useState<ShiftTask[]>(defaultTasks);

  useEffect(() => {
    if (!currentSite) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('id, display_name')
        .eq('organisation_id', currentSite.organisation_id)
        .eq('status', 'active');
      if (cancelled || !data) return;
      setStaffMembers(data.map((u: any) => ({
        id: u.id,
        name: u.display_name,
        initials: (u.display_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      })));
    })();
    return () => { cancelled = true; };
  }, [currentSite]);

  const [expandedShifts, setExpandedShifts] = useState<string[]>(["sh1"]);
  const [showAddShift, setShowAddShift] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedShiftForTask, setSelectedShiftForTask] = useState("");
  const [viewAs, setViewAs] = useState("all");

  // Shift form
  const [shiftForm, setShiftForm] = useState({ name: "", startTime: "06:00", endTime: "12:00", assignedStaff: [] as string[], daysActive: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] });

  // Task form
  const [taskForm, setTaskForm] = useState({ title: "", dueTime: "", module: "General", recurring: true, assignedTo: "" });

  const toggleShiftExpand = (id: string) => {
    setExpandedShifts((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleTaskDone = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: t.status === "done" ? "pending" : "done",
              completedAt: t.status !== "done" ? new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : undefined,
              completedBy: t.status !== "done" ? "You" : undefined,
            }
          : t
      )
    );
  };

  const saveShift = () => {
    const newShift: Shift = {
      id: `sh-${Date.now()}`,
      name: shiftForm.name,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      color: shiftColors[shifts.length % shiftColors.length],
      assignedStaff: shiftForm.assignedStaff,
      daysActive: shiftForm.daysActive,
    };
    setShifts((prev) => [...prev, newShift]);
    setShowAddShift(false);
    setShiftForm({ name: "", startTime: "06:00", endTime: "12:00", assignedStaff: [], daysActive: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] });
  };

  const saveTask = () => {
    const newTask: ShiftTask = {
      id: `t-${Date.now()}`,
      shiftId: selectedShiftForTask,
      title: taskForm.title,
      dueTime: taskForm.dueTime,
      module: taskForm.module,
      recurring: taskForm.recurring,
      assignedTo: taskForm.assignedTo || undefined,
      status: "pending",
    };
    setTasks((prev) => [...prev, newTask]);
    setShowAddTask(false);
    setTaskForm({ title: "", dueTime: "", module: "General", recurring: true, assignedTo: "" });
  };

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const overdueTasks = tasks.filter((t) => t.status === "overdue").length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Filter tasks if viewing as specific staff
  const filteredTasks = viewAs === "all" ? tasks : tasks.filter((t) => t.assignedTo === viewAs);
  const filteredShiftIds = [...new Set(filteredTasks.map((t) => t.shiftId))];

  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Shifts & Tasks</h1>
            <p className="text-sm text-muted-foreground">{today}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAddShift(true)}>
            <Plus className="h-3 w-3" /> Shift
          </Button>
          <Button size="sm" className="gap-1" onClick={() => { setSelectedShiftForTask(shifts[0]?.id || ""); setShowAddTask(true); }}>
            <Plus className="h-3 w-3" /> Task
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="today" className="flex-1">Today's Tasks</TabsTrigger>
          <TabsTrigger value="shifts" className="flex-1">Manage Shifts</TabsTrigger>
        </TabsList>

        {/* ════════ TODAY'S TASKS ════════ */}
        <TabsContent value="today" className="mt-4 space-y-4">
          {/* View As + Stats */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Select value={viewAs} onValueChange={setViewAs}>
                <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staffMembers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-success font-semibold">{doneTasks} done</span>
              <span className="text-muted-foreground">{totalTasks - doneTasks - overdueTasks} pending</span>
              {overdueTasks > 0 && <span className="text-breach font-semibold">{overdueTasks} overdue</span>}
            </div>
          </div>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">{pct}% complete</span>
                <span className="text-xs text-muted-foreground">{doneTasks}/{totalTasks}</span>
              </div>
              <Progress value={pct} className="h-2" />
            </CardContent>
          </Card>

          {/* Tasks grouped by shift */}
          {shifts
            .filter((s) => viewAs === "all" || filteredShiftIds.includes(s.id))
            .map((shift) => {
              const shiftTasks = filteredTasks.filter((t) => t.shiftId === shift.id);
              if (shiftTasks.length === 0) return null;
              const shiftDone = shiftTasks.filter((t) => t.status === "done").length;
              const isExpanded = expandedShifts.includes(shift.id);

              return (
                <motion.div key={shift.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Collapsible open={isExpanded} onOpenChange={() => toggleShiftExpand(shift.id)}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={`${shift.color} border text-xs`}>{shift.name}</Badge>
                              <span className="text-xs text-muted-foreground">{shift.startTime}–{shift.endTime}</span>
                              <Badge variant="outline" className="text-[10px]">{shiftDone}/{shiftTasks.length}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-1.5">
                                {shift.assignedStaff.map((sid) => {
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
                            {shiftTasks.map((task) => {
                              const ModIcon = moduleIcons[task.module] || CalendarClock;
                              const staff = staffMembers.find((s) => s.id === task.assignedTo);
                              return (
                                <button
                                  key={task.id}
                                  onClick={() => toggleTaskDone(task.id)}
                                  className={`w-full flex items-center gap-3 p-2.5 rounded-md text-left transition-colors hover:bg-muted/50 ${
                                    task.status === "done" ? "opacity-60" : ""
                                  }`}
                                >
                                  {task.status === "done" ? (
                                    <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                                  ) : task.status === "overdue" ? (
                                    <AlertTriangle className="h-5 w-5 text-breach animate-pulse-breach shrink-0" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-sm ${task.status === "done" ? "line-through text-muted-foreground" : "font-medium"}`}>
                                        {task.title}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> {task.dueTime}
                                      </span>
                                      {staff && <span className="text-xs text-muted-foreground">· {staff.name}</span>}
                                      {task.completedAt && (
                                        <span className="text-[10px] text-success">Done {task.completedAt}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <ModIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <Badge variant="outline" className="text-[10px]">{task.module}</Badge>
                                    {task.recurring && (
                                      <Badge variant="secondary" className="text-[10px]">↻</Badge>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 text-xs text-muted-foreground gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedShiftForTask(shift.id);
                              setShowAddTask(true);
                            }}
                          >
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

        {/* ════════ MANAGE SHIFTS ════════ */}
        <TabsContent value="shifts" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-sm">Shift Templates</h2>
            <Button size="sm" className="gap-1" onClick={() => setShowAddShift(true)}>
              <Plus className="h-3 w-3" /> Create Shift
            </Button>
          </div>

          {shifts.map((shift) => {
            const shiftTasks = tasks.filter((t) => t.shiftId === shift.id);
            return (
              <Card key={shift.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${shift.color} border text-xs`}>{shift.name}</Badge>
                        <span className="text-sm text-muted-foreground">{shift.startTime} – {shift.endTime}</span>
                      </div>
                      <div className="flex gap-1 mb-2">
                        {shift.daysActive.map((day) => (
                          <Badge key={day} variant="secondary" className="text-[10px]">{day}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm"><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="text-breach hover:text-breach" onClick={() => setShifts((prev) => prev.filter((s) => s.id !== shift.id))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Assigned staff */}
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Assigned Staff</p>
                    <div className="flex flex-wrap gap-2">
                      {shift.assignedStaff.map((sid) => {
                        const s = staffMembers.find((st) => st.id === sid);
                        return s ? (
                          <div key={sid} className="flex items-center gap-1.5 bg-muted rounded-full px-2 py-1">
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                              {s.initials}
                            </div>
                            <span className="text-xs">{s.name}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>

                  {/* Required tasks */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Required Tasks ({shiftTasks.length})</p>
                    <div className="space-y-1">
                      {shiftTasks.map((t) => {
                        const ModIcon = moduleIcons[t.module] || CalendarClock;
                        return (
                          <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                            <div className="flex items-center gap-2">
                              <ModIcon className="h-3 w-3 text-muted-foreground" />
                              <span>{t.title}</span>
                              {t.recurring && <Badge variant="secondary" className="text-[9px]">↻ Recurring</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{t.dueTime}</span>
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-breach hover:text-breach" onClick={() => setTasks((prev) => prev.filter((tt) => tt.id !== t.id))}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Escalation info */}
          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-heading font-semibold">Escalation Rules</p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                    <li>• Overdue tasks are highlighted in red on the staff dashboard</li>
                    <li>• Manager is notified when any task is 15+ minutes overdue</li>
                    <li>• Temperature breaches create automatic recheck tasks</li>
                    <li>• Uncompleted tasks carry over to manager's exception review</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Add Shift Dialog ─── */}
      <Dialog open={showAddShift} onOpenChange={setShowAddShift}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Create Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Shift name</Label>
              <Input placeholder="e.g. AM Prep, Bake, Close..." value={shiftForm.name} onChange={(e) => setShiftForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Start time</Label>
                <Input type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm">End time</Label>
                <Input type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Active days</Label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => (
                  <Button
                    key={day}
                    variant={shiftForm.daysActive.includes(day) ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      setShiftForm((f) => ({
                        ...f,
                        daysActive: f.daysActive.includes(day) ? f.daysActive.filter((d) => d !== day) : [...f.daysActive, day],
                      }))
                    }
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Assign staff</Label>
              <div className="space-y-2">
                {staffMembers.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={shiftForm.assignedStaff.includes(s.id)}
                      onCheckedChange={(checked) =>
                        setShiftForm((f) => ({
                          ...f,
                          assignedStaff: checked ? [...f.assignedStaff, s.id] : f.assignedStaff.filter((id) => id !== s.id),
                        }))
                      }
                    />
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                        {s.initials}
                      </div>
                      <span className="text-sm">{s.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddShift(false)}>Cancel</Button>
            <Button disabled={!shiftForm.name} onClick={saveShift}>
              <Save className="h-3 w-3 mr-1" /> Create Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Task Dialog ─── */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Add Task to Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Shift</Label>
              <Select value={selectedShiftForTask} onValueChange={setSelectedShiftForTask}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Task title</Label>
              <Input placeholder="e.g. Fridge 3 AM temp, Floor mop..." value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm">Due time</Label>
              <Input type="time" value={taskForm.dueTime} onChange={(e) => setTaskForm((f) => ({ ...f, dueTime: e.target.value }))} />
            </div>
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
              <Label className="text-sm">Assign to</Label>
              <Select value={taskForm.assignedTo} onValueChange={(v) => setTaskForm((f) => ({ ...f, assignedTo: v }))}>
                <SelectTrigger><SelectValue placeholder="Any shift member..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any shift member</SelectItem>
                  {staffMembers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
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
            <Button disabled={!taskForm.title || !taskForm.dueTime} onClick={saveTask}>
              <Save className="h-3 w-3 mr-1" /> Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftAssignment;
