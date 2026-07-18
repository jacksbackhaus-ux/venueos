import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap, Plus, Loader2, ShieldCheck, ShieldAlert, ShieldX,
  Upload, ArrowLeft, FileText, Trash2, Pencil, Download, ChevronRight,
  UserPlus, X,
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
import { format, differenceInDays, parseISO, addMonths } from "date-fns";
import { EmptyState } from "@/components/shared/EmptyState";
import { SEO } from "@/components/SEO";

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

/**
 * Role model exposed in the UI is the current one: Owner / Manager / Staff.
 * On the wire, the memberships table still uses `supervisor` for what we now
 * label "Manager". We map both ways at read/write time so no destructive DB
 * migration is needed and existing catalog entries continue to work.
 */
type UiRole = "owner" | "manager" | "staff";
const UI_ROLES: { value: UiRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
];
const UI_ROLE_LABEL: Record<UiRole, string> = { owner: "Owner", manager: "Manager", staff: "Staff" };

/** Wire role (stored in DB) → UI role. */
function toUiRole(wire: string): UiRole | null {
  if (wire === "owner") return "owner";
  if (wire === "manager" || wire === "supervisor") return "manager";
  if (wire === "staff") return "staff";
  return null; // read_only etc. are ignored for training coverage
}
/** UI role → wire roles that should be considered matching in the DB. */
function toWireRoles(ui: UiRole): string[] {
  if (ui === "owner") return ["owner"];
  if (ui === "manager") return ["manager", "supervisor"];
  return ["staff"];
}

interface TrainingCatalogEntry {
  id: string;
  site_id: string;
  training_name: string;
  training_type: TrainingType;
  renewal_period_months: number | null;
  required_for_roles: string[]; // wire roles (may contain 'supervisor')
  is_mandatory: boolean;
  is_active?: boolean;
}

interface TrainingRecord {
  id: string;
  site_id: string;
  user_id: string;
  training_name: string;
  training_type: TrainingType;
  training_catalog_id: string | null;
  completed_date: string;
  expiry_date: string | null;
  certificate_url: string | null;
  notes: string | null;
  created_at: string;
}

interface IndividualAssignment {
  id: string;
  site_id: string;
  training_catalog_id: string;
  user_id: string;
  notes: string | null;
}

interface TeamMember {
  id: string;
  display_name: string;
  site_role: string;
}

type ComplianceStatus = "current" | "expiring" | "expired" | "missing";

function statusColor(s: ComplianceStatus) {
  if (s === "current") return "bg-success/10 text-success border-success/20";
  if (s === "expiring") return "bg-warning/10 text-warning border-warning/20";
  if (s === "expired" || s === "missing") return "bg-breach/10 text-breach border-breach/20";
  return "bg-muted text-muted-foreground border-border";
}
function statusLabel(s: ComplianceStatus): string {
  return s === "current" ? "Current"
    : s === "expiring" ? "Expiring soon"
    : s === "expired" ? "Expired" : "Missing";
}
function StatusIcon({ status }: { status: ComplianceStatus }) {
  if (status === "current") return <ShieldCheck className="h-3.5 w-3.5" />;
  if (status === "expiring") return <ShieldAlert className="h-3.5 w-3.5" />;
  return <ShieldX className="h-3.5 w-3.5" />;
}

/** Determine the status of a specific record vs today. */
function recordStatus(rec: TrainingRecord | undefined): ComplianceStatus {
  if (!rec) return "missing";
  if (!rec.expiry_date) return "current"; // "no renewal" catalog = always current if completed
  const days = differenceInDays(parseISO(rec.expiry_date), new Date());
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "current";
}

