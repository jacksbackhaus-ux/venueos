import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bug, Wrench, Plus, Clock, CheckCircle2, AlertTriangle,
  MapPin, Calendar, Loader2, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning/10 text-warning",
  high: "bg-destructive/10 text-destructive",
};
const statusColors: Record<string, string> = {
  open: "bg-destructive/10 text-destructive",
  "in-progress": "bg-warning/10 text-warning",
  resolved: "bg-success/10 text-success",
};

const PestMaintenance = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";

  const [activeTab, setActiveTab] = useState("pest");
  const [showNewPest, setShowNewPest] = useState(false);
  const [showNewMaint, setShowNewMaint] = useState(false);

  const [pestType, setPestType] = useState("");
  const [pestLocation, setPestLocation] = useState("");
  const [pestDesc, setPestDesc] = useState("");
  const [pestAction, setPestAction] = useState("");

  const [maintItem, setMaintItem] = useState("");
  const [maintIssue, setMaintIssue] = useState("");
  const [maintPriority, setMaintPriority] = useState<"low" | "medium" | "high">("medium");

  const { data: pestLogs = [], isLoading: pestLoading } = useQuery({
    queryKey: ["pest_logs", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("pest_logs")
        .select("*")
        .eq("site_id", siteId)
        .order("reported_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  const { data: maintLogs = [] } = useQuery({
    queryKey: ["maintenance_logs", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("maintenance_logs")
        .select("*")
        .eq("site_id", siteId)
        .order("reported_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  const { data: preventativeChecks = [] } = useQuery({
    queryKey: ["preventative_checks", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from("preventative_checks")
        .select("*")
        .eq("site_id", siteId)
        .eq("active", true)
        .order("next_due_at");
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // PPM tasks — graceful if table doesn't exist yet
  const { data: ppmTasks = [] } = useQuery({
    queryKey: ["ppm_tasks", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      try {
        const { data, error } = await supabase
          .from("ppm_tasks")
          .select("*, ppm_completions(completed_date, next_due_date)")
          .eq("site_id", siteId)
          .eq("is_active", true)
          .order("created_at");
        if (error) return [];
        return data || [];
      } catch {
        return [];
      }
    },
    enabled: !!siteId,
  });

  const savePest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pest_logs").insert({
        site_id: siteId!, organisation_id: organisationId!,
        type: pestType, location: pestLocation,
        description: pestDesc, action_taken: pestAction,
        reported_by_user_id: appUser?.id || null,
        reported_by_name: userName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pest_logs", siteId] });
      setShowNewPest(false);
      setPestType(""); setPestLocation(""); setPestDesc(""); setPestAction("");
      toast.success("Pest report saved!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveMaint = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("maintenance_logs").insert({
        site_id: siteId!, organisation_id: organisationId!,
        item: maintItem, issue: maintIssue, priority: maintPriority,
        reported_by_user_id: appUser?.id || null,
        reported_by_name: userName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_logs", siteId] });
      setShowNewMaint(false);
      setMaintItem(""); setMaintIssue(""); setMaintPriority("medium");
      toast.success("Issue logged!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!siteId) return (
    <div className="p-6 text-center text-muted-foreground">No site selected.</div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bug className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">
            Pest & Maintenance
          </h1>
          <p className="text-sm text-muted-foreground">
            Sightings, maintenance issues, and planned checks
          </p>
        </div>
      </div>

      {pestLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="pest" className="flex-1">Pest</TabsTrigger>
          <TabsTrigger value="maintenance" className="flex-1">Maintenance</TabsTrigger>
          <TabsTrigger value="preventative" className="flex-1">Preventative</TabsTrigger>
          <TabsTrigger value="ppm" className="flex-1">PPM</TabsTrigger>
        </TabsList>

        {/* ── Pest tab ── */}
        <TabsContent value="pest" className="mt-4 space-y-3">
          <Button onClick={() => setShowNewPest(true)} className="w-full sm:w-auto gap-2">
            <Plus className="h-4 w-4" /> Report Pest Sighting
          </Button>
          {pestLogs.map((log: any) => (
            <motion.div key={log.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={!log.resolved ? "border-warning/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-warning" />
                      <h3 className="font-heading font-semibold text-sm">{log.type}</h3>
                      {log.resolved
                        ? <Badge className="bg-success/10 text-success border-0 text-[10px]">Resolved</Badge>
                        : <Badge className="bg-warning/10 text-warning border-0 text-[10px]">Open</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.reported_at).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <MapPin className="h-3 w-3" /> {log.location}
                  </p>
                  <p className="text-sm">{log.description}</p>
                  <p className="text-xs text-success mt-2 font-medium">Action: {log.action_taken}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Reported by {log.reported_by_name}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {pestLogs.length === 0 && !pestLoading && (
            <p className="text-center text-sm text-muted-foreground py-8">No pest reports.</p>
          )}
        </TabsContent>

        {/* ── Maintenance tab ── */}
        <TabsContent value="maintenance" className="mt-4 space-y-3">
          <Button onClick={() => setShowNewMaint(true)} className="w-full sm:w-auto gap-2">
            <Plus className="h-4 w-4" /> Log Maintenance Issue
          </Button>
          {maintLogs.map((log: any) => (
            <motion.div key={log.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-heading font-semibold text-sm">{log.item}</h3>
                      <Badge className={`${priorityColors[log.priority] || ""} border-0 text-[10px]`}>
                        {log.priority}
                      </Badge>
                      <Badge className={`${statusColors[log.status] || ""} border-0 text-[10px]`}>
                        {log.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.reported_at).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <p className="text-sm">{log.issue}</p>
                  {log.resolution && (
                    <p className="text-xs text-success mt-1.5 font-medium">
                      Resolution: {log.resolution}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Reported by {log.reported_by_name}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {maintLogs.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No maintenance issues.</p>
          )}
        </TabsContent>

        {/* ── Preventative tab ── */}
        <TabsContent value="preventative" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading">Scheduled Preventative Checks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {preventativeChecks.map((check: any) => {
                  const overdue = check.next_due_at && new Date(check.next_due_at) < new Date();
                  return (
                    <div key={check.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className={`text-sm font-medium ${overdue ? "text-destructive" : ""}`}>
                          {check.task}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {check.frequency}
                          {check.last_done_at
                            ? ` · Last: ${new Date(check.last_done_at).toLocaleDateString("en-GB")}`
                            : ""}
                        </p>
                      </div>
                      {check.next_due_at && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${overdue ? "text-destructive border-destructive/30" : ""}`}
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          Next: {new Date(check.next_due_at).toLocaleDateString("en-GB")}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {preventativeChecks.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No preventative checks configured.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PPM Schedule tab ── */}
        <TabsContent value="ppm" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Planned preventative maintenance tasks
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/ppm-schedule")}
            >
              Manage PPM
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {ppmTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">No PPM tasks set up yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add planned maintenance tasks to track them here.
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate("/ppm-schedule")}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add PPM tasks
                </Button>
              </CardContent>
            </Card>
          ) : (
            ppmTasks.map((task: any) => {
              const latestCompletion = task.ppm_completions?.[task.ppm_completions.length - 1];
              const nextDue = latestCompletion?.next_due_date;
              const overdue = nextDue && new Date(nextDue) < new Date();
              const dueSoon = nextDue && !overdue &&
                new Date(nextDue) <= new Date(Date.now() + 14 * 86400000);

              return (
                <Card
                  key={task.id}
                  className={
                    overdue
                      ? "border-destructive/30 bg-destructive/5"
                      : dueSoon
                      ? "border-warning/30 bg-warning/5"
                      : ""
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{task.task_name}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {task.frequency}
                          </Badge>
                          {task.category && (
                            <Badge variant="outline" className="text-[10px]">
                              {task.category}
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                        )}
                        {task.contractor_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Contractor: {task.contractor_name}
                          </p>
                        )}
                      </div>
                      {nextDue ? (
                        <Badge
                          className={`text-[10px] shrink-0 ${
                            overdue
                              ? "bg-destructive/10 text-destructive border-0"
                              : dueSoon
                              ? "bg-warning/10 text-warning border-0"
                              : "bg-success/10 text-success border-0"
                          }`}
                        >
                          {overdue ? (
                            <><AlertTriangle className="h-3 w-3 mr-1" /> Overdue</>
                          ) : dueSoon ? (
                            <><Clock className="h-3 w-3 mr-1" /> Due {new Date(nextDue).t
