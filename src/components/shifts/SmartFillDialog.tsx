import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle, Check } from "lucide-react";
import { findSmartFillCandidates, type SmartFillCandidate } from "@/hooks/useShiftHive";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  siteId: string;
  shift: { shift_date: string; start_time: string; end_time: string } | null;
  excludeUserIds?: string[];
  onPick: (userId: string) => void;
}

export function SmartFillDialog({ open, onOpenChange, siteId, shift, excludeUserIds, onPick }: Props) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<SmartFillCandidate[]>([]);

  useEffect(() => {
    if (!open || !shift) return;
    setLoading(true);
    findSmartFillCandidates({
      siteId,
      shiftDate: shift.shift_date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      excludeUserIds,
    })
      .then(setCandidates)
      .finally(() => setLoading(false));
  }, [open, shift, siteId, excludeUserIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Fill suggestions
          </DialogTitle>
          <DialogDescription>
            Ranked by availability, weekly hours, and rest-time compliance.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No eligible candidates found for this shift.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <button
                key={c.user_id}
                onClick={() => { onPick(c.user_id); onOpenChange(false); }}
                className="w-full text-left rounded-lg border p-3 hover:bg-muted/40 transition"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium">{c.display_name}</span>
                  <Badge variant="secondary" className="text-[10px]">Score {c.score}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {c.available ? (
                    <Badge variant="outline" className="gap-1 border-green-500/40 text-green-700 dark:text-green-400">
                      <Check className="h-3 w-3" /> Available
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">No availability set</Badge>
                  )}
                  <Badge variant="outline">{c.weekly_hours}h this week</Badge>
                  {c.exceeds_48h && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Exceeds 48h
                    </Badge>
                  )}
                  {c.has_clopen && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Clopen (&lt;11h rest)
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
