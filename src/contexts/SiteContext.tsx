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
  /**
   * True when the current user has a site context to operate in:
   * - Site-membership users: always true once their membership loads
   * - HQ users (no site membership): only true after they explicitly pick a site
   */
  hasSelectedSite: boolean;
  clearSelectedSite: () => void;
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

  useEffect(() => {
    const fetchContext = async () => {
      // Staff kiosk sessions are locked to one site, but they still need the
      // actual site row so the rest of the app can resolve shared site-scoped
      // settings/config exactly like the working temperature flow does.
      if (staffSession) {
        setIsLoading(true);
        setCurrentSiteId(staffSession.site_id);

        const { data: siteData } = await supabase
          .from('sites')
          .select('*')
          .eq('id', staffSession.site_id)
          .maybeSingle();

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
        setIsLoading(false);
        return;
      }

      if (!appUser || !isAuthenticated) {
        setSites([]);
        setMemberships([]);
        setCurrentSiteId(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const [sitesRes, membershipsRes] = await Promise.all([
        supabase.from('sites').select('*').eq('active', true),
        supabase.from('memberships').select('*').eq('user_id', appUser.id).eq('active', true),
      ]);

      const fetchedSites = (sitesRes.data || []) as Site[];
      const fetchedMemberships = (membershipsRes.data || []) as Membership[];
      const accessibleSiteIds = new Set(fetchedSites.map((site) => site.id));

      setSites(fetchedSites);
      setMemberships(fetchedMemberships);

      // If the stored site belongs to a previous user/session, reset it to a
      // site this user can actually access so shared site-scoped data loads.
      if (!currentSiteId || !accessibleSiteIds.has(currentSiteId)) {
        const fallbackSiteId = fetchedMemberships[0]?.site_id || fetchedSites[0]?.id || null;
        setCurrentSiteId(fallbackSiteId);
      }

      setIsLoading(false);
    };

    fetchContext();
  }, [appUser, staffSession, isAuthenticated, currentSiteId]);

  // Persist current site
  useEffect(() => {
    if (currentSiteId) {
      localStorage.setItem('current_site_id', currentSiteId);
    } else {
      localStorage.removeItem('current_site_id');
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
