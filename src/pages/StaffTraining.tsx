import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap, Plus, Loader2, ShieldCheck, ShieldAlert, ShieldX,
  Calendar as CalendarIcon, Upload, ArrowLeft, FileText, Trash2, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";

type TrainingType =
  | "induction" | "food_safety" | "allergens" | "haccp"
  | "fire_safety" | "manual_handling" | "other";

const TRAINING_TYPES: { value: TrainingType; label: string }[] = [
  { value: "induction", label: "Induction" },
  { value: "food_safety", label: "Food Safety" },
  { value: "allergens", label: "Allergens" },
  { value: "haccp", label: "HACCP" },
  { value: "fire_safety", label: "Fire Safety" },
  { value: "manual_handling", label: "Manual Handling" },
  { value: "other", label: "Other" },
];

const TYPE_LABEL: Record<TrainingType, string> =
  Object.fromEntries(TRAINING_TYPES.map(t => [t.value, t.label])) as Record<TrainingType, string>;

const SITE_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "supervisor", label: "Supervisor" },
  { value: "staff", label: "Staff" },
  { value: "read_only", label: "Read-only" },
];

interface TrainingRecord {
  id: string;
  site_id: string;
  user_id: string;
  training_name: string;
  training_type: TrainingType;
  completed_date: string;
  expiry_date: string | null;
  certificate_url: string | null;
  notes: string | null;
  created_at: string;
}

interface TrainingRequirement {
  id: string;
  site_id: string;
  training_name: string;
  training_type: TrainingType;
  renewal_period_months: number | null;
  required_for_roles: string[];
  is_mandatory: boolean;
}

interface TeamMember {
  id: string;
  display_name: string;
  site_role: string;
}

type ComplianceStatus = "green" | "amber" | "red" | "unknown";

function statusColor(s: ComplianceStatus) {
  if (s === "green") return "bg-success/10 text-success border-success/20";
  if (s === "amber") return "bg-warning/10 text-warning border-warning/20";
  if (s === "red") return "bg-breach/10 text-breach border-breach/20";
  return "bg-muted text-muted-foreground border-border";
}

function StatusIcon({ status }: { status: ComplianceStatus }) {
  if (status === "green") return <ShieldCheck className="h-4 w-4" />;
  if (status === "amber") return <ShieldAlert className="h-4 w-4" />;
  if (status === "red") return <ShieldX className="h-4 w-4" />;
  return <ShieldCheck className="h-4 w-4" />;
}

