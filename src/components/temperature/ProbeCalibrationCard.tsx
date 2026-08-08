/**
 * Probe calibration ("prove it") — lives inside the Temperatures module.
 * Recommended monthly; the reminder is a single dismissible line, never a
 * failure state.
 */

import { useState } from "react";
import { Gauge, Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useProbeCalibrations } from "@/hooks/useSfbb";
import { probeCalibrationPass } from "@/lib/sfbb";
import { promptDismissed, dismissPrompt } from "@/lib/premises";
import { useSite } from "@/contexts/SiteContext";

export function ProbeCalibrationCard({ readOnly }: { readOnly?: boolean }) {
  const { currentSite } = useSite();
  const siteId = currentSite?.id ?? "";
  const { calibrations, isLoading, latest, dueThisMonth, log } = useProbeCalibrations();
  const [open, setOpen] = useState(false);
  const [probeName, setProbeName] = useState("");
  const [iced, setIced] = useState("");
  const [boiling, setBoiling] = useState("");
  const [notes, setNotes] = useState("");
  const [hidePrompt, setHidePrompt] = useState(() => promptDismissed("probe_cal", siteId));

  const icedNum = parseFloat(iced);
  const boilNum = parseFloat(boiling);
  const valid = !isNaN(icedNum) && !isNaN(boilNum);
  const willPass = valid && probeCalibrationPass(icedNum, boilNum);

  async function submit() {
    try {
      await log.mutateAsync({ probe_name: probeName, iced: icedNum, boiling: boilNum, notes });
      toast.success(willPass ? "Calibration recorded — probe passed." : "Calibration recorded — probe failed.");
      setOpen(false);
      setProbeName(""); setIced(""); setBoiling(""); setNotes("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the calibration.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" /> Probe calibration
          </CardTitle>
          {latest && (
            <Badge variant="outline" className={latest.pass
              ? "bg-success/10 text-success border-success/30"
              : "bg-destructive/10 text-destructive border-destructive/30"}>
              {latest.pass ? "Last check passed" : "Last check failed"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {dueThisMonth && !hidePrompt && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-dashed p-3">
            <p className="text-xs text-muted-foreground flex-1">
              A monthly probe check is recommended — iced water should read 0°C and boiling water 100°C.
            </p>
            <button
              aria-label="Dismiss reminder"
              onClick={() => { dismissPrompt("probe_cal", siteId); setHidePrompt(true); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!readOnly && (
          <Button size="sm" onClick={() => setOpen(true)}>Log calibration</Button>
        )}

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : calibrations.length === 0 ? (
          <p className="text-xs text-muted-foreground">No calibrations recorded yet.</p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {calibrations.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                {c.pass
                  ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                <span className="flex-1 min-w-0 truncate">
                  {c.probe_name ?? "Probe"} · {c.iced_water_reading}°C / {c.boiling_water_reading}°C
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(c.calibrated_at).toLocaleDateString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Log probe calibration</DialogTitle>
            <DialogDescription>
              Iced water should read between -1°C and 1°C. Boiling water between 99°C and 101°C.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Probe name (optional)</Label>
              <Input value={probeName} onChange={(e) => setProbeName(e.target.value)} placeholder="Kitchen probe" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Iced water °C</Label>
                <Input type="number" inputMode="decimal" value={iced} onChange={(e) => setIced(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Boiling water °C</Label>
                <Input type="number" inputMode="decimal" value={boiling} onChange={(e) => setBoiling(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {valid && (
              <p className={`text-xs font-medium ${willPass ? "text-success" : "text-destructive"}`}>
                {willPass ? "Within tolerance — probe passes." : "Outside tolerance — probe fails. Replace or recalibrate it."}
              </p>
            )}
            <Button className="w-full" disabled={!valid || log.isPending} onClick={submit}>
              {log.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
