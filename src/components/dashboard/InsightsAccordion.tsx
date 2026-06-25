import { showAIFeatures } from "@/lib/launchFlags";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { MorningBriefingCard } from "@/components/dashboard/MorningBriefingCard";
import { CollapsibleInsight } from "@/components/shared/CollapsibleInsight";

/**
 * Thin "Yesterday's summary — tap to expand" strip shown directly under
 * the Priority Feed. Contains the AI Morning Briefing without leading
 * with AI branding.
 */
export function InsightsAccordion() {
  if (!showAIFeatures) return null;
  const { isActive } = useModuleAccess();
  if (!isActive("ai_insights")) return null;

  return (
    <CollapsibleInsight label="Yesterday's summary" hint="tap to expand">
      <div className="space-y-3">
        <MorningBriefingCard />
        <Link
          to="/reports"
          className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 hover:border-primary/40 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Compliance assessment
          </span>
          <span className="text-xs text-muted-foreground">Open reports →</span>
        </Link>
      </div>
    </CollapsibleInsight>
  );
}
