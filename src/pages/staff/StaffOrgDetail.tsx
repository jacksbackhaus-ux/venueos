import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Loader2, ArrowLeft, Eye, ShieldAlert, ShieldPlus, Headset, Copy, CreditCard, Boxes,
  Activity, FileClock, History, Building2, AlertTriangle, Thermometer, Sparkles, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { SubscriptionManager } from "@/components/staff/SubscriptionManager";
import { deriveTierFromFlags, TIERS, type TierId } from "@/lib/plans";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface Customer360 {
  organisation: { id: string; name: string; slug: string | null; created_at: string };
  subscription: Record<string, any> | null;
  sites: Array<{ id: string; name: string; site_code: string | null; address: string | null; active: boolean; timezone: string | null }>;
  org_owners: Array<{ user_id: string; display_name: string | null; email: string | null; org_role: string }>;
  user_count: number;
  assigned_staff: Array<{ staff_user_id: string; access_level: string; reason: string; granted_at: string; expires_at: string | null }>;
  ops_snapshot: {
    open_incidents: number;
    last_temp_log_at: string | null;
    last_cleaning_log_at: string | null;
    waste_week_count: number;
  };
  recent_activity: Array<{ created_at: string; action_type: string; reason: string; performed_by: string; metadata: any }>;
  impersonation_history: Array<{ id: string; internal_user_id: string; started_at: string; ended_at: string | null; expires_at: string; active: boolean; access_level: string; reason: string }>;
}

function relative(ts: string | null) {
  if (!ts) return "Never";
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return "—"; }
}

function planLabel(sub: Customer360["subscription"]): { tier: TierId | null; label: string } {
  if (!sub) return { tier: null, label: "No subscription" };
  const tier = (sub.tier as TierId | null) ?? deriveTierFromFlags({
    base: !!sub.base_active, compliance: !!sub.compliance_active,
    business: !!sub.business_active, bundle: !!sub.bundle_active, ai: !!sub.ai_active,
  });
  return { tier, label: tier ? TIERS[tier].name : "Unconfigured" };
}

