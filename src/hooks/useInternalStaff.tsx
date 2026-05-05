import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface InternalStaffRoleRow {
  role: "support" | "onboarding" | "ops" | "engineering";
  expires_at: string | null;
  revoked_at: string | null;
}

/**
 * Returns whether the current authed user is active MiseOS internal staff,
 * plus their granted role(s). Customers and even platform super admins are
 * NOT internal staff unless explicitly added to internal_staff_roles.
 */
export function useInternalStaff() {
  const { user } = useAuth();
  const [isInternalStaff, setIsInternalStaff] = useState(false);
  const [roles, setRoles] = useState<InternalStaffRoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsInternalStaff(false);
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      // RLS on internal_staff_roles only allows super admins to SELECT, so
      // we use the SECURITY DEFINER helper which is allowed for any authed user.
      const { data: ok, error } = await supabase.rpc("is_internal_staff");
      if (cancelled) return;
      const active = !error && ok === true;
      setIsInternalStaff(active);

      if (active) {
        // Best-effort fetch of role names — may return [] for non-super-admins
        // due to RLS; that's fine, we still know they're staff.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb: any = supabase;
        const { data } = await sb
          .from("internal_staff_roles")
          .select("role, expires_at, revoked_at")
          .eq("user_id", user.id)
          .is("revoked_at", null);
        if (!cancelled) setRoles((data as InternalStaffRoleRow[]) || []);
      } else {
        setRoles([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isInternalStaff, roles, loading };
}
