import { showAIFeatures } from "@/lib/launchFlags";
// Cashflow AI insights — Intelligence tier only.
// Server-side gating is enforced by the edge function.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function CashflowInsightsCard({ siteId, period }: { siteId: string; period: string }) {
  if (!showAIFeatures) return null;
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["cashflow-insight", siteId, period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-cashflow-insights", {
        body: { site_id: siteId, period },
      });
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const regen = useMutation({
    mutationFn: async () => {
      await supabase.from("ai_insights")
        .delete().eq("site_id", siteId).eq("insight_type", "cashflow_insights");
      const { data, error } = await supabase.functions.invoke("generate-cashflow-insights", {
        body: { site_id: siteId, period, force: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cashflow-insight", siteId] }),
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const narrative: string = (q.data as any)?.narrative || "";

  return (
    <Card className="bg-muted/40">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/70 rounded-md">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI insights</span>
              {q.isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {q.error ? (
              <p className="text-xs text-muted-foreground">
                Insights unavailable. Add more sales or overhead data, then try again.
              </p>
            ) : narrative ? (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{narrative}</pre>
            ) : (
              <p className="text-xs text-muted-foreground">No insights yet.</p>
            )}
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => regen.mutate()} disabled={regen.isPending}>
                <RotateCcw className="h-3 w-3 mr-1" />Regenerate
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
