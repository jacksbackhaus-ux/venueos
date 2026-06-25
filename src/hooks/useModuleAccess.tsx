import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { ALL_MODULES, type ModuleName } from "@/lib/plans";
import { isModuleVisibleInLaunch } from "@/lib/launchFlags";

export interface ModuleActivationRow {
  id: string;
  site_id: string;
  module_name: ModuleName;
  is_active: boolean;
  activated_at: string | null;
  updated_at: string;
}

/**
 * Per-site module activation state. Lists which of the 14 modules are turned
 * on for the *current* site. Reactive — updates instantly when subscription
 * changes (via DB trigger writing module_activation) or when an org owner
 * toggles a module in Settings.
 */
export function useModuleAccess() {
  const { currentSite } = useSite();
  const { trialActive } = useOrgAccess();
  const siteId = currentSite?.id || null;
  const [rows, setRows] = useState<ModuleActivationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!siteId) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("module_activation")
        .select("*")
        .eq("site_id", siteId);
      if (error) throw error;
      setRows((data ?? []) as ModuleActivationRow[]);
    } catch (e) {
      console.error("Failed to load module activations.", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!siteId) return;
    const channel = supabase
      .channel(`module-access-${siteId}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table: "module_activation", filter: `site_id=eq.${siteId}` },
        () => { void refreshRef.current(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [siteId]);

  const activeMap: Record<string, boolean> = {};
  rows.forEach(r => { activeMap[r.module_name] = r.is_active; });

  // During an active free trial, unlock every module — trial users get everything.
  // Launch flag: in HACCP-only mode, hide non-HACCP modules from customer UI
  // even when subscription/trial would otherwise grant access. Hidden modules
  // remain in the codebase and re-enable when LAUNCH_MODE flips back to "full".
  const isActive = (mod: ModuleName) => {
    if (!isModuleVisibleInLaunch(mod)) return false;
    return trialActive ? true : !!activeMap[mod];
  };
  const activeModules = (trialActive ? [...ALL_MODULES] : ALL_MODULES.filter(m => activeMap[m]))
    .filter(isModuleVisibleInLaunch);

  return { loading, rows, isActive, activeModules, refresh };
}
