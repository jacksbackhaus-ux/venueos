import { AlertTriangle } from "lucide-react";

interface Props {
  date: string;
  className?: string;
}

/** Amber banner shown when a manager is editing a past day. */
export function RetrospectiveBanner({ date, className = "" }: Props) {
  const formatted = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-warning bg-warning/10 px-4 py-3 text-warning-foreground ${className}`}
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-warning" />
      <div className="text-sm">
        <p className="font-semibold text-foreground">Retrospective edit mode</p>
        <p className="text-muted-foreground">
          You are editing records for <span className="font-medium text-foreground">{formatted}</span>.
          Every change will be tagged as retrospective and recorded in the audit trail.
        </p>
      </div>
    </div>
  );
}
