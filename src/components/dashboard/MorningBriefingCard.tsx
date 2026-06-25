import { showAIFeatures } from "@/lib/launchFlags";
import { motion } from "framer-motion";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { toast } from "sonner";
import { useEffect } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35 },
  }),
};

interface CachedBriefing {
  id: string;
  narrative: string | null;
  generated_at: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function MorningBriefingCard() {
  if (!showAIFeatures) return null;
  const { isActive } = useModuleAccess();
  const { currentSite } = useSite();
  const siteId = currentSite?.id ?? null;
  const queryClient = useQueryClient();

  const aiActive = isActive("ai_insights");

  const { data: briefing, isLoading } = useQuery({
    queryKey: ["morning-briefing", siteId],
    enabled: !!siteId && aiActive,
    queryFn: async (): Promise<CachedBriefing | null> => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("id, narrative, generated_at")
        .eq("site_id", siteId!)
        .eq("insight_type", "morning_briefing")
        .gt("valid_until", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CachedBriefing | null;
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!siteId) throw new Error("No site selected");
      const { data, error } = await supabase.functions.invoke(
        "generate-morning-briefing",
        { body: { site_id: siteId } },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["morning-briefing", siteId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to generate briefing";
      toast.error(msg);
    },
  });

  // Auto-generate when no cached briefing exists
  useEffect(() => {
    if (!aiActive || !siteId || isLoading) return;
    if (briefing?.narrative) return;
    if (generate.isPending || generate.isError) return;
    generate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiActive, siteId, isLoading, briefing?.narrative]);

  const regenerate = async () => {
    if (!siteId) return;
    if (briefing?.id) {
  if (!showAIFeatures) return null;
      await supabase.from("ai_insights").delete().eq("id", briefing.id);
    }
    queryClient.invalidateQueries({ queryKey: ["morning-briefing", siteId] });
    generate.mutate();
  };

  if (!aiActive || !siteId) return null;

  const showLoading = isLoading || (generate.isPending && !briefing?.narrative);
  const showError = generate.isError && !briefing?.narrative;

  return (
    <motion.div initial="hidden" animate="visible" custom={0.75} variants={fadeUp}>
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Morning Briefing
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating your morning briefing...
            </div>
          ) : showError ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Briefing unavailable right now</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
              >
                Try again
              </Button>
            </div>
          ) : briefing?.narrative ? (
            <>
              <p className="text-sm whitespace-pre-wrap text-foreground">
                {briefing.narrative}
              </p>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-muted-foreground">
                  AI-generated · {formatTime(briefing.generated_at)}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={regenerate}
                  disabled={generate.isPending}
                  className="h-7 px-2"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${generate.isPending ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
