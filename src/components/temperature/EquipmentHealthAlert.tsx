import { motion } from "framer-motion";
import { Thermometer, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useEffect, useState } from "react";

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
  const [dismissed, setDismissed] = useState(false);

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

  if (!aiActive || !siteId || dismissed) return null;

  const alerts = (alert?.content as any)?.alerts ?? [];
  if (!alert?.narrative || alerts.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-warning/30 bg-warning/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Thermometer className="h-4 w-4 text-warning" />
            Equipment Health Alert
            <Sparkles className="h-3.5 w-3.5 text-warning/70" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap text-foreground">{alert.narrative}</p>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">AI-generated</p>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} className="h-7 px-2 text-xs">
              Dismiss
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
