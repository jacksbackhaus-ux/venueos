import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookCheck, Plus, Loader2, ArrowLeft, FileText, Trash2, Pencil,
  CheckCircle2, AlertTriangle, Clock, Printer, Download, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, addMonths, isBefore } from "date-fns";

// ============= Types =============
type StepType =
  | "process_step" | "hazard" | "critical_control_point"
  | "corrective_action" | "monitoring" | "verification";

interface HaccpPlan {
  id: string;
  site_id: string;
  organisation_id: string;
  name: string;
  food_business_type: string | null;
  status: "draft" | "published";
  last_reviewed_at: string | null;
  review_due_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface HaccpStep {
  id: string;
  plan_id: string;
  step_number: number;
  step_type: StepType;
  title: string;
  description: string | null;
  critical_limit: string | null;
  monitoring_procedure: string | null;
  corrective_action: string | null;
  responsible_person: string | null;
  sort_order: number;
  created_at: string;
}

// ============= HACCP Principles config =============
type Principle = {
  key: string;
  number: number;
  title: string;
  blurb: string;
  stepType: StepType | null; // null = record-keeping (handled differently)
  prompts: string[];
  fields: ("title"|"description"|"critical_limit"|"monitoring_procedure"|"corrective_action"|"responsible_person")[];
};

const PRINCIPLES: Principle[] = [
  {
    key: "hazard",
    number: 1,
    title: "Hazard Analysis",
    blurb: "Identify the biological, chemical, allergen and physical hazards in your food business.",
    stepType: "hazard",
    prompts: [
      "Think about each step from delivery to serving.",
      "Examples: bacterial growth in cooked rice, allergen cross-contact, foreign objects.",
    ],
    fields: ["title", "description"],
  },
  {
    key: "ccp",
    number: 2,
    title: "Critical Control Points",
    blurb: "List the steps where you must control a hazard to make food safe.",
    stepType: "critical_control_point",
    prompts: [
      "A CCP is a point where loss of control would cause real harm.",
      "Common CCPs: cooking, hot-holding, chilling, reheating.",
    ],
    fields: ["title", "description", "responsible_person"],
  },
  {
    key: "limits",
    number: 3,
    title: "Critical Limits",
    blurb: "Set the safe limits at each CCP — temperatures, times, pH, etc.",
    stepType: "critical_control_point",
    prompts: [
      "Use clear, measurable values: e.g. \"Core temp ≥ 75°C\".",
      "Limits should come from regulations or food-safety guidance.",
    ],
    fields: ["title", "critical_limit"],
  },
  {
    key: "monitoring",
    number: 4,
    title: "Monitoring Procedures",
    blurb: "Decide how, when, and by whom each CCP will be checked.",
    stepType: "monitoring",
    prompts: [
      "How will you measure? (probe, timer, visual)",
      "How often? Who is responsible?",
    ],
    fields: ["title", "monitoring_procedure", "responsible_person"],
  },
  {
    key: "corrective",
    number: 5,
    title: "Corrective Actions",
    blurb: "Plan what to do when a critical limit is not met.",
    stepType: "corrective_action",
    prompts: [
      "Examples: cook longer, discard product, recalibrate equipment.",
      "Always include who decides and what happens to the food.",
    ],
    fields: ["title", "corrective_action", "responsible_person"],
  },
  {
    key: "verification",
    number: 6,
    title: "Verification",
    blurb: "Confirm your HACCP system is working — through reviews, audits and tests.",
    stepType: "verification",
    prompts: [
      "Examples: weekly probe calibration, monthly review of logs, annual plan review.",
    ],
    fields: ["title", "description", "responsible_person"],
  },
  {
    key: "records",
    number: 7,
    title: "Record Keeping",
    blurb: "Keep clear records of monitoring, corrective actions and verification.",
    stepType: null,
    prompts: [
      "MiseOS automatically logs your temperatures, cleaning, deliveries and incidents.",
      "Make sure these match what's in your HACCP plan.",
    ],
    fields: [],
  },
];

const STEP_TYPE_LABEL: Record<StepType, string> = {
  process_step: "Process Step",
  hazard: "Hazard",
  critical_control_point: "Critical Control Point",
  monitoring: "Monitoring",
  corrective_action: "Corrective Action",
  verification: "Verification",
};

// ============= Page =============
export default function Haccp() {
  const { currentSite, organisationId } = useSite();
  const { appUser } = useAuth();
  const { isSupervisorPlus } = useRole();
  const qc = useQueryClient();
  const siteId = currentSite?.id;

  const [view, setView] = useState<"list" | "builder" | "published">("list");
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  // ---------- Plans query ----------
  const plansQ = useQuery({
    queryKey: ["haccp-plans", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<HaccpPlan[]> => {
      const { data, error } = await supabase
        .from("haccp_plans")
        .select("*")
        .eq("site_id", siteId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HaccpPlan[];
    },
  });

  if (!siteId) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Select a site to view HACCP plans.
        </CardContent></Card>
      </div>
    );
  }

  // ---------- Detail view ----------
  if ((view === "builder" || view === "published") && activePlanId) {
    const plan = plansQ.data?.find(p => p.id === activePlanId);
    if (!plan) {
      return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto">
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </CardContent></Card>
        </div>
      );
    }
    return view === "builder" ? (
      <PlanBuilder
        plan={plan}
        canEdit={isSupervisorPlus}
        onBack={() => { setView("list"); setActivePlanId(null); }}
        onView={() => setView("published")}
      />
    ) : (
      <PublishedPlanView
        plan={plan}
        canEdit={isSupervisorPlus}
        onBack={() => { setView("list"); setActivePlanId(null); }}
        onEdit={() => setView("builder")}
      />
    );
  }

