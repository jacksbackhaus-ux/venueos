import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Plus,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Thermometer,
  Bug,
  Wheat,
  Package,
  XCircle,
  Camera,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Incident = {
  id: string;
  type: string;
  title: string;
  description: string;
  immediateAction: string;
  rootCause: string;
  prevention: string;
  date: string;
  time: string;
  reportedBy: string;
  status: "open" | "action-taken" | "verified";
  verifiedBy?: string;
  module?: string;
};

const incidentTypes = [
  { value: "temp-breach", label: "Temperature Breach", icon: Thermometer },
  { value: "contamination", label: "Contamination Risk", icon: AlertTriangle },
  { value: "allergen", label: "Allergen Risk", icon: Wheat },
  { value: "foreign-body", label: "Foreign Body", icon: Package },
  { value: "pest", label: "Pest Issue", icon: Bug },
  { value: "structural", label: "Structural Issue", icon: AlertTriangle },
  { value: "complaint", label: "Customer Complaint", icon: AlertTriangle },
];

const rootCauses = [
  "Equipment failure",
  "Human error",
  "Supplier issue",
  "Cleaning gap",
  "Training gap",
  "Process not followed",
  "Environmental / external",
  "Unknown — under investigation",
];

const initialIncidents: Incident[] = [
  {
    id: "i1", type: "temp-breach", title: "Fridge 2 temperature breach — 9.2°C",
    description: "Fridge 2 recorded at 9.2°C during AM check. Compressor struggling.",
    immediateAction: "All perishable food moved to Fridge 1. Display chiller used for overflow. Engineer called.",
    rootCause: "Equipment failure",
    prevention: "Engineer to inspect compressor. Consider replacement if recurring. Add extra PM check until resolved.",
    date: "2025-04-08", time: "08:50", reportedBy: "Sarah M.",
    status: "action-taken", module: "Temperatures",
  },
  {
    id: "i2", type: "allergen", title: "Sesame cross-contact near-miss",
    description: "Sesame seeds found on surface used for non-sesame products. Staff caught before use.",
    immediateAction: "Surface re-cleaned and sanitised. Products checked — none contaminated.",
    rootCause: "Process not followed",
    prevention: "Refresher training on allergen separation. Colour-coded boards reintroduced for sesame products.",
    date: "2025-04-06", time: "11:20", reportedBy: "Tom B.",
    status: "verified", verifiedBy: "Manager", module: "Allergens",
  },
  {
    id: "i3", type: "complaint", title: "Customer reported stale croissant",
    description: "Customer phoned to say croissant purchased today tasted stale/old.",
    immediateAction: "Refund offered. Remaining batch checked — 3 croissants from yesterday found in display (mis-dated).",
    rootCause: "Human error",
    prevention: "End-of-day date check added to closing procedure. Staff briefed.",
    date: "2025-04-03", time: "14:00", reportedBy: "Manager",
    status: "verified", verifiedBy: "Manager", module: "Day Sheet",
  },
];

const statusBadge = (status: string) => {
  switch (status) {
    case "open": return <Badge className="bg-breach/10 text-breach border-0 text-[10px]"><Clock className="h-3 w-3 mr-1" /> Open</Badge>;
    case "action-taken": return <Badge className="bg-warning/10 text-warning border-0 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" /> Action Taken</Badge>;
    case "verified": return <Badge className="bg-success/10 text-success border-0 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>;
    default: return null;
  }
};

const Incidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("all");

  // Form
  const [formType, setFormType] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAction, setFormAction] = useState("");
  const [formRoot, setFormRoot] = useState("");
  const [formPrevention, setFormPrevention] = useState("");

  const saveIncident = () => {
    const newIncident: Incident = {
      id: Date.now().toString(),
      type: formType,
      title: formTitle,
      description: formDesc,
      immediateAction: formAction,
      rootCause: formRoot,
      prevention: formPrevention,
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      reportedBy: "You",
      status: "open",
    };
    setIncidents((prev) => [newIncident, ...prev]);
    setShowNew(false);
    setFormType(""); setFormTitle(""); setFormDesc(""); setFormAction(""); setFormRoot(""); setFormPrevention("");
  };

  const filtered = filter === "all" ? incidents : incidents.filter((i) => i.status === filter);

  // Trend: count by type
  const typeCounts = incidents.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Incidents & Corrective Actions</h1>
            <p className="text-sm text-muted-foreground">
              {incidents.filter((i) => i.status !== "verified").length} unresolved
            </p>
          </div>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Report Incident
        </Button>
      </div>

      {/* Trend Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(typeCounts).slice(0, 4).map(([type, count]) => {
          const typeInfo = incidentTypes.find((t) => t.value === type);
          return (
            <Card key={type}>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-heading font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{typeInfo?.label || type}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["all", "open", "action-taken", "verified"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="text-xs capitalize">
            {f === "action-taken" ? "Action Taken" : f}
          </Button>
        ))}
      </div>

      {/* Incident List */}
      {filtered.map((incident) => (
        <motion.div key={incident.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className={incident.status === "open" ? "border-breach/30" : ""}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {statusBadge(incident.status)}
                  <Badge variant="outline" className="text-[10px]">{incidentTypes.find((t) => t.value === incident.type)?.label}</Badge>
                  {incident.module && <Badge variant="secondary" className="text-[10px]">{incident.module}</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{incident.date}</span>
              </div>

              <h3 className="font-heading font-semibold text-sm">{incident.title}</h3>
              <p className="text-sm text-muted-foreground">{incident.description}</p>

              <div className="space-y-1.5 pt-2 border-t text-xs">
                <div><span className="font-semibold text-foreground">Immediate action:</span> {incident.immediateAction}</div>
                <div><span className="font-semibold text-foreground">Root cause:</span> {incident.rootCause}</div>
                <div><span className="font-semibold text-foreground">Prevention:</span> {incident.prevention}</div>
              </div>

              <div className="flex items-center justify-between pt-2 text-[10px] text-muted-foreground">
                <span>Reported by {incident.reportedBy} at {incident.time}</span>
                {incident.verifiedBy && <span>Verified by {incident.verifiedBy}</span>}
              </div>

              {incident.status !== "verified" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs gap-1"
                  onClick={() =>
                    setIncidents((prev) =>
                      prev.map((i) =>
                        i.id === incident.id
                          ? { ...i, status: i.status === "open" ? "action-taken" : "verified", verifiedBy: i.status === "action-taken" ? "Manager" : undefined }
                          : i
                      )
                    )
                  }
                >
                  <ShieldCheck className="h-3 w-3" />
                  {incident.status === "open" ? "Mark Action Taken" : "Verify & Close"}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* New Incident Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Report Incident</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  {incidentTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Title</Label>
              <Input placeholder="Brief summary..." value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Description</Label>
              <Textarea placeholder="What happened?" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-sm">Immediate action taken</Label>
              <Textarea placeholder="What did you do straight away?" value={formAction} onChange={(e) => setFormAction(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-sm">Root cause</Label>
              <Select value={formRoot} onValueChange={setFormRoot}>
                <SelectTrigger><SelectValue placeholder="Select root cause..." /></SelectTrigger>
                <SelectContent>
                  {rootCauses.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Prevention steps</Label>
              <Textarea placeholder="What will prevent this happening again?" value={formPrevention} onChange={(e) => setFormPrevention(e.target.value)} className="text-sm" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2"><Camera className="h-4 w-4" /> Photo</Button>
              <Button className="flex-1" disabled={!formType || !formTitle || !formAction} onClick={saveIncident}>Save Incident</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Incidents;
