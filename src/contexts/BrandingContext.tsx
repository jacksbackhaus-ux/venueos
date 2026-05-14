import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "./SiteContext";

const DEFAULT_PRIMARY = "#0D9488";
const DEFAULT_SECONDARY = "#F59E0B";

export interface OrgBranding {
  id: string;
  organisation_id: string;
  logo_url: string | null;
  business_display_name: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
}

interface BrandingContextValue {
  logoUrl: string | null;
  businessName: string;
  primaryColour: string;
  secondaryColour: string;
  isLoaded: boolean;
  organisationId: string | null;
  refresh: () => void;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

/** Resolve `org-logos/<path>` to a public URL. */
export function resolveLogoUrl(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const { data } = supabase.storage.from("org-logos").getPublicUrl(value);
  // Add a cache-buster on the path's updated_at would require extra query; rely on filename versioning.
  return data?.publicUrl || null;
}

/** Hex luminance check — returns true if foreground should be dark on this bg. */
export function shouldUseDarkText(hex: string): boolean {
  const c = hex.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6;
}

/** Darken a hex by `amount` (0-1). */
export function darkenHex(hex: string, amount = 0.1): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return hex;
  const f = (i: number) => {
    const n = Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - amount))));
    return n.toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(2)}${f(4)}`;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { organisationId, currentSite } = useSite();
  const qc = useQueryClient();

  const { data, isFetched } = useQuery({
    queryKey: ["org-branding", organisationId],
    enabled: !!organisationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_branding" as any)
        .select("*")
        .eq("organisation_id", organisationId!)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return (data as unknown as OrgBranding | null) ?? null;
    },
  });

  const orgFallbackName = currentSite?.name ?? "";

  const value: BrandingContextValue = useMemo(() => {
    const logoUrl = resolveLogoUrl(data?.logo_url ?? null);
    const businessName = data?.business_display_name?.trim() || orgFallbackName || "MiseOS";
    const primaryColour = data?.primary_colour || DEFAULT_PRIMARY;
    const secondaryColour = data?.secondary_colour || DEFAULT_SECONDARY;
    return {
      logoUrl,
      businessName,
      primaryColour,
      secondaryColour,
      isLoaded: isFetched,
      organisationId,
      refresh: () => qc.invalidateQueries({ queryKey: ["org-branding", organisationId] }),
    };
  }, [data, isFetched, orgFallbackName, organisationId, qc]);

  // Apply CSS custom properties so opt-in styles (.bg-brand-primary etc.) reflect branding.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", value.primaryColour);
    root.style.setProperty("--brand-primary-hover", darkenHex(value.primaryColour, 0.1));
    root.style.setProperty(
      "--brand-primary-foreground",
      shouldUseDarkText(value.primaryColour) ? "#0f172a" : "#ffffff",
    );
    root.style.setProperty("--brand-secondary", value.secondaryColour);
    root.style.setProperty(
      "--brand-secondary-foreground",
      shouldUseDarkText(value.secondaryColour) ? "#0f172a" : "#ffffff",
    );
  }, [value.primaryColour, value.secondaryColour]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    // Safe defaults if used outside provider (e.g. on /landing)
    return {
      logoUrl: null,
      businessName: "MiseOS",
      primaryColour: DEFAULT_PRIMARY,
      secondaryColour: DEFAULT_SECONDARY,
      isLoaded: false,
      organisationId: null,
      refresh: () => {},
    } as BrandingContextValue;
  }
  return ctx;
}

export const BRANDING_DEFAULTS = { primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY };
