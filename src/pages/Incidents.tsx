import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Plus, CheckCircle2, Clock, ShieldCheck, Loader2, Circle } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { incidentCurrentStage, incidentStageTimeline, nextIncidentAction, type IncidentStageKey } from "@/lib/incidentStages";

const incidentTypes = [
  { value: "temp-breach", label: "Temperature Breach" },
  { value: "contamination", label: "Contamination Risk" },
  { value: "allergen", label: "Allergen Risk" },
  { value: "foreign-body", label: "Foreign Body" },
  { value: "pest", label: "Pest Issue" },
  { value: "structural", label: "Structural Issue" },
  { value: "complaint", label: "Customer Complaint" },
];

const rootCauses = ["Equipment failure","Human error","Supplier issue","Cleaning gap","Training gap","Process not followed","Environmental / external","Unknown — under investigation"];

const statusBadge = (incident: any) => {
  switch (incidentCurrentStage(incident)) {
    case "reported": return <Badge className="bg-breach/10 text-breach border-0 text-[10px]"><Clock className="h-3 w-3 mr-1" /> Reported</Badge>;
    case "resolved": return <Badge className="bg-warning/10 text-warning border-0 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" /> Resolved</Badge>;
    case "corrective_action": return <Badge className="bg-warning/10 text-warning border-0 text-[10px]"><ShieldCheck className="h-3 w-3 mr-1" /> Corrective action</Badge>;
    case "verified": return <Badge className="bg-success/10 text-success border-0 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>;
    default: return null;
  }
};

