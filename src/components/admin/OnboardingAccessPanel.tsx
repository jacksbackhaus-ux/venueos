import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, KeyRound, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface OrgUserRow {
  id: string;
  organisation_id: string;
  user_id: string;
  org_role: string;
  active: boolean;
  expires_at: string | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

interface UserRow {
  id: string;
  display_name: string;
  email: string | null;
}

export function OnboardingAccessPanel({
  orgId, orgName, users,
}: { orgId: string; orgName: string; users: UserRow[] }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<OrgUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [granting, setGranting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await sb
      .from("org_users")
      .select("*")
      .eq("organisation_id", orgId)
      .eq("org_role", "onboarding_admin")
      .order("created_at", { ascending: false });
    setRows((data || []) as OrgUserRow[]);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId]);

  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />Onboarding access
          </h3>
          <p className="text-sm text-muted-foreground max-w-xl">
            Grant a customer user temporary manager-level access to <strong>{orgName}</strong> only —
            scoped to this organisation, time-bound, fully revocable. Use this instead of granting global super admin.
          </p>
        </div>
        <Button onClick={() => setGranting(true)}>
          <KeyRound className="h-4 w-4 mr-1.5" />Grant onboarding access
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No onboarding admins on this organisation.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <OnboardingRoleCard key={r.id} row={r} user={userMap.get(r.user_id)} onChanged={load} />
          ))}
        </div>
      )}

      <GrantDialog
        open={granting}
        onOpenChange={setGranting}
        orgId={orgId}
        users={users}
        existingActiveUserIds={new Set(rows.filter(r => r.active && (!r.expires_at || new Date(r.expires_at) > new Date())).map(r => r.user_id))}
        actorAuthId={user?.id}
        onGranted={load}
      />
    </div>
  );
}

function OnboardingRoleCard({
  row, user, onChanged,
}: { row: OrgUserRow; user: UserRow | undefined; onChanged: () => void }) {
  const { user: actor } = useAuth();
  const [working, setWorking] = useState(false);
  const expired = row.expires_at && new Date(row.expires_at) <= new Date();
  const isActive = row.active && !expired;

  const revoke = async () => {
    if (!confirm("Revoke onboarding access for this user?")) return;
    setWorking(true);
    const { error } = await sb
      .from("org_users")
      .update({ active: false })
      .eq("id", row.id);
    if (error) { toast.error(error.message); setWorking(false); return; }
    await sb.from("admin_actions_log").insert({
      performed_by: actor?.id,
      action_type: "revoke_onboarding_admin",
      target_user_id: row.user_id,
      target_organisation_id: row.organisation_id,
      reason: "Revoked from admin panel",
      metadata: { previous_expires_at: row.expires_at },
    });
    toast.success("Onboarding access revoked");
    setWorking(false);
    onChanged();
  };

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">{user?.display_name || "(unknown user)"}</p>
              <Badge variant="outline">{user?.email || row.user_id}</Badge>
              {isActive ? (
                <Badge className="bg-success/10 text-success border-success/20">Active</Badge>
              ) : expired ? (
                <Badge variant="outline" className="text-muted-foreground">Expired</Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Revoked</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
              <p>Granted {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}</p>
              {row.expires_at ? (
                <p className="flex items-center gap-1"><Clock className="h-3 w-3" />Expires {format(new Date(row.expires_at), "PPp")}</p>
              ) : (
                <p>Permanent</p>
              )}
              {row.reason && <p className="italic">Reason: {row.reason}</p>}
            </div>
          </div>
          {isActive && (
            <Button size="sm" variant="destructive" onClick={revoke} disabled={working}>
              <X className="h-3.5 w-3.5 mr-1" />Revoke
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function GrantDialog({
  open, onOpenChange, orgId, users, existingActiveUserIds, actorAuthId, onGranted,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  orgId: string; users: UserRow[]; existingActiveUserIds: Set<string>;
  actorAuthId: string | undefined; onGranted: () => void;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<UserRow | null>(null);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<"7" | "14" | "30">("7");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setSearch(""); setPicked(null); setReason(""); setDuration("7"); }
  }, [open]);

  const filtered = users.filter(u =>
    !existingActiveUserIds.has(u.id) && (
      !search ||
      u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    )
  ).slice(0, 30);

  const canSubmit = !!picked && reason.trim().length >= 5;

  const submit = async () => {
    if (!picked || !canSubmit) return;
    setSubmitting(true);
    const expires_at = new Date(Date.now() + parseInt(duration) * 24 * 3600 * 1000).toISOString();

    // Try to insert; if a row already exists (org_role/active=false) then update it.
    const { error: insErr } = await sb.from("org_users").insert({
      organisation_id: orgId,
      user_id: picked.id,
      org_role: "onboarding_admin",
      active: true,
      reason: reason.trim(),
      expires_at,
    });

    if (insErr && /duplicate key|unique/i.test(insErr.message)) {
      const { error: updErr } = await sb.from("org_users")
        .update({
          org_role: "onboarding_admin",
          active: true,
          reason: reason.trim(),
          expires_at,
        })
        .eq("organisation_id", orgId)
        .eq("user_id", picked.id);
      if (updErr) { toast.error(updErr.message); setSubmitting(false); return; }
    } else if (insErr) {
      toast.error(insErr.message);
      setSubmitting(false);
      return;
    }

    await sb.from("admin_actions_log").insert({
      performed_by: actorAuthId,
      action_type: "grant_onboarding_admin",
      target_user_id: picked.id,
      target_organisation_id: orgId,
      reason: reason.trim(),
      metadata: { duration_days: parseInt(duration), expires_at, email: picked.email },
    });
    toast.success(`Onboarding access granted to ${picked.display_name}`);
    setSubmitting(false);
    onOpenChange(false);
    onGranted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant onboarding access</DialogTitle>
          <DialogDescription>
            Time-bound, organisation-scoped manager access. Does NOT grant billing changes or platform-wide access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Pick a user from this organisation</Label>
            <Input
              placeholder="Search name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mt-1.5"
            />
            {!picked && (
              <div className="mt-2 border rounded-md max-h-60 overflow-auto divide-y">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">No matching users (already-active onboarding admins are hidden).</p>
                ) : filtered.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full text-left p-2 text-sm hover:bg-muted"
                    onClick={() => setPicked(u)}
                  >
                    <p className="font-medium">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </button>
                ))}
              </div>
            )}
            {picked && (
              <div className="mt-2 p-3 border rounded-md bg-muted/30 text-sm flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium">{picked.display_name}</p>
                  <p className="text-xs text-muted-foreground">{picked.email}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Change</Button>
              </div>
            )}
          </div>

          <div>
            <Label>Duration</Label>
            <RadioGroup value={duration} onValueChange={(v) => setDuration(v as typeof duration)} className="mt-1.5 space-y-1.5">
              <div className="flex items-center gap-2"><RadioGroupItem value="7" id="o7" /><Label htmlFor="o7" className="font-normal">7 days (recommended)</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="14" id="o14" /><Label htmlFor="o14" className="font-normal">14 days</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="30" id="o30" /><Label htmlFor="o30" className="font-normal">30 days</Label></div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground mt-1.5">No permanent option — onboarding access is intentionally time-bound.</p>
          </div>

          <div>
            <Label>Reason (required, min 5 chars)</Label>
            <Textarea
              placeholder="e.g. Initial setup help — ticket #1234"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Grant access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