  // ---------- List view ----------
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-3 flex-wrap"
      >
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <BookCheck className="h-6 w-6 text-primary" />
            HACCP Plan Builder
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build, publish and review your food safety management plans.
          </p>
        </div>
        {isSupervisorPlus && (
          <Button onClick={() => setNewDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New plan
          </Button>
        )}
      </motion.header>

      <Card>
        <CardContent className="p-0">
          {plansQ.isLoading ? (
            <div className="p-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : (plansQ.data ?? []).length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <BookCheck className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="font-medium">No HACCP plans yet</p>
              <p className="text-sm text-muted-foreground">
                {isSupervisorPlus ? "Create your first plan to get started." : "Your manager hasn't published a plan yet."}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {plansQ.data!.map(plan => {
                const overdue = plan.review_due_at && isBefore(parseISO(plan.review_due_at), new Date());
                return (
                  <li key={plan.id}>
                    <button
                      onClick={() => {
                        setActivePlanId(plan.id);
                        setView(plan.status === "published" && !isSupervisorPlus ? "published" : "builder");
                      }}
                      className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{plan.name}</span>
                          <Badge
                            variant="outline"
                            className={
                              plan.status === "published"
                                ? "text-xs border-success/30 text-success bg-success/10"
                                : "text-xs"
                            }
                          >
                            {plan.status === "published" ? "Published" : "Draft"}
                          </Badge>
                          {overdue && (
                            <Badge variant="outline" className="text-xs border-breach/30 text-breach bg-breach/10">
                              Review overdue
                            </Badge>
                          )}
                        </div>
                        {plan.food_business_type && (
                          <div className="text-xs text-muted-foreground">{plan.food_business_type}</div>
                        )}
                        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                          {plan.last_reviewed_at && (
                            <span className="inline-flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              Reviewed {format(parseISO(plan.last_reviewed_at), "d MMM yyyy")}
                            </span>
                          )}
                          {plan.review_due_at && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Next review {format(parseISO(plan.review_due_at), "d MMM yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <NewPlanDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        siteId={siteId}
        organisationId={organisationId!}
        createdBy={appUser?.id ?? null}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["haccp-plans", siteId] });
          setActivePlanId(id);
          setView("builder");
        }}
      />
    </div>
  );
}

// ============= New Plan Dialog =============
function NewPlanDialog({
  open, onOpenChange, siteId, organisationId, createdBy, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  siteId: string; organisationId: string; createdBy: string | null;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setType(""); };

  const submit = async () => {
    if (!name.trim()) return toast.error("Please name your plan.");
    setSaving(true);
    const { data, error } = await supabase.from("haccp_plans").insert({
      site_id: siteId,
      organisation_id: organisationId,
      name: name.trim(),
      food_business_type: type.trim() || null,
      status: "draft",
      created_by: createdBy,
    }).select("id").single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not create plan.");
      return;
    }
    toast.success("Plan created.");
    reset();
    onOpenChange(false);
    onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New HACCP plan</DialogTitle>
          <DialogDescription>
            Start a new plan as a draft — you can edit it as you work through each principle.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input
              id="plan-name"
              placeholder="e.g. Bakery Production HACCP"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-type">Food business type (optional)</Label>
            <Input
              id="plan-type"
              placeholder="e.g. Artisan bakery, café, deli"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= Plan Builder =============
function PlanBuilder({
  plan, canEdit, onBack, onView,
}: {
  plan: HaccpPlan; canEdit: boolean;
  onBack: () => void; onView: () => void;
}) {
  const qc = useQueryClient();
  const [stepDialog, setStepDialog] = useState<{ open: boolean; principle: Principle | null; existing: HaccpStep | null }>({
    open: false, principle: null, existing: null,
  });

  const stepsQ = useQuery({
    queryKey: ["haccp-steps", plan.id],
    queryFn: async (): Promise<HaccpStep[]> => {
      const { data, error } = await supabase
        .from("haccp_steps")
        .select("*")
        .eq("plan_id", plan.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HaccpStep[];
    },
  });

  const stepsByType = useMemo(() => {
    const m = new Map<StepType, HaccpStep[]>();
    (stepsQ.data ?? []).forEach(s => {
      if (!m.has(s.step_type)) m.set(s.step_type, []);
      m.get(s.step_type)!.push(s);
    });
    return m;
  }, [stepsQ.data]);

  const deleteStepM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("haccp_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["haccp-steps", plan.id] });
      toast.success("Removed.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete."),
  });

  const publishM = useMutation({
    mutationFn: async () => {
      const today = new Date();
      const dueDate = addMonths(today, 12);
      const { error } = await supabase
        .from("haccp_plans")
        .update({
          status: "published",
          last_reviewed_at: format(today, "yyyy-MM-dd"),
          review_due_at: format(dueDate, "yyyy-MM-dd"),
        })
        .eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["haccp-plans"] });
      toast.success("Plan published.");
      onView();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not publish."),
  });

  const unpublishM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("haccp_plans").update({ status: "draft" }).eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["haccp-plans"] });
      toast.success("Reverted to draft.");
    },
  });

