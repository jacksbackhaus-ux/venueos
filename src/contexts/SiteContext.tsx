import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import {
  premisesLabels,
  type OperatingMode,
  type PremisesLabels,
  type PremisesType,
} from '@/lib/premises';

interface Site {
  id: string;
  organisation_id: string;
  name: string;
  address: string | null;
  timezone: string;
  active: boolean;
  site_code: string;
  created_at: string;
  premises_type: PremisesType;
  operating_mode: OperatingMode;
  archived_at: string | null;
  archived_reason: string | null;
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
  /** Sites the user can reach that have been archived (read-only). */
  archivedSites: Site[];
  memberships: Membership[];
  setCurrentSiteId: (id: string) => void;
  isLoading: boolean;
  hasHydrated: boolean;
  organisationId: string | null;
  hasSelectedSite: boolean;
  clearSelectedSite: () => void;
  /** Premises type of the current site (defaults to commercial). */
  premisesType: PremisesType;
  /** How compliance days are declared for the current site. */
  operatingMode: OperatingMode;
  /** True when the current site declares production days instead of calendar days. */
  isOnDemand: boolean;
  /** True when the current site is archived — everything is read-only. */
  isArchived: boolean;
  /** Customer-facing wording for the current premises type. */
  labels: PremisesLabels;
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
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Mark loading synchronously on any auth change so consumers don't
    // briefly see "not loading + empty sites" before the fetch begins.
    setIsLoading(true);
    let cancelled = false;
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
          // Include closed sites (active = false + archived_at set) so they stay
          // reachable read-only and can be reopened from Settings → Site.
          supabase.from('sites').select('*').or('active.eq.true,archived_at.not.is.null'),
          supabase.from('memberships').select('*').eq('user_id', appUser.id).eq('active', true),
        ]);

        if (sitesRes.error) throw sitesRes.error;
        if (membershipsRes.error) throw membershipsRes.error;

        const fetchedSites = (sitesRes.data || []) as Site[];
        const fetchedMemberships = (membershipsRes.data || []) as Membership[];
        const accessibleSiteIds = new Set(fetchedSites.map((site) => site.id));

        setSites(fetchedSites);
        setMemberships(fetchedMemberships);

        // Auto-pick only when there's a single accessible site. Multi-site users
        // land on the site switcher / All Sites view (RequireSite handles routing).
        if (!currentSiteId || !accessibleSiteIds.has(currentSiteId)) {
          const fallbackSiteId =
            fetchedMemberships.length === 1 ? fetchedMemberships[0].site_id : null;
          setCurrentSiteIdState(fallbackSiteId);
        }
      } catch (error) {
        console.error('Failed to load site context.', error);
        if (!cancelled) {
          setSites([]);
          setMemberships([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setHasHydrated(true);
        }
      }
    };

    void fetchContext();
    return () => { cancelled = true; };
  }, [appUser, staffSession, isAuthenticated]);

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

  // Archived sites stay reachable (read-only) but are kept out of the default lists.
  const liveSites = sites.filter((s) => !s.archived_at);
  const archivedSites = sites.filter((s) => !!s.archived_at);

  const premisesType: PremisesType = currentSite?.premises_type ?? 'commercial';
  const operatingMode: OperatingMode = currentSite?.operating_mode ?? 'scheduled';

  return (
    <SiteContext.Provider value={{
      currentSite, currentMembership, sites: liveSites, archivedSites, memberships, setCurrentSiteId,
      isLoading, hasHydrated, organisationId, hasSelectedSite, clearSelectedSite,
      premisesType, operatingMode,
      isOnDemand: operatingMode === 'on_demand',
      isArchived: !!currentSite?.archived_at,
      labels: premisesLabels(premisesType),
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
