import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, Gift, X, ArrowLeft, ChevronRight, Users, Building2, CreditCard, Layers, MessageSquare, Trash2, CalendarClock, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface SubRow {
  organisation_id: string;
  status: string;
  is_comped: boolean;
  comped_until: string | null;
  comped_reason: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  current_period_start: string | null;
  site_quantity: number;
  hq_quantity: number;
  base_active: boolean;
  compliance_active: boolean;
  business_active: boolean;
  bundle_active: boolean;
  tier: string | null;
  billing_interval: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
  subscription: SubRow | null;
}

interface PlatformStats {
  totalActive: number;
  totalPaid: number;
  totalTrial: number;
  totalComped: number;
  newSignups30d: number;
  topModules: { name: string; count: number }[];
}

const ALL_MODULES = [
  "temperatures","day_sheet","cleaning","shifts","timesheets","messenger","waste_log","customer_feedback",
  "allergens","suppliers","pest_maintenance","incidents","batch_tracking","staff_training","haccp","ppm_schedule",
  "cost_margin","tip_tracker","reports",
];

export default function Admin() {
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: orgsData }, { data: subs }, { data: modules }] = await Promise.all([
      supabase.from("organisations").select("id, name, slug, created_at").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*"),
      supabase.from("module_activation").select("module_name, is_active").eq("is_active", true),
    ]);
    const subMap = new Map((subs || []).map((s: SubRow) => [s.organisation_id, s]));
    const orgList: OrgRow[] = (orgsData || []).map((o: { id: string; name: string; slug: string | null; created_at: string }) => ({
      ...o,
      subscription: (subMap.get(o.id) as SubRow) || null,
    }));
    setOrgs(orgList);

    // Platform stats
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let totalPaid = 0, totalTrial = 0, totalComped = 0;
    for (const s of (subs || []) as SubRow[]) {
      const compedActive = s.is_comped && (!s.comped_until || new Date(s.comped_until) > now);
      if (compedActive) totalComped++;
      if (s.status === "trialing") totalTrial++;
      if (s.status === "active" && !compedActive) totalPaid++;
    }
    const newSignups30d = orgList.filter(o => new Date(o.created_at) >= thirtyDaysAgo).length;
    const moduleCounts = new Map<string, number>();
    for (const m of (modules || []) as { module_name: string }[]) {
      moduleCounts.set(m.module_name, (moduleCounts.get(m.module_name) || 0) + 1);
    }
    const topModules = Array.from(moduleCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    setStats({
      totalActive: orgList.length,
      totalPaid,
      totalTrial,
      totalComped,
      newSignups30d,
      topModules,
    });
    setLoading(false);
  };

  useEffect(() => { if (isSuperAdmin) load(); }, [isSuperAdmin]);

  if (roleLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!isSuperAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Access denied. This area is for MiseOS administrators only.
        </CardContent></Card>
      </div>
    );
  }

  if (selectedOrgId) {
    const org = orgs.find(o => o.id === selectedOrgId);
    if (!org) {
      return (
        <div className="p-6 max-w-6xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => setSelectedOrgId(null)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          <p className="text-sm text-muted-foreground mt-4">Organisation not found.</p>
        </div>
      );
    }
    return <OrgDetail org={org} onBack={() => setSelectedOrgId(null)} onChange={load} />;
  }

  const filtered = orgs.filter(o => o.name.toLowerCase().includes(filter.toLowerCase()) || (o.slug || "").toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-heading text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Manage organisations, plans, and support.</p>
        </div>
      </div>

      {stats && <PlatformStatsSection stats={stats} />}

      <Input placeholder="Search organisations…" value={filter} onChange={e => setFilter(e.target.value)} />

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(org => (
            <OrgCard key={org.id} org={org} onChange={load} onOpen={() => setSelectedOrgId(org.id)} />
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No organisations.</p>}
        </div>
      )}
    </div>
  );
}

