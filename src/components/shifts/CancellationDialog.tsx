import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { previewCompensation, cancelShiftWithReason } from "@/hooks/useShiftHive";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shift: {
    id: string;
    user_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
  } | null;
  onCancelled?: () => void;
}

export function CancellationDialog({ open, onOpenChange, shift, onCancelled }: Props) {
  const { appUser } = useAuth();
  const { currentSite } = useSite();
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewCompensation>> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !shift || !currentSite) return;
    setReason("");
    void previewCompensation({
      siteId: currentSite.id, userId: shift.user_id,
      shiftDate: shift.shift_date, startTime: shift.start_time, endTime: shift.end_time,
    }).then(setPreview);
  }, [open, shift, currentSite]);

  const submit = async () => {
    if (!shift || !appUser?.id) return;
    setBusy(true);
    const ok = await cancelShiftWithReason({ shiftId: shift.id, reason, userId: appUser.id });
    setBusy(false);
    if (ok) { onOpenChange(false); onCancelled?.(); }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel shift</AlertDialogTitle>
          <AlertDialogDescription>
            This action is logged for compliance with the Employment Rights Bill 2025-26.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {preview && (
          <div className={`rounded p-3 border space-y-2 ${preview.isLate ? "bg-destructive/10 border-destructive/30" : "bg-muted/30"}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Notice given</span>
              <Badge variant={preview.isLate ? "destructive" : "secondary"}>{preview.hoursUntil}h</Badge>
            </div>
            {preview.isLate ? (
              <>
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Late cancellation. Compensation of <strong>£{preview.amount.toFixed(2)}</strong> will be auto-logged
                    ({preview.pct}% of {preview.shiftHours}h × £{preview.hourlyRate.toFixed(2)}/h).
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Outside the {preview.shortNoticeHours}h short-notice window — no compensation owed.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Reason for cancellation</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. site closure, sickness cover already arranged…" />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep shift</AlertDialogCancel>
          <AlertDialogAction onClick={submit} disabled={busy} className="bg-destructive hover:bg-destructive/90">
            {busy ? "Cancelling…" : "Confirm cancellation"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
