import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Gift, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";

interface OrgRow {
  id: string;
  name: string;
  created_at: string;
  subscription: {
    status: string;
    is_comped: boolean;
    comped_until: string | null;
    comped_reason: string | null;
    trial_end: string | null;
    current_period_end: string | null;
    site_quantity: number;
    hq_quantity: number;
  } | null;
}

export default function Admin() {
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: orgsData } = await supabase.from("organisations").select("id, name, created_at").order("created_at", { ascending: false });
    const { data: subs } = await supabase.from("subscriptions").select("*");
    const subMap = new Map((subs || []).map(s => [s.organisation_id, s]));
    setOrgs((orgsData || []).map(o => ({ ...o, subscription: (subMap.get(o.id) as any) || null })));
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

  const filtered = orgs.filter(o => o.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-heading text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Manage organisations and grant comped access.</p>
        </div>
      </div>

      <Input placeholder="Search organisations…" value={filter} onChange={e => setFilter(e.target.value)} />

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(org => <OrgCard key={org.id} org={org} onChange={load} />)}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No organisations.</p>}
        </div>
      )}
    </div>
  );
}

function OrgCard({ org, onChange }: { org: OrgRow; onChange: () => void }) {
  const sub = org.subscription;
  const compedActive = sub?.is_comped && (!sub.comped_until || new Date(sub.comped_until) > new Date());
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{org.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Created {format(new Date(org.created_at), "d MMM yyyy")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end">
            {compedActive && <Badge className="bg-success/15 text-success border-success/30">Comped</Badge>}
            <Badge variant="outline">{sub?.status || "no sub"}</Badge>
            {sub && <Badge variant="secondary">{sub.site_quantity} site(s)</Badge>}
            {sub && sub.hq_quantity > 0 && <Badge variant="secondary">{sub.hq_quantity} HQ user(s)</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {sub?.trial_end && <p className="text-muted-foreground">Trial ends: {format(new Date(sub.trial_end), "d MMM yyyy")}</p>}
        {sub?.current_period_end && <p className="text-muted-foreground">Period ends: {format(new Date(sub.current_period_end), "d MMM yyyy")}</p>}
        {compedActive && sub?.comped_reason && <p className="text-xs">📝 {sub.comped_reason}</p>}
        <div className="flex gap-2 pt-2">
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
