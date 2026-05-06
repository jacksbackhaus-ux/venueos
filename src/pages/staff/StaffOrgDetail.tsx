import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Eye, ShieldAlert, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { SubscriptionManager } from "@/components/staff/SubscriptionManager";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface OrgDetail {
  organisation: { id: string; name: string; slug: string | null; created_at: string };
  sites: Array<{ id: string; name: string; site_code: string | null; address: string | null }>;
  subscription: Record<string, unknown> | null;
  user_count: number;
  org_owners: Array<{ user_id: string; display_name: string | null; email: string | null; org_role: string }>;
}

export default function StaffOrgDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useSuperAdmin();
  const { startImpersonation, isImpersonating } = useImpersonation();
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const [showImpersonate, setShowImpersonate] = useState(false);
  const [reason, setReason] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    void (async () => {
      setLoading(true);
      const { data, error } = await sb.rpc("staff_get_org_detail", { _org_id: orgId });
      if (error) {
        if (error.code === "42501" || /not authorised/i.test(error.message || "")) {
          setDenied(true);
        } else {
          toast.error(error.message);
        }
        setLoading(false);
        return;
      }
      setDetail(data as OrgDetail);
      setLoading(false);
    })();
  }, [orgId]);

  const start = async () => {
    if (!detail) return;
    if (reason.trim().length < 5) {
      toast.error("Reason required (min 5 chars).");
      return;
    }
    setStarting(true);
    const res = await startImpersonation({
      organisationId: detail.organisation.id,
      reason: reason.trim(),
    });
    setStarting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Impersonating ${detail.organisation.name}.`);
    setShowImpersonate(false);
    setReason("");
    window.location.assign("/");
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-muted-foreground" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/staff/orgs")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to assigned organisations
        </Button>
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-warning" />
            <h2 className="font-heading font-semibold">Not authorised for this organisation</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              You don't have an active assignment for this organisation. Ask a platform super admin
              to grant you access via the Access Management page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/staff/orgs")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        <Link to="/staff" className="text-xs text-blue-600 hover:underline font-medium">
          Staff Dashboard
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="font-heading text-xl">{detail.organisation.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {detail.organisation.slug && <code className="mr-2">/{detail.organisation.slug}</code>}
                Created {format(new Date(detail.organisation.created_at), "PP")}
              </p>
            </div>
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                disabled={isImpersonating}
                onClick={() => setShowImpersonate(true)}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" /> Start Impersonation
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <MapPin className="h-3.5 w-3.5" /> Sites
            </div>
            <p className="font-heading text-2xl font-bold">{detail.sites.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" /> Active users
            </div>
            <p className="font-heading text-2xl font-bold">{detail.user_count}</p>
          </CardContent>
        </Card>
      </div>

      <SubscriptionManager orgId={detail.organisation.id} orgName={detail.organisation.name} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Sites</CardTitle></CardHeader>
        <CardContent className="p-0">
          {detail.sites.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No sites yet.</p>
          ) : (
            <div className="divide-y">
              {detail.sites.map(s => (
                <div key={s.id} className="px-4 py-3">
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.site_code && <code className="mr-2">{s.site_code}</code>}
                    {s.address}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Org owners & HQ admins</CardTitle></CardHeader>
        <CardContent className="p-0">
          {detail.org_owners.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No managers found.</p>
          ) : (
            <div className="divide-y">
              {detail.org_owners.map(o => (
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
      <SupportNotes orgId={detail.organisation.id} />

      <Dialog open={showImpersonate} onOpenChange={setShowImpersonate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate {detail.organisation.name}</DialogTitle>
            <DialogDescription>
              You'll be signed in as this organisation's primary manager.
              Read-only — all writes are blocked. Auto-expires after 60 minutes.
              This action is logged.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason (required, min 5 chars) — e.g. 'Investigating ticket #1234'"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowImpersonate(false)}>Cancel</Button>
            <Button onClick={() => void start()} disabled={starting}>
              {starting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Start impersonation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

  useEffect(() => { void load(); }, [orgId]);

  const save = async () => {
    if (!draft.trim() || !user?.id) return;
    setSaving(true);
    const { error } = await sb.from("support_notes").insert({ organisation_id: orgId, created_by: user.id, note: draft.trim() });
    if (error) { toast.error(error.message); } else { setDraft(""); void load(); }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" /> Internal Support Notes
        </CardTitle>
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
                <p className="text-foreground">{n.note}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(n.created_at), "d MMM yyyy HH:mm")}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export const _Link = Link;
