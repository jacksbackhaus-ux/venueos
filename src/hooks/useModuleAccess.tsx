import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { ALL_MODULES, type ModuleName } from "@/lib/plans";

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

  const isActive = (mod: ModuleName) => !!activeMap[mod];
  const activeModules = ALL_MODULES.filter(m => activeMap[m]);

  return { loading, rows, isActive, activeModules, refresh };
}
