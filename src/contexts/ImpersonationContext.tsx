import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setImpersonationActive } from "@/lib/impersonationGuard";
import { toast } from "sonner";

const STORAGE_KEY = "miseos_impersonation_session";
const SESSION_MAX_MS = 60 * 60 * 1000; // 60 minutes

export interface ImpersonationTargetUser {
  id: string;
  auth_user_id: string | null;
  organisation_id: string;
  display_name: string;
  email: string | null;
  auth_type: "email" | "staff_code";
  staff_code: string | null;
  status: "active" | "suspended";
}

export interface ImpersonationOrgRole {
  org_role: "org_owner" | "hq_admin" | "hq_auditor";
  organisation_id: string;
}

export interface ImpersonationSession {
  log_id: string;
  organisation_id: string;
  organisation_name: string;
  target_user_id: string;
  reason: string;
  started_at: string; // ISO
  expires_at: string; // ISO
}

interface ImpersonationContextType {
  session: ImpersonationSession | null;
  targetAppUser: ImpersonationTargetUser | null;
  targetOrgRole: ImpersonationOrgRole | null;
  isImpersonating: boolean;
  startImpersonation: (input: { organisationId: string; reason: string }) => Promise<{ error?: string }>;
  stopImpersonation: (opts?: { silent?: boolean; expired?: boolean }) => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

function readStored(): ImpersonationSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImpersonationSession;
    if (
      !parsed?.log_id ||
      !parsed.organisation_id ||
      !parsed.target_user_id ||
      !parsed.expires_at
    )
      return null;
    if (new Date(parsed.expires_at).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ImpersonationSession | null>(() => readStored());
  const [targetAppUser, setTargetAppUser] = useState<ImpersonationTargetUser | null>(null);
  const [targetOrgRole, setTargetOrgRole] = useState<ImpersonationOrgRole | null>(null);
  const expireTimerRef = useRef<number | null>(null);

  // Keep the global guard flag in sync with our state.
  useEffect(() => {
    setImpersonationActive(!!session);
  }, [session]);

  // Hydrate target user/role whenever the session changes.
  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setTargetAppUser(null);
      setTargetOrgRole(null);
      return;
    }
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase;
      const { data: userRow } = await sb
        .from("users")
        .select("id, auth_user_id, organisation_id, display_name, email, auth_type, staff_code, status")
        .eq("id", session.target_user_id)
        .maybeSingle();
      if (cancelled) return;
      if (!userRow) {
        setTargetAppUser(null);
        setTargetOrgRole(null);
        return;
      }
      setTargetAppUser(userRow as ImpersonationTargetUser);
      const { data: orgRow } = await sb
        .from("org_users")
        .select("org_role, organisation_id")
        .eq("user_id", userRow.id)
        .eq("active", true)
        .maybeSingle();
      if (cancelled) return;
      setTargetOrgRole((orgRow as ImpersonationOrgRole | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const stopImpersonation = useCallback(
    async (opts?: { silent?: boolean; expired?: boolean }) => {
      const current = session;
      // Clear local state FIRST so the write guard releases before we update the log.
      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setImpersonationActive(false);
      if (expireTimerRef.current) {
        window.clearTimeout(expireTimerRef.current);
        expireTimerRef.current = null;
      }
      if (current) {
        try {
          await supabase
            .from("impersonation_logs")
            .update({ ended_at: new Date().toISOString() })
            .eq("id", current.log_id);
        } catch {
          /* best-effort */
        }
      }
      if (opts?.expired) {
        toast.warning("Impersonation session expired after 60 minutes.");
      } else if (!opts?.silent) {
        toast.success("Impersonation ended.");
      }
    },
    [session]
  );

  // Auto-expire timer.
  useEffect(() => {
    if (!session) return;
    const ms = new Date(session.expires_at).getTime() - Date.now();
    if (ms <= 0) {
      void stopImpersonation({ expired: true });
      return;
    }
    expireTimerRef.current = window.setTimeout(() => {
      void stopImpersonation({ expired: true });
    }, ms);
    return () => {
      if (expireTimerRef.current) {
        window.clearTimeout(expireTimerRef.current);
        expireTimerRef.current = null;
      }
    };
  }, [session, stopImpersonation]);

  const startImpersonation = useCallback(
    async ({ organisationId, reason }: { organisationId: string; reason: string }) => {
      if (!reason.trim()) return { error: "A reason is required." };

      // Find the target organisation's primary manager: org_owner first,
      // then hq_admin, then any active manager-level org user.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase;

      // Server-side scope check: must be super admin AND have staff access to this org.
      // `has_staff_access_to_org` returns true for super admins automatically (bypass),
      // and otherwise requires an active staff_org_access row.
      const { data: scopeOk, error: scopeErr } = await sb.rpc(
        "has_staff_access_to_org",
        { _org_id: organisationId },
      );
      if (scopeErr) return { error: scopeErr.message };
      if (scopeOk !== true) {
        return { error: "You don't have staff access to this organisation." };
      }

      const { data: org } = await sb
        .from("organisations")
        .select("id, name")
        .eq("id", organisationId)
        .maybeSingle();
      if (!org) return { error: "Organisation not found." };

      const { data: orgUsers } = await sb
        .from("org_users")
        .select("user_id, org_role")
        .eq("organisation_id", organisationId)
        .eq("active", true);

      const ranked = (orgUsers || []).slice().sort((a: { org_role: string }, b: { org_role: string }) => {
        const order: Record<string, number> = { org_owner: 0, hq_admin: 1, hq_auditor: 2 };
        return (order[a.org_role] ?? 99) - (order[b.org_role] ?? 99);
      });
      const primary = ranked[0];
      if (!primary) return { error: "No manager account found for this organisation." };

      const { data: { user: adminUser } } = await supabase.auth.getUser();
      if (!adminUser) return { error: "You must be signed in." };

      // Insert the log row — must happen BEFORE the guard activates, so we
      // still have write access as the super admin.
      const { data: logRow, error: logErr } = await sb
        .from("impersonation_logs")
        .insert({
          super_admin_user_id: adminUser.id,
          target_organisation_id: organisationId,
          target_user_id: primary.user_id,
          reason: reason.trim(),
        })
        .select("id, started_at")
        .single();
      if (logErr || !logRow) return { error: logErr?.message || "Failed to log impersonation." };

      const startedAt = (logRow.started_at as string) || new Date().toISOString();
      const expiresAt = new Date(new Date(startedAt).getTime() + SESSION_MAX_MS).toISOString();

      const newSession: ImpersonationSession = {
        log_id: logRow.id as string,
        organisation_id: organisationId,
        organisation_name: org.name,
        target_user_id: primary.user_id as string,
        reason: reason.trim(),
        started_at: startedAt,
        expires_at: expiresAt,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
      setImpersonationActive(true);
      return {};
    },
    []
  );

  const value = useMemo<ImpersonationContextType>(
    () => ({
      session,
      targetAppUser,
      targetOrgRole,
      isImpersonating: !!session,
      startImpersonation,
      stopImpersonation,
    }),
    [session, targetAppUser, targetOrgRole, startImpersonation, stopImpersonation]
  );

  return <ImpersonationContext.Provider value={value}>{children}</ImpersonationContext.Provider>;
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}
