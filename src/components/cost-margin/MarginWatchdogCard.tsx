import { showAIFeatures } from "@/lib/launchFlags";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingDown, ChevronDown, RotateCcw, CheckCircle, Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  calcRecipeBreakdown, tmeLineCost,
  type TMEContext, type TMERecipe,
} from "@/lib/trueMargin";

interface Props {
  siteId: string | null;
  ctx: TMEContext | undefined;
  recipes: TMERecipe[];
}

interface FlaggedRecipe {
  recipe_id: string;
  recipe_name: string;
  current_gp_percent: number;
  target_gp_percent: number;
  sale_price: number;
  food_cost_per_portion: number;
  top_cost_drivers: { ingredient_name: string; cost_contribution: number }[];
  suggested_new_price?: number;
  estimated_monthly_impact?: number;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// Light safety: strip common markdown marks. Prompt prevents them but defend anyway.
function stripMarkdown(s: string): string {
  return s
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S[^*]*)\*/g, "$1$2")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/`([^`]*)`/g, "$1");
}

export function MarginWatchdogCard({ siteId, ctx, recipes }: Props) {
  if (!showAIFeatures) return null;
  const { isActive } = useModuleAccess();
  const { isManager } = useRole();
  const aiActive = isActive("ai_insights");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dismissedEmpty, setDismissedEmpty] = useState(false);
  const today = ymd(new Date());

  // Build flagged list from existing TME data — no extra queries.
  const flagged = useMemo<FlaggedRecipe[]>(() => {
    if (!ctx || !recipes?.length) return [];
    const out: FlaggedRecipe[] = [];
    for (const r of recipes) {
      if (r.recipe_type === "prep_batch") continue;
      const bd = calcRecipeBreakdown(r, ctx);
      if (bd.gpPercent == null || bd.salePriceExVat == null) continue;
      const target = Number(r.target_gp_percent) || ctx.settings.target_margin_pct || 0;
      if (target <= 0) continue;
      if (bd.gpPercent >= target - 3) continue;

      // Top cost drivers: per ingredient line cost
      const drivers = (r.recipe_ingredients || [])
        .map((line) => {
          const cost = tmeLineCost(line, ctx);
          let name = "Unknown";
          if (line.line_type === "nested_recipe" && line.nested_recipe_id) {
            name = ctx.recipesById.get(line.nested_recipe_id)?.name ?? "Sub-recipe";
          } else if (line.ingredients) {
            name = line.ingredients.name;
          }
          return { ingredient_name: name, cost_contribution: Number(cost.toFixed(4)) };
        })
        .filter((d) => d.cost_contribution > 0)
        .sort((a, b) => b.cost_contribution - a.cost_contribution)
        .slice(0, 3);

      const food_cost = Number(bd.costPerPortionExVat.toFixed(4));
      const suggested =
        target < 100 ? Number((food_cost / (1 - target / 100)).toFixed(2)) : undefined;
      const gpDelta = suggested != null ? (suggested - (bd.salePriceExVat ?? 0)) : 0;
      const estMonthly = suggested != null ? Number((gpDelta * 30).toFixed(2)) : undefined;

      out.push({
        recipe_id: r.id,
        recipe_name: r.name,
        current_gp_percent: Number(bd.gpPercent.toFixed(1)),
        target_gp_percent: Number(target.toFixed(1)),
        sale_price: Number((bd.salePriceExVat ?? 0).toFixed(2)),
        food_cost_per_portion: Number(food_cost.toFixed(2)),
        top_cost_drivers: drivers,
        suggested_new_price: suggested,
        estimated_monthly_impact: estMonthly,
      });
    }
    return out;
  }, [ctx, recipes]);

  const enabled = !!siteId && aiActive && isManager;

  const cachedQuery = useQuery({
    queryKey: ["margin-alert", siteId, today],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("id, narrative, content, generated_at")
        .eq("site_id", siteId!)
        .eq("insight_type", "margin_alert")
        .gt("valid_until", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!siteId || !ctx) throw new Error("Not ready");
      const payload = {
        site_name: "",
        generated_for_date: today,
        currency: "GBP",
        flagged_recipes: flagged,
      };
      const { data, error } = await supabase.functions.invoke("generate-margin-alert", {
        body: { site_id: siteId, payload },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["margin-alert", siteId, today] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to generate margin alert";
      toast.error(msg);
    },
  });

  // Auto-regenerate when cached count differs from current flagged count
  useEffect(() => {
    if (!enabled || !ctx || cachedQuery.isLoading) return;
    if (generate.isPending || generate.isError) return;
    const cachedFlagged = (cachedQuery.data?.content as any)?.flagged_recipes;
    const cachedCount = Array.isArray(cachedFlagged) ? cachedFlagged.length : null;
    if (cachedQuery.data == null || cachedCount !== flagged.length) {
      generate.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ctx, cachedQuery.isLoading, cachedQuery.data, flagged.length]);

  const regenerate = async () => {
    if (!siteId) return;
    if (cachedQuery.data?.id) {
      await supabase.from("ai_insights").delete().eq("id", cachedQuery.data.id);
    }
    queryClient.invalidateQueries({ queryKey: ["margin-alert", siteId, today] });
    generate.mutate();
  };

  if (!enabled) return null;
  if (!ctx) return null;

  const narrative = cachedQuery.data?.narrative ?? "";
  const isLoading = cachedQuery.isLoading || (generate.isPending && !narrative);

  // Empty + dismissed: render nothing
  if (flagged.length === 0 && dismissedEmpty) return null;

  // Empty state — tiny one-liner
  if (flagged.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-success" />
            All recipes within target margins
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setDismissedEmpty(true)}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="bg-muted/50 border-border">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/70 transition-colors rounded-md"
            >
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm text-foreground">Margin Watchdog</span>
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {flagged.length}
                </Badge>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 px-4 space-y-4">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analysing margins…
                </div>
              ) : (
                <>
                  {narrative && (
                    <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                      {stripMarkdown(narrative)}
                    </p>
                  )}

                  <div className="space-y-2">
                    {flagged.map((f) => (
                      <div
                        key={f.recipe_id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground truncate">
                            {f.recipe_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Sale £{f.sale_price.toFixed(2)} · Food cost £{f.food_cost_per_portion.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="destructive" className="text-xs">
                            {f.current_gp_percent.toFixed(1)}%
                          </Badge>
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            target {f.target_gp_percent.toFixed(1)}%
                          </Badge>
                          {f.suggested_new_price != null && (
                            <Badge variant="secondary" className="text-xs">
                              → £{f.suggested_new_price.toFixed(2)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground">
                      AI-generated{cachedQuery.data?.generated_at ? ` · ${formatTime(cachedQuery.data.generated_at)}` : ""}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={regenerate}
                      disabled={generate.isPending}
                      className="h-7 px-2"
                    >
                      <RotateCcw className={cn("h-3.5 w-3.5", generate.isPending && "animate-spin")} />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </motion.div>
  );
}
