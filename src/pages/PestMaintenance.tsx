import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bug,
  Wrench,
  Plus,
  Camera,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PestLog = {
  id: string;
  type: string;
  location: string;
  description: string;
  date: string;
  time: string;
  reportedBy: string;
  actionTaken: string;
  resolved: boolean;
};

type MaintenanceLog = {
  id: string;
  item: string;
  issue: string;
  priority: "low" | "medium" | "high";
  date: string;
  reportedBy: string;
  status: "open" | "in-progress" | "resolved";
  resolution?: string;
};

const initialPestLogs: PestLog[] = [
  { id: "p1", type: "Fly", location: "Back door area", description: "Several flies near delivery door during morning", date: "2025-04-07", time: "10:30", reportedBy: "Tom B.", actionTaken: "Fly screen checked — gap found. Temporary fix applied. Contractor booked.", resolved: false },
  { id: "p2", type: "Mouse droppings", location: "Dry store", description: "Small droppings found behind flour shelf", date: "2025-03-28", time: "08:15", reportedBy: "Sarah M.", actionTaken: "Area deep cleaned. Pest contractor called same day. Bait stations refreshed. No further signs.", resolved: true },
];

const initialMaintenance: MaintenanceLog[] = [
  { id: "m1", item: "Walk-in Fridge 2", issue: "Temperature rising above 5°C intermittently", priority: "high", date: "2025-04-08", reportedBy: "Sarah M.", status: "in-progress", resolution: "Engineer booked for today PM" },
  { id: "m2", item: "Oven 1 door seal", issue: "Seal starting to wear — heat escaping", priority: "medium", date: "2025-04-05", reportedBy: "Tom B.", status: "open" },
  { id: "m3", item: "Hand wash basin (bakery)", issue: "Slow drainage", priority: "low", date: "2025-04-01", reportedBy: "Sarah M.", status: "resolved", resolution: "Plumber attended 02/04. Drain cleared." },
  { id: "m4", item: "Floor tiles (prep area)", issue: "Cracked tile near mixer — trip hazard", priority: "high", date: "2025-03-20", reportedBy: "Tom B.", status: "resolved", resolution: "Tile replaced 22/03." },
];

const preventativeChecks = [
  { id: "pc1", task: "Check all pest bait stations", frequency: "Weekly", lastDone: "2025-04-04", nextDue: "2025-04-11" },
  { id: "pc2", task: "Inspect fly screens and door seals", frequency: "Monthly", lastDone: "2025-03-15", nextDue: "2025-04-15" },
  { id: "pc3", task: "Review pest contractor report", frequency: "Monthly", lastDone: "2025-03-30", nextDue: "2025-04-30" },
  { id: "pc4", task: "Check external waste area condition", frequency: "Weekly", lastDone: "2025-04-07", nextDue: "2025-04-14" },
];

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/10 text-warning",
  high: "bg-breach/10 text-breach",
};

const statusColors: Record<string, string> = {
  open: "bg-breach/10 text-breach",
  "in-progress": "bg-warning/10 text-warning",
  resolved: "bg-success/10 text-success",
};

