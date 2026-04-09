import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Site {
  id: string;
  organisation_id: string;
  name: string;
  address: string | null;
  timezone: string;
  active: boolean;
}

interface Membership {
  id: string;
  site_id: string;
  user_id: string;
  site_role: 'owner' | 'supervisor' | 'staff' | 'read_only';
  active: boolean;
}

interface SiteContextType {
  currentSite: Site | null;
  currentMembership: Membership | null;
  sites: Site[];
  setCurrentSiteId: (id: string) => void;
  isLoading: boolean;
  organisationId: string | null;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { appUser, staffSession, isAuthenticated } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(() =>
    localStorage.getItem('current_site_id')
  );
  const [isLoading, setIsLoading] = useState(true);

  // For staff sessions, site is fixed
  useEffect(() => {
    if (staffSession) {
      setCurrentSiteId(staffSession.site_id);
      setSites([]);
      setMemberships([]);
      setIsLoading(false);
      return;
    }

    if (!appUser) {
      setSites([]);
      setMemberships([]);
      setIsLoading(false);
      return;
    }

    const fetchSitesAndMemberships = async () => {
      setIsLoading(true);
      const [sitesRes, membershipsRes] = await Promise.all([
        supabase.from('sites').select('*').eq('active', true),
        supabase.from('memberships').select('*').eq('user_id', appUser.id).eq('active', true),
      ]);

      const fetchedSites = (sitesRes.data || []) as Site[];
      const fetchedMemberships = (membershipsRes.data || []) as Membership[];
      setSites(fetchedSites);
      setMemberships(fetchedMemberships);

      // Auto-select site if only one
      if (!currentSiteId && fetchedSites.length === 1) {
        setCurrentSiteId(fetchedSites[0].id);
      } else if (!currentSiteId && fetchedMemberships.length === 1) {
        setCurrentSiteId(fetchedMemberships[0].site_id);
      }
      setIsLoading(false);
    };

    fetchSitesAndMemberships();
  }, [appUser, staffSession]);

  // Persist current site
  useEffect(() => {
    if (currentSiteId) {
      localStorage.setItem('current_site_id', currentSiteId);
    }
  }, [currentSiteId]);

  const currentSite = sites.find(s => s.id === currentSiteId) || null;
  const currentMembership = memberships.find(m => m.site_id === currentSiteId) || null;

  const organisationId = appUser?.organisation_id || staffSession?.organisation_id || null;

  return (
    <SiteContext.Provider value={{
      currentSite, currentMembership, sites, setCurrentSiteId,
      isLoading, organisationId
    }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used within SiteProvider');
  return ctx;
}