const Incidents = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";
  const { canWrite, isSupervisorPlus } = useRole();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("all");
  const [formType, setFormType] = useState(""); const [formTitle, setFormTitle] = useState(""); const [formDesc, setFormDesc] = useState("");
  const [formAction, setFormAction] = useState(""); const [formRoot, setFormRoot] = useState(""); const [formPrevention, setFormPrevention] = useState("");
  const [stageIncident, setStageIncident] = useState<any>(null);
  const [stageNote, setStageNote] = useState("");

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents", siteId], queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("incidents").select("*").eq("site_id", siteId).order("reported_at", { ascending: false }).limit(100);
      if (error) throw error; return data;
    }, enabled: !!siteId,
  });

  const saveIncident = useMutation({
    mutationFn: async () => {
      if (!siteId || !organisationId) throw new Error("Select a site before reporting an incident.");
      const { error } = await supabase.from("incidents").insert({
        site_id: siteId, organisation_id: organisationId, type: formType, title: formTitle,
        description: formDesc, immediate_action: formAction, root_cause: formRoot || null,
        prevention: formPrevention || null, reported_by_user_id: appUser?.id || null, reported_by_name: userName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", siteId] }); setShowNew(false);
      setFormType(""); setFormTitle(""); setFormDesc(""); setFormAction(""); setFormRoot(""); setFormPrevention("");
      toast.success("Incident reported!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const advanceStage = useMutation({
    mutationFn: async ({ id, stage, note }: { id: string; stage: Exclude<IncidentStageKey, "reported">; note: string }) => {
      const { error } = await supabase.rpc("advance_incident_stage", { _incident_id: id, _stage: stage, _note: note });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents", siteId] });
      setStageIncident(null);
      setStageNote("");
      toast.success("Incident timeline updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = filter === "all" ? incidents : incidents.filter((i: any) => incidentCurrentStage(i) === filter);
  const actionLabels: Record<string, string> = {
    resolved: "Record resolution",
    corrective_action: "Complete corrective action",
    verified: "Verify and close",
  };

  if (!siteId) return <div className="p-6 text-center text-muted-foreground">No site selected.</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-warning" /></div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Incidents</h1>
            <p className="text-sm text-muted-foreground">{incidents.filter((i: any) => i.status !== "verified").length} unresolved</p>
          </div>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2"><Plus className="h-4 w-4" /> Report issue</Button>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        {[
          { value: "all", label: "All" },
          { value: "reported", label: "Reported" },
          { value: "resolved", label: "Resolved" },
          { value: "corrective_action", label: "Corrective action" },
          { value: "verified", label: "Verified" },
        ].map(f => (
          <Button key={f.value} variant={filter === f.value ? "default" : "outline"} size="sm" onClick={() => setFilter(f.value)} className="text-xs shrink-0">{f.label}</Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((incident: any) => {
          const currentStage = incidentCurrentStage(incident);
          const nextAction = nextIncidentAction(incident);
          const canTakeNextAction = canWrite && nextAction && (nextAction !== "verified" || isSupervisorPlus);
          return (
            <motion.div key={incident.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={currentStage === "reported" ? "border-breach/30" : ""}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading font-semibold text-sm truncate">{incident.title}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {incidentTypes.find(t=>t.value===incident.type)?.label || incident.type}
                        {" · "}
                        {new Date(incident.reported_at).toLocaleDateString("en-GB")}
                        {" · "}
                        {incident.reported_by_name}
                      </p>
                    </div>
                    <div className="shrink-0">{statusBadge(incident)}</div>
                  </div>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="timeline" className="border-0">
                      <AccordionTrigger className="py-2 text-xs text-muted-foreground">View timeline</AccordionTrigger>
                      <AccordionContent className="space-y-3 pt-1">
                        {incidentStageTimeline(incident).map((stage) => (
                          <div key={stage.key} className="flex gap-3">
                            {stage.state === "complete" ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" /> :
                              stage.state === "current" ? <Clock className="h-4 w-4 mt-0.5 text-warning shrink-0" /> :
                              <Circle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground">{stage.label}</p>
                              {stage.note && <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{stage.note}</p>}
                              {(stage.at || stage.actor) && <p className="text-[11px] text-muted-foreground">{stage.actor || "Unknown"}{stage.at ? ` · ${new Date(stage.at).toLocaleString("en-GB")}` : ""}</p>}
                            </div>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  {nextAction && (
                    <Button variant={currentStage === "reported" ? "default" : "outline"} size="sm" className="w-full text-xs gap-1"
                      disabled={!canTakeNextAction}
                      onClick={() => { setStageIncident(incident); setStageNote(""); }}>
                      <ShieldCheck className="h-3 w-3" /> {actionLabels[nextAction]}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {filtered.length === 0 && !isLoading && (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="No incidents logged"
            description="Log an incident to keep your compliance records complete and inspection-ready."
            action={<Button onClick={() => setShowNew(true)} className="gap-2"><Plus className="h-4 w-4" /> Log incident</Button>}
          />
        )}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Report issue</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-sm">Type</Label><Select value={formType} onValueChange={setFormType}><SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger><SelectContent>{incidentTypes.map(t=><SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-sm">Title</Label><Input placeholder="Brief summary..." value={formTitle} onChange={e=>setFormTitle(e.target.value)} /></div>
            <div><Label className="text-sm">What happened</Label><Textarea placeholder="Describe it briefly..." value={formDesc} onChange={e=>setFormDesc(e.target.value)} className="text-sm" /></div>
            <div><Label className="text-sm">What you did</Label><Textarea placeholder="The immediate fix..." value={formAction} onChange={e=>setFormAction(e.target.value)} className="text-sm" /></div>
            <div><Label className="text-sm">Why it happened</Label><Select value={formRoot} onValueChange={setFormRoot}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{rootCauses.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-sm">How to prevent it</Label><Textarea placeholder="What will stop this happening again?" value={formPrevention} onChange={e=>setFormPrevention(e.target.value)} className="text-sm" /></div>
            <Button className="w-full" disabled={!formType||!formTitle||!formAction} onClick={()=>saveIncident.mutate()}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!stageIncident} onOpenChange={(open) => { if (!open) { setStageIncident(null); setStageNote(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">{stageIncident ? actionLabels[nextIncidentAction(stageIncident) || ""] : "Update incident"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Evidence note</Label>
              <Textarea value={stageNote} onChange={(event) => setStageNote(event.target.value)} className="min-h-28 text-sm" placeholder="Record what happened at this stage..." />
            </div>
            <Button className="w-full" disabled={!stageNote.trim() || advanceStage.isPending} onClick={() => {
              const next = stageIncident ? nextIncidentAction(stageIncident) : null;
              if (!stageIncident || !next) return;
              advanceStage.mutate({ id: stageIncident.id, stage: next, note: stageNote.trim() });
            }}>
              {advanceStage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save stage
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Incidents;
