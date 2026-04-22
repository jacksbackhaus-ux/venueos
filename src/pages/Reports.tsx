import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText, Download, ShieldCheck, ClipboardCheck, SprayCan, Thermometer,
  Truck, AlertTriangle, Wheat, Bug, Users, CheckCircle2, BarChart3,
  ArrowRight, Info, Calendar, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSite } from "@/contexts/SiteContext";
import { toast } from "@/hooks/use-toast";
import { buildRange, fetchReportData, type DateRangeKey, type ReportData } from "@/lib/reports";
import { generateInspectionPackPdf } from "@/lib/reportPdf";
import { format } from "date-fns";

const statusColor = (s: string) => {
  switch (s) {
    case "good": return "text-success";
    case "ok": return "text-primary";
    case "warning": return "text-warning";
    case "bad": return "text-breach";
    default: return "text-muted-foreground";
  }
};

const reportSections = [
  { icon: ClipboardCheck, label: "Daily Records (day sheets, locked status)" },
  { icon: Thermometer, label: "Temperature readings + breach evidence" },
  { icon: SprayCan, label: "Cleaning schedule completion %" },
  { icon: ShieldCheck, label: "Management & lock-off summary" },
  { icon: Wheat, label: "Allergen matrix (recipes & approvals)" },
  { icon: Truck, label: "Delivery records + acceptance rates" },
  { icon: Users, label: "Approved supplier list" },
  { icon: AlertTriangle, label: "Incident register + corrective actions" },
  { icon: Bug, label: "Pest control & maintenance log" },
];

const Reports = () => {
  const navigate = useNavigate();
  const { currentSite, organisationId } = useSite();
  const [dateRange, setDateRange] = useState<DateRangeKey>("4weeks");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!currentSite || !organisationId) return;
    let cancelled = false;
    setLoading(true);
    fetchReportData(currentSite.id, organisationId, buildRange(dateRange))
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => {
        console.error(err);
        toast({ title: "Could not load reports", description: err.message, variant: "destructive" });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentSite, organisationId, dateRange]);

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      generateInspectionPackPdf(data);
      toast({ title: "Inspection Pack generated", description: "Your PDF has been downloaded." });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (!currentSite) {
    return <div className="p-6 text-sm text-muted-foreground">Select a site to view reports.</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Reports & Inspection Pack</h1>
            <p className="text-sm text-muted-foreground">{currentSite.name} · live compliance from your records</p>
          </div>
        </div>
      </div>

      {/* Date range + data completeness */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeKey)}>
          <SelectTrigger className="w-44">
            <Calendar className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="4weeks">Last 4 weeks</SelectItem>
            <SelectItem value="3months">Last 3 months</SelectItem>
            <SelectItem value="12months">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <>
            <Badge variant="outline" className="text-xs">Data completeness: {data.dataCompleteness}%</Badge>
            <span className="text-[10px] text-muted-foreground">
              {format(data.range.from, "d MMM")} – {format(data.range.to, "d MMM yyyy")}
            </span>
          </>
        )}
      </div>

      {/* Disclaimer */}
      <Alert className="border-warning/30 bg-warning/5">
        <Info className="h-4 w-4 text-warning" />
        <AlertDescription className="text-xs text-muted-foreground">
          <strong>Disclaimer:</strong> The estimated food hygiene rating is indicative only, based on records logged in this app.
          The actual EHO rating may differ due to physical inspection observations, evidence outside this system, and officer discretion.
        </AlertDescription>
      </Alert>

      {loading || !data ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading live data…
        </div>
      ) : (
        <>
          {/* Rating Estimate */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <p className="text-sm font-medium text-muted-foreground mb-2">Estimated Food Hygiene Rating</p>
                <div className="flex items-center justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className={`h-10 w-10 rounded-lg flex items-center justify-center font-heading font-bold text-lg ${
                      n <= data.ratingEstimate ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {n}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Overall compliance: <strong>{data.overallScore}%</strong> across all 3 inspection pillars
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Fixes */}
          {data.topFixes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Priority Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topFixes.map((fix, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(fix.link)}
                    className="w-full flex items-center justify-between text-left p-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${
                        fix.severity === 'high' ? 'border-breach text-breach' :
                        fix.severity === 'medium' ? 'border-warning text-warning' :
                        'border-primary text-primary'
                      }`}>
                        {i + 1}
                      </Badge>
                      <span className="text-sm truncate">{fix.text}</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 3 Pillars */}
          <div className="space-y-4">
            {data.pillars.map((pillar, idx) => {
              const Icon = pillar.key === "hygiene" ? ClipboardCheck : pillar.key === "premises" ? SprayCan : ShieldCheck;
              return (
                <motion.div key={pillar.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-heading">{pillar.name}</CardTitle>
                        </div>
                        <span className={`font-heading font-bold text-lg ${pillar.score >= 80 ? "text-success" : pillar.score >= 60 ? "text-warning" : "text-breach"}`}>
                          {pillar.score}%
                        </span>
                      </div>
                      <Progress value={pillar.score} className="h-1.5" />
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1.5">
                        {pillar.details.map((d) => (
                          <button
                            key={d.label}
                            onClick={() => navigate(d.drilldown)}
                            className="w-full flex items-center justify-between text-xs p-1 rounded hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-muted-foreground text-left">{d.label}</span>
                            <span className={`font-medium ${statusColor(d.status)} flex items-center gap-1`}>
                              {d.value}
                              <ArrowRight className="h-2.5 w-2.5" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Quick stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Temp logs</p>
              <p className="text-lg font-heading font-bold">{data.tempLogs.length}</p>
              <p className="text-[10px] text-breach">{data.tempBreaches.length} breach(es)</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Day sheets</p>
              <p className="text-lg font-heading font-bold">{data.daySheets.length}</p>
              <p className="text-[10px] text-muted-foreground">{data.daySheetsLockedPct}% locked</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Deliveries</p>
              <p className="text-lg font-heading font-bold">{data.deliveries.length}</p>
              <p className="text-[10px] text-muted-foreground">{data.deliveryAcceptPct}% accepted</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Open issues</p>
              <p className="text-lg font-heading font-bold">{data.openIncidents + data.openPestLogs + data.openMaintenance}</p>
              <p className="text-[10px] text-muted-foreground">incidents/pest/maint</p>
            </CardContent></Card>
          </div>

          {/* Export Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Download className="h-4 w-4" /> Generate EHO Inspection Pack
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium mb-2">Included in export:</p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {reportSections.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      <s.icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full gap-2" size="lg" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? "Generating PDF…" : "Export Inspection Pack (PDF)"}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                A multi-page A4 PDF with all records and evidence for the selected period. Includes the disclaimer above.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Reports;
