import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  loadCashflow, periodDays, rangeStart, runwayDays, isoDay,
  type PeriodKey, type ChannelFilter,
} from "@/lib/cashflow";
import { loadSiteTaxSettings, splitGross, vatActive as vatIsActive } from "@/lib/vat";
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Receipt } from "lucide-react";
import { CashflowInsightsCard } from "./CashflowInsightsCard";

type ViewMode = "gross" | "net" | "net_vat";

interface Props {
  siteIds: string[];          // one site or many ("all sites")
  primarySiteId: string | null; // used to gate AI insights (must be single site)
  intelligence: boolean;       // tier + module check
}

export default function CashflowTab({ siteIds, primarySiteId, intelligence }: Props) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [advanced, setAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("gross");

  const startIso = rangeStart(period);
  const endIso = isoDay(new Date());

  const q = useQuery({
    queryKey: ["cashflow", siteIds.join(","), startIso, endIso, channel],
    enabled: siteIds.length > 0,
    queryFn: () => loadCashflow({ siteIds, startIso, endIso, channel }),
  });

  const taxQ = useQuery({
    queryKey: ["site-tax-settings", primarySiteId],
    enabled: !!primarySiteId,
    queryFn: () => loadSiteTaxSettings(primarySiteId),
  });
  const tax = taxQ.data;
  const vatOn = vatIsActive(tax);
  const rate = Number(tax?.default_vat_rate) || 20;

  const data = q.data;
  const days = periodDays(period);

  // Compute VAT estimates over the period totals.
  const vatEstimate = useMemo(() => {
    if (!vatOn || !data) return null;
    const salesAreGross = tax?.sales_values_include_vat !== false;
    // Output VAT — derived from sales totals (data.totals.sales is whatever was stored).
    let outputVat = 0;
    let salesNet = data.totals.sales;
    let salesGross = data.totals.sales;
    if (salesAreGross) {
      const split = splitGross(data.totals.sales, rate);
      salesNet = split.net;
      salesGross = data.totals.sales;
      outputVat = split.vat;
    } else {
      salesNet = data.totals.sales;
      salesGross = data.totals.sales * (1 + rate / 100);
      outputVat = salesGross - salesNet;
    }
    // Input VAT — estimate from COGS + overheads at default rate.
    const cogsSplit = splitGross(data.totals.cogs, rate);
    const ohSplit = splitGross(data.totals.overheads, rate);
    const inputVat = cogsSplit.vat + ohSplit.vat;
    return {
      outputVat,
      inputVat,
      payable: outputVat - inputVat,
      salesNet,
      salesGross,
      cogsNet: cogsSplit.net,
      cogsVat: cogsSplit.vat,
      overheadsNet: ohSplit.net,
      overheadsVat: ohSplit.vat,
    };
  }, [vatOn, data, rate, tax?.sales_values_include_vat]);

  const chartIn = useMemo(() => {
    if (!data) return [];
    const transform = (v: number) => {
      if (!vatOn || viewMode === "gross") return v;
      // For sales values, split per-row using the rate.
      return splitGross(v, rate).net;
    };
    return data.days.map((d) => {
      const r = data.byDay[d];
      const dtc = (vatOn && viewMode !== "gross") ? transform(r.salesDtc) : r.salesDtc;
      const ws = (vatOn && viewMode !== "gross") ? transform(r.salesWholesale) : r.salesWholesale;
      const cogsNet = (vatOn && viewMode !== "gross") ? splitGross(r.cogs, rate).net : r.cogs;
      const ohNet = (vatOn && viewMode !== "gross") ? splitGross(r.overheads, rate).net : r.overheads;
      return {
        day: d.slice(5),
        DTC: dtc,
        Wholesale: ws,
        AdjIn: r.adjustmentsIn,
        VATout: (vatOn && viewMode === "net_vat") ? splitGross(r.salesDtc + r.salesWholesale, rate).vat : 0,
        COGS: -cogsNet,
        Labour: -r.labour,
        Overheads: -ohNet,
        AdjOut: -r.adjustmentsOut,
      };
    });
  }, [data, vatOn, viewMode, rate]);


  const chartIn = useMemo(() => {
    if (!data) return [];
    return data.days.map((d) => {
      const r = data.byDay[d];
      return {
        day: d.slice(5),
        DTC: r.salesDtc,
        Wholesale: r.salesWholesale,
        AdjIn: r.adjustmentsIn,
        COGS: -r.cogs,
        Labour: -r.labour,
        Overheads: -r.overheads,
        AdjOut: -r.adjustmentsOut,
      };
    });
  }, [data]);

  const balanceSeries = useMemo(() => {
    if (!data) return [];
    let bal = data.startingCash ?? 0;
    return data.days.map((d) => {
      const r = data.byDay[d];
      bal += r.in - r.out;
      return { day: d.slice(5), balance: bal, net: r.in - r.out };
    });
  }, [data]);

  const showBalance = data?.startingCash != null && data.startingCash > 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <TabsList>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="90d">90d</TabsTrigger>
              <TabsTrigger value="12m">12m</TabsTrigger>
            </TabsList>
          </Tabs>

          {data?.hasChannel && (
            <Select value={channel} onValueChange={(v) => setChannel(v as ChannelFilter)}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="dtc">DTC</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Label htmlFor="adv-mode" className="text-xs text-muted-foreground">Advanced</Label>
            <Switch id="adv-mode" checked={advanced} onCheckedChange={setAdvanced} />
          </div>
        </CardContent>
      </Card>

      {/* KPI strip */}
      <KpiStrip data={data} days={days} loading={q.isLoading} />

      {/* Gentle prompts */}
      {data && !data.hasSales && (
        <PromptCard
          icon={<AlertCircle className="h-4 w-4" />}
          message="Import sales to unlock weighted analytics and revenue trends."
        />
      )}
      {data && !data.hasOverheads && (
        <PromptCard
          icon={<AlertCircle className="h-4 w-4" />}
          message="Add overheads in the Inputs tab to see contribution after fixed costs."
        />
      )}

      {/* Waterfall */}
      <WaterfallCard data={data} />

      {/* Stacked bar — cash in vs out */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cash in vs cash out</CardTitle>
          <CardDescription className="text-xs">
            Daily breakdown over the selected period.
            {data?.cogsMethod === "sales-estimate" && (
              <Badge variant="secondary" className="ml-2 text-[10px]">COGS estimated from sales</Badge>
            )}
            {data?.cogsMethod === "unavailable" && (
              <Badge variant="outline" className="ml-2 text-[10px]">COGS estimate unavailable</Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          {chartIn.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartIn} stackOffset="sign" margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" fontSize={10} interval="preserveStartEnd" />
                <YAxis fontSize={10} />
                <Tooltip
                  formatter={(v: number) => `£${Math.abs(v).toFixed(2)}`}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {data?.hasChannel ? (
                  <>
                    <Bar dataKey="DTC" stackId="in" fill="hsl(var(--success))" />
                    <Bar dataKey="Wholesale" stackId="in" fill="hsl(var(--primary))" />
                  </>
                ) : (
                  <Bar dataKey="DTC" name="Sales" stackId="in" fill="hsl(var(--success))" />
                )}
                {advanced && <Bar dataKey="AdjIn" name="Adj in" stackId="in" fill="hsl(var(--accent))" />}
                <Bar dataKey="COGS" stackId="out" fill="hsl(var(--warning))" />
                <Bar dataKey="Labour" stackId="out" fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="Overheads" stackId="out" fill="hsl(var(--destructive))" />
                {advanced && <Bar dataKey="AdjOut" name="Adj out" stackId="out" fill="hsl(var(--secondary))" />}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Line — balance or net trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {showBalance ? "Cash balance trend" : "Net flow trend"}
          </CardTitle>
          <CardDescription className="text-xs">
            {showBalance
              ? `Starting cash £${data!.startingCash!.toFixed(0)} + cumulative net flow.`
              : "Daily net flow. Set starting cash in Inputs to see a balance line."}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[220px]">
          {balanceSeries.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceSeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" fontSize={10} interval="preserveStartEnd" />
                <YAxis fontSize={10} />
                <Tooltip
                  formatter={(v: number) => `£${v.toFixed(2)}`}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey={showBalance ? "balance" : "net"}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* AI insights — Intelligence tier only, single site only */}
      {intelligence && primarySiteId && siteIds.length === 1 && (
        <CashflowInsightsCard siteId={primarySiteId} period={period} />
      )}
    </div>
  );
}

function KpiStrip({ data, days, loading }: { data: ReturnType<typeof useQuery>["data"] extends any ? any : never; days: number; loading: boolean }) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="py-4 h-[88px] animate-pulse bg-muted/40" /></Card>
        ))}
      </div>
    );
  }
  const t = data.totals;
  const runway = runwayDays(data.startingCash, t, days);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi
        icon={t.net >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
        label="Net cashflow"
        value={`£${t.net.toFixed(0)}`}
        tone={t.net >= 0 ? "success" : "destructive"}
        hint={`over ${days}d`}
      />
      <Kpi
        label="Revenue (net sales)"
        value={`£${t.sales.toFixed(0)}`}
        hint={data.hasSales ? "from imported sales" : "no sales data"}
        muted={!data.hasSales}
      />
      <Kpi
        label="Estimated COGS"
        value={data.cogsMethod === "unavailable" ? "—" : `£${t.cogs.toFixed(0)}`}
        hint={
          data.cogsMethod === "batches" ? "from batches" :
          data.cogsMethod === "sales-estimate" ? "estimated from sales" :
          "COGS estimate unavailable"
        }
        muted={data.cogsMethod === "unavailable"}
      />
      {data.hasTimesheets ? (
        <Kpi label="Labour" value={`£${t.labour.toFixed(0)}`} hint="logged shifts" />
      ) : (
        <Kpi
          icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
          label={runway != null ? "Runway estimate" : "Overheads"}
          value={runway != null ? `${runway.toFixed(0)}d` : `£${t.overheads.toFixed(0)}`}
          hint={runway != null ? "starting cash ÷ avg daily out" : data.hasOverheads ? "allocated" : "—"}
          muted={!data.hasOverheads && runway == null}
        />
      )}
    </div>
  );
}

