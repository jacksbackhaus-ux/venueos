import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useRole } from "@/hooks/useRole";
import { TrendingDown, TrendingUp, Minus, Sparkles } from "lucide-react";

interface Props { siteId: string | undefined; }

function weekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (day - 1) - offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function Trend({ now, prev }: { now: number; prev: number }) {
  if (prev === 0 && now === 0) return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Minus className="h-3 w-3" />no change</span>;
  const diff = prev === 0 ? 100 : Math.round(((now - prev) / prev) * 100);
  const up = diff > 0;
  const Icon = up ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  return (
    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
      <Icon className={`h-3 w-3 ${up ? "text-warning" : diff < 0 ? "text-success" : ""}`} />
      {Math.abs(diff)}% vs last week
    </span>
  );
}

function Tile({ title, value, sub, children }: { title: string; value: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="text-2xl md:text-3xl font-heading font-bold mt-1 tabular-nums">{value}</p>
      {sub && <div className="mt-1">{sub}</div>}
      {children}
    </Card>
  );
}

export function ThisWeekSnapshot({ siteId }: Props) {
  const { isActive } = useModuleAccess();
  const { isSupervisorPlus } = useRole();

  const hasBusiness = isActive("cost_margin") || isActive("waste_log") || isActive("timesheets");
  const showSection = hasBusiness || isSupervisorPlus;

  const w = weekRange(0);
  const pw = weekRange(1);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-this-week", siteId, w.from],
    enabled: !!siteId && showSection,
    queryFn: async () => {
      const [wasteNow, wastePrev, batchNow, batchPrev] = await Promise.all([
        isActive("waste_log") ? supabase.from("waste_logs").select("estimated_cost").eq("site_id", siteId!).gte("waste_date", w.from).lt("waste_date", w.to) : Promise.resolve({ data: [] as any[] }),
        isActive("waste_log") ? supabase.from("waste_logs").select("estimated_cost").eq("site_id", siteId!).gte("waste_date", pw.from).lt("waste_date", pw.to) : Promise.resolve({ data: [] as any[] }),
        supabase.from("batches").select("quantity_produced").eq("site_id", siteId!).gte("date_produced", w.from).lt("date_produced", w.to),
        supabase.from("batches").select("quantity_produced").eq("site_id", siteId!).gte("date_produced", pw.from).lt("date_produced", pw.to),
      ]);
      const sumCost = (rows: any[]) => rows.reduce((s, r) => s + Number(r.estimated_cost || 0), 0);
      const sumQty = (rows: any[]) => rows.reduce((s, r) => s + Number(r.quantity_produced || 0), 0);
      return {
        wasteNow: sumCost(wasteNow.data ?? []),
        wastePrev: sumCost(wastePrev.data ?? []),
        prodNow: sumQty(batchNow.data ?? []),
        prodPrev: sumQty(batchPrev.data ?? []),
      };
    },
  });

  if (!showSection) return null;

  if (!hasBusiness) {
    return (
      <Card className="p-5 bg-muted/40 border-dashed">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Unlock weekly business performance</p>
            <p className="text-xs text-muted-foreground">Enable the Business plan to see labour, waste, margin and production trends.</p>
          </div>
          <Link to="/settings"><Button size="sm" variant="outline">Upgrade</Button></Link>
        </div>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">This week</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">This week</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isActive("timesheets") ? (
          <Tile title="Labour" value="—" sub={<span className="text-xs text-muted-foreground">Open timesheets</span>} />
        ) : (
          <Tile title="Labour" value="—" sub={<span className="text-xs text-muted-foreground">Enable timesheets</span>} />
        )}
        {isActive("waste_log") && (
          <Tile title="Waste cost" value={`£${data.wasteNow.toFixed(0)}`} sub={<Trend now={data.wasteNow} prev={data.wastePrev} />} />
        )}
        <Tile
          title="Margin health"
          value={isActive("cost_margin") ? "Live" : "—"}
          sub={<Link to={isActive("cost_margin") ? "/cost-margin" : "/settings"} className="text-xs text-primary hover:underline">
            {isActive("cost_margin") ? "Open Cost & Margin" : "Enable Business plan"}
          </Link>}
        />
        <Tile title="Production" value={data.prodNow.toLocaleString()} sub={<Trend now={data.prodNow} prev={data.prodPrev} />} />
      </div>
    </div>
  );
}
