import { motion } from "framer-motion";
import { Scale, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LabourVsWasteCardProps {
  siteId: string;
  organisationId: string;
  date: string; // YYYY-MM-DD
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export const LabourVsWasteCard = ({ siteId, organisationId, date }: LabourVsWasteCardProps) => {
  // Module activation gate
  const { data: modules } = useQuery({
    queryKey: ["lvw-modules", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("module_activation")
        .select("module_name, is_active")
        .eq("site_id", siteId)
        .in("module_name", ["timesheets", "waste_log"]);
      const map = new Map((data ?? []).map((m: any) => [m.module_name, m.is_active]));
      return {
        timesheets: !!map.get("timesheets"),
        waste_log: !!map.get("waste_log"),
      };
    },
  });

  const enabled = !!siteId && !!modules?.timesheets && !!modules?.waste_log;

  const { data } = useQuery({
    queryKey: ["lvw-data", siteId, date],
    enabled,
    queryFn: async () => {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;

      const [wasteRes, entriesRes, orgCostRes] = await Promise.all([
        supabase
          .from("waste_logs")
          .select("estimated_cost")
          .eq("site_id", siteId)
          .gte("logged_at", dayStart)
          .lte("logged_at", dayEnd),
        supabase
          .from("timesheet_entries")
          .select("user_id, clock_in, clock_out, break_minutes")
          .eq("site_id", siteId)
          .gte("clock_in", dayStart)
          .lte("clock_in", dayEnd),
        supabase
          .from("org_cost_settings")
          .select("labour_hourly_rate")
          .eq("organisation_id", organisationId)
          .maybeSingle(),
      ]);

      const wasteCost = (wasteRes.data ?? []).reduce(
        (sum: number, r: any) => sum + (Number(r.estimated_cost) || 0),
        0,
      );

      const entries = (entriesRes.data ?? []) as any[];
      const userIds = Array.from(new Set(entries.map((e) => e.user_id).filter(Boolean)));
      let rateByUser = new Map<string, number | null>();
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, hourly_rate")
          .in("id", userIds);
        rateByUser = new Map((usersData ?? []).map((u: any) => [u.id, u.hourly_rate]));
      }

      const orgRate = Number(orgCostRes.data?.labour_hourly_rate) || 0;
      let labourCost = 0;
      for (const e of entries) {
        if (!e.clock_out) continue;
        const ms = new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime();
        const hours = Math.max(0, ms / 3_600_000 - (Number(e.break_minutes) || 0) / 60);
        const rate = Number(rateByUser.get(e.user_id) ?? orgRate) || orgRate;
        labourCost += hours * rate;
      }

      return { wasteCost, labourCost };
    },
  });

  if (!enabled) return null;

  const wasteCost = data?.wasteCost ?? 0;
  const labourCost = data?.labourCost ?? 0;
  const ratio = labourCost > 0 ? wasteCost / labourCost : 0;

  let status: "ok" | "warn" | "alert" = "ok";
  if (labourCost > 0) {
    if (ratio >= 0.3) status = "alert";
    else if (ratio >= 0.15) status = "warn";
  }

  const statusConfig =
    status === "alert"
      ? {
          label: "Waste is significantly high — review today's production",
          icon: AlertTriangle,
          classes: "bg-breach/10 text-breach border-breach/30",
        }
      : status === "warn"
      ? {
          label: "Waste is higher than usual",
          icon: AlertTriangle,
          classes: "bg-warning/10 text-warning border-warning/30",
        }
      : {
          label: "Labour and waste on track",
          icon: CheckCircle2,
          classes: "bg-success/10 text-success border-success/30",
        };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

  const StatusIcon = statusConfig.icon;

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="md:col-span-2">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              Labour Cost vs Waste
            </CardTitle>
            {labourCost > 0 && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {Math.round(ratio * 100)}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Today's balance at a glance</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Labour cost</p>
              <p className="text-2xl font-heading font-bold text-foreground mt-1">{fmt(labourCost)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Waste cost</p>
              <p className="text-2xl font-heading font-bold text-foreground mt-1">{fmt(wasteCost)}</p>
            </div>
          </div>
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${statusConfig.classes}`}
          >
            <StatusIcon className="h-4 w-4 shrink-0" />
            <span>{statusConfig.label}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