export default function StaffTraining() {
  const { currentSite, currentMembership, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const { isManager, isSupervisorPlus } = useRole();
  const qc = useQueryClient();
  const siteId = currentSite?.id;
  const currentUserId = appUser?.id ?? staffSession?.user_id ?? null;
  const isStaffOnly = !isSupervisorPlus;

  const [tab, setTab] = useState<"team" | "individual" | "catalog">(
    isStaffOnly ? "individual" : "team",
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    isStaffOnly ? currentUserId : null,
  );
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [recordPrefillCatalog, setRecordPrefillCatalog] =
    useState<TrainingCatalogEntry | null>(null);
  const [reqDialogOpen, setReqDialogOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<TrainingCatalogEntry | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [certViewerUrl, setCertViewerUrl] = useState<string | null>(null);

  // Staff self-service: always lock the individual view to themselves.
  useEffect(() => {
    if (isStaffOnly) {
      setSelectedUserId(currentUserId);
      setTab("individual");
    }
  }, [isStaffOnly, currentUserId]);

  // ---------- Queries ----------
  const teamQ = useQuery({
    queryKey: ["staff-training-team", siteId],
    enabled: !!siteId && !isStaffOnly,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from("memberships")
        .select("user_id, site_role, active, users:user_id (id, display_name, status)")
        .eq("site_id", siteId!)
        .eq("active", true);
      if (error) throw error;
      return (data ?? [])
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
      return (data ?? []) as any as TrainingRecord[];
    },
  });

  const catalogQ = useQuery({
    queryKey: ["training-catalog", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<TrainingCatalogEntry[]> => {
      const { data, error } = await supabase
        .from("training_requirements")
        .select("*")
        .eq("site_id", siteId!)
        .order("training_name");
      if (error) throw error;
      return ((data ?? []) as any[])
        .filter((r) => r.is_active !== false && !r.deleted_at) as TrainingCatalogEntry[];
    },
  });

  const assignmentsQ = useQuery({
    queryKey: ["training-individual-assignments", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<IndividualAssignment[]> => {
      const { data, error } = await supabase
        .from("training_individual_assignments" as any)
        .select("*")
        .eq("site_id", siteId!);
      if (error) throw error;
      return ((data ?? []) as any) as IndividualAssignment[];
    },
  });

  // For each team member, list catalog entries required for them (role-based + individual).
  const requiredForUser = useMemo(() => {
    const map = new Map<string, TrainingCatalogEntry[]>();
    const catalog = catalogQ.data ?? [];
    const assigns = assignmentsQ.data ?? [];
    const members = teamQ.data ?? [];

    // Staff-only mode: still compute for themselves even without team query.
    const universe = isStaffOnly && currentUserId
      ? [{ id: currentUserId, display_name: appUser?.display_name ?? "You",
           site_role: currentMembership?.site_role ?? "staff" }]
      : members;

    for (const m of universe) {
      const uiRole = toUiRole(m.site_role);
      const roleMatched = catalog.filter((c) =>
        c.is_mandatory !== false
        && c.required_for_roles?.length
        && uiRole
        && c.required_for_roles.some((r) => toUiRole(r) === uiRole),
      );
      const individually = catalog.filter((c) =>
        assigns.some((a) => a.user_id === m.id && a.training_catalog_id === c.id),
      );
      const seen = new Set<string>();
      const merged: TrainingCatalogEntry[] = [];
      [...roleMatched, ...individually].forEach((c) => {
        if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
      });
      map.set(m.id, merged);
    }
    return map;
  }, [teamQ.data, catalogQ.data, assignmentsQ.data, isStaffOnly, currentUserId,
      appUser?.display_name, currentMembership?.site_role]);

  /** For (user, catalog entry) → latest matching record (by catalog id, then by name fallback). */
  function latestRecordFor(userId: string, entry: TrainingCatalogEntry): TrainingRecord | undefined {
    const recs = (recordsQ.data ?? [])
      .filter((r) => r.user_id === userId)
      .filter((r) =>
        r.training_catalog_id === entry.id
        || (!r.training_catalog_id && r.training_name.toLowerCase() === entry.training_name.toLowerCase()),
      )
      .sort((a, b) => b.completed_date.localeCompare(a.completed_date));
    return recs[0];
  }

  // Team member summary (counts + worst status).
  interface MemberSummary {
    memberId: string;
    total: number;
    current: number;
    expiring: number;
    expired: number;
    missing: number;
    worst: ComplianceStatus;
    text: string;
  }
  const memberSummaries = useMemo<MemberSummary[]>(() => {
    const members = teamQ.data ?? [];
    return members.map((m) => {
      const reqs = requiredForUser.get(m.id) ?? [];
      let current = 0, expiring = 0, expired = 0, missing = 0;
      reqs.forEach((r) => {
        const s = recordStatus(latestRecordFor(m.id, r));
        if (s === "current") current++;
        else if (s === "expiring") expiring++;
        else if (s === "expired") expired++;
        else missing++;
      });
      const total = reqs.length;
      const worst: ComplianceStatus =
        expired > 0 || missing > 0 ? "expired"
        : expiring > 0 ? "expiring"
        : "current";
      const text = total === 0
        ? "No training assigned"
        : missing + expired > 0
          ? `${missing + expired} needs action${expiring ? ` · ${expiring} expiring` : ""}`
          : expiring > 0
            ? `${expiring} expiring soon`
            : `${current} of ${total} current`;
      return { memberId: m.id, total, current, expiring, expired, missing, worst, text };
    });
  }, [teamQ.data, requiredForUser, recordsQ.data]);

  // Aggregate counts across all assignments (per-training, not per-person).
  const aggregate = useMemo(() => {
    let current = 0, expiring = 0, actionNeeded = 0;
    memberSummaries.forEach((s) => {
      current += s.current;
      expiring += s.expiring;
      actionNeeded += s.missing + s.expired;
    });
    return { current, expiring, actionNeeded };
  }, [memberSummaries]);

  // Compliance count per catalog entry (for the Trainings tab).
  const catalogCompliance = useMemo(() => {
    const map = new Map<string, { total: number; compliant: number }>();
    (catalogQ.data ?? []).forEach((c) => {
      const members = teamQ.data ?? [];
      const assignedMembers = members.filter((m) => {
        const reqs = requiredForUser.get(m.id) ?? [];
        return reqs.some((r) => r.id === c.id);
      });
      const compliant = assignedMembers.filter((m) => {
        const s = recordStatus(latestRecordFor(m.id, c));
        return s === "current" || s === "expiring";
      }).length;
      map.set(c.id, { total: assignedMembers.length, compliant });
    });
    return map;
  }, [catalogQ.data, teamQ.data, requiredForUser, recordsQ.data]);

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
      // Soft-delete so historical records keep their link.
      const { error } = await supabase
        .from("training_requirements")
        .update({ is_active: false, deleted_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Training removed from catalog");
      qc.invalidateQueries({ queryKey: ["training-catalog", siteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!siteId) return null;

  const selectedMember: TeamMember | null =
    selectedUserId
      ? (teamQ.data?.find((m) => m.id === selectedUserId)
        ?? (isStaffOnly && selectedUserId === currentUserId
            ? { id: currentUserId!, display_name: appUser?.display_name ?? "You",
                site_role: currentMembership?.site_role ?? "staff" }
            : null))
      : null;

  function openRecordDialog(catalogEntry: TrainingCatalogEntry | null) {
    setRecordPrefillCatalog(catalogEntry);
    setRecordDialogOpen(true);
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <SEO title="Staff Training — MiseOS" description="Team training records, certificates and compliance." path="/staff-training" noindex />

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Staff Training</h1>
          <p className="text-sm text-muted-foreground">
            {isStaffOnly ? "Your training and certificates" : "Records, certificates and compliance"}
          </p>
        </div>
      </motion.div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
        {!isStaffOnly && (
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="individual" disabled={!selectedUserId}>Individual</TabsTrigger>
            <TabsTrigger value="catalog">Trainings</TabsTrigger>
          </TabsList>
        )}

        {/* ---------------- TEAM ---------------- */}
        {!isStaffOnly && (
          <TabsContent value="team" className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-success">
                  <ShieldCheck className="h-4 w-4" /> <span className="text-sm">Current</span>
                </div>
                <div className="text-2xl font-semibold mt-1 tabular-nums">{aggregate.current}</div>
                <p className="text-[11px] text-muted-foreground">trainings</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-warning">
                  <ShieldAlert className="h-4 w-4" /> <span className="text-sm">Expiring soon</span>
                </div>
                <div className="text-2xl font-semibold mt-1 tabular-nums">{aggregate.expiring}</div>
                <p className="text-[11px] text-muted-foreground">within 30 days</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-breach">
                  <ShieldX className="h-4 w-4" /> <span className="text-sm">Action needed</span>
                </div>
                <div className="text-2xl font-semibold mt-1 tabular-nums">{aggregate.actionNeeded}</div>
                <p className="text-[11px] text-muted-foreground">missing or expired</p>
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
                  <div className="p-4">
                    <EmptyState
                      icon={<GraduationCap className="h-6 w-6" />}
                      title="No active staff yet"
                      description="Add team members in Settings to start tracking training and expiries."
                    />
                  </div>
                ) : (
                  <ul className="divide-y">
                    {teamQ.data!.map((m) => {
                      const sum = memberSummaries.find((x) => x.memberId === m.id);
                      const worst = sum?.worst ?? "current";
                      const uiRole = toUiRole(m.site_role);
                      return (
                        <li key={m.id}
                          className="flex items-center justify-between gap-3 p-4 hover:bg-accent/50 cursor-pointer"
                          onClick={() => { setSelectedUserId(m.id); setTab("individual"); }}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{m.display_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {uiRole ? UI_ROLE_LABEL[uiRole] : m.site_role} · {sum?.text ?? "—"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={statusColor(worst)}>
                              <StatusIcon status={worst} />
                              <span className="ml-1.5">{statusLabel(worst)}</span>
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ---------------- INDIVIDUAL ---------------- */}
        <TabsContent value="individual" className="space-y-4">
          {selectedMember && (
            <IndividualView
              member={selectedMember}
              required={requiredForUser.get(selectedMember.id) ?? []}
              allRecords={(recordsQ.data ?? []).filter((r) => r.user_id === selectedMember.id)}
              catalog={catalogQ.data ?? []}
              latestRecordFor={(entry) => latestRecordFor(selectedMember.id, entry)}
              canManage={isManager}
              canWrite={isSupervisorPlus || selectedMember.id === currentUserId}
              isStaffSelf={isStaffOnly}
              onBack={() => setTab("team")}
              onOpenRecordForCatalog={(entry) => openRecordDialog(entry)}
              onOpenAdHocRecord={() => openRecordDialog(null)}
              onDeleteRecord={(id) => {
                if (confirm("Delete this training record?")) deleteRecordM.mutate(id);
              }}
              onOpenCertViewer={(url) => setCertViewerUrl(url)}
              onGoToCatalog={() => setTab("catalog")}
              onAssign={() => setAssignDialogOpen(true)}
            />
          )}
        </TabsContent>

        {/* ---------------- CATALOG (renamed Trainings) ---------------- */}
        {!isStaffOnly && (
          <TabsContent value="catalog" className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Define what training is required. Assign by role or to specific people.
              </p>
              {isManager && (
                <Button onClick={() => { setEditingReq(null); setReqDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" /> New training
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                {catalogQ.isLoading ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </div>
                ) : (catalogQ.data ?? []).length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      icon={<ShieldCheck className="h-6 w-6" />}
                      title="No trainings yet"
                      description="Add the certifications your team needs so gaps and expiries show up automatically."
                    />
                  </div>
                ) : (
                  <ul className="divide-y">
                    {catalogQ.data!.map((c) => {
                      const comp = catalogCompliance.get(c.id) ?? { total: 0, compliant: 0 };
                      const uiRoles = Array.from(new Set(
                        (c.required_for_roles ?? []).map(toUiRole).filter(Boolean),
                      )) as UiRole[];
                      return (
                        <li key={c.id} className="p-4 flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{c.training_name}</span>
                              <Badge variant="secondary" className="text-xs">{TYPE_LABEL[c.training_type]}</Badge>
                              {c.is_mandatory && (
                                <Badge variant="outline" className="text-xs border-primary/30 text-primary">Mandatory</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {uiRoles.length > 0
                                ? `For: ${uiRoles.map((r) => UI_ROLE_LABEL[r]).join(", ")}`
                                : "No role assigned"}
                              {" · "}
                              {c.renewal_period_months
                                ? `Renews every ${c.renewal_period_months} months`
                                : "No renewal"}
                            </div>
                            <div className="text-xs">
                              <span className={comp.total === 0 ? "text-muted-foreground"
                                : comp.compliant === comp.total ? "text-success" : "text-warning"}>
                                {comp.total === 0 ? "Not assigned to anyone yet" :
                                  `${comp.compliant} of ${comp.total} compliant`}
                              </span>
                            </div>
                          </div>
                          {isManager && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon"
                                onClick={() => { setEditingReq(c); setReqDialogOpen(true); }}>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon"
                                onClick={() => {
                                  if (confirm("Remove this training from the catalog? Existing records are preserved.")) {
                                    deleteReqM.mutate(c.id);
                                  }
                                }}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {selectedMember && (
        <RecordDialog
          open={recordDialogOpen}
          onOpenChange={(v) => { setRecordDialogOpen(v); if (!v) setRecordPrefillCatalog(null); }}
          siteId={siteId}
          organisationId={organisationId!}
          targetUserId={selectedMember.id}
          createdBy={currentUserId}
          catalog={catalogQ.data ?? []}
          prefillCatalog={recordPrefillCatalog}
          onCreated={() => qc.invalidateQueries({ queryKey: ["training-records", siteId] })}
          onCatalogRefresh={() => qc.invalidateQueries({ queryKey: ["training-catalog", siteId] })}
        />
      )}

      <RequirementDialog
        open={reqDialogOpen}
        onOpenChange={setReqDialogOpen}
        siteId={siteId}
        existing={editingReq}
        onSaved={() => qc.invalidateQueries({ queryKey: ["training-catalog", siteId] })}
      />

      {selectedMember && isManager && (
        <AssignDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          siteId={siteId}
          member={selectedMember}
          catalog={catalogQ.data ?? []}
          existingAssignments={(assignmentsQ.data ?? [])
            .filter((a) => a.user_id === selectedMember.id)}
          assignedByUserId={currentUserId}
          alreadyRequired={(requiredForUser.get(selectedMember.id) ?? []).map((c) => c.id)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["training-individual-assignments", siteId] })}
        />
      )}

      <CertificateViewer url={certViewerUrl} onClose={() => setCertViewerUrl(null)} />
    </div>
  );
}

// =========================================================================
//                              INDIVIDUAL VIEW
// =========================================================================
function IndividualView({
  member, required, allRecords, catalog, latestRecordFor,
  canManage, canWrite, isStaffSelf,
  onBack, onOpenRecordForCatalog, onOpenAdHocRecord, onDeleteRecord,
  onOpenCertViewer, onGoToCatalog, onAssign,
}: {
  member: TeamMember;
  required: TrainingCatalogEntry[];
  allRecords: TrainingRecord[];
  catalog: TrainingCatalogEntry[];
  latestRecordFor: (entry: TrainingCatalogEntry) => TrainingRecord | undefined;
  canManage: boolean;
  canWrite: boolean;
  isStaffSelf: boolean;
  onBack: () => void;
  onOpenRecordForCatalog: (entry: TrainingCatalogEntry) => void;
  onOpenAdHocRecord: () => void;
  onDeleteRecord: (id: string) => void;
  onOpenCertViewer: (url: string) => void;
  onGoToCatalog: () => void;
  onAssign: () => void;
}) {
  // "Additional records" = records not linked to any *required* catalog entry
  // (either legacy free-text, or extra optional training).
  const requiredIds = new Set(required.map((r) => r.id));
  const requiredNames = new Set(required.map((r) => r.training_name.toLowerCase()));
  const additional = allRecords.filter((rec) => {
    if (rec.training_catalog_id && requiredIds.has(rec.training_catalog_id)) return false;
    if (!rec.training_catalog_id && requiredNames.has(rec.training_name.toLowerCase())) return false;
    return true;
  });

  const uiRole = toUiRole(member.site_role);

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {!isStaffSelf ? (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to team
          </Button>
        ) : <span />}
        <div className="flex items-center gap-2">
          {canManage && !isStaffSelf && (
            <Button variant="outline" size="sm" onClick={onAssign}>
              <UserPlus className="h-4 w-4 mr-2" /> Assign training
            </Button>
          )}
          {canWrite && (
            <Button size="sm" onClick={onOpenAdHocRecord}>
              <Plus className="h-4 w-4 mr-2" /> Add record
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isStaffSelf ? "Your training" : member.display_name}</CardTitle>
          {!isStaffSelf && (
            <p className="text-xs text-muted-foreground">{uiRole ? UI_ROLE_LABEL[uiRole] : member.site_role}</p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {required.length === 0 && allRecords.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<GraduationCap className="h-6 w-6" />}
                title="No training assigned yet"
                description={
                  isStaffSelf
                    ? "Speak to your manager if you think this is wrong."
                    : catalog.length === 0
                      ? "Add a training to the catalog to get started."
                      : "Assign a training to this person from the Trainings tab."
                }
                action={!isStaffSelf && canManage ? (
                  <Button size="sm" variant="outline" onClick={onGoToCatalog}>
                    Go to Trainings
                  </Button>
                ) : undefined}
              />
            </div>
          ) : (
            <div className="divide-y">
              {required.length > 0 && (
                <div>
                  <div className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Required trainings
                  </div>
                  <ul className="divide-y">
                    {required.map((entry) => {
                      const rec = latestRecordFor(entry);
                      const status = recordStatus(rec);
                      const days = rec?.expiry_date
                        ? differenceInDays(parseISO(rec.expiry_date), new Date())
                        : null;
                      const substatus =
                        status === "current"
                          ? (days !== null ? `${days} day${days === 1 ? "" : "s"} remaining` : "No renewal")
                        : status === "expiring"
                          ? (days !== null ? `Expires in ${days} day${days === 1 ? "" : "s"}` : "")
                        : status === "expired"
                          ? (days !== null ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` : "Expired")
                        : "Not completed";
                      return (
                        <li key={entry.id} className="p-4 flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{entry.training_name}</span>
                              <Badge variant="secondary" className="text-xs">{TYPE_LABEL[entry.training_type]}</Badge>
                              <Badge variant="outline" className={`text-xs ${statusColor(status)}`}>
                                <StatusIcon status={status} />
                                <span className="ml-1">{statusLabel(status)}</span>
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{substatus}</p>
                            {rec?.completed_date && (
                              <p className="text-xs text-muted-foreground">
                                Completed {format(parseISO(rec.completed_date), "d MMM yyyy")}
                                {rec.expiry_date && ` · Expires ${format(parseISO(rec.expiry_date), "d MMM yyyy")}`}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {rec?.certificate_url && (
                              <Button variant="ghost" size="sm"
                                onClick={() => onOpenCertViewer(rec.certificate_url!)}>
                                <FileText className="h-4 w-4 mr-1" /> View
                              </Button>
                            )}
                            {canWrite && (
                              <Button size="sm" variant={status === "current" ? "outline" : "default"}
                                onClick={() => onOpenRecordForCatalog(entry)}>
                                <Upload className="h-3.5 w-3.5 mr-1" />
                                {status === "missing" ? "Upload" : status === "current" ? "Update" : "Renew"}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {additional.length > 0 && (
                <div>
                  <div className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Additional records
                  </div>
                  <ul className="divide-y">
                    {additional.map((rec) => {
                      const status = recordStatus(rec);
                      const isLegacy = !rec.training_catalog_id;
                      return (
                        <li key={rec.id} className="p-4 flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{rec.training_name}</span>
                              <Badge variant="secondary" className="text-xs">{TYPE_LABEL[rec.training_type]}</Badge>
                              {isLegacy && (
                                <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">
                                  Legacy
                                </Badge>
                              )}
                              {rec.expiry_date && (
                                <Badge variant="outline" className={`text-xs ${statusColor(status)}`}>
                                  Expires {format(parseISO(rec.expiry_date), "d MMM yyyy")}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Completed {format(parseISO(rec.completed_date), "d MMM yyyy")}
                            </div>
                            {rec.notes && <p className="text-sm text-muted-foreground">{rec.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {rec.certificate_url && (
                              <Button variant="ghost" size="sm"
                                onClick={() => onOpenCertViewer(rec.certificate_url!)}>
                                <FileText className="h-4 w-4 mr-1" /> View
                              </Button>
                            )}
                            {canManage && (
                              <Button variant="ghost" size="icon" onClick={() => onDeleteRecord(rec.id)}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// =========================================================================
//                              RECORD DIALOG
// =========================================================================
function RecordDialog({
  open, onOpenChange, siteId, organisationId, targetUserId, createdBy,
  catalog, prefillCatalog, onCreated, onCatalogRefresh,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  siteId: string;
  organisationId: string;
  targetUserId: string;
  createdBy: string | null;
  catalog: TrainingCatalogEntry[];
  prefillCatalog: TrainingCatalogEntry | null;
  onCreated: () => void;
  onCatalogRefresh: () => void;
}) {
  const [catalogId, setCatalogId] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [trainingType, setTrainingType] = useState<TrainingType>("food_safety");
  const [completedDate, setCompletedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCatalogOpen, setNewCatalogOpen] = useState(false);

  const selectedEntry = catalog.find((c) => c.id === catalogId) ?? null;
  const isAdHoc = catalogId === "__adhoc__";

  // Prefill when dialog opens
  useEffect(() => {
    if (!open) return;
    if (prefillCatalog) {
      setCatalogId(prefillCatalog.id);
      setTrainingType(prefillCatalog.training_type);
      setCustomName("");
    } else {
      setCatalogId("");
      setCustomName("");
      setTrainingType("food_safety");
    }
    setCompletedDate(format(new Date(), "yyyy-MM-dd"));
    setExpiryDate("");
    setExpiryTouched(false);
    setNotes("");
    setFile(null);
  }, [open, prefillCatalog]);

  // When catalog entry or completed date changes, auto-calc expiry from renewal period.
  useEffect(() => {
    if (!selectedEntry) return;
    setTrainingType(selectedEntry.training_type);
    if (!expiryTouched) {
      if (selectedEntry.renewal_period_months && completedDate) {
        const next = addMonths(parseISO(completedDate), selectedEntry.renewal_period_months);
        setExpiryDate(format(next, "yyyy-MM-dd"));
      } else {
        setExpiryDate("");
      }
    }
  }, [selectedEntry, completedDate, expiryTouched]);

  const showExpiry = isAdHoc
    || !selectedEntry
    || (selectedEntry.renewal_period_months !== null && selectedEntry.renewal_period_months !== undefined);

  async function submit() {
    const name = selectedEntry
      ? selectedEntry.training_name
      : customName.trim();
    if (!name) { toast.error("Choose a training"); return; }
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
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        certificateUrl = signed?.signedUrl ?? null;
      }

      const { error } = await supabase.from("training_records").insert({
        site_id: siteId,
        organisation_id: organisationId,
        user_id: targetUserId,
        training_name: name,
        training_type: trainingType,
        training_catalog_id: selectedEntry?.id ?? null,
        completed_date: completedDate,
        expiry_date: showExpiry && expiryDate ? expiryDate : null,
        certificate_url: certificateUrl,
        notes: notes.trim() || null,
        created_by: createdBy,
      } as any);
      if (error) throw error;

      toast.success("Training record saved");
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{prefillCatalog ? `Log: ${prefillCatalog.training_name}` : "Add training record"}</DialogTitle>
            <DialogDescription>
              Pick a training from your catalog, then upload the certificate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Training</Label>
              <Select value={catalogId} onValueChange={setCatalogId}>
                <SelectTrigger><SelectValue placeholder="Choose training…" /></SelectTrigger>
                <SelectContent>
                  {catalog.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.training_name}
                        {c.is_mandatory && (
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Mandatory</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                  <SelectItem value="__adhoc__">Other (one-off)</SelectItem>
                </SelectContent>
              </Select>
              <button type="button"
                onClick={() => setNewCatalogOpen(true)}
                className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add new training to catalog
              </button>
            </div>

            {isAdHoc && (
              <div>
                <Label>Training name</Label>
                <Input value={customName} onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. External workshop" />
              </div>
            )}

            {(isAdHoc || !selectedEntry) && (
              <div>
                <Label>Type</Label>
                <Select value={trainingType} onValueChange={(v) => setTrainingType(v as TrainingType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRAINING_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedEntry && !isAdHoc && (
              <div className="text-xs text-muted-foreground">
                Type: <span className="font-medium text-foreground">{TYPE_LABEL[selectedEntry.training_type]}</span>
                {selectedEntry.renewal_period_months
                  ? ` · Renews every ${selectedEntry.renewal_period_months} months`
                  : " · No renewal"}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Completed</Label>
                <Input type="date" value={completedDate}
                  onChange={(e) => setCompletedDate(e.target.value)} />
              </div>
              {showExpiry && (
                <div>
                  <Label>Expires</Label>
                  <Input type="date" value={expiryDate}
                    onChange={(e) => { setExpiryDate(e.target.value); setExpiryTouched(true); }} />
                </div>
              )}
            </div>

            <div>
              <Label>Certificate</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
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

      <RequirementDialog
        open={newCatalogOpen}
        onOpenChange={setNewCatalogOpen}
        siteId={siteId}
        existing={null}
        onSaved={async (created) => {
          onCatalogRefresh();
          if (created?.id) {
            setCatalogId(created.id);
            setTrainingType(created.training_type);
          }
        }}
      />
    </>
  );
}

// =========================================================================
//                          TRAINING CATALOG DIALOG
// =========================================================================
function RequirementDialog({
  open, onOpenChange, siteId, existing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  siteId: string;
  existing: TrainingCatalogEntry | null;
  onSaved: (created?: TrainingCatalogEntry) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TrainingType>("food_safety");
  const [renewMonths, setRenewMonths] = useState<string>("");
  const [uiRoles, setUiRoles] = useState<UiRole[]>([]);
  const [mandatory, setMandatory] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(existing?.training_name ?? "");
    setType(existing?.training_type ?? "food_safety");
    setRenewMonths(existing?.renewal_period_months?.toString() ?? "");
    const initialUi = Array.from(new Set(
      (existing?.required_for_roles ?? []).map(toUiRole).filter(Boolean),
    )) as UiRole[];
    setUiRoles(initialUi);
    setMandatory(existing?.is_mandatory ?? true);
  }, [open, existing?.id]);

  function toggleRole(r: UiRole) {
    setUiRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }

  async function submit() {
    if (!name.trim()) { toast.error("Add a training name"); return; }
    setSaving(true);
    try {
      // Expand each UI role to the wire roles it covers.
      const wireRoles = Array.from(new Set(uiRoles.flatMap(toWireRoles)));
      const payload: any = {
        site_id: siteId,
        training_name: name.trim(),
        training_type: type,
        renewal_period_months: renewMonths ? Number(renewMonths) : null,
        required_for_roles: wireRoles,
        is_mandatory: mandatory,
        is_active: true,
      };
      if (existing) {
        const { error } = await supabase
          .from("training_requirements").update(payload).eq("id", existing.id);
        if (error) throw error;
        toast.success("Training updated");
        onSaved();
      } else {
        const { data, error } = await supabase
          .from("training_requirements").insert(payload).select().single();
        if (error) throw error;
        toast.success("Training added");
        onSaved(data as any);
      }
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
          <DialogTitle>{existing ? "Edit training" : "New training"}</DialogTitle>
          <DialogDescription>
            Add a training everyone with the selected role needs to complete.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Training name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Level 2 Food Safety" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TrainingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRAINING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Renewal period (months)</Label>
            <Input type="number" min={1} value={renewMonths}
              onChange={(e) => setRenewMonths(e.target.value)}
              placeholder="Leave blank for no renewal" />
          </div>
          <div>
            <Label>Applies to</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {UI_ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={uiRoles.includes(r.value)}
                    onCheckedChange={() => toggleRole(r.value)} />
                  {r.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Anyone with a matching role is automatically required to complete this training.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={mandatory} onCheckedChange={(v) => setMandatory(!!v)} />
            Mandatory
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

// =========================================================================
//                         INDIVIDUAL ASSIGNMENT DIALOG
// =========================================================================
function AssignDialog({
  open, onOpenChange, siteId, member, catalog, existingAssignments,
  assignedByUserId, alreadyRequired, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  siteId: string;
  member: TeamMember;
  catalog: TrainingCatalogEntry[];
  existingAssignments: IndividualAssignment[];
  assignedByUserId: string | null;
  alreadyRequired: string[];
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const requiredByRole = alreadyRequired.filter(
    (id) => !existingAssignments.some((a) => a.training_catalog_id === id),
  );

  async function add() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("training_individual_assignments" as any)
        .insert({
          site_id: siteId,
          user_id: member.id,
          training_catalog_id: selectedId,
          assigned_by: assignedByUserId,
        } as any);
      if (error) throw error;
      toast.success("Training assigned");
      setSelectedId("");
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("training_individual_assignments" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign training to {member.display_name}</DialogTitle>
          <DialogDescription>
            Assign a catalog training on top of what their role already requires.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Training</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Choose training…" /></SelectTrigger>
                <SelectContent>
                  {catalog
                    .filter((c) =>
                      !existingAssignments.some((a) => a.training_catalog_id === c.id)
                      && !requiredByRole.includes(c.id))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.training_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={add} disabled={!selectedId || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Individually assigned
            </div>
            {existingAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="space-y-1">
                {existingAssignments.map((a) => {
                  const entry = catalog.find((c) => c.id === a.training_catalog_id);
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-sm border rounded-md px-2 py-1.5">
                      <span>{entry?.training_name ?? "—"}</span>
                      <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
//                            CERTIFICATE VIEWER
// =========================================================================
function CertificateViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const isImage = !!url && /\.(png|jpe?g|webp|gif)$/i.test(url.split("?")[0]);
  return (
    <Dialog open={!!url} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Certificate</DialogTitle>
        </DialogHeader>
        <div className="h-[70vh] bg-muted rounded-md overflow-hidden">
          {url && (
            isImage
              ? <img src={url} alt="Certificate" className="w-full h-full object-contain" />
              : <iframe src={url} title="Certificate" className="w-full h-full" />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {url && (
            <Button asChild>
              <a href={url} target="_blank" rel="noreferrer" download>
                <Download className="h-4 w-4 mr-2" /> Download
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
