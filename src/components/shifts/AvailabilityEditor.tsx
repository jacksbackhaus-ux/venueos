import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Info, Lock } from "lucide-react";
import { useStaffAvailability } from "@/hooks/useShiftHive";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { supabase } from "@/integrations/supabase/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type StaffOption = { id: string; display_name: string };

export function AvailabilityEditor() {
  const { isSupervisorPlus } = useRole();
  const { appUser } = useAuth();
  const { currentSite } = useSite();

  // Manager-only: pick a staff member. Staff: locked to themselves.
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    appUser?.id ?? null,
  );

  useEffect(() => {
    if (!isSupervisorPlus || !currentSite) return;
    void (async () => {
      const { data } = await supabase
        .from("memberships")
        .select("user_id, users:user_id(id, display_name, status)")
        .eq("site_id", currentSite.id)
        .eq("active", true);
      const list: StaffOption[] = (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((m: any) => m.users)
        .filter((u: any) => u && u.status === "active")
        .map((u: any) => ({ id: u.id, display_name: u.display_name }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name));
      setStaff(list);
      if (!selectedUserId && list.length) setSelectedUserId(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupervisorPlus, currentSite?.id]);

  const targetUserId = isSupervisorPlus ? selectedUserId : appUser?.id ?? null;
  const { windows, addWindow, deleteWindow, loading } = useStaffAvailability(
    targetUserId ?? undefined,
  );

  const [day, setDay] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  const selectedName = useMemo(() => {
    if (!isSupervisorPlus) return appUser?.display_name ?? "You";
    return staff.find((s) => s.id === selectedUserId)?.display_name ?? "—";
  }, [isSupervisorPlus, appUser, staff, selectedUserId]);

  const submit = async () => {
    if (start >= end) return;
    await addWindow({ day_of_week: Number(day), start_time: start, end_time: end });
  };

  // ---------- STAFF: read-only view ----------
  if (!isSupervisorPlus) {
    return (
      <div className="space-y-4">
        <Card className="border-border bg-muted/40">
          <CardContent className="p-4 flex items-start gap-3">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Your availability is set by your manager
              </p>
              <p className="mt-1">
                If anything below is wrong or your availability has changed, please
                speak to your manager and they'll update it for you.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
          ) : windows.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground text-center">
                No availability has been set yet.
              </CardContent>
            </Card>
          ) : (
            windows.map((w) => (
              <Card key={w.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{DAYS[w.day_of_week]}</Badge>
                    <span className="text-sm">
                      {w.start_time.slice(0, 5)}–{w.end_time.slice(0, 5)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  // ---------- MANAGER: edit any staff member's availability ----------
  return (
    <div className="space-y-4">
      <Card className="border-border bg-muted/40">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Availability is manager-managed. Set the days and times each team member
            is available to work — Smart Rota and Smart Fill will only schedule
            people inside these windows.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Team member</Label>
            <Select
              value={selectedUserId ?? ""}
              onValueChange={(v) => setSelectedUserId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-heading font-semibold text-sm">
            Add a window for {selectedName}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={submit}
            className="w-full"
            disabled={!targetUserId}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add window
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
        ) : windows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No availability set for {selectedName} yet.
          </p>
        ) : (
          windows.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{DAYS[w.day_of_week]}</Badge>
                  <span className="text-sm">
                    {w.start_time.slice(0, 5)}–{w.end_time.slice(0, 5)}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteWindow(w.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
