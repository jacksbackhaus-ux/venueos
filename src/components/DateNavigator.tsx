import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DateNavigatorProps {
  selectedDate: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  className?: string;
}

const todayString = () => new Date().toISOString().slice(0, 10);

const formatLong = (dateStr: string, withYear: boolean) =>
  new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });

/**
 * Reusable date navigator: ◀ [date] ▶  Used on Dashboard, Day Sheet,
 * Temperature Tracking, and Cleaning to scope a view to a chosen day.
 * - Right arrow disabled when viewing today (no future navigation).
 * - "Jump to today" link appears when viewing a past day.
 */
export function DateNavigator({ selectedDate, onChange, className = "" }: DateNavigatorProps) {
  const todayStr = todayString();
  const isToday = selectedDate === todayStr;
  const dateStr = formatLong(selectedDate, !isToday);

  const shift = (days: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    const next = d.toISOString().slice(0, 10);
    if (next > todayStr) return;
    onChange(next);
  };

  return (
    <div
      className={`flex items-center justify-between rounded-lg border bg-card px-2 py-1.5 ${className}`}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => shift(-1)}
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span>{isToday ? "Today" : dateStr}</span>
        {!isToday && (
          <button
            type="button"
            onClick={() => onChange(todayStr)}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Jump to today
          </button>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => shift(1)}
        disabled={isToday}
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
