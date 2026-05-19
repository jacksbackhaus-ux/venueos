import { Thermometer } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { CollapsibleInsight } from "@/components/shared/CollapsibleInsight";

interface CachedAlert {
  id: string;
  narrative: string | null;
  generated_at: string;
  content: any;
}

export function EquipmentHealthAlert() {
  const { isActive } = useModuleAccess();
  const { currentSite } = useSite();
  const siteId = currentSite?.id ?? null;
  const queryClient = useQueryClient();

  const aiActive = isActive("ai_insights");

  const { data: alert, isLoading } = useQuery({
    queryKey: ["equipment-alert", siteId],
    enabled: !!siteId && aiActive,
    queryFn: async (): Promise<CachedAlert | null> => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("id, narrative, generated_at, content")
        .eq("site_id", siteId!)
        .eq("insight_type", "equipment_alert")
        .gt("valid_until", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CachedAlert | null;
    },
  });

  const detect = useMutation({
    mutationFn: async () => {
      if (!siteId) throw new Error("No site selected");
      const { data, error } = await supabase.functions.invoke(
        "detect-equipment-drift",
        { body: { site_id: siteId } },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-alert", siteId] });
    },
  });

  useEffect(() => {
    if (!aiActive || !siteId || isLoading) return;
    if (alert) return;
    if (detect.isPending || detect.isError) return;
    detect.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiActive, siteId, isLoading, alert]);

  if (!aiActive || !siteId) return null;

  const alerts = (alert?.content as any)?.alerts ?? [];
  if (!alert?.narrative || alerts.length === 0) return null;

  return (
    <CollapsibleInsight
      label="Equipment drift warning"
      hint={`${alerts.length} unit${alerts.length === 1 ? "" : "s"} need attention`}
      icon={<Thermometer className="h-4 w-4 text-warning" />}
      tone="warning"
      defaultOpen
    >
      <p className="text-sm whitespace-pre-wrap text-foreground">{alert.narrative}</p>
    </CollapsibleInsight>
  );
}
