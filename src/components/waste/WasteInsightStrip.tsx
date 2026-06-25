import { showAIFeatures } from "@/lib/launchFlags";
import { Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { CollapsibleInsight } from "@/components/shared/CollapsibleInsight";

interface CachedInsight {
  id: string;
  narrative: string | null;
  generated_at: string;
}

/**
 * Inline waste insight strip. Stays hidden unless a cached insight row exists
 * — keeps AI invisible by default per Phase 3.
 */
export function WasteInsightStrip() {
  if (!showAIFeatures) return null;
  const { isActive } = useModuleAccess();
  const { currentSite } = useSite();
  const siteId = currentSite?.id ?? null;
  const aiActive = isActive("ai_insights");

  const { data: insight } = useQuery({
    queryKey: ["waste-insight", siteId],
    enabled: !!siteId && aiActive,
    queryFn: async (): Promise<CachedInsight | null> => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("id, narrative, generated_at")
        .eq("site_id", siteId!)
        .eq("insight_type", "waste_insight")
        .gt("valid_until", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CachedInsight | null;
    },
  });

  if (!aiActive || !siteId || !insight?.narrative) return null;

  return (
    <CollapsibleInsight
      label="Waste insight"
      hint="this week's pattern"
      icon={<Trash2 className="h-4 w-4 text-muted-foreground" />}
    >
      <p className="text-sm whitespace-pre-wrap text-foreground">{insight.narrative}</p>
    </CollapsibleInsight>
  );
}
