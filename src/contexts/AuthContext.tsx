import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

interface AuthContextType {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  staffSession: StaffSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  setStaffSession: (s: StaffSession | null) => void;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(() => {
    const stored = localStorage.getItem('staff_session');
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchAppUser = useCallback(async (authUserId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUserId)
      .eq('status', 'active')
      .maybeSingle();
    setAppUser(data as AppUser | null);
  }, []);

  const refreshAppUser = useCallback(async () => {
    if (user?.id) await fetchAppUser(user.id);
  }, [user, fetchAppUser]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchAppUser(session.user.id), 0);
        } else {
          setAppUser(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAppUser(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchAppUser]);

  // Persist staff session
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
    await supabase.auth.signOut();
  };

  const isAuthenticated = !!(session && appUser) || !!staffSession;

  return (
    <AuthContext.Provider value={{
      session, user, appUser, staffSession, isLoading,
      isAuthenticated, signOut, setStaffSession, refreshAppUser
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
