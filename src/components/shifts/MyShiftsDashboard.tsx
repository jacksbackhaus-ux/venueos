import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, RefreshCw, UserCheck, ArrowLeftRight, Megaphone, ChevronRight, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useShiftRequests } from "@/hooks/useShiftHive";
import { toast } from "sonner";

interface MyShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  position: string | null;
  cancelled_at: string | null;
}

interface Teammate {
  id: string;
  display_name: string;
}

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fmtTime = (t: string) => t.slice(0, 5);
const shiftHours = (s: string, e: string) => {
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  let h = (eh + em / 60) - (sh + sm / 60);
  if (h < 0) h += 24;
  return Math.round(h * 10) / 10;
};

export function MyShiftsDashboard() {
  const { currentSite } = useSite();
  const { appUser } = useAuth();
  const [shifts, setShifts] = useState<MyShift[]>([]);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionShift, setActionShift] = useState<MyShift | null>(null);
  const [actionType, setActionType] = useState<"swap" | "cover" | null>(null);
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [openPool, setOpenPool] = useState(false);
  const [message, setMessage] = useState("");

  const { myRequests, incomingForMe, openCoverPool, createSwap, createCover, respondToSwap, claimCover, cancelRequest } = useShiftRequests();

  // Load my future shifts + teammates
  useEffect(() => {
    if (!currentSite?.id || !appUser?.id) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    void (async () => {
      setLoading(true);
      const [{ data: s }, { data: m }] = await Promise.all([
        supabase.from("rota_assignments").select("id,shift_date,start_time,end_time,position,cancelled_at")
          .eq("site_id", currentSite.id).eq("user_id", appUser.id)
          .gte("shift_date", todayIso).is("cancelled_at", null)
          .order("shift_date").order("start_time").limit(20),
        supabase.from("memberships")
          .select("user_id, users!inner(id, display_name, status)")
          .eq("site_id", currentSite.id).eq("active", true),
      ]);
      setShifts((s ?? []) as MyShift[]);
      const tm = (m ?? [])
        .map(r => (r.users as unknown) as Teammate & { status: string })
        .filter(u => u.status === "active" && u.id !== appUser.id)
        .map(u => ({ id: u.id, display_name: u.display_name }));
      setTeammates(tm);
      setLoading(false);
    })();
  }, [currentSite?.id, appUser?.id]);

  // This week hours
  const weeklyHours = useMemo(() => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7;
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - dow);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const wsIso = weekStart.toISOString().slice(0, 10);
    const weIso = weekEnd.toISOString().slice(0, 10);
    return shifts
      .filter(s => s.shift_date >= wsIso && s.shift_date <= weIso)
      .reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0);
  }, [shifts]);

  const openAction = (shift: MyShift, type: "swap" | "cover") => {
    setActionShift(shift); setActionType(type);
    setTargetUserId(""); setOpenPool(false); setMessage("");
  };

  const submitAction = async () => {
    if (!actionShift || !actionType) return;
    if (actionType === "swap") {
      if (!targetUserId) { toast.error("Choose a teammate"); return; }
      await createSwap({ originalShiftId: actionShift.id, targetUserId, message });
    } else {
      await createCover({
        originalShiftId: actionShift.id,
        targetUserId: openPool ? null : targetUserId || null,
        message,
      });
    }
    setActionShift(null);
  };

  const has48Warning = weeklyHours > 48;
  const predictabilityPct = Math.min(100, (weeklyHours / 48) * 100);

  return (
    <div className="space-y-6">
      {/* Predictability bar */}
      <Card className="border-primary/20">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-heading font-semibold">This week</p>
              <p className="text-sm text-muted-foreground">Working time visibility</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-heading font-bold">{weeklyHours.toFixed(1)}<span className="text-sm font-normal text-muted-foreground">/48h</span></p>
            </div>
          </div>
          <Progress value={predictabilityPct} className={has48Warning ? "[&>div]:bg-destructive" : ""} />
          {has48Warning && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              You're scheduled over the 48h weekly limit (Working Time Directive)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incoming swap requests targeting me */}
      {incomingForMe.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 space-y-3">
            <p className="font-heading font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" /> Swap requests for you
            </p>
            {incomingForMe.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded bg-background border">
                <div className="text-sm">
                  <p className="font-medium">{r.request_type === "swap" ? "Swap requested" : "Cover requested"}</p>
                  {r.message && <p className="text-muted-foreground">{r.message}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => respondToSwap(r.id, false)}>Decline</Button>
                  <Button size="sm" onClick={() => respondToSwap(r.id, true)}>Accept</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="my-shifts">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="my-shifts">My shifts</TabsTrigger>
          <TabsTrigger value="cover-pool">
            Cover pool {openCoverPool.length > 0 && <Badge variant="secondary" className="ml-1">{openCoverPool.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="my-requests">
            My requests {myRequests.filter(r => ["pending_teammate","pending_approval"].includes(r.status)).length > 0 && (
              <Badge variant="secondary" className="ml-1">{myRequests.filter(r => ["pending_teammate","pending_approval"].includes(r.status)).length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-shifts" className="space-y-3 mt-4">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>
          ) : shifts.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No upcoming shifts</CardContent></Card>
          ) : shifts.map(shift => {
            const pendingReq = myRequests.find(r => r.original_shift_id === shift.id && ["pending_teammate","pending_approval"].includes(r.status));
            const status = pendingReq
              ? (pendingReq.request_type === "swap" ? "swap_pending" : "cover_pending")
              : "confirmed";
            return (
              <Card key={shift.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p className="font-heading font-semibold">{formatDate(shift.shift_date)}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {fmtTime(shift.start_time)}–{fmtTime(shift.end_time)} · {shiftHours(shift.start_time, shift.end_time)}h
                        {shift.position && <span>· {shift.position}</span>}
                      </div>
                    </div>
                    {status === "swap_pending" && <Badge className="bg-warning text-warning-foreground">Swap pending</Badge>}
                    {status === "cover_pending" && <Badge variant="destructive">Cover requested</Badge>}
                    {status === "confirmed" && <Badge className="bg-success text-success-foreground">Confirmed</Badge>}
                  </div>

                  {pendingReq ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => cancelRequest(pendingReq.id)}>
                      Cancel request
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => openAction(shift, "swap")}>
                        <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Swap
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openAction(shift, "cover")}>
                        <Megaphone className="h-3.5 w-3.5 mr-1" /> Cover
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="cover-pool" className="space-y-3 mt-4">
          {openCoverPool.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No open shifts in the cover pool</CardContent></Card>
          ) : openCoverPool.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <p className="font-heading font-semibold">Open shift</p>
                {r.message && <p className="text-sm text-muted-foreground">{r.message}</p>}
                <Button size="sm" className="w-full" onClick={() => claimCover(r.id)}>
                  <UserCheck className="h-3.5 w-3.5 mr-1" /> Claim shift
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-3 mt-4">
          {myRequests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No requests yet</CardContent></Card>
          ) : myRequests.map(r => (
            <Card key={r.id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium capitalize">{r.request_type} request</p>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "declined" ? "destructive" : "secondary"}>
                    {r.status.replace("_", " ")}
                  </Badge>
                </div>
                {r.manager_note && <p className="text-xs text-muted-foreground">Manager: {r.manager_note}</p>}
                {["pending_teammate","pending_approval"].includes(r.status) && (
                  <Button size="sm" variant="ghost" className="w-full mt-1" onClick={() => cancelRequest(r.id)}>
                    Cancel
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Action dialog */}
      <Dialog open={!!actionShift} onOpenChange={(o) => !o && setActionShift(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === "swap" ? "Request swap" : "Find cover"}</DialogTitle>
            <DialogDescription>
              {actionShift && `${formatDate(actionShift.shift_date)} · ${fmtTime(actionShift.start_time)}–${fmtTime(actionShift.end_time)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {actionType === "cover" && (
              <div className="flex items-start gap-2 p-3 rounded border">
                <input type="checkbox" id="open-pool" checked={openPool} onChange={(e) => setOpenPool(e.target.checked)} className="mt-1" />
                <label htmlFor="open-pool" className="text-sm">
                  <span className="font-medium">Post to cover pool</span>
                  <span className="block text-muted-foreground text-xs">Anyone eligible can claim. Manager still approves.</span>
                </label>
              </div>
            )}
            {!openPool && (
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger><SelectValue placeholder={actionType === "swap" ? "Choose a teammate to swap with" : "Choose someone (optional)"} /></SelectTrigger>
                <SelectContent>
                  {teammates.map(t => <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Textarea placeholder="Optional message" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionShift(null)}>Cancel</Button>
            <Button onClick={submitAction}>Send request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
