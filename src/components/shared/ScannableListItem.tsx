import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScannableListItemProps {
  /** Small icon shown on the left (lucide icon or any node). */
  icon?: ReactNode;
  /** Bold subject line — the item's identity (e.g. product name). */
  subject: ReactNode;
  /** Big right-aligned figure or status badge (e.g. "92%", a margin badge). */
  primary?: ReactNode;
  /** One muted line of metadata under the subject — max ~60 chars. */
  metadata?: ReactNode;
  /** Optional single secondary action (icon-only) shown far right. */
  trailing?: ReactNode;
  /** Optional click handler to make the whole row tappable. */
  onClick?: () => void;
  /** Visual tone — used for breach/warning bands. */
  tone?: "neutral" | "warning" | "breach" | "success";
  className?: string;
}

/**
 * Phase 4 list primitive. One line of bold subject + one muted line of
 * metadata + a single right-side primary signal. Max 3 lines of text,
 * everything else expressed via colour and badges.
 */
export function ScannableListItem({
  icon,
  subject,
  primary,
  metadata,
  trailing,
  onClick,
  tone = "neutral",
  className,
}: ScannableListItemProps) {
  const toneClass =
    tone === "breach"
      ? "border-breach/30"
      : tone === "warning"
        ? "border-warning/30"
        : tone === "success"
          ? "border-success/30"
          : "";

  const interactive = onClick
    ? "cursor-pointer hover:bg-muted/40 active:bg-muted/60 transition-colors"
    : "";

  return (
    <Card
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5",
        toneClass,
        interactive,
        className,
      )}
    >
      {icon && <div className="shrink-0 text-muted-foreground">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground truncate">{subject}</div>
        {metadata && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">{metadata}</div>
        )}
      </div>
      {primary && <div className="shrink-0 text-right">{primary}</div>}
      {trailing && <div className="shrink-0">{trailing}</div>}
    </Card>
  );
}
