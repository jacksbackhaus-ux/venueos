import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AppUser {
  id: string;
  auth_user_id: string | null;
  organisation_id: string;
  display_name: string;
  email: string | null;
  auth_type: 'email' | 'staff_code';
  staff_code: string | null;
  status: 'active' | 'suspended';
}

interface StaffSession {
  user_id: string;
  display_name: string;
  site_role: string;
  organisation_id: string;
  site_id: string;
}

interface OrgRole {
  org_role: 'org_owner' | 'hq_admin' | 'hq_auditor';
  organisation_id: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  staffSession: StaffSession | null;
  orgRole: OrgRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isHQ: boolean;
  isReadOnly: boolean;
  signOut: () => Promise<void>;
  setStaffSession: (s: StaffSession | null) => void;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredStaffSession(): StaffSession | null {
  try {
    const stored = localStorage.getItem('staff_session');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (
      parsed &&
      typeof parsed.user_id === 'string' &&
      typeof parsed.display_name === 'string' &&
      typeof parsed.site_role === 'string' &&
      typeof parsed.organisation_id === 'string' &&
      typeof parsed.site_id === 'string'
    ) {
      return parsed as StaffSession;
    }
  } catch (error) {
    console.error('Invalid stored staff session, clearing it.', error);
  }

  localStorage.removeItem('staff_session');
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [orgRole, setOrgRole] = useState<OrgRole | null>(null);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(() => readStoredStaffSession());
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchAppUser = useCallback(async (authUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUserId)
        .eq('status', 'active')
        .eq('auth_type', 'email')
        .maybeSingle();

      if (error) throw error;

      const appUserData = data as AppUser | null;
      if (!mountedRef.current) return appUserData;
      setAppUser(appUserData);

      if (appUserData) {
        const { data: orgData, error: orgError } = await supabase
          .from('org_users')
          .select('org_role, organisation_id')
          .eq('user_id', appUserData.id)
          .eq('active', true)
          .maybeSingle();

        if (orgError) throw orgError;
        if (mountedRef.current) setOrgRole(orgData as OrgRole | null);
      } else if (mountedRef.current) {
        setOrgRole(null);
      }

      return appUserData;
    } catch (error) {
      console.error('Failed to hydrate authenticated app user.', error);
      if (mountedRef.current) {
        setAppUser(null);
        setOrgRole(null);
      }
      return null;
    }
  }, []);

  const refreshAppUser = useCallback(async () => {
    if (user?.id) await fetchAppUser(user.id);
  }, [user, fetchAppUser]);

  useEffect(() => {
    mountedRef.current = true;

    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (!mountedRef.current) return;
        if (error) throw error;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchAppUser(session.user.id);
        } else {
          setAppUser(null);
          setOrgRole(null);
        }
      })
      .catch((error) => {
        console.error('Failed to restore auth session.', error);
        if (!mountedRef.current) return;
        setSession(null);
        setUser(null);
        setAppUser(null);
        setOrgRole(null);
      })
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mountedRef.current) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Keep isLoading=true until appUser hydration finishes, otherwise
          // guards see (user && !appUser) for a brief window and incorrectly
          // redirect a fully onboarded user to /onboarding.
          setIsLoading(true);
          fetchAppUser(session.user.id)
            .catch((error) => {
              console.error('Failed to refresh auth state after change.', error);
            })
            .finally(() => {
              if (mountedRef.current) setIsLoading(false);
            });
        } else {
          setAppUser(null);
          setOrgRole(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchAppUser]);

  useEffect(() => {
    if (staffSession) {
      localStorage.setItem('staff_session', JSON.stringify(staffSession));
    } else {
      localStorage.removeItem('staff_session');
    }
  }, [staffSession]);

  const signOut = async () => {
    setStaffSession(null);
    setAppUser(null);
    setOrgRole(null);
    await supabase.auth.signOut();
  };

  const isAuthenticated = !!(session && appUser) || !!staffSession;
  const isHQ = !!orgRole && ['org_owner', 'hq_admin', 'hq_auditor'].includes(orgRole.org_role);
  const isReadOnly = orgRole?.org_role === 'hq_auditor' || staffSession?.site_role === 'read_only';

  return (
    <AuthContext.Provider value={{
      session, user, appUser, staffSession, orgRole, isLoading,
      isAuthenticated, isHQ, isReadOnly, signOut, setStaffSession, refreshAppUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