function PlatformStatsSection({ stats }: { stats: PlatformStats }) {
  const cells: { label: string; value: string | number; tone?: string }[] = [
    { label: "Active orgs", value: stats.totalActive },
    { label: "Paid plans", value: stats.totalPaid, tone: "text-success" },
    { label: "On trial", value: stats.totalTrial, tone: "text-primary" },
    { label: "Comped", value: stats.totalComped, tone: "text-warning" },
    { label: "New (30d)", value: stats.newSignups30d },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Platform stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {cells.map(c => (
            <div key={c.label} className="rounded-lg border bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-2xl font-semibold ${c.tone || ""}`}>{c.value}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Top 3 active modules</p>
          <div className="flex flex-wrap gap-2">
            {stats.topModules.length === 0 && <span className="text-xs text-muted-foreground">No data</span>}
            {stats.topModules.map((m, i) => (
              <Badge key={m.name} variant="secondary" className="text-xs">
                #{i + 1} {m.name.replace(/_/g, " ")} · {m.count}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrgCard({ org, onChange, onOpen }: { org: OrgRow; onChange: () => void; onOpen: () => void }) {
  const sub = org.subscription;
  const compedActive = sub?.is_comped && (!sub.comped_until || new Date(sub.comped_until) > new Date());
  return (
    <Card className="hover:border-primary/40 transition-colors cursor-pointer" onClick={onOpen}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {org.name}
              {org.slug && <span className="text-xs text-muted-foreground font-normal">/{org.slug}</span>}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Created {format(new Date(org.created_at), "d MMM yyyy")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end items-center">
            {compedActive && <Badge className="bg-success/15 text-success border-success/30">Comped</Badge>}
            <Badge variant="outline">{sub?.status || "no sub"}</Badge>
            {sub && <Badge variant="secondary">{sub.site_quantity} site(s)</Badge>}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {sub?.trial_end && <p className="text-muted-foreground">Trial ends: {format(new Date(sub.trial_end), "d MMM yyyy")}</p>}
        {sub?.current_period_end && <p className="text-muted-foreground">Period ends: {format(new Date(sub.current_period_end), "d MMM yyyy")}</p>}
        {compedActive && sub?.comped_reason && <p className="text-xs">📝 {sub.comped_reason}</p>}
        <div className="flex gap-2 pt-2" onClick={e => e.stopPropagation()}>
          {!compedActive ? (
            <GrantCompDialog orgId={org.id} onChange={onChange} />
          ) : (
            <Button size="sm" variant="outline" onClick={async () => {
              const { error } = await supabase.from("subscriptions").update({
                is_comped: false, comped_reason: null, comped_until: null,
              }).eq("organisation_id", org.id);
              if (error) toast.error(error.message); else { toast.success("Comped access revoked"); onChange(); }
            }}><X className="h-3.5 w-3.5 mr-1" />Revoke comp</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function GrantCompDialog({ orgId, onChange }: { orgId: string; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const [saving, setSaving] = useState(false);

  const grant = async () => {
    setSaving(true);
    const { error } = await supabase.from("subscriptions").update({
      is_comped: true,
      comped_reason: reason || null,
      comped_until: until ? new Date(until).toISOString() : null,
    }).eq("organisation_id", orgId);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Comped access granted"); setOpen(false); setReason(""); setUntil(""); onChange(); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Gift className="h-3.5 w-3.5 mr-1" />Grant comp access</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Grant complimentary access</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Reason (internal note)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Demo account, beta tester, partner…" />
          </div>
          <div className="space-y-1.5">
            <Label>Expires on (optional, leave blank for unlimited)</Label>
            <Input type="date" value={until} onChange={e => setUntil(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={grant} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Grant</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ====================== ORG DETAIL ====================== */

interface SiteRow { id: string; name: string; address: string | null; site_code: string | null; active: boolean; created_at: string; }
interface UserRow { id: string; display_name: string; email: string | null; auth_type: string; status: string; last_login_at: string | null; created_at: string; org_role?: string; site_roles?: string[]; }
interface ModuleRow { site_id: string; module_name: string; is_active: boolean; activated_at: string | null; }
interface NoteRow { id: string; note: string; created_at: string; created_by: string; created_by_name?: string | null; }

function OrgDetail({ org, onBack, onChange }: { org: OrgRow; onBack: () => void; onChange: () => void }) {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [allSubs, setAllSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [sitesRes, usersRes, orgUsersRes, membershipsRes, modulesRes, subsRes] = await Promise.all([
      supabase.from("sites").select("id, name, address, site_code, active, created_at").eq("organisation_id", org.id).order("created_at"),
      supabase.from("users").select("id, display_name, email, auth_type, status, last_login_at, created_at").eq("organisation_id", org.id),
      supabase.from("org_users").select("user_id, org_role, active").eq("organisation_id", org.id).eq("active", true),
      sb.from("memberships").select("user_id, site_id, site_role, active").eq("active", true),
      supabase.from("module_activation").select("site_id, module_name, is_active, activated_at"),
      supabase.from("subscriptions").select("*").eq("organisation_id", org.id).order("created_at", { ascending: false }),
    ]);

    const siteIds = new Set((sitesRes.data || []).map((s: SiteRow) => s.id));
    const orgRoleMap = new Map((orgUsersRes.data || []).map((ou: { user_id: string; org_role: string }) => [ou.user_id, ou.org_role]));
    const userSiteRoles = new Map<string, string[]>();
    for (const m of (membershipsRes.data || []) as { user_id: string; site_id: string; site_role: string }[]) {
      if (!siteIds.has(m.site_id)) continue;
      const arr = userSiteRoles.get(m.user_id) || [];
      arr.push(m.site_role);
      userSiteRoles.set(m.user_id, arr);
    }

    setSites((sitesRes.data || []) as SiteRow[]);
    setUsers(((usersRes.data || []) as UserRow[]).map(u => ({
      ...u,
      org_role: orgRoleMap.get(u.id) as string | undefined,
      site_roles: userSiteRoles.get(u.id) || [],
    })));
    setModules(((modulesRes.data || []) as ModuleRow[]).filter(m => siteIds.has(m.site_id)));
    setAllSubs((subsRes.data || []) as SubRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [org.id]);

  const currentSub = allSubs[0] || null;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back to organisations</Button>
        <ImpersonateDialog orgId={org.id} orgName={org.name} />
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-muted-foreground">
            {org.slug && <span>/{org.slug} · </span>}Created {format(new Date(org.created_at), "d MMM yyyy")}
          </p>
        </div>
        {currentSub && (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{currentSub.status}</Badge>
            {currentSub.is_comped && (!currentSub.comped_until || new Date(currentSub.comped_until) > new Date()) && (
              <Badge className="bg-success/15 text-success border-success/30">Comped</Badge>
            )}
            <Badge variant="secondary">{currentSub.site_quantity} site(s)</Badge>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview"><CreditCard className="h-4 w-4 mr-1.5" />Plan</TabsTrigger>
            <TabsTrigger value="sites"><Building2 className="h-4 w-4 mr-1.5" />Sites & modules</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />Users</TabsTrigger>
            <TabsTrigger value="history"><Layers className="h-4 w-4 mr-1.5" />Sub history</TabsTrigger>
            <TabsTrigger value="support"><MessageSquare className="h-4 w-4 mr-1.5" />Support log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <PlanPanel orgId={org.id} sub={currentSub} onChange={() => { void load(); onChange(); }} />
          </TabsContent>

          <TabsContent value="sites" className="mt-4 space-y-3">
            {sites.length === 0 && <p className="text-sm text-muted-foreground">No sites.</p>}
            {sites.map(site => (
              <SiteModulesCard
                key={site.id}
                site={site}
                modules={modules.filter(m => m.site_id === site.id)}
                onChange={load}
              />
            ))}
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <UsersPanel users={users} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <SubHistoryPanel subs={allSubs} />
          </TabsContent>

          <TabsContent value="support" className="mt-4">
            <SupportLogPanel orgId={org.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function PlanPanel({ orgId, sub, onChange }: { orgId: string; sub: SubRow | null; onChange: () => void }) {
  const [trialEnd, setTrialEnd] = useState(sub?.trial_end ? sub.trial_end.slice(0, 10) : "");
  const [savingTrial, setSavingTrial] = useState(false);
  const compedActive = sub?.is_comped && (!sub.comped_until || new Date(sub.comped_until) > new Date());

  if (!sub) return <Card><CardContent className="py-8 text-sm text-muted-foreground text-center">No subscription record.</CardContent></Card>;

  const saveTrial = async () => {
    setSavingTrial(true);
    const { error } = await supabase.from("subscriptions").update({
      trial_end: trialEnd ? new Date(trialEnd).toISOString() : null,
    }).eq("organisation_id", orgId);
    setSavingTrial(false);
    if (error) toast.error(error.message);
    else { toast.success("Trial end updated"); onChange(); }
  };

  const toggleComp = async (next: boolean) => {
    const { error } = await supabase.from("subscriptions").update({
      is_comped: next,
      ...(next ? {} : { comped_reason: null, comped_until: null }),
    }).eq("organisation_id", orgId);
    if (error) toast.error(error.message);
    else { toast.success(next ? "Comped access enabled" : "Comped access disabled"); onChange(); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Current plan</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Status" value={sub.status} />
            <Field label="Tier" value={sub.tier || "—"} />
            <Field label="Interval" value={sub.billing_interval || "—"} />
            <Field label="Sites" value={String(sub.site_quantity)} />
            <Field label="HQ users" value={String(sub.hq_quantity)} />
            <Field label="Period start" value={sub.current_period_start ? format(new Date(sub.current_period_start), "d MMM yyyy") : "—"} />
            <Field label="Period end" value={sub.current_period_end ? format(new Date(sub.current_period_end), "d MMM yyyy") : "—"} />
            <Field label="Stripe sub" value={sub.stripe_subscription_id || "—"} mono />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {sub.base_active && <Badge variant="secondary">Base</Badge>}
            {sub.compliance_active && <Badge variant="secondary">Compliance</Badge>}
            {sub.business_active && <Badge variant="secondary">Business</Badge>}
            {sub.bundle_active && <Badge variant="secondary">Bundle</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Extend trial</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Trial end date</Label>
            <Input type="date" value={trialEnd} onChange={e => setTrialEnd(e.target.value)} className="w-48" />
          </div>
          <Button size="sm" onClick={saveTrial} disabled={savingTrial}>
            {savingTrial && <Loader2 className="h-4 w-4 animate-spin mr-1" />}<CalendarClock className="h-4 w-4 mr-1" />Save trial date
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Comped access</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Comped enabled</p>
              <p className="text-xs text-muted-foreground">Bypasses billing while active.</p>
            </div>
            <Switch checked={!!sub.is_comped} onCheckedChange={toggleComp} />
          </div>
          {compedActive && sub.comped_reason && <p className="text-xs">📝 {sub.comped_reason}</p>}
          {sub.comped_until && <p className="text-xs text-muted-foreground">Expires: {format(new Date(sub.comped_until), "d MMM yyyy")}</p>}
          {!sub.is_comped && <GrantCompDialog orgId={orgId} onChange={onChange} />}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function SiteModulesCard({ site, modules, onChange }: { site: SiteRow; modules: ModuleRow[]; onChange: () => void }) {
  const moduleMap = useMemo(() => new Map(modules.map(m => [m.module_name, m])), [modules]);

  const toggle = async (moduleName: string, next: boolean) => {
    const existing = moduleMap.get(moduleName);
    if (existing) {
      const { error } = await supabase.from("module_activation")
        .update({ is_active: next, activated_at: next ? new Date().toISOString() : null })
        .eq("site_id", site.id).eq("module_name", moduleName);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("module_activation").insert({
        site_id: site.id, module_name: moduleName, is_active: next, activated_at: next ? new Date().toISOString() : null,
      });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`${moduleName} ${next ? "enabled" : "disabled"}`);
    onChange();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{site.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {site.site_code && <span>Code: {site.site_code} · </span>}
              {site.address || "No address"}
            </p>
          </div>
          {!site.active && <Badge variant="outline">Inactive</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_MODULES.map(name => {
            const m = moduleMap.get(name);
            const active = !!m?.is_active;
            return (
              <div key={name} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="capitalize">{name.replace(/_/g, " ")}</span>
                <Switch checked={active} onCheckedChange={(v) => toggle(name, v)} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function UsersPanel({ users }: { users: UserRow[] }) {
  if (users.length === 0) return <Card><CardContent className="py-8 text-sm text-muted-foreground text-center">No users.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{u.display_name || "(no name)"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {u.email || (u.auth_type === "staff_code" ? "Staff code" : "—")}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="outline" className="text-[10px]">{u.auth_type}</Badge>
                  <Badge variant="outline" className="text-[10px]">{u.status}</Badge>
                  {u.org_role && <Badge variant="secondary" className="text-[10px]">{u.org_role}</Badge>}
                  {(u.site_roles || []).map((r, i) => <Badge key={i} variant="secondary" className="text-[10px]">{r}</Badge>)}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0">
                <p>Last login</p>
                <p>{u.last_login_at ? formatDistanceToNow(new Date(u.last_login_at), { addSuffix: true }) : "Never"}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SubHistoryPanel({ subs }: { subs: SubRow[] }) {
  if (subs.length === 0) return <Card><CardContent className="py-8 text-sm text-muted-foreground text-center">No subscription history.</CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {subs.map((s, i) => (
            <div key={i} className="p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{s.status}</Badge>
                  {s.tier && <Badge variant="secondary">{s.tier}</Badge>}
                  {s.billing_interval && <Badge variant="secondary">{s.billing_interval}</Badge>}
                  {s.is_comped && <Badge className="bg-success/15 text-success border-success/30">Comped</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{format(new Date(s.updated_at), "d MMM yyyy HH:mm")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {s.current_period_start ? format(new Date(s.current_period_start), "d MMM yyyy") : "—"}
                {" → "}
                {s.current_period_end ? format(new Date(s.current_period_end), "d MMM yyyy") : "—"}
              </p>
              {s.stripe_subscription_id && <p className="text-xs font-mono text-muted-foreground truncate">{s.stripe_subscription_id}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SupportLogPanel({ orgId }: { orgId: string }) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: noteRows } = await sb.from("support_notes").select("*").eq("organisation_id", orgId).order("created_at", { ascending: false });
    const list = (noteRows || []) as NoteRow[];
    const userIds = Array.from(new Set(list.map(n => n.created_by)));
    let nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: usersData } = await supabase.from("users").select("auth_user_id, display_name").in("auth_user_id", userIds);
      nameMap = new Map((usersData || []).map((u: { auth_user_id: string; display_name: string }) => [u.auth_user_id, u.display_name]));
    }
    setNotes(list.map(n => ({ ...n, created_by_name: nameMap.get(n.created_by) || null })));
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId]);

  const add = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not signed in"); setSaving(false); return; }
    const { error } = await sb.from("support_notes").insert({
      organisation_id: orgId, created_by: user.id, note: text.trim(),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { setText(""); toast.success("Note added"); void load(); }
  };

  const remove = async (id: string) => {
    const { error } = await sb.from("support_notes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Note deleted"); void load(); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Add internal note</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Logged a support call about… / Bug reported: … / Fix applied: …"
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={saving || !text.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Add note
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Internal only. Never visible to the customer.</p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : notes.length === 0 ? (
        <Card><CardContent className="py-8 text-sm text-muted-foreground text-center">No support notes yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <Card key={n.id}>
              <CardContent className="py-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => remove(n.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {n.created_by_name || "Super admin"} · {format(new Date(n.created_at), "d MMM yyyy HH:mm")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
