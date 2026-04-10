import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText, Download, ShieldCheck, ClipboardCheck, SprayCan, Thermometer,
  Truck, AlertTriangle, Wheat, Bug, Users, CheckCircle2, BarChart3,
  TrendingUp, TrendingDown, ArrowRight, Info, Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const pillars = [
  {
    name: "Hygienic Handling of Food",
    score: 85, prevScore: 82,
    icon: ClipboardCheck,
    details: [
      { label: "Daily day sheets completed", value: "96%", status: "good", drilldown: "/day-sheet" },
      { label: "Cooking temps logged", value: "100%", status: "good", drilldown: "/temperatures" },
      { label: "Cooling logs compliant", value: "88%", status: "ok", drilldown: "/temperatures" },
      { label: "Cross-contamination incidents", value: "1 (minor)", status: "warning", drilldown: "/incidents" },
      { label: "Allergen matrix reviewed", value: "Up to date", status: "good", drilldown: "/allergens" },
    ],
  },
  {
    name: "Premises & Cleanliness",
    score: 72, prevScore: 68,
    icon: SprayCan,
    details: [
      { label: "Daily cleaning completion", value: "78%", status: "warning", drilldown: "/cleaning" },
      { label: "Weekly cleaning completion", value: "65%", status: "warning", drilldown: "/cleaning" },
      { label: "Pest control — open issues", value: "1 (fly screen)", status: "warning", drilldown: "/pest-maintenance" },
      { label: "Maintenance — open issues", value: "2", status: "warning", drilldown: "/pest-maintenance" },
      { label: "Monthly deep clean", value: "Overdue", status: "bad", drilldown: "/cleaning" },
    ],
  },
  {
    name: "Management Confidence",
    score: 90, prevScore: 88,
    icon: ShieldCheck,
    details: [
      { label: "HACCP plan reviewed", value: "Jan 2025", status: "good", drilldown: "/settings" },
      { label: "Staff training up to date", value: "4/4 staff", status: "good", drilldown: "/settings" },
      { label: "Day sheets locked by manager", value: "28/30 days", status: "good", drilldown: "/day-sheet" },
      { label: "Incidents with corrective actions", value: "100%", status: "good", drilldown: "/incidents" },
      { label: "Supplier approvals current", value: "5/6", status: "ok", drilldown: "/suppliers" },
    ],
  },
];

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
  { icon: ClipboardCheck, label: "Daily Records (opening/closing)", included: true },
  { icon: Thermometer, label: "Temperature Charts + Breach Evidence", included: true },
  { icon: SprayCan, label: "Cleaning Completion %", included: true },
  { icon: ShieldCheck, label: "HACCP Summary + Last Review", included: true },
  { icon: Wheat, label: "Allergen Matrix + Review Date", included: true },
  { icon: Users, label: "Training Matrix", included: true },
  { icon: Truck, label: "Supplier List + Delivery Accept %", included: true },
  { icon: AlertTriangle, label: "Incident Register + Corrective Actions", included: true },
  { icon: Bug, label: "Pest Control & Maintenance Log", included: true },
];

const topFixes = [
  { text: "Complete overdue monthly deep clean", link: "/cleaning", severity: "high" },
  { text: "Approve remaining supplier (1 outstanding)", link: "/suppliers", severity: "medium" },
  { text: "Lock 2 missing day sheets", link: "/day-sheet", severity: "low" },
];

const monthlyStats = [
  { month: "Jan", score: 82 },
  { month: "Feb", score: 78 },
  { month: "Mar", score: 85 },
  { month: "Apr", score: 82 },
];

