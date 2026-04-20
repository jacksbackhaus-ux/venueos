import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Users, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";

// ---------- Date helpers (local time, Mon-first week) ----------
const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
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
  const diff = (d.getDay() + 6) % 7; // Mon=0, Sun=6
  d.setDate(d.getDate() - diff);
  return toIsoDate(d);
};

const addDays = (iso: string, days: number) => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};

const dayKeyForIso = (iso: string) => DAY_KEYS[parseIso(iso).getDay()];

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
type Shift = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  color: string;
  days_active: string[];
  shift_staff: { user_id: string }[];
};

type AppUser = { id: string; display_name: string; status: string };

// ---------- Page ----------
const Shifts = () => {
  const { currentSite, currentMembership } = useSite();
  const { staffSession } = useAuth();
  const siteId = currentSite?.id || staffSession?.site_id;
  const role = currentMembership?.site_role || staffSession?.site_role || "staff";
  const canEdit = role === "owner" || role === "supervisor"; // gate for future actions

  const [view, setView] = useState<"week" | "day">("week");
  const [anchorDate, setAnchorDate] = useState<string>(todayIso());

  const weekStart = useMemo(() => startOfWeekMon(anchorDate), [anchorDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Fetch shifts (active) for site
  const { data: shifts = [], isLoading: loadingShifts } = useQuery({
    queryKey: ["rota-shifts", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("shifts")
        .select("id, name, start_time, end_time, color, days_active, shift_staff(user_id)")
        .eq("site_id", siteId)
        .eq("active", true)
        .order("start_time");
      if (error) throw error;
      return (data || []) as Shift[];
    },
    enabled: !!siteId,
  });

  // Fetch active users in this org (for staff names)
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["rota-users", currentSite?.organisation_id || staffSession?.organisation_id],
    queryFn: async () => {
      const orgId = currentSite?.organisation_id || staffSession?.organisation_id;
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, display_name, status")
        .eq("organisation_id", orgId)
        .eq("status", "active")
        .order("display_name");
      if (error) throw error;
      return (data || []) as AppUser[];
    },
    enabled: !!(currentSite?.organisation_id || staffSession?.organisation_id),
  });

  const userById = useMemo(() => {
    const m = new Map<string, AppUser>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  // Build per-day shift assignments. A shift is "on" for a day if its
  // days_active contains that weekday key (e.g. "Mon").
  const shiftsForDay = (iso: string) => {
    const key = dayKeyForIso(iso);
    return shifts.filter((s) => (s.days_active || []).includes(key));
  };

  // For a given staff member, list shifts assigned to them on a day
  const shiftsForStaffOnDay = (userId: string, iso: string) => {
    const key = dayKeyForIso(iso);
    return shifts.filter(
      (s) =>
        (s.days_active || []).includes(key) &&
        (s.shift_staff || []).some((ss) => ss.user_id === userId)
    );
  };

  // Staff who appear in any shift this week (so we don't render empty rows for everyone)
  const staffInWeek = useMemo(() => {
    const ids = new Set<string>();
    weekDays.forEach((iso) => {
      shiftsForDay(iso).forEach((s) =>
        (s.shift_staff || []).forEach((ss) => ids.add(ss.user_id))
      );
    });
    return Array.from(ids)
      .map((id) => userById.get(id))
      .filter((u): u is AppUser => !!u)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [weekDays, shifts, userById]);

  // Daily view: flat list of (shift × assigned staff) for the day
  const dayAssignments = useMemo(() => {
    const list: { shift: Shift; user: AppUser }[] = [];
    shiftsForDay(anchorDate).forEach((s) => {
      (s.shift_staff || []).forEach((ss) => {
        const u = userById.get(ss.user_id);
        if (u) list.push({ shift: s, user: u });
      });
    });
    return list.sort((a, b) => {
      if (a.shift.start_time !== b.shift.start_time)
        return a.shift.start_time.localeCompare(b.shift.start_time);
      return a.user.display_name.localeCompare(b.user.display_name);
    });
  }, [shifts, anchorDate, userById]);

  const shiftsOnDayUnassigned = useMemo(
    () => shiftsForDay(anchorDate).filter((s) => (s.shift_staff || []).length === 0),
    [shifts, anchorDate]
  );

  const isLoading = loadingShifts || loadingUsers;

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

        <Tabs value={view} onValueChange={(v) => setView(v as "week" | "day")}>
          <TabsList>
            <TabsTrigger value="week">Weekly</TabsTrigger>
            <TabsTrigger value="day">Daily</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Date navigator */}
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
          staff={staffInWeek}
          shiftsForStaffOnDay={shiftsForStaffOnDay}
          shiftsForDay={shiftsForDay}
        />
      ) : (
        <DayView
          dateIso={anchorDate}
          assignments={dayAssignments}
          unassigned={shiftsOnDayUnassigned}
        />
      )}
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
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={onPrev}
        aria-label={view === "week" ? "Previous week" : "Previous day"}
      >
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
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={onNext}
        aria-label={view === "week" ? "Next week" : "Next day"}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ---------- Weekly view ----------
function WeekView({
  weekDays,
  staff,
  shiftsForStaffOnDay,
  shiftsForDay,
}: {
  weekDays: string[];
  staff: AppUser[];
  shiftsForStaffOnDay: (userId: string, iso: string) => Shift[];
  shiftsForDay: (iso: string) => Shift[];
}) {
  const today = todayIso();
  const totalShiftsThisWeek = weekDays.reduce((sum, iso) => sum + shiftsForDay(iso).length, 0);

  if (totalShiftsThisWeek === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No shifts scheduled this week</p>
          <p className="text-sm mt-1">Shifts created in the rota will appear here.</p>
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
                    className={`text-left font-heading font-semibold p-3 min-w-[130px] ${
                      isToday ? "bg-primary/5 text-primary" : ""
                    }`}
                  >
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {DAY_LABELS_LONG[d.getDay()].slice(0, 3)}
                    </div>
                    <div className="text-base">{d.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={weekDays.length + 1} className="p-6 text-center text-muted-foreground">
                  No staff assigned to any shift this week.
                </td>
              </tr>
            ) : (
              staff.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-medium sticky left-0 bg-card z-10 border-r">
                    {u.display_name}
                  </td>
                  {weekDays.map((iso) => {
                    const sList = shiftsForStaffOnDay(u.id, iso);
                    const isToday = iso === today;
                    return (
                      <td
                        key={iso}
                        className={`p-2 align-top ${isToday ? "bg-primary/5" : ""}`}
                      >
                        {sList.length === 0 ? (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        ) : (
                          <div className="space-y-1">
                            {sList.map((s) => (
                              <div
                                key={s.id}
                                className={`rounded px-2 py-1 text-xs border ${s.color}`}
                              >
                                <div className="font-semibold truncate">{s.name}</div>
                                <div className="opacity-80">
                                  {s.start_time}–{s.end_time}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
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
  unassigned,
}: {
  dateIso: string;
  assignments: { shift: Shift; user: AppUser }[];
  unassigned: Shift[];
}) {
  const isToday = dateIso === todayIso();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          {assignments.length} {assignments.length === 1 ? "assignment" : "assignments"} · {formatLong(dateIso)}
          {isToday && <Badge variant="outline" className="ml-2 text-[10px]">Today</Badge>}
        </span>
      </div>

      {assignments.length === 0 && unassigned.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No shifts scheduled</p>
            <p className="text-sm mt-1">Nothing planned for this day.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {assignments.map(({ shift, user }, idx) => (
              <div
                key={`${shift.id}-${user.id}-${idx}`}
                className="flex items-center gap-3 p-3"
              >
                <div className={`px-2 py-1 rounded text-xs font-semibold border ${shift.color} shrink-0`}>
                  {shift.name}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user.display_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {shift.start_time} – {shift.end_time}
                  </div>
                </div>
              </div>
            ))}

            {unassigned.length > 0 && (
              <div className="p-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Shifts with no staff assigned
                </p>
                <div className="space-y-2">
                  {unassigned.map((s) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded text-xs font-semibold border ${s.color}`}>
                        {s.name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {s.start_time} – {s.end_time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default Shifts;
