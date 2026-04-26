import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowLeftRight, Check, X, Megaphone } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useShiftRequests, type ShiftRequest } from "@/hooks/useShiftHive";

interface UserMap { [id: string]: string }
interface ShiftDetail {
  id: string; user_id: string; shift_date: string; start_time: string; end_time: string;
}

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fmt = (t: string) => t.slice(0, 5);
const shiftHours = (s: string, e: string) => {
  const [sh, sm] = s.split(":").map(Number); const [eh, em] = e.split(":").map(Number);
  let h = (eh + em/60) - (sh + sm/60); if (h < 0) h += 24; return h;
};

export function ManagerApprovalCenter() {
  const { currentSite } = useSite();
  const { pendingManager, managerDecide } = useShiftRequests();
  const [users, setUsers] = useState<UserMap>({});
  const [shiftDetails, setShiftDetails] = useState<Record<string, ShiftDetail>>({});
  const [conflicts, setConflicts] = useState<Record<string, { exceeds48: boolean; clopen: boolean; weeklyHours: number }>>({});
  const [decisionFor, setDecisionFor] = useState<{ req: ShiftRequest; approve: boolean } | null>(null);
  const [note, setNote] = useState("");

  // Load user names + referenced shift details
  useEffect(() => {
    if (!currentSite?.id || pendingManager.length === 0) return;
    void (async () => {
      const userIds = new Set<string>();
      const shiftIds = new Set<string>();
      pendingManager.forEach(r => {
        userIds.add(r.requester_id);
        if (r.target_user_id) userIds.add(r.target_user_id);
        shiftIds.add(r.original_shift_id);
        if (r.target_shift_id) shiftIds.add(r.target_shift_id);
      });

      const [{ data: us }, { data: shifts }] = await Promise.all([
        supabase.from("users").select("id, display_name").in("id", Array.from(userIds)),
        supabase.from("rota_assignments").select("id, user_id, shift_date, start_time, end_time")
          .in("id", Array.from(shiftIds)),
      ]);

      const uMap: UserMap = {};
      (us ?? []).forEach(u => { uMap[u.id] = u.display_name; });
      setUsers(uMap);

      const sMap: Record<string, ShiftDetail> = {};
      (shifts ?? []).forEach(s => { sMap[s.id] = s as ShiftDetail; });
      setShiftDetails(sMap);

      // Compute conflicts for each request
      const cMap: Record<string, { exceeds48: boolean; clopen: boolean; weeklyHours: number }> = {};
      for (const r of pendingManager) {
        const newOwner = r.target_user_id;
        const sh = sMap[r.original_shift_id];
        if (!newOwner || !sh) continue;
        const date = new Date(`${sh.shift_date}T12:00:00`);
        const dow = (date.getDay() + 6) % 7;
        const ws = new Date(date); ws.setDate(date.getDate() - dow);
        const wsIso = ws.toISOString().slice(0, 10);
        const weIso = new Date(ws.getTime() + 7 * 86400000).toISOString().slice(0, 10);

        const { data: weekly } = await supabase.from("rota_assignments")
          .select("start_time, end_time, shift_date")
          .eq("site_id", currentSite.id).eq("user_id", newOwner)
          .gte("shift_date", wsIso).lt("shift_date", weIso).is("cancelled_at", null);

        const weeklyHours = (weekly ?? []).reduce((sum, s) => sum + shiftHours(s.start_time, s.end_time), 0);
        const newShiftHours = shiftHours(sh.start_time, sh.end_time);
        const exceeds48 = (weeklyHours + newShiftHours) > 48;

        // Clopen check
        const prevDay = new Date(date.getTime() - 86400000).toISOString().slice(0, 10);
        const nextDay = new Date(date.getTime() + 86400000).toISOString().slice(0, 10);
        const adjacent = (weekly ?? []).filter(s => s.shift_date === prevDay || s.shift_date === nextDay);
        const clopen = adjacent.some(s => {
          if (s.shift_date === prevDay) {
            const gap = (new Date(`${sh.shift_date}T${sh.start_time}`).getTime() - new Date(`${prevDay}T${s.end_time}`).getTime()) / 3600000;
            return gap < 11;
          } else {
            const gap = (new Date(`${nextDay}T${s.start_time}`).getTime() - new Date(`${sh.shift_date}T${sh.end_time}`).getTime()) / 3600000;
            return gap < 11;
          }
        });

        cMap[r.id] = { exceeds48, clopen, weeklyHours };
      }
      setConflicts(cMap);
    })();
  }, [currentSite?.id, pendingManager]);

  const submit = async () => {
    if (!decisionFor) return;
    await managerDecide(decisionFor.req, decisionFor.approve, note);
    setDecisionFor(null); setNote("");
  };

  if (pendingManager.length === 0) {
    return (
      <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
        No pending shift requests
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      {pendingManager.map(req => {
        const sh = shiftDetails[req.original_shift_id];
        const conf = conflicts[req.id];
        const requesterName = users[req.requester_id] ?? "Unknown";
        const targetName = req.target_user_id ? (users[req.target_user_id] ?? "Unknown") : "Open pool";
        return (
          <Card key={req.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {req.request_type === "swap" ? <ArrowLeftRight className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                    <p className="font-heading font-semibold capitalize">{req.request_type}</p>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{requesterName}</span>
                    {req.request_type === "swap" ? " ↔ " : " → "}
                    <span className="font-medium">{targetName}</span>
                  </p>
                  {sh && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(sh.shift_date)} · {fmt(sh.start_time)}–{fmt(sh.end_time)}
                    </p>
                  )}
                  {req.message && <p className="text-xs italic text-muted-foreground">"{req.message}"</p>}
                </div>
                <Badge variant="secondary">Pending</Badge>
              </div>

              {conf && (conf.exceeds48 || conf.clopen) && (
                <div className="space-y-1 p-2 rounded bg-destructive/10 border border-destructive/30">
                  {conf.exceeds48 && (
                    <p className="text-xs flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Will push {targetName} over 48h ({conf.weeklyHours.toFixed(1)}h current)
                    </p>
                  )}
                  {conf.clopen && (
                    <p className="text-xs flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Less than 11h rest between shifts (clopen conflict)
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setDecisionFor({ req, approve: false })}>
                  <X className="h-3.5 w-3.5 mr-1" /> Decline
                </Button>
                <Button size="sm" onClick={() => setDecisionFor({ req, approve: true })}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!decisionFor} onOpenChange={(o) => !o && setDecisionFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decisionFor?.approve ? "Approve request" : "Decline request"}</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Optional note for staff" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecisionFor(null)}>Cancel</Button>
            <Button onClick={submit} variant={decisionFor?.approve ? "default" : "destructive"}>
              {decisionFor?.approve ? "Approve" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