export default function StaffOrgDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useSuperAdmin();
  const { startImpersonation, isImpersonating } = useImpersonation();
  const [c360, setC360] = useState<Customer360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showImpersonate, setShowImpersonate] = useState(false);
  const [reason, setReason] = useState("");
  const [siteId, setSiteId] = useState<string | "">("");
  const [starting, setStarting] = useState(false);

  const load = async () => {
    if (!orgId) return;
    setRefreshing(true);
    const { data, error } = await sb.rpc("staff_get_customer_360", { _org_id: orgId });
    if (error) {
      console.error("[Customer360] load failed", error);
      if (error.code === "42501" || /not authorised/i.test(error.message || "")) setDenied(true);
      else toast.error(error.message);
    } else {
      setC360(data as Customer360);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [orgId]);

  const hasAssignment = useMemo(() => {
    if (!c360) return false;
    if (isSuperAdmin) return true;
    return c360.assigned_staff.length > 0;
  }, [c360, isSuperAdmin]);

  const startImpersonationFlow = async () => {
    if (!c360) return;
    if (reason.trim().length < 5) { toast.error("Reason required (min 5 chars)."); return; }
    setStarting(true);
    const res = await startImpersonation({
      organisationId: c360.organisation.id,
      siteId: siteId || null,
      reason: reason.trim(),
      returnTo: `/staff/org/${c360.organisation.id}`,
    });
    setStarting(false);
    if (res.error) {
      console.error("[Customer360] impersonation failed", res.error);
      toast.error(res.error);
      return;
    }
    toast.success(`Support mode started for ${c360.organisation.name}.`);
    setShowImpersonate(false);
    setReason("");
    // Full reload so all customer providers initialise cleanly inside the tenant.
    window.location.assign("/");
  };

  const copyLoginUrl = () => {
    if (!c360?.organisation.slug) { toast.error("This organisation has no slug."); return; }
    const url = `${window.location.origin}/login/${c360.organisation.slug}`;
    void navigator.clipboard.writeText(url);
    toast.success("Branded login URL copied.");
  };

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin inline text-muted-foreground" /></div>;
  }

  if (denied) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/staff/orgs")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-warning" />
            <h2 className="font-heading font-semibold">Not authorised for this organisation</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You don't have an active assignment for this organisation. Ask a super admin to grant access first.
            </p>
            <Link to="/staff/access"><Button variant="outline" size="sm" className="mt-2"><ShieldPlus className="h-3.5 w-3.5 mr-1.5" /> Grant access first</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!c360) return null;
  const { tier, label } = planLabel(c360.subscription);
  const sub = c360.subscription;
  const status = (sub?.status as string) || "—";
  const interval = (sub?.billing_interval as string) || "—";
  const renewal = sub?.current_period_end ? format(new Date(sub.current_period_end as string), "PP") : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/staff/orgs")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to tenants
        </Button>
        <div className="flex items-center gap-2 text-xs">
          {refreshing && <Loader2 className="h-3 w-3 animate-spin" />}
          <Link to="/staff" className="text-blue-600 hover:underline font-medium">Staff Dashboard</Link>
        </div>
      </div>

      {/* SECTION A — Customer summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="font-heading text-xl truncate">{c360.organisation.name}</CardTitle>
                <Badge variant="outline" className="text-[10px]">Customer 360</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {c360.organisation.slug && <code>/{c360.organisation.slug}</code>}
                <span>ID <code className="text-[10px]">{c360.organisation.id.slice(0, 8)}…</code></span>
                <span>Created {format(new Date(c360.organisation.created_at), "PP")}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button variant="outline" size="sm" onClick={copyLoginUrl}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Login URL
              </Button>
              <Link to="/staff/access"><Button variant="outline" size="sm"><ShieldPlus className="h-3.5 w-3.5 mr-1.5" /> Grant access</Button></Link>
              <Button
                variant={hasAssignment ? "default" : "outline"}
                size="sm"
                disabled={!hasAssignment || isImpersonating}
                onClick={() => hasAssignment ? setShowImpersonate(true) : toast.error("Grant access first.")}
                title={hasAssignment ? "Start a support session" : "Grant access first"}
              >
                <Headset className="h-3.5 w-3.5 mr-1.5" />
                {hasAssignment ? "Impersonate" : "Grant access first"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-4 gap-3 pt-0">
          <Stat icon={<CreditCard className="h-3.5 w-3.5" />} label="Plan" value={label} sub={tier ?? "—"} />
          <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Status" value={status} sub={interval} />
          <Stat icon={<FileClock className="h-3.5 w-3.5" />} label="Renews" value={renewal} sub={sub?.cancel_at_period_end ? "cancels at period end" : ""} />
          <Stat icon={<Boxes className="h-3.5 w-3.5" />} label="Sites · Users" value={`${c360.sites.length} · ${c360.user_count}`} sub={`${c360.assigned_staff.length} internal staff assigned`} />
        </CardContent>
      </Card>

      {/* SECTION D — Operational snapshot */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Operational snapshot</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-4 gap-3">
          <Stat icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Open incidents" value={c360.ops_snapshot.open_incidents.toString()} />
          <Stat icon={<Thermometer className="h-3.5 w-3.5" />} label="Last temp log" value={relative(c360.ops_snapshot.last_temp_log_at)} />
          <Stat icon={<Sparkles className="h-3.5 w-3.5" />} label="Last cleaning" value={relative(c360.ops_snapshot.last_cleaning_log_at)} />
          <Stat icon={<Trash2 className="h-3.5 w-3.5" />} label="Waste (7d)" value={`${c360.ops_snapshot.waste_week_count} entries`} />
        </CardContent>
      </Card>

      {/* SECTION C — Sites */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Sites ({c360.sites.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {c360.sites.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No sites yet.</p>
          ) : (
            <div className="divide-y">
              {c360.sites.slice(0, 4).map(s => (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.site_code && <code className="mr-2">{s.site_code}</code>}
                      {s.address || "—"}{s.timezone ? ` · ${s.timezone}` : ""}
                    </p>
                  </div>
                  <Badge variant={s.active ? "secondary" : "outline"} className="text-[10px]">{s.active ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
              {c360.sites.length > 4 && (
                <p className="text-xs text-muted-foreground px-4 py-2">+ {c360.sites.length - 4} more</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <SubscriptionManager orgId={c360.organisation.id} orgName={c360.organisation.name} />

      {/* Org owners */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Owners & HQ admins</CardTitle></CardHeader>
        <CardContent className="p-0">
          {c360.org_owners.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No managers found.</p>
          ) : (
            <div className="divide-y">
              {c360.org_owners.map(o => (
                <div key={o.user_id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{o.display_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">{o.email}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{o.org_role}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION B — Assigned internal staff */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Assigned internal staff ({c360.assigned_staff.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {c360.assigned_staff.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No internal staff assigned to this tenant.</p>
          ) : (
            <div className="divide-y">
              {c360.assigned_staff.map(a => (
                <div key={a.staff_user_id + a.granted_at} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm"><code className="text-xs">{a.staff_user_id.slice(0, 8)}…</code></p>
                    <p className="text-xs text-muted-foreground italic truncate">{a.reason}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">{a.access_level}</Badge>
                    <span>{format(new Date(a.granted_at), "PP")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION F — Recent internal activity */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Recent internal activity</CardTitle></CardHeader>
        <CardContent className="p-0">
          {c360.recent_activity.length === 0 && c360.impersonation_history.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No internal actions logged yet.</p>
          ) : (
            <div className="divide-y">
              {c360.recent_activity.slice(0, 10).map((a, i) => (
                <div key={i} className="px-4 py-2.5 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium"><Badge variant="outline" className="text-[10px] mr-2">{a.action_type}</Badge>{a.reason}</p>
                    <p className="text-xs text-muted-foreground">by <code>{a.performed_by.slice(0,8)}…</code></p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{relative(a.created_at)}</span>
                </div>
              ))}
              {c360.impersonation_history.slice(0, 5).map(s => (
                <div key={s.id} className="px-4 py-2.5 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium"><Badge variant={s.active ? "default" : "outline"} className="text-[10px] mr-2">{s.active ? "active" : "ended"}</Badge>impersonation · {s.access_level}</p>
                    <p className="text-xs text-muted-foreground italic">{s.reason}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{relative(s.started_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION E — Internal support notes */}
      <SupportNotes orgId={c360.organisation.id} />

      <Dialog open={showImpersonate} onOpenChange={setShowImpersonate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate {c360.organisation.name}</DialogTitle>
            <DialogDescription>
              You'll enter the customer tenant in read-only support mode. All writes are blocked,
              the session auto-expires in 2 hours, and the action is logged.
            </DialogDescription>
          </DialogHeader>
          {c360.sites.length > 1 && (
            <div className="space-y-1.5">
              <label htmlFor="imp-site" className="text-xs font-medium">Site (optional)</label>
              <select
                id="imp-site"
                value={siteId}
                onChange={e => setSiteId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All sites (org-level)</option>
                {c360.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <Textarea
            placeholder="Reason (required, min 5 chars) — e.g. 'Investigating ticket #1234'"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowImpersonate(false)}>Cancel</Button>
            <Button onClick={() => void startImpersonationFlow()} disabled={starting}>
              {starting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Eye className="h-4 w-4 mr-2" /> Enter support mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <p className="font-heading text-base font-semibold mt-1 truncate">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

function SupportNotes({ orgId }: { orgId: string }) {
  const [notes, setNotes] = useState<{ id: string; note: string; created_at: string; created_by: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from("support_notes").select("*").eq("organisation_id", orgId).order("created_at", { ascending: false }).limit(50);
    setNotes((data ?? []) as any[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [orgId]);

  const save = async () => {
    if (!draft.trim() || !user?.id) return;
    setSaving(true);
    const { error } = await sb.from("support_notes").insert({ organisation_id: orgId, created_by: user.id, note: draft.trim() });
    if (error) toast.error(error.message); else { setDraft(""); void load(); }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Internal support notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Textarea
            placeholder="Add an internal note — e.g. 'Called 6 May, resolved login issue. Follow up next week.'"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <Button size="sm" onClick={save} disabled={saving || !draft.trim()} className="shrink-0 self-end">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No notes yet.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((n: any) => (
              <div key={n.id} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <p className="text-foreground whitespace-pre-wrap">{n.note}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), "d MMM yyyy HH:mm")}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
