// Sales Health dashboard for Cost & Margin Overview.
// Mobile-first, action-oriented. Uses sales_line_items reconciled by linked_product_id.
// All cost / GP calcs run through TME engine via calcRecipeBreakdown.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, ChevronDown, Search, Sparkles,
  TrendingUp, TrendingDown, PoundSterling, Target, Upload, LinkIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calcRecipeBreakdown, type TMEContext, type TMERecipe } from "@/lib/trueMargin";
import { loadSiteTaxSettings, splitGross, vatActive } from "@/lib/vat";

type Period = "7d" | "30d" | "90d";
type ViewMode = "net" | "gross";

interface Props {
  siteId: string | null;
  orgId: string | null;
  ctx: TMEContext | undefined;
  recipes: TMERecipe[];
  intelligence?: boolean;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return d.toISOString().slice(0, 10);
}
function today(): string { return new Date().toISOString().slice(0, 10); }
function periodDays(p: Period): number { return p === "7d" ? 7 : p === "30d" ? 30 : 90; }
function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n || 0);
}
function fmtGBP2(n: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(n || 0);
}
function fmtPct(n: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export default function SalesHealthDashboard({ siteId, orgId, ctx, recipes, intelligence }: Props) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("30d");
  const [view, setView] = useState<ViewMode>("net");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"profit" | "units" | "margin" | "leak">("profit");
  const [insightsOpen, setInsightsOpen] = useState(false);

  const startIso = useMemo(() => isoDaysAgo(periodDays(period)), [period]);
  const endIso = today();

  // Sales import existence
  const importsQ = useQuery({
    queryKey: ["sh-imports", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { count } = await supabase
        .from("sales_imports")
        .select("id", { count: "exact", head: true })
        .eq("site_id", siteId!);
      return count ?? 0;
    },
  });

  // Sales line items in period
  const linesQ = useQuery({
    queryKey: ["sh-lines", siteId, startIso, endIso],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_line_items")
        .select("sale_date, net_sales, gross_sales, quantity, channel, linked_product_id, ignored, product_name_raw")
        .eq("site_id", siteId!)
        .gte("sale_date", startIso)
        .lte("sale_date", endIso)
        .eq("ignored", false);
      if (error) throw error;
      return data || [];
    },
  });

  // Tax settings
  const taxQ = useQuery({
    queryKey: ["sh-tax", siteId],
    enabled: !!siteId,
    queryFn: () => loadSiteTaxSettings(siteId),
  });

  // Labour for period (shift_compensation_logs as proxy, consistent with Cashflow)
  const labourQ = useQuery({
    queryKey: ["sh-labour", siteId, startIso, endIso],
    enabled: !!siteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("shift_compensation_logs")
        .select("compensation_amount")
        .eq("site_id", siteId!)
        .gte("shift_date", startIso)
        .lte("shift_date", endIso);
      const total = (data || []).reduce((s: number, r: any) => s + Number(r.compensation_amount || 0), 0);
      return { total, hasData: (data?.length ?? 0) > 0 };
    },
  });

  // Overheads for current month
  const overheadsQ = useQuery({
    queryKey: ["sh-overheads", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthIso = monthStart.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("site_overheads_monthly")
        .select("rent, utilities, insurance, software_subscriptions, equipment_lease, marketing, repairs_maintenance, other, month")
        .eq("site_id", siteId!)
        .eq("month", monthIso)
        .maybeSingle();
      if (!data) return { monthly: 0, configured: false };
      const monthly =
        Number(data.rent || 0) + Number(data.utilities || 0) + Number(data.insurance || 0) +
        Number(data.software_subscriptions || 0) + Number(data.equipment_lease || 0) +
        Number(data.marketing || 0) + Number(data.repairs_maintenance || 0) + Number(data.other || 0);
      return { monthly, configured: true };
    },
  });

  // Ingredients last update (for stale-price alert)
  const ingFreshQ = useQuery({
    queryKey: ["sh-ing-fresh", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ingredients")
        .select("updated_at")
        .eq("site_id", siteId!)
        .order("updated_at", { ascending: false })
        .limit(1);
      return data?.[0]?.updated_at ?? null;
    },
  });

  const lines = linesQ.data || [];
  const tax = taxQ.data;
  const showVatToggle = vatActive(tax);
  const useNet = !showVatToggle ? true : view === "net";

  // Recipe lookup + breakdown cache
  const breakdownById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calcRecipeBreakdown>>();
    if (!ctx) return m;
    for (const r of recipes) m.set(r.id, calcRecipeBreakdown(r, ctx));
    return m;
  }, [ctx, recipes]);
  const recipesById = useMemo(() => {
    const m = new Map<string, TMERecipe>();
    for (const r of recipes) m.set(r.id, r);
    return m;
  }, [recipes]);

  // Has any reconciled sales?
  const reconciledCount = lines.filter((l: any) => l.linked_product_id).length;
  const unmatchedCount = lines.filter((l: any) => !l.linked_product_id).length;
  const hasImports = (importsQ.data ?? 0) > 0;

  // Aggregate per product (only reconciled)
  type AggRow = {
    recipeId: string;
    name: string;
    units: number;
    netSales: number;
    grossSales: number;
    cost: number;
    profit: number;          // (revenue used) - cost
    revenueForMargin: number;
    marginPct: number | null;
    targetGpPct: number;
    targetProfitPerUnit: number;
    currentProfitPerUnit: number;
    leak: number;            // positive £ if below target
    dtcNet: number;
    wholesaleNet: number;
  };

  const { rows, totals, channelSplit } = useMemo(() => {
    const map = new Map<string, AggRow>();
    let totalNet = 0, totalGross = 0;
    let dtcNet = 0, wholesaleNet = 0;
    let hasChannelData = false;
    for (const l of lines as any[]) {
      const id = l.linked_product_id;
      const net = Number(l.net_sales || 0);
      const gross = Number(l.gross_sales || net || 0);
      const qty = Number(l.quantity || 0);
      totalNet += net;
      totalGross += gross;
      if (l.channel) {
        hasChannelData = true;
        if (l.channel === "wholesale") wholesaleNet += net;
        else dtcNet += net;
      }
      if (!id) continue;
      const recipe = recipesById.get(id);
      const bd = breakdownById.get(id);
      if (!recipe || !bd) continue;
      let row = map.get(id);
      if (!row) {
        const target = Number(recipe.target_gp_percent) || ctx?.settings.target_margin_pct || 0;
        row = {
          recipeId: id,
          name: recipe.name,
          units: 0, netSales: 0, grossSales: 0, cost: 0, profit: 0,
          revenueForMargin: 0, marginPct: null,
          targetGpPct: target,
          targetProfitPerUnit: 0,
          currentProfitPerUnit: 0,
          leak: 0,
          dtcNet: 0, wholesaleNet: 0,
        };
        map.set(id, row);
      }
      row.units += qty;
      row.netSales += net;
      row.grossSales += gross;
      row.cost += qty * (bd.costPerPortionExVat || 0);
      if (l.channel === "wholesale") row.wholesaleNet += net;
      else if (l.channel) row.dtcNet += net;
    }

    // Finalise per-row math
    for (const row of map.values()) {
      const recipe = recipesById.get(row.recipeId)!;
      const bd = breakdownById.get(row.recipeId)!;
      const rev = useNet ? row.netSales : row.grossSales;
      row.revenueForMargin = rev;
      row.profit = rev - row.cost;
      row.marginPct = rev > 0 ? (row.profit / rev) * 100 : null;
      row.currentProfitPerUnit = row.units > 0 ? row.profit / row.units : 0;
      const unitRev = row.units > 0 ? rev / row.units : (bd.salePriceExVat ?? 0);
      // target profit per unit = unitRev * targetGpPct/100 (if target set, otherwise 0)
      row.targetProfitPerUnit = row.targetGpPct > 0
        ? unitRev * (row.targetGpPct / 100)
        : row.currentProfitPerUnit;
      const gap = row.targetProfitPerUnit - row.currentProfitPerUnit;
      row.leak = gap > 0 && row.targetGpPct > 0 ? gap * row.units : 0;
    }

    const arr = Array.from(map.values());
    const totalRev = useNet ? totalNet : totalGross;
    const totalCost = arr.reduce((s, r) => s + r.cost, 0);
    const totalProfit = totalRev - totalCost;
    const weightedMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : null;
    const leakSum = arr.reduce((s, r) => s + r.leak, 0);
    // Scale leak to monthly equivalent
    const periodD = periodDays(period);
    const monthlyLeak = periodD > 0 ? leakSum * (30 / periodD) : leakSum;

    return {
      rows: arr,
      totals: {
        netSales: totalNet,
        grossSales: totalGross,
        revenue: totalRev,
        cost: totalCost,
        profit: totalProfit,
        weightedMargin,
        monthlyLeak,
        isEstimate: periodD < 30,
        hasAnyTarget: arr.some(r => r.targetGpPct > 0),
      },
      channelSplit: { dtcNet, wholesaleNet, hasChannelData },
    };
  }, [lines, recipesById, breakdownById, useNet, period, ctx]);

  // Period-scaled labour and overheads for profit bridge
  const periodD = periodDays(period);
  const labourPeriod = labourQ.data?.total ?? 0;
  const overheadPeriod = (overheadsQ.data?.monthly ?? 0) * (periodD / 30);
  const contribution = totals.revenue - totals.cost - labourPeriod - overheadPeriod;

  // Alerts
  const alerts = useMemo(() => {
    const out: { id: string; text: string; cta: string; onClick: () => void; severity: "warn" | "info" }[] = [];
    if (unmatchedCount > 0) {
      out.push({
        id: "unmatched", severity: "warn",
        text: `${unmatchedCount} unmatched sales item${unmatchedCount === 1 ? "" : "s"}`,
        cta: "Reconcile", onClick: () => navigate("/sales"),
      });
    }
    // Top 5 sellers missing dtc_price
    const top5 = [...rows].sort((a, b) => b.units - a.units).slice(0, 5);
    const missingDtc = top5.filter(r => {
      const rec = recipesById.get(r.recipeId);
      return rec && (rec.sale_price == null || Number(rec.sale_price) <= 0);
    });
    if (missingDtc.length > 0) {
      out.push({
        id: "missing-dtc", severity: "warn",
        text: `${missingDtc.length} top seller${missingDtc.length === 1 ? "" : "s"} missing a sale price`,
        cta: "Set prices", onClick: () => navigate("/cost-margin"),
      });
    }
    // Wholesale lines exist but missing wholesale price on those products
    const wholesaleRows = rows.filter(r => r.wholesaleNet > 0);
    if (wholesaleRows.length > 0) {
      // Note: trueMargin TMERecipe doesn't carry wholesale_price; flag generically.
      out.push({
        id: "wholesale-channel", severity: "info",
        text: `Wholesale sales detected on ${wholesaleRows.length} product${wholesaleRows.length === 1 ? "" : "s"} — confirm channel pricing`,
        cta: "Open channels", onClick: () => navigate("/cost-margin"),
      });
    }
    // Stale ingredient prices > 30d
    const last = ingFreshQ.data ? new Date(ingFreshQ.data).getTime() : 0;
    if (last && (Date.now() - last) > 30 * 86400000) {
      out.push({
        id: "stale-ing", severity: "info",
        text: "Ingredient prices not updated in 30+ days",
        cta: "Review", onClick: () => navigate("/cost-margin"),
      });
    }
    // Overheads not set
    if (!overheadsQ.data?.configured) {
      out.push({
        id: "no-overheads", severity: "info",
        text: "Overheads not set for this month",
        cta: "Add", onClick: () => navigate("/cost-margin"),
      });
    }
    return out.slice(0, 5);
  }, [unmatchedCount, rows, recipesById, ingFreshQ.data, overheadsQ.data, navigate]);

  // Focus card data
  const topDrivers = useMemo(() => [...rows].sort((a, b) => b.profit - a.profit).slice(0, 5), [rows]);
  const topLeaks = useMemo(() => [...rows].filter(r => r.leak > 0).sort((a, b) => b.leak - a.leak).slice(0, 5), [rows]);

  // Searchable product list
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = rows;
    if (q) r = r.filter(x => x.name.toLowerCase().includes(q));
    r = [...r].sort((a, b) => {
      switch (sortBy) {
        case "units": return b.units - a.units;
        case "margin": return (b.marginPct ?? -Infinity) - (a.marginPct ?? -Infinity);
        case "leak": return b.leak - a.leak;
        case "profit":
        default: return b.profit - a.profit;
      }
    });
    return r;
  }, [rows, search, sortBy]);

  // Profit bridge data
  const bridgeData = useMemo(() => {
    const data: { name: string; value: number; fill: string }[] = [
      { name: useNet ? "Net Sales" : "Gross Sales", value: totals.revenue, fill: "hsl(var(--primary))" },
      { name: "COGS", value: -totals.cost, fill: "hsl(var(--destructive))" },
    ];
    if (labourQ.data?.hasData) data.push({ name: "Labour", value: -labourPeriod, fill: "hsl(var(--destructive) / 0.7)" });
    if (overheadsQ.data?.configured) data.push({ name: "Overheads", value: -overheadPeriod, fill: "hsl(var(--destructive) / 0.5)" });
    data.push({ name: "Contribution", value: contribution, fill: contribution >= 0 ? "hsl(var(--success, var(--primary)))" : "hsl(var(--destructive))" });
    return data;
  }, [totals, labourPeriod, overheadPeriod, contribution, useNet, labourQ.data, overheadsQ.data]);

  // ─────────────── Setup states ───────────────
  if (importsQ.isLoading || taxQ.isLoading) {
    return (
      <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
    );
  }

  if (!hasImports) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Best sellers & problems</CardTitle>
          </div>
          <CardDescription>Import sales to see which products earn most — and which lose money.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li>Weighted margins by real units sold</li>
            <li>Top profit drivers and worst margin leaks</li>
            <li>Actionable alerts and one-click fixes</li>
          </ul>
          <Button onClick={() => navigate("/sales")}>
            <Upload className="h-4 w-4 mr-2" /> Import sales
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (reconciledCount === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Sales imported — match products to unlock analytics</CardTitle>
          </div>
          <CardDescription>
            {unmatchedCount > 0
              ? `${unmatchedCount} sales line${unmatchedCount === 1 ? "" : "s"} waiting to be linked to a product.`
              : "Link sales lines to recipes to see weighted margins and profit drivers."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/sales?tab=unmatched")}>
            Reconcile unmatched items <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─────────────── Full dashboard ───────────────
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Best sellers & problems</CardTitle>
            {totals.isEstimate && <Badge variant="outline" className="text-xs">estimate</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            {showVatToggle && (
              <Select value={view} onValueChange={(v) => setView(v as ViewMode)}>
                <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="net">Net of VAT</SelectItem>
                  <SelectItem value="gross">Gross</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            icon={<PoundSterling className="h-4 w-4" />}
            label={useNet ? "Net Sales" : "Gross Sales"}
            value={fmtGBP(totals.revenue)}
            actionLabel="View"
            onAction={() => navigate("/sales")}
          />
          <Kpi
            icon={<TrendingUp className="h-4 w-4" />}
            label="Gross Profit"
            value={fmtGBP(totals.profit)}
            actionLabel="Bridge"
            onAction={() => document.getElementById("sh-profit-bridge")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
          <Kpi
            icon={<Target className="h-4 w-4" />}
            label="Weighted Margin"
            value={fmtPct(totals.weightedMargin)}
            actionLabel="Leaks"
            onAction={() => document.getElementById("sh-leaks")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
          <Kpi
            icon={<TrendingDown className="h-4 w-4" />}
            label="Margin Leak / mo"
            value={fmtGBP(totals.monthlyLeak)}
            sub={!totals.hasAnyTarget ? "Set targets to refine" : totals.isEstimate ? "estimate" : undefined}
            actionLabel="Fix"
            onAction={() => {
              const worst = topLeaks[0]?.recipeId;
              navigate(worst ? `/cost-margin?pricing=${worst}` : "/cost-margin");
            }}
            tone={totals.monthlyLeak > 0 ? "warn" : "default"}
          />
        </div>

        {/* Profit bridge */}
        <div id="sh-profit-bridge" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Profit bridge ({periodD}d)</h3>
            {(!labourQ.data?.hasData || !overheadsQ.data?.configured) && (
              <button onClick={() => navigate("/cost-margin")} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                {!labourQ.data?.hasData && !overheadsQ.data?.configured
                  ? "Labour & overheads not configured"
                  : !labourQ.data?.hasData ? "Labour not configured" : "Overheads not configured"}
              </button>
            )}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bridgeData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtGBP(v as number)} width={60} />
                <Tooltip
                  formatter={(v: number) => fmtGBP2(v)}
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                  {bridgeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">
            {fmtGBP2(totals.revenue)} − {fmtGBP2(totals.cost)} COGS
            {labourQ.data?.hasData ? ` − ${fmtGBP2(labourPeriod)} labour` : ""}
            {overheadsQ.data?.configured ? ` − ${fmtGBP2(overheadPeriod)} overheads` : ""}
            {" = "}<span className="font-medium text-foreground">{fmtGBP2(contribution)} contribution</span>
          </p>
        </div>

        {/* Focus cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FocusCard title="Top profit drivers" emptyText="No reconciled sales yet">
            {topDrivers.map((r) => (
              <FocusRow
                key={r.recipeId}
                primary={r.name}
                secondary={`${r.units.toFixed(0)} units · ${fmtPct(r.marginPct)}`}
                value={fmtGBP(r.profit)}
                ctaLabel="Fix"
                onCta={() => navigate(`/cost-margin?pricing=${r.recipeId}`)}
              />
            ))}
          </FocusCard>

          <FocusCard
            id="sh-leaks"
            title="Top margin leaks"
            emptyText={totals.hasAnyTarget ? "No leaks — all products on target" : "Set target margins to find leaks"}
          >
            {topLeaks.map((r) => (
              <FocusRow
                key={r.recipeId}
                primary={r.name}
                secondary={`${fmtPct(r.marginPct)} vs target ${r.targetGpPct.toFixed(0)}%`}
                value={fmtGBP(r.leak)}
                tone="warn"
                ctaLabel="Fix price"
                onCta={() => navigate(`/cost-margin?pricing=${r.recipeId}`)}
              />
            ))}
          </FocusCard>

          {channelSplit.hasChannelData && (
            <FocusCard title="Sales mix" emptyText="">
              <FocusRow primary="DTC" secondary="Direct to customer" value={fmtGBP(channelSplit.dtcNet)} />
              <FocusRow primary="Wholesale" secondary="B2B" value={fmtGBP(channelSplit.wholesaleNet)} />
              <Button size="sm" variant="ghost" className="w-full mt-1 justify-between" onClick={() => navigate("/cost-margin")}>
                Channel settings <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </FocusCard>
          )}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Needs attention
            </h3>
            <div className="space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${a.severity === "warn" ? "bg-destructive" : "bg-primary"}`} />
                    <span className="truncate">{a.text}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={a.onClick}>
                    {a.cta} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product performance list */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-sm">Product performance</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products"
                  className="h-8 pl-7 w-[160px] text-xs"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="profit">Profit £</SelectItem>
                  <SelectItem value="units">Units</SelectItem>
                  <SelectItem value="margin">Margin %</SelectItem>
                  <SelectItem value="leak">Leak £</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No products match.</p>
          ) : (
            <div className="space-y-1.5">
              {filteredRows.slice(0, 25).map((r) => (
                <div key={r.recipeId} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.units.toFixed(0)} units · {fmtGBP(r.revenueForMargin)} · {fmtPct(r.marginPct)}
                      {r.leak > 0 && <span className="text-destructive"> · leak {fmtGBP(r.leak)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium tabular-nums">{fmtGBP(r.profit)}</span>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => navigate(`/cost-margin?pricing=${r.recipeId}`)}>
                      Fix
                    </Button>
                  </div>
                </div>
              ))}
              {filteredRows.length > 25 && (
                <p className="text-xs text-muted-foreground pt-1">Showing top 25 of {filteredRows.length}.</p>
              )}
            </div>
          )}
        </div>

        {/* Intelligence insights — derived, no AI required to compute */}
        {intelligence && (
          <Collapsible open={insightsOpen} onOpenChange={setInsightsOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium">Insights</span>
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${insightsOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="rounded-md border bg-background px-3 py-3 text-sm space-y-2">
                <InsightLine label="Top 3 actions this week">
                  {buildTopActions(topLeaks, missingPriceCount(rows, recipesById), unmatchedCount)}
                </InsightLine>
                <InsightLine label="Biggest margin leak">
                  {topLeaks[0]
                    ? `${topLeaks[0].name} is leaking about ${fmtGBP2(topLeaks[0].leak)} this period.`
                    : "No products below target."}
                </InsightLine>
                <InsightLine label="Biggest cost driver">
                  {topDrivers[0]
                    ? `${topDrivers[0].name} drove ${fmtGBP(topDrivers[0].profit)} of profit on ${topDrivers[0].units.toFixed(0)} units.`
                    : "Not enough data."}
                </InsightLine>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────── Subcomponents ─────────── */

function Kpi(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  actionLabel: string;
  onAction: () => void;
  tone?: "default" | "warn";
}) {
  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-1 ${props.tone === "warn" ? "border-destructive/40" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">{props.icon}{props.label}</span>
        <button onClick={props.onAction} className="text-xs text-primary hover:underline">
          {props.actionLabel}
        </button>
      </div>
      <div className="text-xl font-semibold tabular-nums">{props.value}</div>
      {props.sub && <div className="text-[11px] text-muted-foreground">{props.sub}</div>}
    </div>
  );
}

function FocusCard(props: { id?: string; title: string; emptyText: string; children: React.ReactNode }) {
  const arr = Array.isArray(props.children) ? props.children : [props.children];
  const hasContent = arr.some((c) => !!c);
  return (
    <div id={props.id} className="rounded-lg border p-3 space-y-2">
      <h4 className="font-medium text-sm">{props.title}</h4>
      {hasContent ? <div className="space-y-1.5">{props.children}</div> : (
        <p className="text-xs text-muted-foreground">{props.emptyText}</p>
      )}
    </div>
  );
}

function FocusRow(props: {
  primary: string;
  secondary?: string;
  value: string;
  tone?: "default" | "warn";
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{props.primary}</div>
        {props.secondary && <div className="text-xs text-muted-foreground truncate">{props.secondary}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`tabular-nums ${props.tone === "warn" ? "text-destructive" : ""}`}>{props.value}</span>
        {props.ctaLabel && props.onCta && (
          <Button size="sm" variant="ghost" className="h-7" onClick={props.onCta}>{props.ctaLabel}</Button>
        )}
      </div>
    </div>
  );
}

function InsightLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/* ─────────── Helpers ─────────── */

function missingPriceCount(
  rows: { recipeId: string }[],
  recipesById: Map<string, TMERecipe>,
): number {
  return rows.filter((r) => {
    const rec = recipesById.get(r.recipeId);
    return rec && (rec.sale_price == null || Number(rec.sale_price) <= 0);
  }).length;
}

function buildTopActions(
  topLeaks: { name: string; leak: number }[],
  missingPrices: number,
  unmatched: number,
): string {
  const actions: string[] = [];
  if (unmatched > 0) actions.push(`Reconcile ${unmatched} unmatched sales item${unmatched === 1 ? "" : "s"}.`);
  if (topLeaks[0]) actions.push(`Reprice ${topLeaks[0].name} to recover margin.`);
  if (missingPrices > 0) actions.push(`Set sale prices on ${missingPrices} top product${missingPrices === 1 ? "" : "s"}.`);
  if (actions.length === 0) return "You're on track this week.";
  return actions.slice(0, 3).join(" ");
}