function Kpi({ icon, label, value, hint, tone, muted }: {
  icon?: React.ReactNode; label: string; value: string; hint?: string;
  tone?: "success" | "destructive"; muted?: boolean;
}) {
  const valueClass =
    tone === "success" ? "text-success" :
    tone === "destructive" ? "text-destructive" :
    muted ? "text-muted-foreground" : "";
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}{label}
        </div>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${valueClass}`}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function WaterfallCard({ data }: { data: any }) {
  if (!data) return null;
  const t = data.totals;
  const net = t.sales - t.cogs - t.labour - t.overheads;
  const rows: { label: string; value: number; tone: "in" | "out" | "net" }[] = [
    { label: "Revenue (net sales)", value: t.sales, tone: "in" },
    { label: "− COGS", value: -t.cogs, tone: "out" },
    { label: "− Labour", value: -t.labour, tone: "out" },
    { label: "− Overheads", value: -t.overheads, tone: "out" },
    { label: "= Net contribution", value: net, tone: "net" },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Profit waterfall</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex justify-between items-center py-1.5 px-2 rounded-md ${
              r.tone === "net"
                ? r.value >= 0 ? "bg-success/10 font-semibold" : "bg-destructive/10 font-semibold"
                : r.tone === "in" ? "bg-muted/40" : ""
            }`}
          >
            <span>{r.label}</span>
            <span className={`tabular-nums ${
              r.tone === "out" ? "text-destructive" :
              r.tone === "in" ? "text-success" :
              r.value >= 0 ? "text-success" : "text-destructive"
            }`}>
              £{Math.abs(r.value).toFixed(2)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PromptCard({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <Card className="bg-muted/30 border-dashed">
      <CardContent className="py-3 flex items-center gap-2 text-sm text-muted-foreground">
        {icon}{message}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
      No data for this period yet.
    </div>
  );
}
