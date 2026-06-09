import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import {
  BASE_MODULES, COMPLIANCE_MODULES, BUSINESS_MODULES, AI_MODULES,
  MODULE_LABELS, type ModuleName, type TierId,
} from "@/lib/plans";
import { toast } from "sonner";
import { format } from "date-fns";

const TIER_LABEL: Record<TierId, string> = {
  essentials: "Essentials",
  compliance: "Compliance",
  profit: "Profit",
  intelligence: "Intelligence",
};

function expectedModulesForTier(tier: TierId | null): Set<ModuleName> {
  const out = new Set<ModuleName>();
  if (!tier) return out;
  BASE_MODULES.forEach(m => out.add(m));
  if (tier === "compliance" || tier === "profit" || tier === "intelligence") {
    COMPLIANCE_MODULES.forEach(m => out.add(m));
  }
  if (tier === "profit" || tier === "intelligence") {
    BUSINESS_MODULES.forEach(m => out.add(m));
  }
  if (tier === "intelligence") {
    AI_MODULES.forEach(m => out.add(m));
  }
  return out;
}

export default function SubscriptionDiagnostics() {
  const { orgRole, appUser } = useAuth();
  const { currentSite } = useSite();
  const { subscription, loading, refresh, tier } = useOrgAccess();
  const [activation, setActivation] = useState<Array<{ module_name: string; is_active: boolean }>>([]);
  const [actLoading, setActLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);

  const isManager = orgRole?.org_role === "org_owner" || orgRole?.org_role === "hq_admin";
  const siteId = currentSite?.id ?? null;
  const orgId = appUser?.organisation_id ?? null;

  const loadActivation = async () => {
    if (!siteId) { setActivation([]); setActLoading(false); return; }
    setActLoading(true);
    const { data } = await supabase
      .from("module_activation")
      .select("module_name, is_active")
      .eq("site_id", siteId);
    setActivation((data as any) ?? []);
    setActLoading(false);
  };

  useEffect(() => { void loadActivation(); }, [siteId]);

  const expected = useMemo(() => expectedModulesForTier(tier), [tier]);
  const actualActive = useMemo(() => new Set(activation.filter(a => a.is_active).map(a => a.module_name)), [activation]);

  const missing = useMemo(() => [...expected].filter(m => !actualActive.has(m)), [expected, actualActive]);
  const unexpected = useMemo(() => [...actualActive].filter(m => !expected.has(m as ModuleName)), [expected, actualActive]);
  const inSync = missing.length === 0 && unexpected.length === 0;

  const onResync = async () => {
    if (!orgId) return;
    setResyncing(true);
    const { error } = await supabase.rpc("resync_org_modules", { _org_id: orgId });
    setResyncing(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Modules re-synced from your current plan.");
    await Promise.all([refresh(), loadActivation()]);
  };

  if (!isManager) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Only the organisation owner or HQ admin can view subscription diagnostics.
        </CardContent></Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Subscription Diagnostics</h1>
          <p className="text-sm text-muted-foreground">Verify the plan you're paying for matches what's switched on.</p>
        </div>
        <Button asChild variant="ghost" size="sm"><Link to="/account"><ArrowLeft className="h-4 w-4 mr-1" />Account</Link></Button>
      </div>

      {/* Health check */}
      <Card className={inSync ? "border-success/40 bg-success/5" : "border-breach/40 bg-breach/5"}>
        <CardContent className="py-4 flex items-center gap-3">
          {inSync ? <CheckCircle2 className="h-6 w-6 text-success" /> : <AlertTriangle className="h-6 w-6 text-breach" />}
          <div className="flex-1">
            <p className="font-semibold">
              {inSync ? "Subscription ↔ module activation in sync" : "Mismatch detected"}
            </p>
            {!inSync && (
              <p className="text-xs text-muted-foreground">
                {missing.length > 0 && <>Expected on, but off: <strong>{missing.map(m => MODULE_LABELS[m as ModuleName] ?? m).join(", ")}</strong>. </>}
                {unexpected.length > 0 && <>On, but not expected: <strong>{unexpected.map(m => MODULE_LABELS[m as ModuleName] ?? m).join(", ")}</strong>.</>}
              </p>
            )}
          </div>
          <Button size="sm" onClick={onResync} disabled={resyncing}>
            {resyncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Re-sync modules
          </Button>
        </CardContent>
      </Card>

      {/* Subscription record */}
      <Card>
        <CardHeader><CardTitle className="text-base">Subscription record</CardTitle></CardHeader>
        <CardContent className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <Row label="Organisation ID" value={orgId} mono />
          <Row label="Plan tier" value={tier ? TIER_LABEL[tier] : "—"} />
          <Row label="Billing interval" value={subscription?.billing_interval ?? "—"} />
          <Row label="Status" value={subscription?.status ?? "—"} />
          <Row label="Trial ends" value={subscription?.trial_end ? format(new Date(subscription.trial_end), "d MMM yyyy") : "—"} />
          <Row label="Current period end" value={subscription?.current_period_end ? format(new Date(subscription.current_period_end), "d MMM yyyy") : "—"} />
          <Row label="Stripe customer" value={subscription?.stripe_customer_id ?? "—"} mono />
          <Row label="Stripe subscription" value={subscription?.stripe_subscription_id ?? "—"} mono />
          <Row label="Updated at" value={subscription?.updated_at ? format(new Date(subscription.updated_at), "d MMM yyyy HH:mm") : "—"} />
        </CardContent>
      </Card>

      {/* Expected modules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected modules</CardTitle>
          <CardDescription>What your current tier should unlock.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ModuleGroup title="Essentials" modules={BASE_MODULES} expected={expected} active={actualActive} />
          <ModuleGroup title="Compliance" modules={COMPLIANCE_MODULES} expected={expected} active={actualActive} />
          <ModuleGroup title="Business" modules={BUSINESS_MODULES} expected={expected} active={actualActive} />
          <ModuleGroup title="AI" modules={AI_MODULES} expected={expected} active={actualActive} />
        </CardContent>
      </Card>

      {/* Actual activation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module activation for this site</CardTitle>
          <CardDescription>{currentSite?.name ?? "No site selected"}</CardDescription>
        </CardHeader>
        <CardContent>
          {actLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 text-sm">
              {activation.map(a => (
                <div key={a.module_name} className="flex items-center justify-between border-b border-border/50 py-1">
                  <span>{MODULE_LABELS[a.module_name as ModuleName] ?? a.module_name}</span>
                  <Badge variant="outline" className={a.is_active ? "bg-success/10 text-success border-success/30" : "text-muted-foreground"}>
                    {a.is_active ? "on" : "off"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs truncate max-w-[60%]" : "text-right"}>{value ?? "—"}</span>
    </div>
  );
}

function ModuleGroup({ title, modules, expected, active }: {
  title: string;
  modules: ModuleName[];
  expected: Set<ModuleName>;
  active: Set<string>;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {modules.map(m => {
          const isExpected = expected.has(m);
          const isActive = active.has(m);
          const ok = isExpected === isActive;
          return (
            <Badge
              key={m}
              variant="outline"
              className={
                !isExpected ? "text-muted-foreground/70" :
                ok ? "bg-success/10 text-success border-success/30" :
                "bg-breach/10 text-breach border-breach/30"
              }
            >
              {MODULE_LABELS[m]}
              {isExpected && (ok ? " ✓" : " ✗")}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
