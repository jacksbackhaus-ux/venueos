import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setImpersonationActive } from "@/lib/impersonationGuard";
import { toast } from "sonner";

const STORAGE_KEY = "miseos_impersonation_session_v2";
const LEGACY_STORAGE_KEY = "miseos_impersonation_session";

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
  session_id: string;
  organisation_id: string;
  organisation_name: string;
  organisation_slug: string | null;
  site_id: string | null;
  site_name: string | null;
  access_level: string;
  reason: string;
  started_at: string; // ISO
  expires_at: string; // ISO
  return_to: string;
  target_user: ImpersonationTargetUser;
  org_role: ImpersonationOrgRole | null;
}

interface StartInput {
  organisationId: string;
  reason: string;
  siteId?: string | null;
  returnTo?: string;
}

interface ImpersonationContextType {
  session: ImpersonationSession | null;
  targetAppUser: ImpersonationTargetUser | null;
  targetOrgRole: ImpersonationOrgRole | null;
  isImpersonating: boolean;
  startImpersonation: (input: StartInput) => Promise<{ error?: string }>;
  stopImpersonation: (opts?: { silent?: boolean; expired?: boolean }) => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

function readStored(): ImpersonationSession | null {
  // Discard any legacy (pre-session-table) stored impersonation state.
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImpersonationSession;
    if (
      !parsed?.session_id ||
      !parsed.organisation_id ||
      !parsed.target_user?.id ||
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
  const expireTimerRef = useRef<number | null>(null);

  // Keep the global write-block guard in sync with our state.
  useEffect(() => {
    setImpersonationActive(!!session);
  }, [session]);

  const stopImpersonation = useCallback(
    async (opts?: { silent?: boolean; expired?: boolean }) => {
      const current = session;
      // Clear local state FIRST so the write guard releases before the RPC runs.
      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setImpersonationActive(false);
      if (expireTimerRef.current) {
        window.clearTimeout(expireTimerRef.current);
        expireTimerRef.current = null;
      }
      if (current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).rpc("end_internal_impersonation");
        } catch {
          /* best-effort — session also auto-expires server-side */
        }
      }
      if (opts?.expired) {
        toast.warning("Support session expired after 2 hours.");
      } else if (!opts?.silent) {
        toast.success("Exited support mode.");
      }
    },
    [session]
  );

  // Verify the stored session is still active server-side (e.g. ended elsewhere,
  // staff signed out, or another session was started on a different device).
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase;
      const { data, error } = await sb
        .from("internal_impersonation_sessions")
        .select("id, active, ended_at, expires_at")
        .eq("id", session.session_id)
        .maybeSingle();
      if (cancelled || error) return; // network/RLS hiccup: rely on local expiry
      const stillActive =
        data && data.active === true && !data.ended_at &&
        new Date(data.expires_at as string).getTime() > Date.now();
      if (!stillActive) {
        await stopImpersonation({ silent: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-verify when the session identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.session_id]);

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
    async ({ organisationId, reason, siteId, returnTo }: StartInput) => {
      if (!reason.trim() || reason.trim().length < 5) {
        return { error: "A reason (min 5 chars) is required." };
      }

      // Starting a new session replaces any current one — release the guard
      // first so the RPC is allowed through.
      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setImpersonationActive(false);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase;
      const { data, error } = await sb.rpc("start_internal_impersonation", {
        _target_organisation_id: organisationId,
        _reason: reason.trim(),
        _target_site_id: siteId ?? null,
      });
      if (error) return { error: error.message };
      if (!data?.session_id) return { error: "Failed to start support session." };

      const newSession: ImpersonationSession = {
        session_id: data.session_id as string,
        organisation_id: data.organisation?.id as string,
        organisation_name: (data.organisation?.name as string) ?? "Customer",
        organisation_slug: (data.organisation?.slug as string) ?? null,
        site_id: (data.site?.id as string) ?? null,
        site_name: (data.site?.name as string) ?? null,
        access_level: (data.access_level as string) ?? "support",
        reason: (data.reason as string) ?? reason.trim(),
        started_at: data.started_at as string,
        expires_at: data.expires_at as string,
        return_to: returnTo || "/admin",
        target_user: data.target_user as ImpersonationTargetUser,
        org_role: (data.org_role as ImpersonationOrgRole | null) ?? null,
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
      targetAppUser: session?.target_user ?? null,
      targetOrgRole: session?.org_role ?? null,
      isImpersonating: !!session,
      startImpersonation,
      stopImpersonation,
    }),
    [session, startImpersonation, stopImpersonation]
  );

  return <ImpersonationContext.Provider value={value}>{children}</ImpersonationContext.Provider>;
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}
