import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Gift, Lock, Unlock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface Subscription {
  id: string;
  organisation_id: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  is_comped: boolean;
  comped_reason: string | null;
  comped_until: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_interval: string | null;
  site_quantity: number;
  hq_quantity: number;
  base_active: boolean;
  compliance_active: boolean;
  business_active: boolean;
  bundle_active: boolean;
  locked_at: string | null;
  environment: string;
  updated_at: string;
}

const STATUSES = ["trialing", "active", "past_due", "canceled", "incomplete", "unpaid", "paused"];
const INTERVALS = ["month", "year"];

function toLocalDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function fromLocalDateTime(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

export function SubscriptionManager({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { isSuperAdmin } = useSuperAdmin();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<Partial<Subscription>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await sb.rpc("staff_get_subscription", { _org_id: orgId });
    if (error) {
      console.error(error);
      toast.error("Could not load subscription");
      setLoading(false);
      return;
    }
    const s = (data?.subscription ?? null) as Subscription | null;
    setSub(s);
    setDraft(s ? { ...s } : {});
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(sub);

  const save = async () => {
    if (!sub) return;
    if (reason.trim().length < 5) {
      toast.error("Reason required (min 5 chars).");
      return;
    }
    // Build patch with only changed keys
    const patch: Record<string, unknown> = {};
    const fields: (keyof Subscription)[] = [
      "is_comped","comped_reason","comped_until","status","trial_end","current_period_end",
      "cancel_at_period_end","billing_interval","site_quantity","hq_quantity",
      "base_active","compliance_active","business_active","bundle_active","locked_at",
    ];
    for (const k of fields) {
      if (draft[k] !== sub[k]) patch[k] = draft[k] ?? null;
    }
    if (Object.keys(patch).length === 0) {
      toast.info("No changes to save.");
      return;
    }
    setSaving(true);
    const { error } = await sb.rpc("staff_update_subscription", {
      _org_id: orgId, _reason: reason.trim(), _patch: patch,
    });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error(error.message?.includes("authoris") ? "Not authorised — super admin required." : "Could not update subscription");
      return;
    }
    toast.success("Subscription updated.");
    setReason("");
    void load();
  };

  const quickAction = async (label: string, patch: Record<string, unknown>, defaultReason: string) => {
    if (!isSuperAdmin) return;
    const r = window.prompt(`Reason for "${label}" (min 5 chars):`, defaultReason);
    if (!r || r.trim().length < 5) return;
    setSaving(true);
    const { error } = await sb.rpc("staff_update_subscription", {
      _org_id: orgId, _reason: r.trim(), _patch: patch,
    });
    setSaving(false);
    if (error) { console.error(error); toast.error("Could not apply change"); return; }
    toast.success(`${label} applied.`);
    void load();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!sub) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No subscription record exists for this organisation.
        </CardContent>
      </Card>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Subscription (read-only)</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-1.5">
          <p><b>Status:</b> {sub.status} {sub.is_comped && <Badge variant="outline" className="ml-2">comped</Badge>}</p>
          <p><b>Plan:</b> {[sub.bundle_active && "bundle", sub.base_active && "base", sub.compliance_active && "compliance", sub.business_active && "business"].filter(Boolean).join(", ") || "none"}</p>
          <p><b>Trial end:</b> {sub.trial_end ? format(new Date(sub.trial_end), "PPp") : "—"}</p>
          <p><b>Period end:</b> {sub.current_period_end ? format(new Date(sub.current_period_end), "PPp") : "—"}</p>
          <p><b>Locked:</b> {sub.locked_at ? format(new Date(sub.locked_at), "PPp") : "no"}</p>
          <p className="text-muted-foreground italic">Only super admins can edit subscriptions.</p>
        </CardContent>
      </Card>
    );
  }

  const set = <K extends keyof Subscription>(k: K, v: Subscription[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm">Subscription Management</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {orgName} · {sub.environment} · updated {format(new Date(sub.updated_at), "PP p")}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={saving}
            onClick={() => quickAction("Comp 30 days",
              { is_comped: true, comped_until: new Date(Date.now() + 30 * 86400000).toISOString() },
              "Goodwill comp 30d")}>
            <Gift className="h-3.5 w-3.5 mr-1.5" /> Comp 30 days
          </Button>
          <Button variant="outline" size="sm" disabled={saving}
            onClick={() => quickAction("Extend trial 14 days",
              { trial_end: new Date(Date.now() + 14 * 86400000).toISOString(), status: "trialing" },
              "Trial extension")}>
            +14d trial
          </Button>
          {sub.locked_at ? (
            <Button variant="outline" size="sm" disabled={saving}
              onClick={() => quickAction("Unlock account", { locked_at: null }, "Unlock — payment resolved")}>
              <Unlock className="h-3.5 w-3.5 mr-1.5" /> Unlock
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={saving}
              onClick={() => quickAction("Lock account", { locked_at: new Date().toISOString() }, "Locking — non-payment")}>
              <Lock className="h-3.5 w-3.5 mr-1.5" /> Lock
            </Button>
          )}
        </div>

        {/* Status & billing */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={draft.status ?? sub.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Billing interval</Label>
            <Select value={draft.billing_interval ?? "month"} onValueChange={v => set("billing_interval", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVALS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Trial end</Label>
            <Input type="datetime-local" value={toLocalDateTime(draft.trial_end ?? null)}
              onChange={e => set("trial_end", fromLocalDateTime(e.target.value) as never)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Current period end</Label>
            <Input type="datetime-local" value={toLocalDateTime(draft.current_period_end ?? null)}
              onChange={e => set("current_period_end", fromLocalDateTime(e.target.value) as never)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Site quantity</Label>
            <Input type="number" min={0} value={draft.site_quantity ?? 1}
              onChange={e => set("site_quantity", parseInt(e.target.value || "0", 10))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">HQ quantity</Label>
            <Input type="number" min={0} value={draft.hq_quantity ?? 0}
              onChange={e => set("hq_quantity", parseInt(e.target.value || "0", 10))} />
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Module flags</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {(["base_active","compliance_active","business_active","bundle_active"] as const).map(k => (
              <div key={k} className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor={k} className="text-xs cursor-pointer">{k.replace("_active","")}</Label>
                <Switch id={k} checked={!!draft[k]} onCheckedChange={v => set(k, v as never)} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="cape" className="text-xs cursor-pointer">Cancel at period end</Label>
            <Switch id="cape" checked={!!draft.cancel_at_period_end}
              onCheckedChange={v => set("cancel_at_period_end", v as never)} />
          </div>
        </div>

        {/* Comp */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comp</p>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="comp" className="text-xs cursor-pointer">Comped (free access)</Label>
            <Switch id="comp" checked={!!draft.is_comped}
              onCheckedChange={v => set("is_comped", v as never)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Comp until</Label>
              <Input type="datetime-local" value={toLocalDateTime(draft.comped_until ?? null)}
                onChange={e => set("comped_until", fromLocalDateTime(e.target.value) as never)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Comp reason</Label>
              <Input value={draft.comped_reason ?? ""}
                onChange={e => set("comped_reason", e.target.value as never)}
                placeholder="e.g. partner pilot" />
            </div>
          </div>
        </div>

        {/* Stripe info */}
        {(sub.stripe_customer_id || sub.stripe_subscription_id) && (
          <div className="text-[11px] text-muted-foreground space-y-0.5 border-t pt-3 font-mono">
            {sub.stripe_customer_id && <p>cus: {sub.stripe_customer_id}</p>}
            {sub.stripe_subscription_id && <p>sub: {sub.stripe_subscription_id}</p>}
          </div>
        )}

        {/* Save */}
        <div className="border-t pt-4 space-y-2">
          <Label className="text-xs">Reason for change (audit log, min 5 chars) *</Label>
          <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. Customer support ticket #1234 — requested manual extension" />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={!dirty || saving}
              onClick={() => { setDraft({ ...sub }); setReason(""); }}>
              Discard
            </Button>
            <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save changes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