const PestMaintenance = () => {
  const [activeTab, setActiveTab] = useState("pest");
  const [pestLogs, setPestLogs] = useState<PestLog[]>(initialPestLogs);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(initialMaintenance);
  const [showNewPest, setShowNewPest] = useState(false);
  const [showNewMaint, setShowNewMaint] = useState(false);

  // Pest form
  const [pestType, setPestType] = useState("");
  const [pestLocation, setPestLocation] = useState("");
  const [pestDesc, setPestDesc] = useState("");
  const [pestAction, setPestAction] = useState("");

  // Maintenance form
  const [maintItem, setMaintItem] = useState("");
  const [maintIssue, setMaintIssue] = useState("");
  const [maintPriority, setMaintPriority] = useState<"low" | "medium" | "high">("medium");

  const savePest = () => {
    const newLog: PestLog = {
      id: Date.now().toString(),
      type: pestType,
      location: pestLocation,
      description: pestDesc,
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      reportedBy: "You",
      actionTaken: pestAction,
      resolved: false,
    };
    setPestLogs((prev) => [newLog, ...prev]);
    setShowNewPest(false);
    setPestType(""); setPestLocation(""); setPestDesc(""); setPestAction("");
  };

  const saveMaint = () => {
    const newLog: MaintenanceLog = {
      id: Date.now().toString(),
      item: maintItem,
      issue: maintIssue,
      priority: maintPriority,
      date: new Date().toISOString().split("T")[0],
      reportedBy: "You",
      status: "open",
    };
    setMaintenanceLogs((prev) => [newLog, ...prev]);
    setShowNewMaint(false);
    setMaintItem(""); setMaintIssue(""); setMaintPriority("medium");
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bug className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Pest Control & Maintenance</h1>
            <p className="text-sm text-muted-foreground">Sightings, checks, and maintenance log</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="pest" className="flex-1">Pest Control</TabsTrigger>
          <TabsTrigger value="maintenance" className="flex-1">Maintenance</TabsTrigger>
          <TabsTrigger value="preventative" className="flex-1">Preventative</TabsTrigger>
        </TabsList>

        {/* Pest Control */}
        <TabsContent value="pest" className="mt-4 space-y-3">
          <Button onClick={() => setShowNewPest(true)} className="w-full sm:w-auto gap-2">
            <Plus className="h-4 w-4" /> Report Pest Sighting
          </Button>

          {pestLogs.map((log) => (
            <motion.div key={log.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={!log.resolved ? "border-warning/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-warning" />
                      <h3 className="font-heading font-semibold text-sm">{log.type}</h3>
                      {log.resolved ? (
                        <Badge className="bg-success/10 text-success border-0 text-[10px]">Resolved</Badge>
                      ) : (
                        <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Open</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{log.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <MapPin className="h-3 w-3" /> {log.location}
                  </p>
                  <p className="text-sm">{log.description}</p>
                  <p className="text-xs text-success mt-2 font-medium">Action: {log.actionTaken}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Reported by {log.reportedBy} at {log.time}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        {/* Maintenance */}
        <TabsContent value="maintenance" className="mt-4 space-y-3">
          <Button onClick={() => setShowNewMaint(true)} className="w-full sm:w-auto gap-2">
            <Plus className="h-4 w-4" /> Log Maintenance Issue
          </Button>

          {maintenanceLogs.map((log) => (
            <motion.div key={log.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-heading font-semibold text-sm">{log.item}</h3>
                      <Badge className={`${priorityColors[log.priority]} border-0 text-[10px]`}>{log.priority}</Badge>
                      <Badge className={`${statusColors[log.status]} border-0 text-[10px]`}>{log.status}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{log.date}</span>
                  </div>
                  <p className="text-sm">{log.issue}</p>
                  {log.resolution && (
                    <p className="text-xs text-success mt-1.5 font-medium">Resolution: {log.resolution}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">Reported by {log.reportedBy}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        {/* Preventative Checks */}
        <TabsContent value="preventative" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading">Scheduled Preventative Checks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {preventativeChecks.map((check) => {
                  const overdue = new Date(check.nextDue) < new Date();
                  return (
                    <div key={check.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className={`text-sm font-medium ${overdue ? "text-breach" : ""}`}>{check.task}</p>
                        <p className="text-xs text-muted-foreground">
                          {check.frequency} · Last: {new Date(check.lastDone).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={`text-[10px] ${overdue ? "text-breach border-breach/30" : ""}`}>
                          <Calendar className="h-3 w-3 mr-1" />
                          Next: {new Date(check.nextDue).toLocaleDateString("en-GB")}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Pest Dialog */}
      <Dialog open={showNewPest} onOpenChange={setShowNewPest}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Report Pest Sighting</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Type</Label>
              <Select value={pestType} onValueChange={setPestType}>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  {["Fly/flying insect", "Mouse/rat", "Mouse droppings", "Cockroach", "Bird", "Ant", "Other"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Location</Label>
              <Input placeholder="e.g. Back door, dry store..." value={pestLocation} onChange={(e) => setPestLocation(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Description</Label>
              <Textarea placeholder="What did you see?" value={pestDesc} onChange={(e) => setPestDesc(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-sm">Action taken</Label>
              <Textarea placeholder="What did you do about it?" value={pestAction} onChange={(e) => setPestAction(e.target.value)} className="text-sm" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2"><Camera className="h-4 w-4" /> Photo</Button>
              <Button className="flex-1" disabled={!pestType || !pestLocation || !pestAction} onClick={savePest}>Save Report</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Maintenance Dialog */}
      <Dialog open={showNewMaint} onOpenChange={setShowNewMaint}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Log Maintenance Issue</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Equipment / Area</Label>
              <Input placeholder="e.g. Oven 1, floor tiles..." value={maintItem} onChange={(e) => setMaintItem(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Issue description</Label>
              <Textarea placeholder="Describe the problem..." value={maintIssue} onChange={(e) => setMaintIssue(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Label className="text-sm">Priority</Label>
              <Select value={maintPriority} onValueChange={(v: "low" | "medium" | "high") => setMaintPriority(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High — Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2"><Camera className="h-4 w-4" /> Photo</Button>
              <Button className="flex-1" disabled={!maintItem || !maintIssue} onClick={saveMaint}>Save Issue</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PestMaintenance;
