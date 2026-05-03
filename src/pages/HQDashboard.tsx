import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2, MapPin, CheckCircle2, AlertTriangle,
  ExternalLink, Shield, Thermometer, ClipboardList,
  ArrowRight, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { supabase } from "@/integrations/supabase/client";

interface SiteOverview {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  open_batches: number;
  quarantined_batches: number;
  temp_breaches: number;
  open_incidents: number;
  todays_tasks_total: number;
  todays_tasks_done: number;
  closed_today: boolean;
}

function complianceScore(done: number, total: number, closed: boolean) {
  if (closed) return 100; // Closed days are exempt from compliance.
  if (total === 0) return null;
  return Math.round((done / total) * 100);
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null)
    return <span className="text-xs text-muted-foreground">No tasks</span>;
  const color =
    score >= 80
      ? "bg-success/10 text-success border-success/20"
      : score >= 50
      ? "bg-warning/10 text-warning border-warning/20"
      : "bg-destructive/10 text-destructive border-destructive/20";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {score}%
    </span>
  );
}

export default function AllSitesOverview() {
  const { orgRole, appUser } = useAuth();
  const { setCurrentSiteId } = useSite();
  const navigate = useNavigate();
  const [sites, setSites] = useState<SiteOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    if (!appUser) return;
    setLoading(true);

    const todayIso = new Date().toISOString().slice(0, 10);

    const { data: sitesData } = await supabase
      .from("sites")
      .select("id, name, address, active")
      .order("name");

    const overviews: SiteOverview[] = [];

    for (const site of sitesData || []) {
      // Look up today's day sheet for this site (if any) so we can count entries.
      const { data: todaySheet } = await supabase
        .from("day_sheets")
        .select("id")
        .eq("site_id", site.id)
        .eq("sheet_date", todayIso)
        .maybeSingle();

      const [
        { count: openBatches },
        { count: quarantinedBatches },
        { count: tempBreaches },
        { count: openIncidents },
        { data: daySheetSections },
        { count: completedCount },
      ] = await Promise.all([
        supabase
          .from("batches")
          .select("*", { count: "exact", head: true })
          .eq("site_id", site.id)
          .eq("status", "in_progress"),
        supabase
          .from("batches")
          .select("*", { count: "exact", head: true })
          .eq("site_id", site.id)
          .eq("status", "quarantined"),
        supabase
          .from("temp_logs")
          .select("*", { count: "exact", head: true })
          .eq("site_id", site.id)
          .eq("pass", false)
          .gte("logged_at", `${todayIso}T00:00:00`)
          .lte("logged_at", `${todayIso}T23:59:59`),
        supabase
          .from("incidents")
          .select("*", { count: "exact", head: true })
          .eq("site_id", site.id)
          .in("status", ["open", "investigating"]),
        supabase
          .from("day_sheet_sections")
          .select("id, day_sheet_items(id)")
          .eq("site_id", site.id)
          .eq("active", true),
        todaySheet?.id
          ? supabase
              .from("day_sheet_entries")
              .select("*", { count: "exact", head: true })
              .eq("day_sheet_id", todaySheet.id)
              .eq("done", true)
          : Promise.resolve({ count: 0 } as { count: number }),
      ]);

      // Closed-day exemption: if today is marked closed for this site, skip compliance scoring.
      const { data: closedToday } = await supabase
        .from("closed_days")
        .select("id")
        .eq("site_id", site.id)
        .eq("closed_date", todayIso)
        .maybeSingle();

      const totalItems = (daySheetSections || []).reduce(
        (acc: number, s: { day_sheet_items?: { id: string }[] | null }) =>
          acc + (s.day_sheet_items?.length || 0),
        0,
      );

      overviews.push({
        ...site,
        open_batches: openBatches || 0,
        quarantined_batches: quarantinedBatches || 0,
        temp_breaches: tempBreaches || 0,
        open_incidents: openIncidents || 0,
        todays_tasks_total: totalItems,
        todays_tasks_done: completedCount || 0,
        closed_today: !!closedToday,
      });
    }

    setSites(overviews);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, [appUser]);

  const switchToSite = (siteId: string) => {
    setCurrentSiteId(siteId);
    navigate("/");
  };

  const viewSiteReports = (siteId: string) => {
    setCurrentSiteId(siteId);
    navigate("/reports");
  };

  if (
    !orgRole ||
    !["org_owner", "hq_admin", "hq_auditor"].includes(orgRole.org_role)
  ) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="font-heading font-bold text-lg">Access Denied</h2>
        <p className="text-sm text-muted-foreground">
          You need multi-site permissions to view this page.
        </p>
      </div>
    );
  }

  const activeSites = sites.filter((s) => s.active);
  const totalBreaches =
    sites.reduce((n, s) => n + s.temp_breaches, 0) +
    sites.reduce((n, s) => n + s.quarantined_batches, 0) +
    sites.reduce((n, s) => n + s.open_incidents, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">
              All Sites Overview
            </h1>
            <p className="text-xs text-muted-foreground">
              Last updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-heading font-bold text-foreground">
              {activeSites.length}
            </p>
            <p className="text-xs text-muted-foreground">Active Sites</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p
              className={`text-2xl font-heading font-bold ${
                totalBreaches > 0 ? "text-destructive" : "text-success"
              }`}
            >
              {totalBreaches}
            </p>
            <p className="text-xs text-muted-foreground">Active Alerts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-heading font-bold text-foreground">
              {activeSites.length > 0
                ? Math.round(
                    activeSites.reduce((sum, s) => {
                      const score = complianceScore(
                        s.todays_tasks_done,
                        s.todays_tasks_total,
                        s.closed_today
                      );
                      return sum + (score ?? 100);
                    }, 0) / activeSites.length
                  )
                : 0}
              %
            </p>
            <p className="text-xs text-muted-foreground">Avg Compliance</p>
          </CardContent>
        </Card>
      </div>

      {/* Sites */}
      <div className="space-y-3">
        <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Sites
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sites found.</p>
        ) : (
          sites.map((site, idx) => {
            const score = complianceScore(
              site.todays_tasks_done,
              site.todays_tasks_total
            );
            const hasAlerts =
              site.temp_breaches > 0 ||
              site.quarantined_batches > 0 ||
              site.open_incidents > 0;

            return (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card
                  className={
                    hasAlerts
                      ? "border-destructive/30 bg-destructive/5"
                      : ""
                  }
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Site name + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-heading font-bold text-sm">
                            {site.name}
                          </h3>
                          <Badge
                            variant={site.active ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {site.active ? "Active" : "Inactive"}
                          </Badge>
                          <ScoreBadge score={score} />
                        </div>
                        {site.address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {site.address}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Alert pills */}
                    <div className="flex flex-wrap gap-2">
                      {site.temp_breaches > 0 && (
                        <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 rounded-full px-2.5 py-1">
                          <Thermometer className="h-3 w-3" />
                          {site.temp_breaches} temp breach{site.temp_breaches > 1 ? "es" : ""}
                        </span>
                      )}
                      {site.quarantined_batches > 0 && (
                        <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 rounded-full px-2.5 py-1">
                          <AlertTriangle className="h-3 w-3" />
                          {site.quarantined_batches} quarantined batch{site.quarantined_batches > 1 ? "es" : ""}
                        </span>
                      )}
                      {site.open_incidents > 0 && (
                        <span className="flex items-center gap-1 text-xs text-warning bg-warning/10 rounded-full px-2.5 py-1">
                          <AlertTriangle className="h-3 w-3" />
                          {site.open_incidents} open incident{site.open_incidents > 1 ? "s" : ""}
                        </span>
                      )}
                      {site.todays_tasks_total > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                          <ClipboardList className="h-3 w-3" />
                          {site.todays_tasks_done}/{site.todays_tasks_total} tasks today
                        </span>
                      )}
                      {!hasAlerts &&
                        site.todays_tasks_total > 0 &&
                        site.todays_tasks_done === site.todays_tasks_total && (
                          <span className="flex items-center gap-1 text-xs text-success bg-success/10 rounded-full px-2.5 py-1">
                            <CheckCircle2 className="h-3 w-3" />
                            All clear
                          </span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => viewSiteReports(site.id)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Reports
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => switchToSite(site.id)}
                      >
                        Open Site
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
