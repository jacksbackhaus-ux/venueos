import { useState } from "react";
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
import { toast } from "sonner";

type TimesheetEntry = {
  id: string;
  user_id: string;
  display_name: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number | null;
  approved_by: string | null;
  date: string;
};

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
  if (h === null) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

const MOCK_ENTRIES: TimesheetEntry[] = [];

export default function Timesheets() {
  const { appUser, staffSession } = useAuth();
  const { currentSite } = useSite();
  const role = useRole();

  const userName = appUser?.display_name || staffSession?.display_name || "You";
  const [entries] = useState<TimesheetEntry[]>(MOCK_ENTRIES);
  const [showClockIn, setShowClockIn] = useState(false);
  const [showClockOut, setShowClockOut] = useState(false);
  const [breakMins, setBreakMins] = useState("0");
  const [weekOffset, setWeekOffset] = useState(0);

  // Week navigation
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  const isClockedIn = false; // will be wired to DB tomorrow
  const totalWeekHours = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0);

  const handleClockIn = () => {
    toast.success("Clock-in recorded! (Database coming soon)");
    setShowClockIn(false);
  };

  const handleClockOut = () => {
    toast.success("Clock-out recorded! (Database coming soon)");
    setShowClockOut(false);
  };

  const handleExport = () => {
    toast.info("CSV export will be available once the database is connected.");
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
              <p className="text-xs text-muted-foreground">{userName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {!isClockedIn ? (
              <Button size="sm" onClick={() => setShowClockIn(true)}>
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
          {entries.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No timesheet entries this week.</p>
              <p className="text-xs text-muted-foreground">Clock in to start tracking your hours.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{formatDate(entry.clock_in)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(entry.clock_in)} – {entry.clock_out ? formatTime(entry.clock_out) : "Still clocked in"}
                      {entry.break_minutes > 0 && ` · ${entry.break_minutes}m break`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{hoursLabel(entry.total_hours)}</span>
                    {entry.approved_by ? (
                      <Badge className="bg-success/10 text-success border-0 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Pending</Badge>
                    )}
                  </div>
                </div>
              ))}
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
            <div className="text-center py-6 space-y-1">
              <p className="text-sm text-muted-foreground">Staff timesheets will appear here once the database is connected.</p>
              <p className="text-xs text-muted-foreground">You'll be able to approve, query, and export from this view.</p>
            </div>
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
            <Button className="w-full" onClick={handleClockIn}>
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
            <Button className="w-full" onClick={handleClockOut}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Clock Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
