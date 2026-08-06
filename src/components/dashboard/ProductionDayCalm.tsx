import { useState } from "react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { CalendarPlus, ChevronRight, CircleDot, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import type { ProductionDayRow } from "@/hooks/useProductionDay";

interface Props {
  /** Recent production days, newest first. */
  days: ProductionDayRow[];
  loading?: boolean;
  starting?: boolean;
  /** One tap — no modal, no confirmation. */
  onStart: () => void;
  /** Retrospective: log a production day that already happened. */
  onLogPastDay: (dateISO: string) => void;
  /** Jump the dashboard to a past production day. */
  onOpenDay: (dateISO: string) => void;
  todayISO: string;
  minDateISO?: string;
  label: string;
  canWrite: boolean;
}

function pretty(dateISO: string) {
  try {
    return format(parseISO(dateISO), "EEEE d MMMM");
  } catch {
    return dateISO;
  }
}

/**
 * Calm, quiet dashboard state for on-demand sites on a day with no declared
 * production. One primary button. No score, no warnings, no missed tasks.
 */
export function ProductionDayCalm({
  days, loading, starting, onStart, onLogPastDay, onOpenDay,
  todayISO, minDateISO, label, canWrite,
}: Props) {
  const [pastOpen, setPastOpen] = useState(false);
  const [pastDate, setPastDate] = useState("");

  const last = days[0];
  const recent = days.slice(0, 5);
  const unfinished = days.find((d) => !d.completed_at && d.production_date !== todayISO);

  const submitPast = () => {
    if (!pastDate) {
      toast.error("Pick the date you worked.");
      return;
    }
    if (pastDate > todayISO) {
      toast.error("That date is in the future.");
      return;
    }
    if (days.some((d) => d.production_date === pastDate)) {
      toast.error("That day is already logged.");
      setPastOpen(false);
      onOpenDay(pastDate);
      return;
    }
    onLogPastDay(pastDate);
    setPastOpen(false);
    setPastDate("");
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          No {label.toLowerCase()} today
        </p>
        <Button
          size="lg"
          className="mt-4 w-full h-14 text-base font-semibold rounded-xl"
          onClick={onStart}
          disabled={!canWrite || starting}
        >
          {starting ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Play className="h-5 w-5 mr-2" />}
          Start a {label.toLowerCase()}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          {loading
            ? "\u00a0"
            : last
              ? `Last ${label.toLowerCase()}: ${pretty(last.production_date)}`
              : "Tap when you start work — nothing is tracked until you do."}
        </p>
      </div>

      {unfinished && (
        <Card className="p-4 flex items-center gap-3">
          <CircleDot className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm flex-1 min-w-0">
            You have an unfinished {label.toLowerCase()} from {pretty(unfinished.production_date)}.
          </p>
          <Button size="sm" variant="outline" onClick={() => onOpenDay(unfinished.production_date)}>
            Open
          </Button>
        </Card>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent {label.toLowerCase()}s
          </h2>
          {canWrite && (
            <button
              type="button"
              onClick={() => setPastOpen(true)}
              className="text-xs font-medium text-primary hover:underline underline-offset-2 inline-flex items-center gap-1"
            >
              <CalendarPlus className="h-3.5 w-3.5" /> Log a past day
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            Nothing logged yet.
          </Card>
        ) : (
          <Card className="divide-y overflow-hidden">
            {recent.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onOpenDay(d.production_date)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{pretty(d.production_date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.completed_at ? "Finished" : "Not finished"}
                    {d.is_retrospective ? " · logged later" : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </Card>
        )}
      </section>

      <Sheet open={pastOpen} onOpenChange={setPastOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Log a past {label.toLowerCase()}</SheetTitle>
            <SheetDescription>
              Pick the date you worked. Records you add will show the real date you
              entered them, so your audit trail stays honest.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="past-date">Date</Label>
            <Input
              id="past-date"
              type="date"
              value={pastDate}
              max={todayISO}
              min={minDateISO}
              onChange={(e) => setPastDate(e.target.value)}
            />
          </div>
          <SheetFooter>
            <Button onClick={submitPast} className="w-full">Log this day</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </motion.section>
  );
}
