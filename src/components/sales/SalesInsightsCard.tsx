// Collapsible AI sales insights card. Intelligence tier only (gated server-side).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function SalesInsightsCard({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["sales-insight", siteId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-sales-insights", {
        body: { site_id: siteId, period_days: 30 },
      });
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const regen = useMutation({
    mutationFn: async () => {
      await supabase.from("ai_insights")
        .delete().eq("site_id", siteId).eq("insight_type", "sales_insights");
      const { data, error } = await supabase.functions.invoke("generate-sales-insights", {
        body: { site_id: siteId, period_days: 30 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales-insight", siteId] }),
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
              <span className="font-medium text-sm">Sales Insights (AI)</span>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-3">
            {q.isLoading || regen.isPending ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />Generating…
              </div>
            ) : narrative ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{narrative}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Import sales to generate insights.</p>
            )}
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => regen.mutate()} disabled={regen.isPending}>
                <RotateCcw className={cn("h-3.5 w-3.5", regen.isPending && "animate-spin")} />
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
