import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { ChevronDown, Sparkles, FileText } from "lucide-react";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { MorningBriefingCard } from "@/components/dashboard/MorningBriefingCard";

export function InsightsAccordion() {
  const { isActive } = useModuleAccess();
  const [open, setOpen] = useState(false);

  if (!isActive("ai_insights")) return null;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Insights <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t bg-muted/20 px-3 py-3 space-y-3">
          <MorningBriefingCard />
          <Link to="/reports" className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 hover:border-primary/40 transition-colors">
            <span className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Compliance assessment
            </span>
            <span className="text-xs text-muted-foreground">Open reports →</span>
          </Link>
        </div>
      )}
    </Card>
  );
}
