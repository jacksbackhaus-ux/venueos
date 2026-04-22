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
  site_code: string;
  created_at: string;
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
  hasSelectedSite: boolean;
  clearSelectedSite: () => void;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

function readStoredSiteId() {
  return localStorage.getItem('current_site_id');
}

function readStoredHqSelection() {
  return localStorage.getItem('hq_site_selected') === 'true';
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { appUser, staffSession, isAuthenticated } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentSiteId, setCurrentSiteIdState] = useState<string | null>(() => readStoredSiteId());
  const [hqExplicitSelection, setHqExplicitSelection] = useState<boolean>(() => readStoredHqSelection());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        if (staffSession) {
          setIsLoading(true);
          setCurrentSiteIdState(staffSession.site_id);

          const { data: siteData, error } = await supabase
            .from('sites')
            .select('*')
            .eq('id', staffSession.site_id)
            .maybeSingle();

          if (error) throw error;

          setSites(siteData ? [siteData as Site] : []);
          setMemberships([
            {
              id: `staff-session-${staffSession.user_id}`,
              site_id: staffSession.site_id,
              user_id: staffSession.user_id,
              site_role: staffSession.site_role as Membership['site_role'],
              active: true,
            },
          ]);
          return;
        }

        if (!appUser || !isAuthenticated) {
          setSites([]);
          setMemberships([]);
          setCurrentSiteIdState(null);
          return;
        }

        setIsLoading(true);
        const [sitesRes, membershipsRes] = await Promise.all([
          supabase.from('sites').select('*').eq('active', true),
          supabase.from('memberships').select('*').eq('user_id', appUser.id).eq('active', true),
        ]);

        if (sitesRes.error) throw sitesRes.error;
        if (membershipsRes.error) throw membershipsRes.error;

        const fetchedSites = (sitesRes.data || []) as Site[];
        const fetchedMemberships = (membershipsRes.data || []) as Membership[];
        const accessibleSiteIds = new Set(fetchedSites.map((site) => site.id));

        setSites(fetchedSites);
        setMemberships(fetchedMemberships);

        if (!currentSiteId || !accessibleSiteIds.has(currentSiteId)) {
          const fallbackSiteId = fetchedMemberships[0]?.site_id || null;
          setCurrentSiteIdState(fallbackSiteId);
        }
      } catch (error) {
        console.error('Failed to load site context.', error);
        setSites([]);
        setMemberships([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchContext();
  }, [appUser, staffSession, isAuthenticated, currentSiteId]);

  useEffect(() => {
    if (currentSiteId) {
      localStorage.setItem('current_site_id', currentSiteId);
    } else {
      localStorage.removeItem('current_site_id');
    }
  }, [currentSiteId]);

  useEffect(() => {
    if (hqExplicitSelection) {
      localStorage.setItem('hq_site_selected', 'true');
    } else {
      localStorage.removeItem('hq_site_selected');
    }
  }, [hqExplicitSelection]);

  const setCurrentSiteId = (id: string) => {
    setCurrentSiteIdState(id);
    setHqExplicitSelection(true);
  };

  const clearSelectedSite = () => {
    setHqExplicitSelection(false);
    setCurrentSiteIdState(null);
  };

  const currentSite = sites.find((s) => s.id === currentSiteId) || null;
  const currentMembership = memberships.find((m) => m.site_id === currentSiteId) || null;
  const organisationId = appUser?.organisation_id || staffSession?.organisation_id || null;
  const hasSelectedSite = !!currentMembership || (hqExplicitSelection && !!currentSite);

  return (
    <SiteContext.Provider value={{
      currentSite, currentMembership, sites, setCurrentSiteId,
      isLoading, organisationId, hasSelectedSite, clearSelectedSite,
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
