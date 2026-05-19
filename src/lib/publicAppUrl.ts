/**
 * Resolve the public-facing app origin to embed in shareable links / QR codes.
 *
 * Priority:
 *   1. VITE_PUBLIC_APP_URL build-time env (e.g. https://mise-os.app)
 *   2. window.location.origin when it's already a real public domain
 *   3. Fallback to https://mise-os.app for Lovable preview/sandbox hosts so
 *      we never hand out an id-preview--<uuid>.lovable.app link to staff.
 */
const PRODUCTION_FALLBACK = "https://mise-os.app";

function isPreviewHost(host: string): boolean {
  // Sandbox + static preview hostnames contain a UUID and shouldn't be shared.
  return /(^|\.)id-preview--/.test(host) || /(^|\.)sandbox\.lovable\.dev$/.test(host) || /lovableproject\.com$/.test(host);
}

export function getPublicAppOrigin(): string {
  const envUrl = (import.meta as any).env?.VITE_PUBLIC_APP_URL as string | undefined;
  if (envUrl && /^https?:\/\//.test(envUrl)) {
    return envUrl.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const { origin, hostname } = window.location;
    if (!isPreviewHost(hostname)) return origin;
  }
  return PRODUCTION_FALLBACK;
}

export function buildOrgLoginUrl(slug: string): string {
  return `${getPublicAppOrigin()}/login/${slug}`;
}
