import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useStaffAvailability } from "@/hooks/useShiftHive";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function AvailabilityEditor() {
  const { windows, addWindow, deleteWindow, loading } = useStaffAvailability();
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  const submit = async () => {
    if (start >= end) return;
    await addWindow({ day_of_week: Number(day), start_time: start, end_time: end });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="font-heading font-semibold text-sm">Add availability window</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={submit} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add window
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {loading ? <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
        : windows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No availability set yet. Add windows so managers can Smart Fill open shifts.</p>
        : windows.map(w => (
          <Card key={w.id}><CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{DAYS[w.day_of_week]}</Badge>
              <span className="text-sm">{w.start_time.slice(0,5)}–{w.end_time.slice(0,5)}</span>
            </div>
            <Button size="icon" variant="ghost" onClick={() => deleteWindow(w.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