export default function StaffTraining() {
  const { currentSite, organisationId } = useSite();
  const { appUser } = useAuth();
  const { isManager, isSupervisorPlus } = useRole();
  const qc = useQueryClient();
  const siteId = currentSite?.id;

  const [tab, setTab] = useState<"team" | "individual" | "requirements">("team");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [reqDialogOpen, setReqDialogOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<TrainingRequirement | null>(null);

  // ---------- Queries ----------
  const teamQ = useQuery({
    queryKey: ["staff-training-team", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data: memberships, error } = await supabase
        .from("memberships")
        .select("user_id, site_role, active, users:user_id (id, display_name, status)")
        .eq("site_id", siteId!)
        .eq("active", true);
      if (error) throw error;
      return (memberships ?? [])
        .map((m: any) => ({
          id: m.users?.id,
          display_name: m.users?.display_name ?? "—",
          site_role: m.site_role,
          status: m.users?.status,
        }))
        .filter((m: any) => m.id && m.status === "active");
    },
  });

  const recordsQ = useQuery({
    queryKey: ["training-records", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<TrainingRecord[]> => {
      const { data, error } = await supabase
        .from("training_records")
        .select("*")
        .eq("site_id", siteId!)
        .order("completed_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingRecord[];
    },
  });

  const reqsQ = useQuery({
    queryKey: ["training-requirements", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<TrainingRequirement[]> => {
      const { data, error } = await supabase
        .from("training_requirements")
        .select("*")
        .eq("site_id", siteId!)
        .order("training_name");
      if (error) throw error;
      return (data ?? []) as TrainingRequirement[];
    },
  });

  // ---------- Compliance computation ----------
  /**
   * For each user → list of mandatory requirements that apply to their role.
   * Look at the latest matching training record (by name) to determine status.
   */
  const userStatus = useMemo(() => {
    const map = new Map<string, ComplianceStatus>();
    const team = teamQ.data ?? [];
    const reqs = (reqsQ.data ?? []).filter(r => r.is_mandatory);
    const records = recordsQ.data ?? [];
    const today = new Date();

    for (const member of team) {
      const applicable = reqs.filter(
        r => r.required_for_roles.length === 0 || r.required_for_roles.includes(member.site_role),
      );
      if (applicable.length === 0) {
        map.set(member.id, "green");
        continue;
      }
      let worst: ComplianceStatus = "green";
      for (const req of applicable) {
        const latest = records
          .filter(rec => rec.user_id === member.id && rec.training_name === req.training_name)
          .sort((a, b) => b.completed_date.localeCompare(a.completed_date))[0];
        if (!latest) { worst = "red"; continue; }
        if (latest.expiry_date) {
          const days = differenceInDays(parseISO(latest.expiry_date), today);
          if (days < 0) { worst = "red"; }
          else if (days <= 30 && worst !== "red") { worst = "amber"; }
        }
      }
      map.set(member.id, worst);
    }
    return map;
  }, [teamQ.data, reqsQ.data, recordsQ.data]);

  const counts = useMemo(() => {
    const c = { green: 0, amber: 0, red: 0 };
    userStatus.forEach(s => { if (s === "green" || s === "amber" || s === "red") c[s]++; });
    return c;
  }, [userStatus]);

  // ---------- Mutations ----------
  const deleteRecordM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Record removed");
      qc.invalidateQueries({ queryKey: ["training-records", siteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteReqM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_requirements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Requirement removed");
      qc.invalidateQueries({ queryKey: ["training-requirements", siteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!siteId) return null;

  const selectedMember = teamQ.data?.find(m => m.id === selectedUserId) ?? null;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-3 flex-wrap"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Staff Training</h1>
            <p className="text-sm text-muted-foreground">Records, certificates and compliance status</p>
          </div>
        </div>
      </motion.div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full md:w-auto">
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="individual" disabled={!selectedUserId}>Individual</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
        </TabsList>

        {/* ---------------- TEAM OVERVIEW ---------------- */}
        <TabsContent value="team" className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-success">
                <ShieldCheck className="h-4 w-4" /> <span className="text-sm">Current</span>
              </div>
              <div className="text-2xl font-semibold mt-1">{counts.green}</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-warning">
                <ShieldAlert className="h-4 w-4" /> <span className="text-sm">Expiring soon</span>
              </div>
              <div className="text-2xl font-semibold mt-1">{counts.amber}</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-breach">
                <ShieldX className="h-4 w-4" /> <span className="text-sm">Action needed</span>
              </div>
              <div className="text-2xl font-semibold mt-1">{counts.red}</div>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Team compliance</CardTitle></CardHeader>
            <CardContent className="p-0">
              {teamQ.isLoading ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </div>
              ) : (teamQ.data ?? []).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No active staff at this site yet.
                </div>
              ) : (
                <ul className="divide-y">
                  {teamQ.data!.map(m => {
                    const s = userStatus.get(m.id) ?? "unknown";
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-3 p-4 hover:bg-accent/50 cursor-pointer"
                        onClick={() => { setSelectedUserId(m.id); setTab("individual"); }}
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{m.display_name}</div>
                          <div className="text-xs text-muted-foreground capitalize">{m.site_role}</div>
                        </div>
                        <Badge variant="outline" className={statusColor(s)}>
                          <StatusIcon status={s} />
                          <span className="ml-1.5">
                            {s === "green" ? "Current" : s === "amber" ? "Expiring soon" : s === "red" ? "Action needed" : "—"}
                          </span>
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- INDIVIDUAL ---------------- */}
        <TabsContent value="individual" className="space-y-4">
          {selectedMember && (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => setTab("team")}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to team
                </Button>
                {isSupervisorPlus && (
                  <Button onClick={() => setRecordDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add record
                  </Button>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selectedMember.display_name}</CardTitle>
                  <p className="text-xs text-muted-foreground capitalize">{selectedMember.site_role}</p>
                </CardHeader>
                <CardContent className="p-0">
                  {(() => {
                    const userRecs = (recordsQ.data ?? [])
                      .filter(r => r.user_id === selectedMember.id);
                    if (userRecs.length === 0) {
                      return (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                          No training records yet.
                        </div>
                      );
                    }
                    return (
                      <ul className="divide-y">
                        {userRecs.map(rec => {
                          const today = new Date();
                          let chip: ComplianceStatus = "green";
                          if (rec.expiry_date) {
                            const days = differenceInDays(parseISO(rec.expiry_date), today);
                            if (days < 0) chip = "red";
                            else if (days <= 30) chip = "amber";
                          }
                          return (
                            <li key={rec.id} className="p-4 flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{rec.training_name}</span>
                                  <Badge variant="secondary" className="text-xs">{TYPE_LABEL[rec.training_type]}</Badge>
                                  {rec.expiry_date && (
                                    <Badge variant="outline" className={statusColor(chip)}>
                                      Expires {format(parseISO(rec.expiry_date), "d MMM yyyy")}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Completed {format(parseISO(rec.completed_date), "d MMM yyyy")}
                                </div>
                                {rec.notes && <p className="text-sm text-muted-foreground">{rec.notes}</p>}
                                {rec.certificate_url && (
                                  <a
                                    href={rec.certificate_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <FileText className="h-3 w-3" /> View certificate
                                  </a>
                                )}
                              </div>
                              {isManager && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Delete this training record?")) deleteRecordM.mutate(rec.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ---------------- REQUIREMENTS ---------------- */}
        <TabsContent value="requirements" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Define what training is mandatory for this site.
            </p>
            {isManager && (
              <Button onClick={() => { setEditingReq(null); setReqDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> New requirement
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {reqsQ.isLoading ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </div>
              ) : (reqsQ.data ?? []).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No requirements defined yet.
                </div>
              ) : (
                <ul className="divide-y">
                  {reqsQ.data!.map(req => (
                    <li key={req.id} className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{req.training_name}</span>
                          <Badge variant="secondary" className="text-xs">{TYPE_LABEL[req.training_type]}</Badge>
                          {req.is_mandatory && (
                            <Badge variant="outline" className="text-xs border-primary/30 text-primary">Mandatory</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {req.renewal_period_months
                            ? `Renews every ${req.renewal_period_months} months`
                            : "No renewal"}
                          {req.required_for_roles.length > 0 && (
                            <> · For: {req.required_for_roles.map(r =>
                              SITE_ROLES.find(s => s.value === r)?.label ?? r
                            ).join(", ")}</>
                          )}
                        </div>
                      </div>
                      {isManager && (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon"
                            onClick={() => { setEditingReq(req); setReqDialogOpen(true); }}>
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            onClick={() => {
                              if (confirm("Delete this requirement?")) deleteReqM.mutate(req.id);
                            }}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedMember && (
        <RecordDialog
          open={recordDialogOpen}
          onOpenChange={setRecordDialogOpen}
          siteId={siteId}
          organisationId={organisationId!}
          targetUserId={selectedMember.id}
          createdBy={appUser?.id ?? null}
          onCreated={() => qc.invalidateQueries({ queryKey: ["training-records", siteId] })}
        />
      )}

      <RequirementDialog
        open={reqDialogOpen}
        onOpenChange={setReqDialogOpen}
        siteId={siteId}
        existing={editingReq}
        onSaved={() => qc.invalidateQueries({ queryKey: ["training-requirements", siteId] })}
      />
    </div>
  );
}

// ---------------------------- RECORD DIALOG ----------------------------
function RecordDialog({
  open, onOpenChange, siteId, organisationId, targetUserId, createdBy, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  siteId: string;
  organisationId: string;
  targetUserId: string;
  createdBy: string | null;
  onCreated: () => void;
}) {
  const [trainingName, setTrainingName] = useState("");
  const [trainingType, setTrainingType] = useState<TrainingType>("food_safety");
  const [completedDate, setCompletedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setTrainingName(""); setTrainingType("food_safety");
    setCompletedDate(format(new Date(), "yyyy-MM-dd"));
    setExpiryDate(""); setNotes(""); setFile(null);
  }

  async function submit() {
    if (!trainingName.trim()) {
      toast.error("Add a training name");
      return;
    }
    setSaving(true);
    try {
      let certificateUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${siteId}/${targetUserId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("training-certificates")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("training-certificates")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5); // 5 years
        certificateUrl = signed?.signedUrl ?? null;
      }

      const { error } = await supabase.from("training_records").insert({
        site_id: siteId,
        organisation_id: organisationId,
        user_id: targetUserId,
        training_name: trainingName.trim(),
        training_type: trainingType,
        completed_date: completedDate,
        expiry_date: expiryDate || null,
        certificate_url: certificateUrl,
        notes: notes.trim() || null,
        created_by: createdBy,
      });
      if (error) throw error;

      toast.success("Training record added");
      reset();
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add training record</DialogTitle>
          <DialogDescription>
            Log a completed training and optionally upload the certificate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Training name</Label>
            <Input
              value={trainingName}
              onChange={(e) => setTrainingName(e.target.value)}
              placeholder="e.g. Level 2 Food Safety"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={trainingType} onValueChange={(v) => setTrainingType(v as TrainingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRAINING_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Completed</Label>
              <Input type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} />
            </div>
            <div>
              <Label>Expires</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Certificate</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {file && <p className="text-xs text-muted-foreground mt-1">{file.name}</p>}
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Save record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------- REQUIREMENT DIALOG ----------------------------
function RequirementDialog({
  open, onOpenChange, siteId, existing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  siteId: string;
  existing: TrainingRequirement | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.training_name ?? "");
  const [type, setType] = useState<TrainingType>(existing?.training_type ?? "food_safety");
  const [renewMonths, setRenewMonths] = useState<string>(existing?.renewal_period_months?.toString() ?? "");
  const [roles, setRoles] = useState<string[]>(existing?.required_for_roles ?? []);
  const [mandatory, setMandatory] = useState<boolean>(existing?.is_mandatory ?? true);
  const [saving, setSaving] = useState(false);

  // Reset when existing changes
  useMemo(() => {
    setName(existing?.training_name ?? "");
    setType(existing?.training_type ?? "food_safety");
    setRenewMonths(existing?.renewal_period_months?.toString() ?? "");
    setRoles(existing?.required_for_roles ?? []);
    setMandatory(existing?.is_mandatory ?? true);
  }, [existing?.id]);

  function toggleRole(r: string) {
    setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  async function submit() {
    if (!name.trim()) { toast.error("Add a training name"); return; }
    setSaving(true);
    try {
      const payload = {
        site_id: siteId,
        training_name: name.trim(),
        training_type: type,
        renewal_period_months: renewMonths ? Number(renewMonths) : null,
        required_for_roles: roles,
        is_mandatory: mandatory,
      };
      const { error } = existing
        ? await supabase.from("training_requirements").update(payload).eq("id", existing.id)
        : await supabase.from("training_requirements").insert(payload);
      if (error) throw error;
      toast.success(existing ? "Requirement updated" : "Requirement added");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit requirement" : "New requirement"}</DialogTitle>
          <DialogDescription>
            Set what training is required for staff at this site.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Training name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Level 2 Food Safety" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TrainingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRAINING_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Renewal period (months)</Label>
            <Input
              type="number"
              min={1}
              value={renewMonths}
              onChange={(e) => setRenewMonths(e.target.value)}
              placeholder="Leave blank for no renewal"
            />
          </div>
          <div>
            <Label>Required for roles</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {SITE_ROLES.map(r => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roles.includes(r.value)}
                    onCheckedChange={() => toggleRole(r.value)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Leave all unchecked to apply to everyone.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={mandatory} onCheckedChange={(v) => setMandatory(!!v)} />
            Mandatory training
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
