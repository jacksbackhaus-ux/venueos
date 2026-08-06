import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  dateISO: string;
  label: string;
  saving?: boolean;
  onFinish: (notes: string) => void;
}

/**
 * Light bottom sheet that closes out a production day. Summary + optional
 * note + one button — never a full page, never a stacked modal.
 */
export function FinishProductionDaySheet({
  open, onOpenChange, siteId, dateISO, label, saving, onFinish,
}: Props) {
  const [notes, setNotes] = useState("");

  const { data: summary } = useQuery({
    queryKey: ["production-day-summary", siteId, dateISO],
    enabled: open,
    queryFn: async () => {
      const dayStart = `${dateISO}T00:00:00`;
      const dayEnd = `${dateISO}T23:59:59`;
      const [batches, temps, cleaning] = await Promise.all([
        supabase.from("batches").select("id", { count: "exact", head: true })
          .eq("site_id", siteId).gte("created_at", dayStart).lte("created_at", dayEnd),
        supabase.from("temp_logs").select("id", { count: "exact", head: true })
          .eq("site_id", siteId).gte("logged_at", dayStart).lte("logged_at", dayEnd),
        supabase.from("cleaning_logs").select("id", { count: "exact", head: true })
          .eq("site_id", siteId).eq("log_date", dateISO).eq("done", true),
      ]);
      return {
        batches: batches.count ?? 0,
        temps: temps.count ?? 0,
        cleaning: cleaning.count ?? 0,
      };
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Finish {label.toLowerCase()}</SheetTitle>
          <SheetDescription>Here's what you recorded today.</SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 py-4">
          {[
            { label: "Batches", value: summary?.batches },
            { label: "Temps", value: summary?.temps },
            { label: "Cleaning", value: summary?.cleaning },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-3 text-center">
              <p className="text-2xl font-heading font-bold tabular-nums">{s.value ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="pd-notes">Notes (optional)</Label>
          <Textarea
            id="pd-notes"
            rows={3}
            placeholder="Anything worth remembering about today"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <SheetFooter className="mt-4">
          <Button className="w-full" disabled={saving} onClick={() => onFinish(notes)}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Finish day
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
