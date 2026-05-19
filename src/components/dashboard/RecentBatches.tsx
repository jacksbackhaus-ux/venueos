import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ChevronRight } from "lucide-react";

interface Props { siteId: string | undefined; }

export function RecentBatches({ siteId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-recent-batches", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("batches")
        .select("id, batch_code, product_name, quantity_produced, quantity_unit, use_by_date, status")
        .eq("site_id", siteId!)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent batches</h2>
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-5 text-center bg-muted/20">
        <Package className="h-5 w-5 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium mt-2">No batches yet</p>
        <Link to="/batches" className="text-xs text-primary hover:underline">Start a batch →</Link>
      </Card>
    );
  }

  const todayMs = Date.now();
  const daysUntil = (d: string | null) => d ? Math.round((new Date(d).getTime() - todayMs) / 86400000) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent batches</h2>
        <Link to="/batches" className="text-xs text-primary hover:underline">View all</Link>
      </div>
      <div className="space-y-2">
        {data.map((b: any) => {
          const d = daysUntil(b.use_by_date);
          const soon = d !== null && d >= 0 && d <= 2;
          const expired = d !== null && d < 0;
          return (
            <Link key={b.id} to="/batches" className="group block">
              <Card className="p-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.product_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {b.quantity_produced ? `${b.quantity_produced} ${b.quantity_unit ?? ""}` : "—"}
                    </span>
                    {b.use_by_date && (
                      <span className="text-xs text-muted-foreground">· Use by {b.use_by_date}</span>
                    )}
                    {expired && <Badge variant="outline" className="text-[10px] border-breach/40 text-breach">Expired</Badge>}
                    {soon && <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">Use soon</Badge>}
                  </div>
                  {b.batch_code && <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{b.batch_code}</p>}
                </div>
                <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{b.status}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
