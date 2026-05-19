import { useState, type ReactNode } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

interface CollapsibleInsightProps {
  /** Short label, e.g. "Yesterday's summary" */
  label: string;
  /** Optional one-line hint shown next to the label when collapsed */
  hint?: string;
  /** Defaults to false (collapsed). Set true if the body contains a warning the user must see. */
  defaultOpen?: boolean;
  /** Optional override icon */
  icon?: ReactNode;
  /** Tone — adjusts subtle background/border */
  tone?: "neutral" | "warning" | "primary";
  children: ReactNode;
}

/**
 * Shared wrapper that makes AI/derived insights feel invisible by default:
 * a thin strip that the operator can expand on demand. The strip itself
 * has no AI branding beyond a small sparkle icon.
 */
export function CollapsibleInsight({
  label,
  hint,
  defaultOpen = false,
  icon,
  tone = "neutral",
  children,
}: CollapsibleInsightProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toneClass =
    tone === "warning"
      ? "border-warning/30 bg-warning/5"
      : tone === "primary"
        ? "border-primary/20 bg-primary/5"
        : "";

  return (
    <Card className={`overflow-hidden ${toneClass}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium min-w-0">
          {icon ?? <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="truncate">{label}</span>
          {hint && (
            <span className="text-xs font-normal text-muted-foreground truncate hidden sm:inline">
              · {hint}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t bg-background/40 px-3 py-3">{children}</div>}
    </Card>
  );
}
