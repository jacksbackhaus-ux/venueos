import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { ALL_MODULES, MODULE_LABELS, BASE_MODULES, COMPLIANCE_MODULES, BUSINESS_MODULES, modulesForFlags, type ModuleName } from "@/lib/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Group { label: string; modules: ModuleName[]; }
const GROUPS: Group[] = [
  { label: "Daily Operations", modules: BASE_MODULES },
  { label: "Compliance",       modules: COMPLIANCE_MODULES },
  { label: "Business",         modules: BUSINESS_MODULES },
];

/**
 * Per-site Module Management — visible to org_owner only via Settings.
 * Toggling here updates `module_activation` only — does NOT change Stripe.
 * Modules not in the current subscription show as locked with an upgrade CTA.
 */
export function ModuleManagementSection() {
  const navigate = useNavigate();
  const { currentSite } = useSite();
  const { plan } = useOrgAccess();
  const { rows, isActive, refresh } = useModuleAccess();
  const [savingModule, setSavingModule] = useState<ModuleName | null>(null);

  const allowed = useMemo(() => modulesForFlags(plan), [plan]);

  // Detect savings hint: a Compliance / Business add-on the user pays for but isn't using on any site.
  const usageHint = useMemo(() => {
    // rows are scoped to current site only — not enough info for a true cross-site hint here.
    // Show a hint if NONE of an add-on group's modules are on for THIS site.
    if (plan.bundle) return null;
    const hints: string[] = [];
    if (plan.compliance && COMPLIANCE_MODULES.every(m => !isActive(m))) {
      hints.push("Compliance Add-on (£3.99/site/mo)");
    }
    if (plan.business && BUSINESS_MODULES.every(m => !isActive(m))) {
      hints.push("Business Add-on (£3.99/site/mo)");
    }
    return hints.length ? hints : null;
  }, [plan, isActive, rows]);

  const handleToggle = async (mod: ModuleName, next: boolean) => {
    if (!currentSite?.id) return;
    if (!allowed.has(mod)) {
      toast.info("This module isn't in your current plan.");
      return;
    }
    setSavingModule(mod);
    // Upsert: row may not exist yet for newly-added modules.
    const { error } = await supabase
      .from("module_activation")
      .upsert(
        { site_id: currentSite.id, module_name: mod, is_active: next, activated_at: next ? new Date().toISOString() : null },
        { onConflict: "site_id,module_name" }
      );
    setSavingModule(null);
    if (error) {
      toast.error(`Could not update ${MODULE_LABELS[mod]}: ${error.message}`);
      return;
    }
    await refresh();
    toast.success(`${MODULE_LABELS[mod]} ${next ? "enabled" : "hidden"} for this site.`);
  };

  if (!currentSite) {
    return <p className="text-sm text-muted-foreground">Select a site to manage modules.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-semibold text-sm">Modules — {currentSite.name}</h2>
        <p className="text-xs text-muted-foreground">
          Turn modules on or off for this site. Off modules are hidden from navigation everywhere.
          This doesn't change your billing.
        </p>
      </div>

      {usageHint && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-3 flex items-start gap-3">
            <Lightbulb className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2 text-xs">
              <p className="text-foreground">
                You're paying for the {usageHint.join(" and ")} but none of its modules are switched on for this site.
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate("/account")}>
                Review billing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {GROUPS.map(group => (
        <Card key={group.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.modules.map(mod => {
              const inPlan = allowed.has(mod);
              const on = isActive(mod);
              const saving = savingModule === mod;
              return (
                <div
                  key={mod}
                  className={`flex items-center justify-between rounded-md border p-2.5 ${
                    !inPlan ? "opacity-60 bg-muted/40" : "bg-card"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{MODULE_LABELS[mod]}</p>
                    {!inPlan && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">Not in your plan</span>
                      </div>
                    )}
                  </div>
                  {!inPlan ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate("/account")}>
                      Upgrade
                    </Button>
                  ) : saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch checked={on} onCheckedChange={v => handleToggle(mod, v)} aria-label={`Toggle ${MODULE_LABELS[mod]}`} />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
