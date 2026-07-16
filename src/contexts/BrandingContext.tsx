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

/** Convert hex to "H S% L%" string suitable for hsl(var(--token)). */
export function hexToHslString(hex: string): string | null {
  const c = hex.replace("#", "");
  if (c.length !== 6) return null;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
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

  const value: BrandingContextValue & { hasCustomPrimary: boolean; hasCustomSecondary: boolean } = useMemo(() => {
    const logoUrl = resolveLogoUrl(data?.logo_url ?? null);
    const businessName = data?.business_display_name?.trim() || orgFallbackName || "MiseOS";
    const hasCustomPrimary = !!data?.primary_colour;
    const hasCustomSecondary = !!data?.secondary_colour;
    const primaryColour = data?.primary_colour || DEFAULT_PRIMARY;
    const secondaryColour = data?.secondary_colour || DEFAULT_SECONDARY;
    return {
      logoUrl,
      businessName,
      primaryColour,
      secondaryColour,
      isLoaded: isFetched,
      organisationId,
      hasCustomPrimary,
      hasCustomSecondary,
      refresh: () => qc.invalidateQueries({ queryKey: ["org-branding", organisationId] }),
    };
  }, [data, isFetched, orgFallbackName, organisationId, qc]);

  // Apply CSS custom properties. --brand-* vars always reflect the resolved
  // colour so the /login branded surface keeps working. Semantic tokens
  // (--primary, --ring, --sidebar-primary) are ONLY overridden when the
  // organisation has actually saved a custom colour — otherwise the default
  // system palette from index.css is used unchanged.
  useEffect(() => {
    const root = document.documentElement;

    // Always keep --brand-* in sync (used by [data-branded] surfaces only).
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

    // Semantic primary tokens: only override when the org has a custom colour.
    // Status colours (success/warning/breach) are always untouched.
    const primaryTokens = ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"];
    const fgTokens = ["--primary-foreground", "--sidebar-primary-foreground"];
    if (value.hasCustomPrimary) {
      const primaryHsl = hexToHslString(value.primaryColour);
      const primaryFg = shouldUseDarkText(value.primaryColour) ? "222 47% 11%" : "0 0% 100%";
      if (primaryHsl) {
        primaryTokens.forEach((t) => root.style.setProperty(t, primaryHsl));
        fgTokens.forEach((t) => root.style.setProperty(t, primaryFg));
      }
    } else {
      // Clear any previously-applied overrides so the CSS defaults win again.
      [...primaryTokens, ...fgTokens].forEach((t) => root.style.removeProperty(t));
    }
  }, [value.primaryColour, value.secondaryColour, value.hasCustomPrimary]);

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
