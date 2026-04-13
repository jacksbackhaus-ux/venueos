import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Plus, CheckCircle2, Clock, ShieldCheck, Thermometer, Bug, Wheat, Package, Camera, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

const statusBadge = (status: string) => {
  switch (status) {
    case "open": return <Badge className="bg-breach/10 text-breach border-0 text-[10px]"><Clock className="h-3 w-3 mr-1" /> Open</Badge>;
    case "action-taken": return <Badge className="bg-warning/10 text-warning border-0 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" /> Action Taken</Badge>;
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
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("all");
  const [formType, setFormType] = useState(""); const [formTitle, setFormTitle] = useState(""); const [formDesc, setFormDesc] = useState("");
  const [formAction, setFormAction] = useState(""); const [formRoot, setFormRoot] = useState(""); const [formPrevention, setFormPrevention] = useState("");

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents", siteId], queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("incidents").select("*").eq("site_id", siteId).order("reported_at", { ascending: false }).limit(100);
      if (error) throw error; return data;
    }, enabled: !!siteId,
  });

  const saveIncident = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("incidents").insert({
        site_id: siteId!, organisation_id: organisationId!, type: formType, title: formTitle,
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

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const updates: any = { status: newStatus };
      if (newStatus === "verified") { updates.verified_by_name = userName; updates.verified_at = new Date().toISOString(); }
      const { error } = await supabase.from("incidents").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incidents", siteId] }),
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = filter === "all" ? incidents : incidents.filter((i: any) => i.status === filter);

  if (!siteId) return <div className="p-6 text-center text-muted-foreground">No site selected.</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-warning" /></div>
          <div><h1 className="text-xl font-heading font-bold text-foreground">Incidents & Corrective Actions</h1><p className="text-sm text-muted-foreground">{incidents.filter((i: any) => i.status !== "verified").length} unresolved</p></div>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2"><Plus className="h-4 w-4" /> Report Incident</Button>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      <div className="flex gap-2">
        {["all","open","action-taken","verified"].map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="text-xs capitalize">{f === "action-taken" ? "Action Taken" : f}</Button>
        ))}
      </div>

      {filtered.map((incident: any) => (
        <motion.div key={incident.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className={incident.status === "open" ? "border-breach/30" : ""}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {statusBadge(incident.status)}
                  <Badge variant="outline" className="text-[10px]">{incidentTypes.find(t=>t.value===incident.type)?.label || incident.type}</Badge>
                  {incident.module && <Badge variant="secondary" className="text-[10px]">{incident.module}</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(incident.reported_at).toLocaleDateString("en-GB")}</span>
              </div>
              <h3 className="font-heading font-semibold text-sm">{incident.title}</h3>
              <p className="text-sm text-muted-foreground">{incident.description}</p>
              <div className="space-y-1.5 pt-2 border-t text-xs">
                <div><span className="font-semibold text-foreground">Immediate action:</span> {incident.immediate_action}</div>
                {incident.root_cause && <div><span className="font-semibold text-foreground">Root cause:</span> {incident.root_cause}</div>}
                {incident.prevention && <div><span className="font-semibold text-foreground">Prevention:</span> {incident.prevention}</div>}
              </div>
              <div className="flex items-center justify-between pt-2 text-[10px] text-muted-foreground">
                <span>Reported by {incident.reported_by_name}</span>
                {incident.verified_by_name && <span>Verified by {incident.verified_by_name}</span>}
              </div>
              {incident.status !== "verified" && (
                <Button variant="outline" size="sm" className="w-full mt-2 text-xs gap-1"
                  onClick={() => updateStatus.mutate({ id: incident.id, newStatus: incident.status === "open" ? "action-taken" : "verified" })}>
                  <ShieldCheck className="h-3 w-3" /> {incident.status === "open" ? "Mark Action Taken" : "Verify & Close"}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
      {filtered.length === 0 && !isLoading && <p className="text-center text-sm text-muted-foreground py-8">No incidents found.</p>}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Report Incident</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-sm">Type</Label><Select value={formType} onValueChange={setFormType}><SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger><SelectContent>{incidentTypes.map(t=><SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-sm">Title</Label><Input placeholder="Brief summary..." value={formTitle} onChange={e=>setFormTitle(e.target.value)} /></div>
            <div><Label className="text-sm">Description</Label><Textarea placeholder="What happened?" value={formDesc} onChange={e=>setFormDesc(e.target.value)} className="text-sm" /></div>
            <div><Label className="text-sm">Immediate action taken</Label><Textarea placeholder="What did you do?" value={formAction} onChange={e=>setFormAction(e.target.value)} className="text-sm" /></div>
            <div><Label className="text-sm">Root cause</Label><Select value={formRoot} onValueChange={setFormRoot}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{rootCauses.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-sm">Prevention</Label><Textarea placeholder="What will prevent this?" value={formPrevention} onChange={e=>setFormPrevention(e.target.value)} className="text-sm" /></div>
            <Button className="w-full" disabled={!formType||!formTitle||!formAction} onClick={()=>saveIncident.mutate()}>Save Incident</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Incidents;
