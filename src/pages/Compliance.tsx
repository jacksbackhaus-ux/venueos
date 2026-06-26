/**
 * Stay Compliant — section landing / command centre.
 *
 * Reuses `fetchReportData` from src/lib/reports.ts (the same engine that
 * powers the Inspection Pack) so scores here will always match the export.
 * No new data systems, no new tables.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, Thermometer, SprayCan, AlertTriangle, GraduationCap,
  BookCheck, Wheat, FileText, ArrowRight, Loader2, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { buildRange, fetchReportData } from "@/lib/reports";
import type { ModuleName } from "@/lib/plans";

const QUICK_ACTIONS: { to: string; label: string; icon: React.ElementType; mod?: ModuleName }[] = [
  { to: "/temperatures",   label: "Temperatures",  icon: Thermometer,    mod: "temperatures" },
  { to: "/cleaning",       label: "Cleaning",      icon: SprayCan,       mod: "cleaning" },
  { to: "/incidents",      label: "Incidents",     icon: AlertTriangle,  mod: "incidents" },
  { to: "/staff-training", label: "Staff Training",icon: GraduationCap,  mod: "staff_training" },
  { to: "/haccp",          label: "HACCP",         icon: BookCheck,      mod: "haccp" },
  { to: "/allergens",      label: "Allergens",     icon: Wheat,          mod: "allergens" },
  { to: "/reports",        label: "Inspection Pack", icon: FileText,     mod: "reports" },
];

const READINESS_LABEL: Record<string, string> = {
  green: "Inspection ready",
  amber: "Almost ready — a few gaps",
  red: "Not inspection ready",
};
const READINESS_TONE: Record<string, string> = {
  green: "bg-success/10 text-success border-success/30",
  amber: "bg-warning/10 text-warning border-warning/30",
  red:   "bg-destructive/10 text-destructive border-destructive/30",
};

function pillarTone(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-destructive";
}

export default function Compliance() {
  const { appUser } = useAuth();
  const { currentSite } = useSite();
  const { isActive } = useModuleAccess();
  const siteId = currentSite?.id ?? null;
  const orgId = appUser?.organisation_id ?? null;
  const range = useMemo(() => buildRange("4weeks"), []);

  const { data, isLoading } = useQuery({
    queryKey: ["compliance-overview", siteId, orgId, range.key],
    enabled: !!siteId && !!orgId,
    queryFn: () => fetchReportData(siteId!, orgId!, range),
    staleTime: 60_000,
  });

  if (!siteId) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Select a site to view compliance.
        </CardContent></Card>
      </div>
    );
  }

  const actions = QUICK_ACTIONS.filter(a => !a.mod || isActive(a.mod));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 pb-12">
      <SEO title="Stay Compliant — MiseOS" description="Inspection readiness across the three UK Food Hygiene Rating pillars." path="/compliance" noindex />
      <header className="space-y-1">
        <h1 className="font-heading font-bold text-2xl flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Stay Compliant
        </h1>
        <p className="text-sm text-muted-foreground">
          Your inspection readiness across the three UK Food Hygiene Rating pillars. Based on the last {range.days} days.
        </p>
      </header>

      {isLoading || !data ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </CardContent></Card>
      ) : (
        <>
          {/* Inspection readiness hero */}
          <Card className="overflow-hidden">
            <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5">
              <div className="md:w-1/3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Inspection readiness</p>
                <p className="font-heading font-bold text-5xl tabular-nums leading-none mt-2">
                  {data.overallScore}<span className="text-2xl text-muted-foreground">/100</span>
                </p>
                <Badge variant="outline" className={`mt-3 ${READINESS_TONE[data.readiness]}`}>
                  {READINESS_LABEL[data.readiness]}
                </Badge>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Estimated rating: {data.ratingEstimate}/5 · Data completeness {data.dataCompleteness}%
                </p>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.pillars.map((p) => (
                  <div key={p.key} className="rounded-lg border bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.name}</p>
                    <p className={`font-heading font-bold text-3xl tabular-nums mt-1 ${pillarTone(p.score)}`}>
                      {p.score}
                    </p>
                    <Progress value={p.score} className="h-1.5 mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top compliance issues */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top compliance issues</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.topFixes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nothing flagged — keep going.
                </p>
              ) : (
                <ul className="divide-y">
                  {data.topFixes.slice(0, 5).map((fix, i) => (
                    <li key={i}>
                      <Link to={fix.link} className="flex items-center gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded">
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            fix.severity === "high" ? "bg-destructive"
                              : fix.severity === "medium" ? "bg-warning" : "bg-muted-foreground"
                          }`}
                        />
                        <span className="text-sm flex-1">{fix.text}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Strengths (subtle, optional) */}
          {data.topStrengths.length > 0 && (
            <Card className="bg-success/5 border-success/20">
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-wider text-success/80 font-semibold mb-2">
                  What's working
                </p>
                <ul className="space-y-1">
                  {data.topStrengths.slice(0, 3).map((s, i) => (
                    <li key={i} className="text-sm text-foreground/90">· {s.text}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Quick actions into compliance modules */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Jump to a module
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {actions.map((a) => (
                <Link key={a.to} to={a.to}>
                  <Card className="p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors active:scale-[0.99]">
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <a.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium truncate flex-1">{a.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
