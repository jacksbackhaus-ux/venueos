/**
 * First-party signup attribution (no cookies, no third-party scripts).
 * Captures utm_* + referrer on public marketing pages (first touch wins),
 * and records them against the organisation after onboarding succeeds.
 * Every function here swallows errors — it must never affect sign-up.
 */
import { supabase } from "@/integrations/supabase/client";
import { utmReferrerCaptureEnabled } from "@/lib/launchFlags";

const KEY = "miseos_attribution";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface Attribution {
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  landing_page?: string;
  captured_at: number;
}

const PUBLIC_PREFIXES = ["/landing", "/guides", "/faq", "/haccp", "/privacy", "/terms", "/auth"];

export function isPublicMarketingPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function optedOut(): boolean {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.globalPrivacyControl === true || n.doNotTrack === "1";
}

function read(): Attribution | null {
  try {
    const raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Attribution;
    if (!a.captured_at || Date.now() - a.captured_at > MAX_AGE_MS) {
      clearAttribution();
      return null;
    }
    return a;
  } catch {
    return null;
  }
}

export function clearAttribution() {
  try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Call on public marketing pages only. First touch wins. */
export function captureAttribution() {
  if (!utmReferrerCaptureEnabled) return;
  try {
    if (optedOut() || read()) return;
    const params = new URLSearchParams(window.location.search);
    let referrer = "";
    try {
      if (document.referrer) {
        const r = new URL(document.referrer);
        if (r.host !== window.location.host) referrer = r.origin + r.pathname; // drop query strings
      }
    } catch { /* ignore */ }
    const a: Attribution = {
      source: params.get("utm_source") || undefined,
      medium: params.get("utm_medium") || undefined,
      campaign: params.get("utm_campaign") || undefined,
      referrer: referrer || undefined,
      landing_page: window.location.pathname,
      captured_at: Date.now(),
    };
    const raw = JSON.stringify(a);
    sessionStorage.setItem(KEY, raw);
    // Mirror to localStorage so it survives the confirmation email opening a new tab.
    localStorage.setItem(KEY, raw);
  } catch { /* ignore */ }
}

/** Fire-and-forget after onboarding succeeds. Never throws, never awaited by callers. */
export function recordSignupAttribution(orgId: string, heardAboutUs: string | null) {
  try {
    const a = !utmReferrerCaptureEnabled || optedOut() ? null : read();
    if (!a && !heardAboutUs) return;
    void (supabase.rpc as any)("record_signup_attribution", {
      _org_id: orgId,
      _heard_about_us: heardAboutUs,
      _source: a?.source ?? null,
      _medium: a?.medium ?? null,
      _campaign: a?.campaign ?? null,
      _referrer: a?.referrer ?? null,
      _landing_page: a?.landing_page ?? null,
    })
      .then(({ error }: { error: unknown }) => {
        if (error) console.warn("attribution not recorded", error);
        else if (utmReferrerCaptureEnabled) clearAttribution();
      })
      .catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}

export const HEARD_ABOUT_OPTIONS = [
  { value: "instagram_social", label: "Instagram / social media" },
  { value: "google_search", label: "Google search" },
  { value: "recommended", label: "Recommended by another food business" },
  { value: "eho", label: "Environmental Health Officer (EHO) / food inspector" },
  { value: "other", label: "Other" },
] as const;

export function heardAboutLabel(v: string | null | undefined): string | null {
  return HEARD_ABOUT_OPTIONS.find((o) => o.value === v)?.label ?? null;
}