  const deletePlanM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("haccp_plans").delete().eq("id", plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["haccp-plans"] });
      toast.success("Plan deleted.");
      onBack();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete."),
  });

  const totalSteps = stepsQ.data?.length ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1.5 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> All plans
          </Button>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold truncate">{plan.name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={
              plan.status === "published"
                ? "text-xs border-success/30 text-success bg-success/10"
                : "text-xs"
            }>
              {plan.status === "published" ? "Published" : "Draft"}
            </Badge>
            {plan.food_business_type && <span className="text-xs text-muted-foreground">{plan.food_business_type}</span>}
            <span className="text-xs text-muted-foreground">{totalSteps} entries</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onView}>
            <FileText className="h-4 w-4 mr-1.5" /> Preview
          </Button>
          {canEdit && plan.status === "draft" && (
            <Button size="sm" onClick={() => publishM.mutate()} disabled={publishM.isPending}>
              {publishM.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Publish
            </Button>
          )}
          {canEdit && plan.status === "published" && (
            <Button variant="outline" size="sm" onClick={() => unpublishM.mutate()} disabled={unpublishM.isPending}>
              Revert to draft
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="icon"
              onClick={() => { if (confirm("Delete this plan and all its steps?")) deletePlanM.mutate(); }}>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </header>

      <Accordion type="multiple" defaultValue={["hazard"]} className="space-y-3">
        {PRINCIPLES.map(p => {
          const items = p.stepType ? stepsByType.get(p.stepType) ?? [] : [];
          return (
            <AccordionItem key={p.key} value={p.key} className="border rounded-lg bg-card">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                    {p.number}
                  </span>
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground font-normal">{p.blurb}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                <div className="rounded-md bg-muted/50 p-3 space-y-1 text-xs text-muted-foreground">
                  {p.prompts.map((t, i) => <p key={i}>• {t}</p>)}
                </div>

                {p.stepType ? (
                  <>
                    {items.length > 0 ? (
                      <ul className="divide-y border rounded-md">
                        {items.map(step => (
                          <li key={step.id} className="p-3 flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="font-medium">{step.title}</div>
                              {step.description && <p className="text-sm text-muted-foreground">{step.description}</p>}
                              {step.critical_limit && (
                                <p className="text-sm"><span className="text-muted-foreground">Limit:</span> {step.critical_limit}</p>
                              )}
                              {step.monitoring_procedure && (
                                <p className="text-sm"><span className="text-muted-foreground">Monitoring:</span> {step.monitoring_procedure}</p>
                              )}
                              {step.corrective_action && (
                                <p className="text-sm"><span className="text-muted-foreground">Action:</span> {step.corrective_action}</p>
                              )}
                              {step.responsible_person && (
                                <p className="text-xs text-muted-foreground">Responsible: {step.responsible_person}</p>
                              )}
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon"
                                  onClick={() => setStepDialog({ open: true, principle: p, existing: step })}>
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon"
                                  onClick={() => { if (confirm("Delete this entry?")) deleteStepM.mutate(step.id); }}>
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No entries yet.</p>
                    )}

                    {canEdit && (
                      <Button variant="outline" size="sm"
                        onClick={() => setStepDialog({ open: true, principle: p, existing: null })}>
                        <Plus className="h-4 w-4 mr-1.5" /> Add entry
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Records are kept automatically by MiseOS modules — no manual entries needed here.
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <StepDialog
        state={stepDialog}
        onClose={() => setStepDialog({ open: false, principle: null, existing: null })}
        planId={plan.id}
        nextSortOrder={(stepsQ.data?.length ?? 0) + 1}
        onSaved={() => qc.invalidateQueries({ queryKey: ["haccp-steps", plan.id] })}
      />
    </div>
  );
}

// ============= Step Dialog =============
function StepDialog({
  state, onClose, planId, nextSortOrder, onSaved,
}: {
  state: { open: boolean; principle: Principle | null; existing: HaccpStep | null };
  onClose: () => void;
  planId: string;
  nextSortOrder: number;
  onSaved: () => void;
}) {
  const { open, principle, existing } = state;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criticalLimit, setCriticalLimit] = useState("");
  const [monitoring, setMonitoring] = useState("");
  const [corrective, setCorrective] = useState("");
  const [responsible, setResponsible] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset on open
  useMemo(() => {
    if (open) {
      setTitle(existing?.title ?? "");
      setDescription(existing?.description ?? "");
      setCriticalLimit(existing?.critical_limit ?? "");
      setMonitoring(existing?.monitoring_procedure ?? "");
      setCorrective(existing?.corrective_action ?? "");
      setResponsible(existing?.responsible_person ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  if (!principle || !principle.stepType) return null;
  const fields = principle.fields;

  const submit = async () => {
    if (!title.trim()) return toast.error("Please add a title.");
    setSaving(true);
    const payload = {
      plan_id: planId,
      step_type: principle.stepType!,
      step_number: existing?.step_number ?? nextSortOrder,
      sort_order: existing?.sort_order ?? nextSortOrder,
      title: title.trim(),
      description: fields.includes("description") ? (description.trim() || null) : existing?.description ?? null,
      critical_limit: fields.includes("critical_limit") ? (criticalLimit.trim() || null) : existing?.critical_limit ?? null,
      monitoring_procedure: fields.includes("monitoring_procedure") ? (monitoring.trim() || null) : existing?.monitoring_procedure ?? null,
      corrective_action: fields.includes("corrective_action") ? (corrective.trim() || null) : existing?.corrective_action ?? null,
      responsible_person: fields.includes("responsible_person") ? (responsible.trim() || null) : existing?.responsible_person ?? null,
    };
    const { error } = existing
      ? await supabase.from("haccp_steps").update(payload).eq("id", existing.id)
      : await supabase.from("haccp_steps").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Updated." : "Added.");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit entry" : "New entry"} — {principle.title}</DialogTitle>
          <DialogDescription>{principle.blurb}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="step-title">Title</Label>
            <Input id="step-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short, clear name" />
          </div>
          {fields.includes("description") && (
            <div className="space-y-1.5">
              <Label htmlFor="step-desc">Description</Label>
              <Textarea id="step-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          )}
          {fields.includes("critical_limit") && (
            <div className="space-y-1.5">
              <Label htmlFor="step-limit">Critical limit</Label>
              <Input id="step-limit" value={criticalLimit} onChange={(e) => setCriticalLimit(e.target.value)} placeholder='e.g. "Core temp ≥ 75°C for 30s"' />
            </div>
          )}
          {fields.includes("monitoring_procedure") && (
            <div className="space-y-1.5">
              <Label htmlFor="step-monitor">Monitoring procedure</Label>
              <Textarea id="step-monitor" value={monitoring} onChange={(e) => setMonitoring(e.target.value)} rows={2} placeholder="How, when, by whom" />
            </div>
          )}
          {fields.includes("corrective_action") && (
            <div className="space-y-1.5">
              <Label htmlFor="step-action">Corrective action</Label>
              <Textarea id="step-action" value={corrective} onChange={(e) => setCorrective(e.target.value)} rows={2} />
            </div>
          )}
          {fields.includes("responsible_person") && (
            <div className="space-y-1.5">
              <Label htmlFor="step-resp">Responsible person / role</Label>
              <Input id="step-resp" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder='e.g. "Head Baker"' />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {existing ? "Save changes" : "Add entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= Published Plan View =============
function PublishedPlanView({
  plan, canEdit, onBack, onEdit,
}: {
  plan: HaccpPlan; canEdit: boolean;
  onBack: () => void; onEdit: () => void;
}) {
  const stepsQ = useQuery({
    queryKey: ["haccp-steps", plan.id],
    queryFn: async (): Promise<HaccpStep[]> => {
      const { data, error } = await supabase
        .from("haccp_steps")
        .select("*")
        .eq("plan_id", plan.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HaccpStep[];
    },
  });

  const stepsByType = useMemo(() => {
    const m = new Map<StepType, HaccpStep[]>();
    (stepsQ.data ?? []).forEach(s => {
      if (!m.has(s.step_type)) m.set(s.step_type, []);
      m.get(s.step_type)!.push(s);
    });
    return m;
  }, [stepsQ.data]);

  const handlePrint = () => window.print();

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Toolbar — hidden in print */}
      <header className="flex items-start justify-between gap-3 flex-wrap print:hidden">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> All plans
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-1.5" /> Edit
            </Button>
          )}
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" /> Print / Save PDF
          </Button>
        </div>
      </header>

      {/* Printable document */}
      <article className="bg-card border rounded-lg p-6 md:p-10 print:border-0 print:shadow-none print:p-0 space-y-6">
        <div className="border-b pb-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookCheck className="h-4 w-4" /> HACCP Plan
            <Badge variant="outline" className={
              plan.status === "published"
                ? "text-xs border-success/30 text-success bg-success/10"
                : "text-xs"
            }>{plan.status === "published" ? "Published" : "Draft"}</Badge>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold">{plan.name}</h1>
          {plan.food_business_type && (
            <p className="text-sm text-muted-foreground">{plan.food_business_type}</p>
          )}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground pt-1">
            {plan.last_reviewed_at && (
              <span>Last reviewed: <strong className="text-foreground">{format(parseISO(plan.last_reviewed_at), "d MMM yyyy")}</strong></span>
            )}
            {plan.review_due_at && (
              <span>Next review due: <strong className="text-foreground">{format(parseISO(plan.review_due_at), "d MMM yyyy")}</strong></span>
            )}
          </div>
        </div>

        {stepsQ.isLoading ? (
          <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="space-y-6">
            {PRINCIPLES.map(p => {
              const items = p.stepType ? stepsByType.get(p.stepType) ?? [] : [];
              return (
                <section key={p.key} className="space-y-3 break-inside-avoid">
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm font-semibold text-primary">Principle {p.number}</span>
                    <h2 className="font-heading text-lg font-semibold">{p.title}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{p.blurb}</p>

                  {p.stepType ? (
                    items.length > 0 ? (
                      <ul className="space-y-2">
                        {items.map(s => (
                          <li key={s.id} className="rounded-md border p-3 space-y-1 break-inside-avoid">
                            <div className="font-medium">{s.title}</div>
                            {s.description && <p className="text-sm">{s.description}</p>}
                            {s.critical_limit && <p className="text-sm"><span className="text-muted-foreground">Critical limit:</span> {s.critical_limit}</p>}
                            {s.monitoring_procedure && <p className="text-sm"><span className="text-muted-foreground">Monitoring:</span> {s.monitoring_procedure}</p>}
                            {s.corrective_action && <p className="text-sm"><span className="text-muted-foreground">Corrective action:</span> {s.corrective_action}</p>}
                            {s.responsible_person && <p className="text-xs text-muted-foreground">Responsible: {s.responsible_person}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No entries.</p>
                    )
                  ) : (
                    <p className="text-sm">
                      Records for monitoring, corrective actions and verification are maintained
                      automatically through MiseOS daily logs (Temperatures, Cleaning, Deliveries,
                      Incidents and audit trail).
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <footer className="border-t pt-4 text-xs text-muted-foreground">
          Generated by MiseOS · {format(new Date(), "d MMM yyyy HH:mm")}
        </footer>
      </article>
    </div>
  );
}
