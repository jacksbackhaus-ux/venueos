import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, ShieldCheck, Search, UserPlus, Clock, X, History } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface SuperAdminRow {
  id: string;
  user_id: string;
  email: string;
  granted_at: string;
  granted_by: string | null;
  notes: string | null;
  created_by: string | null;
  reason: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

interface UserSearchRow {
  id: string;
  auth_user_id: string | null;
  display_name: string | null;
  email: string | null;
}

interface AuditRow {
  id: string;
  performed_by: string;
  action_type: string;
  target_user_id: string | null;
  target_organisation_id: string | null;
  reason: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function statusOf(row: SuperAdminRow): { label: string; tone: "active" | "expiring" | "expired" | "revoked" } {
  if (row.revoked_at) return { label: "Revoked", tone: "revoked" };
  if (row.expires_at) {
    const exp = new Date(row.expires_at).getTime();
    const now = Date.now();
    if (exp <= now) return { label: "Expired", tone: "expired" };
    if (exp - now < 24 * 3600 * 1000) return { label: "Expires <24h", tone: "expiring" };
  }
  return { label: "Active", tone: "active" };
}

export default function SuperAdminsTab() {
  const { authUser } = useAuth();
  const [rows, setRows] = useState<SuperAdminRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: admins }, { data: log }] = await Promise.all([
      sb.from("super_admins").select("*").order("granted_at", { ascending: false }),
      sb.from("admin_actions_log").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setRows((admins || []) as SuperAdminRow[]);
    setAudit((log || []) as AuditRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Super Admin access
          </h2>
          <p className="text-sm text-muted-foreground">Grant, revoke and audit platform-wide admin access.</p>
        </div>
        <Button onClick={() => setGranting(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" />Grant access
        </Button>
      </div>

      <Tabs defaultValue="admins" className="w-full">
        <TabsList>
          <TabsTrigger value="admins"><ShieldCheck className="h-4 w-4 mr-1.5" />Super admins</TabsTrigger>
          <TabsTrigger value="audit"><History className="h-4 w-4 mr-1.5" />Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="mt-4">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              No super admins yet.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {rows.map(r => (
                <SuperAdminCard
                  key={r.id}
                  row={r}
                  isSelf={authUser?.id === r.user_id}
                  onChange={load}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditLogView rows={audit} />
        </TabsContent>
      </Tabs>

      <GrantDialog open={granting} onOpenChange={setGranting} onGranted={load} existingRows={rows} />
    </div>
  );
}

function SuperAdminCard({ row, isSelf, onChange }: { row: SuperAdminRow; isSelf: boolean; onChange: () => void }) {
  const [extending, setExtending] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const status = statusOf(row);
  const toneClass = {
    active: "bg-success/10 text-success border-success/20",
    expiring: "bg-warning/10 text-warning border-warning/20",
    expired: "bg-muted text-muted-foreground",
    revoked: "bg-destructive/10 text-destructive border-destructive/20",
  }[status.tone];

  return (
    <Card className={status.tone === "expiring" ? "border-warning/40" : ""}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">{row.email}</p>
              <Badge variant="outline" className={toneClass}>{status.label}</Badge>
              {isSelf && <Badge variant="outline">You</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1 break-all">user_id: {row.user_id}</p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <p>Granted {formatDistanceToNow(new Date(row.granted_at), { addSuffix: true })}</p>
              {row.expires_at ? (
                <p>Expires {format(new Date(row.expires_at), "PPp")} ({formatDistanceToNow(new Date(row.expires_at), { addSuffix: true })})</p>
              ) : (
                <p>Permanent</p>
              )}
              {row.reason && <p className="italic">Reason: {row.reason}</p>}
              {row.revoked_at && <p>Revoked {format(new Date(row.revoked_at), "PPp")}</p>}
            </div>
          </div>
          {!row.revoked_at && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setExtending(true)}>
                <Clock className="h-3.5 w-3.5 mr-1" />Extend
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setRevoking(true)} disabled={isSelf}>
                <X className="h-3.5 w-3.5 mr-1" />Revoke
              </Button>
            </div>
          )}
        </div>
        {isSelf && !row.revoked_at && (
          <p className="text-xs text-muted-foreground mt-2">You cannot revoke your own access — ask another super admin.</p>
        )}
      </CardContent>
      <ExtendDialog open={extending} onOpenChange={setExtending} row={row} onChanged={onChange} />
      <RevokeDialog open={revoking} onOpenChange={setRevoking} row={row} onChanged={onChange} />
    </Card>
  );
}

/* ---------- Grant ---------- */

function GrantDialog({
  open, onOpenChange, onGranted, existingRows,
}: { open: boolean; onOpenChange: (v: boolean) => void; onGranted: () => void; existingRows: SuperAdminRow[] }) {
  const { authUser } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<UserSearchRow | null>(null);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<"7" | "30" | "permanent">("7");
  const [permConfirm, setPermConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery(""); setResults([]); setPicked(null); setReason("");
      setDuration("7"); setPermConfirm("");
    }
  }, [open]);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await sb
        .from("users")
        .select("id, auth_user_id, display_name, email")
        .or(`email.ilike.%${query}%,display_name.ilike.%${query}%,auth_user_id.eq.${query}`)
        .limit(20);
      setResults((data || []) as UserSearchRow[]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const isSelfPick = picked?.auth_user_id && authUser?.id === picked.auth_user_id;
  const alreadyActive = picked?.auth_user_id
    && existingRows.some(r => r.user_id === picked.auth_user_id && !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date()));

  const canSubmit =
    !!picked?.auth_user_id &&
    !isSelfPick &&
    !alreadyActive &&
    reason.trim().length >= 5 &&
    (duration !== "permanent" || permConfirm === "GRANT-PERMANENT");

  const submit = async () => {
    if (!picked?.auth_user_id || !canSubmit) return;
    setSubmitting(true);
    const expires_at = duration === "permanent"
      ? null
      : new Date(Date.now() + (duration === "7" ? 7 : 30) * 24 * 3600 * 1000).toISOString();

    const { error } = await sb.from("super_admins").insert({
      user_id: picked.auth_user_id,
      email: picked.email || "(unknown)",
      reason: reason.trim(),
      expires_at,
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }

    await sb.from("admin_actions_log").insert({
      performed_by: authUser?.id,
      action_type: "grant_super_admin",
      target_user_id: picked.auth_user_id,
      reason: reason.trim(),
      metadata: { duration, expires_at, email: picked.email },
    });
    toast.success(`Granted super admin to ${picked.email || picked.display_name}`);
    setSubmitting(false);
    onOpenChange(false);
    onGranted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant super admin access</DialogTitle>
          <DialogDescription>Search for a user, give a reason, and pick a duration.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5"><Search className="h-3.5 w-3.5" />Search user</Label>
            <Input
              placeholder="Email, name or auth user id"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="mt-1.5"
            />
            {searching && <p className="text-xs text-muted-foreground mt-1">Searching…</p>}
            {results.length > 0 && !picked && (
              <div className="mt-2 border rounded-md max-h-60 overflow-auto divide-y">
                {results.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full text-left p-2 text-sm hover:bg-muted"
                    onClick={() => setPicked(u)}
                  >
                    <p className="font-medium">{u.display_name || "(no name)"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    {!u.auth_user_id && <p className="text-xs text-warning">No auth account — cannot be granted.</p>}
                  </button>
                ))}
              </div>
            )}
            {picked && (
              <div className="mt-2 p-3 border rounded-md bg-muted/30 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{picked.display_name || "(no name)"}</p>
                    <p className="text-xs text-muted-foreground">{picked.email}</p>
                    <p className="text-xs text-muted-foreground break-all">auth: {picked.auth_user_id || "—"}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Change</Button>
                </div>
                {isSelfPick && <p className="text-xs text-destructive mt-2">You cannot grant super admin to yourself.</p>}
                {alreadyActive && <p className="text-xs text-warning mt-2">This user already has active super admin — use Extend instead.</p>}
                {!picked.auth_user_id && <p className="text-xs text-destructive mt-2">No auth account linked — cannot be granted.</p>}
              </div>
            )}
          </div>

          <div>
            <Label>Reason (required, min 5 chars)</Label>
            <Textarea
              placeholder="e.g. Onboarding support for ACME, ticket #1234"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>

          <div>
            <Label>Duration</Label>
            <RadioGroup value={duration} onValueChange={(v) => setDuration(v as typeof duration)} className="mt-1.5 space-y-1.5">
              <div className="flex items-center gap-2"><RadioGroupItem value="7" id="d7" /><Label htmlFor="d7" className="font-normal">7 days (recommended)</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="30" id="d30" /><Label htmlFor="d30" className="font-normal">30 days</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="permanent" id="dp" /><Label htmlFor="dp" className="font-normal">Permanent</Label></div>
            </RadioGroup>
            {duration === "permanent" && (
              <div className="mt-3 p-3 border border-destructive/30 bg-destructive/5 rounded-md">
                <p className="text-xs text-destructive font-medium">Permanent access does not expire automatically.</p>
                <Label className="text-xs mt-2 block">Type <code className="font-mono">GRANT-PERMANENT</code> to confirm</Label>
                <Input value={permConfirm} onChange={e => setPermConfirm(e.target.value)} className="mt-1" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
            Grant access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Revoke ---------- */

function RevokeDialog({
  open, onOpenChange, row, onChanged,
}: { open: boolean; onOpenChange: (v: boolean) => void; row: SuperAdminRow; onChanged: () => void }) {
  const { authUser } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [safeToRevoke, setSafeToRevoke] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) { setReason(""); setSafeToRevoke(null); return; }
    (async () => {
      const { data } = await sb.rpc("is_super_admin_revoke_safe", { _row_id: row.id });
      setSafeToRevoke(data === true);
    })();
  }, [open, row.id]);

  const submit = async () => {
    if (reason.trim().length < 5) { toast.error("Reason required (min 5 chars)"); return; }
    setSubmitting(true);
    const { error } = await sb
      .from("super_admins")
      .update({ revoked_at: new Date().toISOString(), revoked_by: authUser?.id })
      .eq("id", row.id);
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    await sb.from("admin_actions_log").insert({
      performed_by: authUser?.id,
      action_type: "revoke_super_admin",
      target_user_id: row.user_id,
      reason: reason.trim(),
      metadata: { email: row.email },
    });
    toast.success(`Revoked super admin from ${row.email}`);
    setSubmitting(false);
    onOpenChange(false);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke super admin</DialogTitle>
          <DialogDescription>Remove platform-wide access from {row.email}.</DialogDescription>
        </DialogHeader>
        {safeToRevoke === false && (
          <div className="p-3 border border-destructive/30 bg-destructive/5 rounded-md text-sm text-destructive">
            Cannot revoke — this would leave the platform with no active super admins.
          </div>
        )}
        <div>
          <Label>Reason (required)</Label>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-1.5" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={submitting || safeToRevoke === false || reason.trim().length < 5}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Revoke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Extend ---------- */

function ExtendDialog({
  open, onOpenChange, row, onChanged,
}: { open: boolean; onOpenChange: (v: boolean) => void; row: SuperAdminRow; onChanged: () => void }) {
  const { authUser } = useAuth();
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<"7" | "30" | "permanent">("7");
  const [permConfirm, setPermConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setReason(""); setDays("7"); setPermConfirm(""); }
  }, [open]);

  const canSubmit = reason.trim().length >= 5 && (days !== "permanent" || permConfirm === "GRANT-PERMANENT");

  const submit = async () => {
    setSubmitting(true);
    const baseFromExisting = row.expires_at && new Date(row.expires_at) > new Date()
      ? new Date(row.expires_at).getTime()
      : Date.now();
    const new_expires_at = days === "permanent"
      ? null
      : new Date(baseFromExisting + (days === "7" ? 7 : 30) * 24 * 3600 * 1000).toISOString();

    const { error } = await sb
      .from("super_admins")
      .update({ expires_at: new_expires_at })
      .eq("id", row.id);
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    await sb.from("admin_actions_log").insert({
      performed_by: authUser?.id,
      action_type: "extend_super_admin",
      target_user_id: row.user_id,
      reason: reason.trim(),
      metadata: { previous_expires_at: row.expires_at, new_expires_at, email: row.email },
    });
    toast.success("Access extended");
    setSubmitting(false);
    onOpenChange(false);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend super admin access</DialogTitle>
          <DialogDescription>{row.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Extend by</Label>
            <RadioGroup value={days} onValueChange={(v) => setDays(v as typeof days)} className="mt-1.5 space-y-1.5">
              <div className="flex items-center gap-2"><RadioGroupItem value="7" id="e7" /><Label htmlFor="e7" className="font-normal">+7 days</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="30" id="e30" /><Label htmlFor="e30" className="font-normal">+30 days</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="permanent" id="ep" /><Label htmlFor="ep" className="font-normal">Make permanent</Label></div>
            </RadioGroup>
            {days === "permanent" && (
              <div className="mt-2">
                <Label className="text-xs">Type <code className="font-mono">GRANT-PERMANENT</code> to confirm</Label>
                <Input value={permConfirm} onChange={e => setPermConfirm(e.target.value)} className="mt-1" />
              </div>
            )}
          </div>
          <div>
            <Label>Reason (required)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-1.5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Extend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Audit log ---------- */

function AuditLogView({ rows }: { rows: AuditRow[] }) {
  const [actionFilter, setActionFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const types = useMemo(() => Array.from(new Set(rows.map(r => r.action_type))).sort(), [rows]);
  const filtered = rows.filter(r =>
    (!actionFilter || r.action_type === actionFilter) &&
    (!search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
  );

  if (rows.length === 0) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No admin actions logged yet.</CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        >
          <option value="">All actions</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <Input placeholder="Search reason / user / metadata…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[200px]" />
      </div>

      <div className="space-y-2">
        {filtered.map(r => (
          <Card key={r.id}>
            <CardContent className="py-3 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.action_type}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PPp")}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
              </div>
              <p className="mt-1.5">{r.reason}</p>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <p className="break-all">By: {r.performed_by}</p>
                {r.target_user_id && <p className="break-all">Target user: {r.target_user_id}</p>}
                {r.target_organisation_id && <p className="break-all">Target org: {r.target_organisation_id}</p>}
                {r.metadata && <pre className="mt-1 p-2 bg-muted rounded text-[11px] overflow-auto">{JSON.stringify(r.metadata, null, 2)}</pre>}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No matching actions.</p>}
      </div>
    </div>
  );
}
