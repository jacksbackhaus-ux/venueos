import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CancellationDialog } from "@/components/shifts/CancellationDialog";
import { SmartFillDialog } from "@/components/shifts/SmartFillDialog";

// ---------- Date helpers (local time, Mon-first week) ----------
const DAY_LABELS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toIsoDate = (d: Date) => {
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60_000);
  return local.toISOString().slice(0, 10);
};

const todayIso = () => toIsoDate(new Date());
const parseIso = (iso: string) => new Date(`${iso}T12:00:00`);

const startOfWeekMon = (iso: string) => {
  const d = parseIso(iso);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return toIsoDate(d);
};

const addDays = (iso: string, days: number) => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};

const formatLong = (iso: string, withYear = false) =>
  parseIso(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });

const formatShortRange = (a: string, b: string) => {
  const dA = parseIso(a);
  const dB = parseIso(b);
  const sameMonth = dA.getMonth() === dB.getMonth();
  const sameYear = dA.getFullYear() === dB.getFullYear();
  const aStr = dA.toLocaleDateString("en-GB", { day: "numeric", month: sameMonth ? undefined : "short" });
  const bStr = dB.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${aStr} – ${bStr}`;
};

// ---------- Types ----------
type Assignment = {
  id: string;
  user_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  position: string | null;
};

type AppUser = { id: string; display_name: string; status: string };

type TaskKind = "day_sheet_item" | "cleaning_task";
type LinkedTask = { task_type: TaskKind; task_id: string };
type DaySheetSection = { id: string; title: string; day_sheet_items: { id: string; label: string; active: boolean }[] };
type CleaningTask = { id: string; task: string; area: string };
type RotaTaskRow = { id: string; rota_assignment_id: string; task_type: TaskKind; task_id: string };

// ---------- Page ----------
const Shifts = () => {
  const { currentSite, currentMembership, organisationId } = useSite();
  const { staffSession } = useAuth();
  const siteId = currentSite?.id || staffSession?.site_id;
  const role = currentMembership?.site_role || staffSession?.site_role || "staff";
  const canEdit = role === "owner" || role === "supervisor";

  const qc = useQueryClient();
  const [view, setView] = useState<"week" | "day">("week");
  const [anchorDate, setAnchorDate] = useState<string>(todayIso());

  const weekStart = useMemo(() => startOfWeekMon(anchorDate), [anchorDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Fetch range covers either the full week or just the day depending on view.
  const rangeStart = view === "week" ? weekStart : anchorDate;
  const rangeEnd = view === "week" ? addDays(weekStart, 6) : anchorDate;

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["rota-assignments", siteId, rangeStart, rangeEnd],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("rota_assignments")
        .select("id, user_id, shift_date, start_time, end_time, position")
        .eq("site_id", siteId)
        .gte("shift_date", rangeStart)
        .lte("shift_date", rangeEnd)
        .order("start_time");
      if (error) throw error;
      return (data || []) as Assignment[];
    },
    enabled: !!siteId,
  });

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["rota-users", organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, display_name, status")
        .eq("organisation_id", organisationId)
        .eq("status", "active")
        .order("display_name");
      if (error) throw error;
      return (data || []) as AppUser[];
    },
    enabled: !!organisationId,
  });

  const userById = useMemo(() => {
    const m = new Map<string, AppUser>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  // Fetch all task links for the visible assignments
  const assignmentIds = assignments.map((a) => a.id);
  const { data: taskLinks = [] } = useQuery({
    queryKey: ["rota-task-links", assignmentIds.join(",")],
    queryFn: async () => {
      if (assignmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("rota_assignment_tasks")
        .select("id, rota_assignment_id, task_type, task_id")
        .in("rota_assignment_id", assignmentIds);
      if (error) throw error;
      return (data || []) as RotaTaskRow[];
    },
    enabled: assignmentIds.length > 0,
  });

  const linksByAssignment = useMemo(() => {
    const m = new Map<string, RotaTaskRow[]>();
    taskLinks.forEach((l) => {
      const arr = m.get(l.rota_assignment_id) || [];
      arr.push(l);
      m.set(l.rota_assignment_id, arr);
    });
    return m;
  }, [taskLinks]);

  // Day sheet sections + items (active only)
  const { data: daySheetSections = [] } = useQuery({
    queryKey: ["rota-daysheet-sections", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("day_sheet_sections")
        .select("id, title, day_sheet_items(id, label, active)")
        .eq("site_id", siteId)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as DaySheetSection[];
    },
    enabled: !!siteId && canEdit,
  });

  // Cleaning tasks
  const { data: cleaningTasks = [] } = useQuery({
    queryKey: ["rota-cleaning-tasks", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("cleaning_tasks")
        .select("id, task, area")
        .eq("site_id", siteId)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as CleaningTask[];
    },
    enabled: !!siteId && canEdit,
  });

  // Group assignments by date+user
  const assignmentsByDateUser = useMemo(() => {
    const m = new Map<string, Assignment[]>();
    assignments.forEach((a) => {
      const key = `${a.shift_date}|${a.user_id}`;
      const arr = m.get(key) || [];
      arr.push(a);
      m.set(key, arr);
    });
    return m;
  }, [assignments]);

  const assignmentsForDate = (iso: string) =>
    assignments
      .filter((a) => a.shift_date === iso)
      .sort(
        (a, b) =>
          a.start_time.localeCompare(b.start_time) ||
          (userById.get(a.user_id)?.display_name || "").localeCompare(
            userById.get(b.user_id)?.display_name || ""
          )
      );

  const staffInRange = useMemo(() => {
    const ids = new Set<string>();
    assignments.forEach((a) => ids.add(a.user_id));
    return Array.from(ids)
      .map((id) => userById.get(id))
      .filter((u): u is AppUser => !!u)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [assignments, userById]);

  // ---------- Dialog state ----------
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Assignment | null>(null);
  const [smartFillTarget, setSmartFillTarget] = useState<Assignment | null>(null);
  const [form, setForm] = useState({
    user_id: "",
    shift_date: anchorDate,
    start_time: "09:00",
    end_time: "17:00",
    position: "",
  });
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);

  const toggleLinkedTask = (task_type: TaskKind, task_id: string) => {
    setLinkedTasks((prev) => {
      const exists = prev.some((l) => l.task_type === task_type && l.task_id === task_id);
      return exists
        ? prev.filter((l) => !(l.task_type === task_type && l.task_id === task_id))
        : [...prev, { task_type, task_id }];
    });
  };

  const isTaskLinked = (task_type: TaskKind, task_id: string) =>
    linkedTasks.some((l) => l.task_type === task_type && l.task_id === task_id);

  const openCreate = (presetDate?: string, presetUserId?: string) => {
    setEditing(null);
    setForm({
      user_id: presetUserId || "",
      shift_date: presetDate || anchorDate,
      start_time: "09:00",
      end_time: "17:00",
      position: "",
    });
    setLinkedTasks([]);
    setDialogOpen(true);
  };

  const openEdit = (a: Assignment) => {
    setEditing(a);
    setForm({
      user_id: a.user_id,
      shift_date: a.shift_date,
      start_time: a.start_time,
      end_time: a.end_time,
      position: a.position || "",
    });
    const existing = linksByAssignment.get(a.id) || [];
    setLinkedTasks(existing.map((l) => ({ task_type: l.task_type, task_id: l.task_id })));
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!siteId || !organisationId) throw new Error("Missing site");
      if (!form.user_id) throw new Error("Select a staff member");
      if (!form.shift_date) throw new Error("Select a date");
      if (!form.start_time || !form.end_time) throw new Error("Enter start and end times");
      if (form.end_time <= form.start_time) throw new Error("End time must be after start time");

      const payload = {
        site_id: siteId,
        organisation_id: organisationId,
        user_id: form.user_id,
        shift_date: form.shift_date,
        start_time: form.start_time,
        end_time: form.end_time,
        position: form.position.trim() || null,
      };

      let assignmentId: string;
      if (editing) {
        const { error } = await supabase
          .from("rota_assignments")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        assignmentId = editing.id;
      } else {
        const { data, error } = await supabase
          .from("rota_assignments")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        assignmentId = data.id;
      }

      // Sync task links: delete then insert (simple + correct).
      const { error: delErr } = await supabase
        .from("rota_assignment_tasks")
        .delete()
        .eq("rota_assignment_id", assignmentId);
      if (delErr) throw delErr;

      if (linkedTasks.length > 0) {
        const rows = linkedTasks.map((l) => ({
          rota_assignment_id: assignmentId,
          task_type: l.task_type,
          task_id: l.task_id,
        }));
        const { error: insErr } = await supabase.from("rota_assignment_tasks").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rota-assignments"] });
      qc.invalidateQueries({ queryKey: ["rota-task-links"] });
      setDialogOpen(false);
      toast.success(editing ? "Shift updated" : "Shift added");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save shift"),
  });

  // Pull pending shift_requests for status badges on the rota grid
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["rota-pending-requests", siteId, rangeStart, rangeEnd],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("shift_requests")
        .select("id, original_shift_id, request_type, target_user_id, status")
        .eq("site_id", siteId)
        .in("status", ["pending_teammate", "pending_approval"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });

  const requestByShiftId = useMemo(() => {
    const m = new Map<string, { request_type: "swap" | "cover"; target_user_id: string | null; status: string }>();
    pendingRequests.forEach((r) => m.set(r.original_shift_id, r as { request_type: "swap" | "cover"; target_user_id: string | null; status: string }));
    return m;
  }, [pendingRequests]);

  const isLoading = loadingAssignments || loadingUsers;

  if (!siteId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>No site selected. Please select a site to view the rota.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Rota</h1>
            <p className="text-sm text-muted-foreground">
              {canEdit ? "Plan and view staff shifts" : "View staff shifts (read-only)"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "week" | "day")}>
            <TabsList>
              <TabsTrigger value="week">Weekly</TabsTrigger>
              <TabsTrigger value="day">Daily</TabsTrigger>
            </TabsList>
          </Tabs>
          {canEdit && (
            <Button size="sm" onClick={() => openCreate()}>
              <Plus className="h-4 w-4 mr-1" /> Add shift
            </Button>
          )}
        </div>
      </div>

      <DateBar
        view={view}
        anchorDate={anchorDate}
        weekStart={weekStart}
        onPrev={() => setAnchorDate(addDays(anchorDate, view === "week" ? -7 : -1))}
        onNext={() => setAnchorDate(addDays(anchorDate, view === "week" ? 7 : 1))}
        onToday={() => setAnchorDate(todayIso())}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : view === "week" ? (
        <WeekView
          weekDays={weekDays}
          staff={staffInRange}
          getAssignments={(uid, iso) => assignmentsByDateUser.get(`${iso}|${uid}`) || []}
          assignmentsForDate={assignmentsForDate}
          linkedCount={(id) => (linksByAssignment.get(id) || []).length}
          requestByShiftId={requestByShiftId}
          canEdit={canEdit}
          onAdd={(iso) => openCreate(iso)}
          onEdit={openEdit}
        />
      ) : (
        <DayView
          dateIso={anchorDate}
          assignments={assignmentsForDate(anchorDate)}
          userById={userById}
          linkedCount={(id) => (linksByAssignment.get(id) || []).length}
          requestByShiftId={requestByShiftId}
          canEdit={canEdit}
          onAdd={() => openCreate(anchorDate)}
          onEdit={openEdit}
          onCancel={(a) => setCancelTarget(a)}
          onSmartFill={(a) => setSmartFillTarget(a)}
        />
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit shift" : "Add shift"}</DialogTitle>
            <DialogDescription>
              Assign a staff member to a date with start and end times.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Staff member</Label>
              <Select
                value={form.user_id}
                onValueChange={(v) => setForm((f) => ({ ...f, user_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.shift_date}
                onChange={(e) => setForm((f) => ({ ...f, shift_date: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Position (optional)</Label>
              <Input
                placeholder="e.g. Morning Baker"
                maxLength={80}
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              />
            </div>

            {/* Optional task linking */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Linked compliance tasks (optional)</Label>
                {linkedTasks.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {linkedTasks.length} linked
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Flag Day Sheet items or Cleaning tasks as this staff member's responsibility for the day.
                This does not change who can complete them.
              </p>

              <ScrollArea className="h-56 rounded-md border p-2">
                <div className="space-y-3">
                  {/* Day sheet items grouped by section */}
                  {daySheetSections.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Day Sheet
                      </div>
                      <div className="space-y-2">
                        {daySheetSections.map((sec) => {
                          const items = (sec.day_sheet_items || []).filter((i) => i.active);
                          if (items.length === 0) return null;
                          return (
                            <div key={sec.id}>
                              <div className="text-xs font-medium text-foreground/80 mb-0.5">
                                {sec.title}
                              </div>
                              <div className="space-y-1 pl-1">
                                {items.map((it) => {
                                  const checked = isTaskLinked("day_sheet_item", it.id);
                                  return (
                                    <label
                                      key={it.id}
                                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5"
                                    >
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={() =>
                                          toggleLinkedTask("day_sheet_item", it.id)
                                        }
                                      />
                                      <span className="truncate">{it.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cleaning tasks */}
                  {cleaningTasks.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Cleaning
                      </div>
                      <div className="space-y-1 pl-1">
                        {cleaningTasks.map((ct) => {
                          const checked = isTaskLinked("cleaning_task", ct.id);
                          return (
                            <label
                              key={ct.id}
                              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleLinkedTask("cleaning_task", ct.id)}
                              />
                              <span className="truncate">
                                {ct.task}{" "}
                                <span className="text-xs text-muted-foreground">· {ct.area}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {daySheetSections.length === 0 && cleaningTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No Day Sheet or Cleaning tasks set up yet.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Add shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation dialog with compensation preview */}
      <CancellationDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        shift={cancelTarget}
        onCancelled={() => {
          setCancelTarget(null);
          qc.invalidateQueries({ queryKey: ["rota-assignments"] });
        }}
      />

      {/* Smart Fill suggestions */}
      <SmartFillDialog
        open={!!smartFillTarget}
        onOpenChange={(o) => !o && setSmartFillTarget(null)}
        siteId={siteId}
        shift={smartFillTarget}
        excludeUserIds={smartFillTarget ? [smartFillTarget.user_id] : []}
        onPick={async (userId) => {
          if (!smartFillTarget) return;
          const { error } = await supabase
            .from("rota_assignments")
            .update({ user_id: userId })
            .eq("id", smartFillTarget.id);
          if (error) toast.error(error.message);
          else {
            toast.success("Shift reassigned");
            qc.invalidateQueries({ queryKey: ["rota-assignments"] });
          }
        }}
      />
    </div>
  );
};

// ---------- Date bar ----------
function DateBar({
  view,
  anchorDate,
  weekStart,
  onPrev,
  onNext,
  onToday,
}: {
  view: "week" | "day";
  anchorDate: string;
  weekStart: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const today = todayIso();
  const isCurrent = view === "week" ? weekStart === startOfWeekMon(today) : anchorDate === today;
  const label =
    view === "week" ? formatShortRange(weekStart, addDays(weekStart, 6)) : formatLong(anchorDate, true);

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-2 py-1.5">
      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
        {!isCurrent && (
          <button
            type="button"
            onClick={onToday}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {view === "week" ? "Jump to this week" : "Jump to today"}
          </button>
        )}
      </div>
      <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ---------- Status badge helper ----------
type RequestInfo = { request_type: "swap" | "cover"; target_user_id: string | null; status: string };

function StatusBadge({ info }: { info?: RequestInfo }) {
  if (!info) return null;
  if (info.request_type === "swap") {
    return (
      <Badge variant="outline" className="text-[9px] h-4 px-1 border-warning/40 bg-warning/10 text-warning-foreground">
        Swap pending
      </Badge>
    );
  }
  // cover
  return (
    <Badge variant="outline" className="text-[9px] h-4 px-1 border-destructive/40 bg-destructive/10 text-destructive">
      Cover requested
    </Badge>
  );
}

// ---------- Weekly view ----------
function WeekView({
  weekDays,
  staff,
  getAssignments,
  assignmentsForDate,
  linkedCount,
  requestByShiftId,
  canEdit,
  onAdd,
  onEdit,
}: {
  weekDays: string[];
  staff: AppUser[];
  getAssignments: (userId: string, iso: string) => Assignment[];
  assignmentsForDate: (iso: string) => Assignment[];
  linkedCount: (assignmentId: string) => number;
  requestByShiftId: Map<string, RequestInfo>;
  canEdit: boolean;
  onAdd: (iso: string) => void;
  onEdit: (a: Assignment) => void;
}) {
  const today = todayIso();
  const totalThisWeek = weekDays.reduce((sum, iso) => sum + assignmentsForDate(iso).length, 0);

  if (totalThisWeek === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No shifts scheduled this week</p>
          <p className="text-sm mt-1">
            {canEdit ? "Use 'Add shift' to schedule staff." : "Nothing scheduled yet."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left font-heading font-semibold p-3 sticky left-0 bg-muted/40 z-10 min-w-[140px]">
                Staff
              </th>
              {weekDays.map((iso) => {
                const d = parseIso(iso);
                const isToday = iso === today;
                return (
                  <th
                    key={iso}
                    className={`text-left font-heading font-semibold p-3 min-w-[140px] ${
                      isToday ? "bg-primary/5 text-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {DAY_LABELS_LONG[d.getDay()].slice(0, 3)}
                        </div>
                        <div className="text-base">{d.getDate()}</div>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onAdd(iso)}
                          title="Add shift"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="p-3 font-medium sticky left-0 bg-card z-10 border-r">
                  {u.display_name}
                </td>
                {weekDays.map((iso) => {
                  const list = getAssignments(u.id, iso);
                  const isToday = iso === today;
                  return (
                    <td key={iso} className={`p-2 align-top ${isToday ? "bg-primary/5" : ""}`}>
                      {list.length === 0 ? (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      ) : (
                        <div className="space-y-1">
                          {list.map((a) => {
                            const lc = linkedCount(a.id);
                            const req = requestByShiftId.get(a.id);
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => canEdit && onEdit(a)}
                                disabled={!canEdit}
                                className={`w-full text-left rounded px-2 py-1 text-xs border bg-primary/10 text-primary border-primary/20 ${
                                  canEdit ? "hover:bg-primary/15 cursor-pointer" : "cursor-default"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="font-semibold">
                                    {a.start_time}–{a.end_time}
                                  </div>
                                  {lc > 0 && (
                                    <span className="flex items-center gap-0.5 text-[10px] opacity-80">
                                      <ListChecks className="h-3 w-3" />
                                      {lc}
                                    </span>
                                  )}
                                </div>
                                {a.position && <div className="opacity-80 truncate">{a.position}</div>}
                                {req && <div className="mt-1"><StatusBadge info={req} /></div>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---------- Daily view ----------
function DayView({
  dateIso,
  assignments,
  userById,
  linkedCount,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  dateIso: string;
  assignments: Assignment[];
  userById: Map<string, AppUser>;
  linkedCount: (assignmentId: string) => number;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (a: Assignment) => void;
  onDelete: (id: string) => void;
}) {
  const isToday = dateIso === todayIso();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>
            {assignments.length} {assignments.length === 1 ? "shift" : "shifts"} · {formatLong(dateIso)}
            {isToday && <Badge variant="outline" className="ml-2 text-[10px]">Today</Badge>}
          </span>
        </div>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No shifts scheduled</p>
            <p className="text-sm mt-1">
              {canEdit ? "Use 'Add shift' to schedule staff." : "Nothing planned for this day."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {assignments.map((a) => {
              const user = userById.get(a.user_id);
              const lc = linkedCount(a.id);
              return (
                <div key={a.id} className="flex items-center gap-3 p-3">
                  <div className="px-2 py-1 rounded text-xs font-semibold border bg-primary/10 text-primary border-primary/20 shrink-0">
                    {a.start_time}–{a.end_time}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {user?.display_name || "Unknown staff"}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      {a.position && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {a.position}
                        </span>
                      )}
                      {lc > 0 && (
                        <span className="flex items-center gap-1">
                          <ListChecks className="h-3 w-3" />
                          {lc} task{lc === 1 ? "" : "s"} linked
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => onDelete(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Shifts;