const Reports = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState("4weeks");
  const overallScore = Math.round(pillars.reduce((sum, p) => sum + p.score, 0) / pillars.length);
  const ratingEstimate = overallScore >= 85 ? 5 : overallScore >= 70 ? 4 : overallScore >= 55 ? 3 : overallScore >= 40 ? 2 : 1;

  const hasBlockers = pillars.some(p => p.details.some(d => d.status === 'bad'));
  const readinessStatus = hasBlockers ? 'Attention Needed' : 'Ready';

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
            <p className="text-sm text-muted-foreground">Your compliance at a glance</p>
          </div>
        </div>
      </div>

      {/* Date range + data completeness */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-36">
            <Calendar className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="4weeks">Last 4 weeks</SelectItem>
            <SelectItem value="3months">Last 3 months</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">
          Data completeness: 87%
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Disclaimer */}
      <Alert className="border-warning/30 bg-warning/5">
        <Info className="h-4 w-4 text-warning" />
        <AlertDescription className="text-xs text-muted-foreground">
          <strong>Disclaimer:</strong> The estimated food hygiene rating is an indication only, based on data recorded in this app.
          The actual council score may differ due to factors outside the data we hold, including physical inspection observations
          and officer discretion. This tool supports — but does not replace — professional assessment.
        </AlertDescription>
      </Alert>

      {/* Rating Estimate */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground mb-2">Estimated Food Hygiene Rating</p>
            <div className="flex items-center justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className={`h-10 w-10 rounded-lg flex items-center justify-center font-heading font-bold text-lg ${
                  n <= ratingEstimate ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {n}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on current compliance across all 3 inspection pillars
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Inspection Pack Readiness */}
      <Card className={hasBlockers ? 'border-warning/30' : 'border-success/30'}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasBlockers ? (
              <AlertTriangle className="h-4 w-4 text-warning" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-success" />
            )}
            <div>
              <p className="text-sm font-heading font-semibold">
                Inspection Pack: <span className={hasBlockers ? 'text-warning' : 'text-success'}>{readinessStatus}</span>
              </p>
              {hasBlockers && (
                <p className="text-xs text-muted-foreground">Resolve blockers below before your next inspection</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 3 Fixes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Top Fixes This Week
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topFixes.map((fix, i) => (
            <button
              key={i}
              onClick={() => navigate(fix.link)}
              className="w-full flex items-center justify-between text-left p-2 rounded hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${
                  fix.severity === 'high' ? 'border-breach text-breach' :
                  fix.severity === 'medium' ? 'border-warning text-warning' :
                  'border-primary text-primary'
                }`}>
                  {i + 1}
                </Badge>
                <span className="text-sm">{fix.text}</span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
        </CardContent>
      </Card>

      {/* 3 Pillars */}
      <div className="space-y-4">
        {pillars.map((pillar, idx) => {
          const trend = pillar.score - pillar.prevScore;
          return (
            <motion.div key={pillar.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <pillar.icon className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm font-heading">{pillar.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {trend !== 0 && (
                        <span className={`flex items-center text-xs ${trend > 0 ? 'text-success' : 'text-breach'}`}>
                          {trend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                          {Math.abs(trend)}%
                        </span>
                      )}
                      <span className={`font-heading font-bold text-lg ${pillar.score >= 80 ? "text-success" : pillar.score >= 60 ? "text-warning" : "text-breach"}`}>
                        {pillar.score}%
                      </span>
                    </div>
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
                          <ArrowRight className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
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

      {/* Export Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Download className="h-4 w-4" /> Generate Inspection Pack
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

          <Button className="w-full gap-2" size="lg">
            <Download className="h-4 w-4" /> Export Inspection Pack (PDF)
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Generates a comprehensive PDF with all records, charts, and evidence for the selected period.
            The disclaimer above will be included in the exported document.
          </p>
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Compliance Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 h-32">
            {monthlyStats.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold">{m.score}%</span>
                <div className="w-full bg-muted rounded-t-sm overflow-hidden" style={{ height: "100%" }}>
                  <div
                    className={`w-full rounded-t-sm transition-all ${m.score >= 80 ? "bg-success" : m.score >= 60 ? "bg-warning" : "bg-breach"}`}
                    style={{ height: `${m.score}%`, marginTop: `${100 - m.score}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{m.month}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
