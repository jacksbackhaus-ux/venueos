import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, AlertCircle, ChevronRight, Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { loadTMEContext, calcRecipeBreakdown } from "@/lib/trueMargin";

interface Props { siteId: string | undefined; }

/**
 * Lightweight Profit Snapshot for the dashboard.
 * Reuses the True Margin Engine — no new data systems.
 * Shows: average GP %, products below target, worst product, est. monthly profit.
 */
export function ProfitSnapshot({ siteId }: Props) {
  const { appUser } = useAuth();
  const { isActive } = useModuleAccess();
  const orgId = appUser?.organisation_id || null;
  const enabled = !!siteId && !!orgId && isActive("cost_margin");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-profit-snapshot", siteId, orgId],
    enabled,
    queryFn: async () => {
      const { ctx, recipes } = await loadTMEContext(siteId!, orgId!);
      const products = recipes.filter((r) => r.recipe_type !== "prep_batch");
      const target = ctx.settings.target_margin_pct;

      const rows = products
        .map((r) => {
          const bd = calcRecipeBreakdown(r, ctx);
          const monthly = Number(r.monthly_volume) || 0;
          const monthlyProfit =
            bd.salePriceExVat != null && monthly > 0
              ? (bd.salePriceExVat - bd.costPerPortionExVat) * monthly
              : 0;
          return { name: r.name, gp: bd.gpPercent, monthlyProfit, hasPrice: bd.salePriceExVat != null };
        })
        .filter((x) => x.hasPrice && x.gp != null);

      if (rows.length === 0) return { setup: true as const };

      const avgGp = rows.reduce((s, r) => s + (r.gp ?? 0), 0) / rows.length;
      const below = rows.filter((r) => (r.gp ?? 0) < target);
      const worst = [...rows].sort((a, b) => (a.gp ?? 0) - (b.gp ?? 0))[0];
      const monthlyProfit = rows.reduce((s, r) => s + r.monthlyProfit, 0);
      const hasVolume = rows.some((r) => r.monthlyProfit !== 0);

      return {
        setup: false as const,
        avgGp,
        target,
        belowCount: below.length,
        productCount: rows.length,
        worstName: worst && (worst.gp ?? 0) < target ? worst.name : null,
        monthlyProfit: hasVolume ? monthlyProfit : null,
      };
    },
  });

  if (!enabled) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Profit snapshot
        </h2>
        <Link to="/cost-margin" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          Open Profit & Pricing <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : data.setup ? (
        <Card className="p-5 bg-muted/30 border-dashed">
          <div className="flex items-center gap-3">
            <Calculator className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Complete pricing setup to unlock</p>
              <p className="text-xs text-muted-foreground">Add prices to your products to see margin health here.</p>
            </div>
            <Link to="/cost-margin"><Button size="sm" variant="outline">Set up</Button></Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Average GP</p>
            <p className={`text-2xl md:text-3xl font-heading font-bold mt-1 tabular-nums ${
              data.avgGp >= data.target ? "text-success" : "text-warning"
            }`}>
              {Math.round(data.avgGp)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Target {Math.round(data.target)}%</p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Below target</p>
            <p className={`text-2xl md:text-3xl font-heading font-bold mt-1 tabular-nums ${
              data.belowCount > 0 ? "text-warning" : "text-success"
            }`}>
              {data.belowCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">of {data.productCount} priced</p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top problem</p>
            {data.worstName ? (
              <Link to="/cost-margin" className="block group">
                <p className="text-sm font-semibold mt-2 truncate group-hover:text-primary transition-colors">{data.worstName}</p>
                <p className="text-xs text-warning inline-flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Below target
                </p>
              </Link>
            ) : (
              <>
                <p className="text-sm font-semibold mt-2 text-success">None 🎉</p>
                <p className="text-xs text-muted-foreground mt-1">All products on target</p>
              </>
            )}
          </Card>

          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Est. monthly profit</p>
            {data.monthlyProfit != null ? (
              <>
                <p className="text-2xl md:text-3xl font-heading font-bold mt-1 tabular-nums inline-flex items-center gap-1">
                  £{Math.round(data.monthlyProfit).toLocaleString()}
                  <TrendingUp className="h-4 w-4 text-success" />
                </p>
                <p className="text-xs text-muted-foreground mt-1">Based on your volumes</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold mt-2 text-muted-foreground">Add volumes</p>
                <p className="text-xs text-muted-foreground mt-1">Set units/month per product</p>
              </>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}
