import { useEffect, useMemo, useState } from "react";
import { Clock, Plus, Download, CheckCircle2, Timer, Calendar, ChevronLeft, ChevronRight, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TimesheetEntry = {
  id: string;
  user_id: string;
  site_id: string;
  organisation_id: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  approved_by: string | null;
  approved_at: string | null;
};

type StaffName = { id: string; display_name: string };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function calcHours(clockIn: string, clockOut: string | null, breakMins: number) {
  if (!clockOut) return null;
  const diff = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 1000 / 60;
  return Math.max(0, (diff - breakMins) / 60);
}
function hoursLabel(h: number | null) {
  if (h === null || isNaN(h)) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}
function toCSV(rows: (string | number)[][]) {
  return rows.map(r => r.map(v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}

export default function Timesheets() {
  const { appUser, staffSession } = useAuth();
  const { currentSite } = useSite();
  const role = useRole();

  const userName = appUser?.display_name || staffSession?.display_name || "You";
  const currentUserId = appUser?.id || staffSession?.user_id || null;
  const siteId = currentSite?.id || null;
  const orgId = currentSite?.organisation_id || appUser?.organisation_id || null;

  const [myEntries, setMyEntries] = useState<TimesheetEntry[]>([]);
  const [allEntries, setAllEntries] = useState<TimesheetEntry[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});
  const [openEntry, setOpenEntry] = useState<TimesheetEntry | null>(null);
  const [showClockIn, setShowClockIn] = useState(false);
  const [showClockOut, setShowClockOut] = useState(false);
  const [breakMins, setBreakMins] = useState("0");
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // Week range (Mon–Sun)
  const { weekStart, weekEnd, weekLabel } = useMemo(() => {
    const today = new Date();
    const day = today.getDay(); // 0 Sun..6 Sat
    const mondayDelta = day === 0 ? -6 : 1 - day;
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(today.getDate() + mondayDelta + weekOffset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const label = `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(end.getTime() - 1).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    return { weekStart: start, weekEnd: end, weekLabel: label };
  }, [weekOffset]);

  // Load my entries for the week + currently open entry
  const loadMy = async () => {
    if (!currentUserId || !siteId) return;
    const { data } = await supabase
      .from("timesheet_entries")
      .select("*")
      .eq("user_id", currentUserId)
      .eq("site_id", siteId)
      .gte("clock_in", weekStart.toISOString())
      .lt("clock_in", weekEnd.toISOString())
      .order("clock_in", { ascending: false });
    setMyEntries((data || []) as TimesheetEntry[]);

    const { data: open } = await supabase
      .from("timesheet_entries")
      .select("*")
      .eq("user_id", currentUserId)
      .eq("site_id", siteId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();
    setOpenEntry((open as TimesheetEntry | null) || null);
  };

  // Load all entries (manager view)
  const loadAll = async () => {
    if (!siteId || !role.isSupervisorPlus) return;
    const { data } = await supabase
      .from("timesheet_entries")
      .select("*")
      .eq("site_id", siteId)
      .gte("clock_in", weekStart.toISOString())
      .lt("clock_in", weekEnd.toISOString())
      .order("clock_in", { ascending: false });
    const rows = (data || []) as TimesheetEntry[];
    setAllEntries(rows);

    const ids = Array.from(new Set(rows.map(r => r.user_id)));
    if (ids.length) {
      const { data: users } = await supabase
        .from("users")
        .select("id, display_name")
        .in("id", ids);
      const map: Record<string, string> = {};
      (users as StaffName[] | null)?.forEach(u => { map[u.id] = u.display_name; });
      setStaffMap(map);
    } else {
      setStaffMap({});
    }
  };

  useEffect(() => { loadMy(); loadAll(); /* eslint-disable-next-line */ }, [currentUserId, siteId, weekOffset, role.isSupervisorPlus]);

  // Realtime updates for this site's entries
  useEffect(() => {
    if (!siteId) return;
    const ch = supabase
      .channel(`timesheets-${siteId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "timesheet_entries", filter: `site_id=eq.${siteId}` }, () => {
        loadMy();
        loadAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [siteId, weekStart.getTime()]);

  const isClockedIn = !!openEntry;
  const totalWeekHours = myEntries.reduce((sum, e) => sum + (calcHours(e.clock_in, e.clock_out, e.break_minutes) || 0), 0);

  const handleClockIn = async () => {
    if (!currentUserId || !siteId || !orgId) {
      toast.error("Missing site or user context");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("timesheet_entries").insert({
      site_id: siteId,
      organisation_id: orgId,
      user_id: currentUserId,
      clock_in: new Date().toISOString(),
      break_minutes: 0,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Clocked in");
    setShowClockIn(false);
    loadMy();
  };

  const handleClockOut = async () => {
    if (!openEntry) return;
    const breaks = Math.max(0, parseInt(breakMins || "0", 10) || 0);
    setLoading(true);
    const { error } = await supabase
      .from("timesheet_entries")
      .update({ clock_out: new Date().toISOString(), break_minutes: breaks })
      .eq("id", openEntry.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Clocked out");
    setShowClockOut(false);
    setBreakMins("0");
    loadMy();
  };

  const handleApprove = async (entry: TimesheetEntry) => {
    if (!currentUserId) return;
    const { error } = await supabase
      .from("timesheet_entries")
      .update({ approved_by: currentUserId, approved_at: new Date().toISOString() })
      .eq("id", entry.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Approved");
    loadAll();
  };

  const handleExport = async () => {
    if (!siteId || !orgId || !currentUserId) return;
    const rows = allEntries.length ? allEntries : myEntries;
    if (!rows.length) {
      toast.info("No entries to export this week");
      return;
    }
    const header = ["Date", "Staff", "Clock In", "Clock Out", "Break (mins)", "Hours", "Approved"];
    const body = rows.map(e => {
      const hrs = calcHours(e.clock_in, e.clock_out, e.break_minutes);
      return [
        new Date(e.clock_in).toLocaleDateString("en-GB"),
        staffMap[e.user_id] || (e.user_id === currentUserId ? userName : e.user_id),
        formatTime(e.clock_in),
        e.clock_out ? formatTime(e.clock_out) : "",
        e.break_minutes,
        hrs !== null ? hrs.toFixed(2) : "",
        e.approved_by ? "Yes" : "No",
      ];
    });
    const csv = toCSV([header, ...body]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheets_${weekStart.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    const dateFrom = weekStart.toISOString().slice(0, 10);
    const dateTo = new Date(weekEnd.getTime() - 1).toISOString().slice(0, 10);
    await supabase.from("timesheet_export_logs").insert({
      site_id: siteId,
      organisation_id: orgId,
      exported_by: currentUserId,
      export_type: "csv",
      date_from: dateFrom,
      date_to: dateTo,
      record_count: rows.length,
    });
    toast.success(`Exported ${rows.length} entries`);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-heading text-2xl font-bold">Timesheets</h1>
            <p className="text-xs text-muted-foreground">{currentSite?.name || "Your site"}</p>
          </div>
        </div>
        {role.isSupervisorPlus && (
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Clock in / out bar */}
      <Card className={`border-2 ${isClockedIn ? "border-success/40 bg-success/5" : "border-primary/20"}`}>
        <CardContent className="py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isClockedIn ? "bg-success/10" : "bg-muted"}`}>
              <Timer className={`h-5 w-5 ${isClockedIn ? "text-success" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-semibold text-sm">{isClockedIn ? "You're clocked in" : "Not clocked in"}</p>
              <p className="text-xs text-muted-foreground">
                {userName}{openEntry ? ` · since ${formatTime(openEntry.clock_in)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!isClockedIn ? (
              <Button size="sm" onClick={() => setShowClockIn(true)} disabled={!siteId}>
                <Plus className="h-4 w-4 mr-1" /> Clock In
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowClockOut(true)}>
                Clock Out
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Week summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Week Summary
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-1 min-w-[140px] text-center">{weekLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {myEntries.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No timesheet entries this week.</p>
              <p className="text-xs text-muted-foreground">Clock in to start tracking your hours.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myEntries.map(entry => {
                const hrs = calcHours(entry.clock_in, entry.clock_out, entry.break_minutes);
                return (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{formatDate(entry.clock_in)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(entry.clock_in)} – {entry.clock_out ? formatTime(entry.clock_out) : "Still clocked in"}
                        {entry.break_minutes > 0 && ` · ${entry.break_minutes}m break`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{hoursLabel(hrs)}</span>
                      {entry.approved_by ? (
                        <Badge className="bg-success/10 text-success border-0 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Pending</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between pt-2">
                <span className="text-sm text-muted-foreground">Total this week</span>
                <span className="text-sm font-bold">{hoursLabel(totalWeekHours)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manager view — all staff */}
      {role.isSupervisorPlus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              All Staff — This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allEntries.length === 0 ? (
              <div className="text-center py-6 space-y-1">
                <p className="text-sm text-muted-foreground">No staff entries for this week yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allEntries.map(entry => {
                  const hrs = calcHours(entry.clock_in, entry.clock_out, entry.break_minutes);
                  return (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium">{staffMap[entry.user_id] || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.clock_in)} · {formatTime(entry.clock_in)} – {entry.clock_out ? formatTime(entry.clock_out) : "Open"}
                          {entry.break_minutes > 0 && ` · ${entry.break_minutes}m break`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{hoursLabel(hrs)}</span>
                        {entry.approved_by ? (
                          <Badge className="bg-success/10 text-success border-0 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                          </Badge>
                        ) : entry.clock_out ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleApprove(entry)}>
                            Approve
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Open</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Clock In Dialog */}
      <Dialog open={showClockIn} onOpenChange={setShowClockIn}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clock In</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
            <p className="text-sm text-center text-muted-foreground">Clocking in as <strong>{userName}</strong></p>
            <Button className="w-full" onClick={handleClockIn} disabled={loading}>
              <Clock className="h-4 w-4 mr-2" /> Confirm Clock In
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clock Out Dialog */}
      <Dialog open={showClockOut} onOpenChange={setShowClockOut}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clock Out</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="break">Break taken (minutes)</Label>
              <Input
                id="break"
                type="number"
                min="0"
                max="120"
                value={breakMins}
                onChange={e => setBreakMins(e.target.value)}
                placeholder="0"
              />
            </div>
            <Button className="w-full" onClick={handleClockOut} disabled={loading}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Clock Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
