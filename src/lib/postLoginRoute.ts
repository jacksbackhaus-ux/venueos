/**
 * Central post-login routing decision. All login flows must go through this
 * so that no future change can accidentally route an email/password customer
 * into the internal MiseOS Staff Console.
 */
export type LoginMethod = "email" | "staff";

export interface RoutableProfile {
  organisation_id: string | null;
  org_role?: string | null;   // org_owner | hq_admin | hq_auditor | ...
  site_role?: string | null;  // owner | supervisor | staff | read_only
}

export interface RouteDecision {
  path: string;
  reason: string;
  blocked?: boolean;
}

export function determinePostLoginRoute(
  profile: RoutableProfile | null,
  method: LoginMethod
): RouteDecision {
  if (method === "staff") {
    return { path: "/", reason: "staff session → staff app" };
  }

  // Email/password — NEVER routes to /staff (internal console).
  if (!profile || !profile.organisation_id) {
    return {
      path: "/auth",
      reason: "Account is not linked to a business.",
      blocked: true,
    };
  }

  const siteRole = (profile.site_role || "").toLowerCase();
  const orgRole = (profile.org_role || "").toLowerCase();
  const isManager =
    ["owner", "supervisor"].includes(siteRole) ||
    ["org_owner", "hq_admin", "hq_auditor"].includes(orgRole);

  if (isManager) return { path: "/", reason: "manager → dashboard" };
  if (siteRole === "staff") {
    return {
      path: "/auth?error=staff_use_pin",
      reason: "Staff accounts must use Staff Login (Site ID + PIN).",
      blocked: true,
    };
  }
  return { path: "/", reason: "default → dashboard" };
}

/* ───────────────────── Per-user slug memory (wrapper-safe) ───────────────────── */

const SLUG_KEY = (userId: string) => `last_slug:${userId}`;

export function rememberSlugForUser(userId: string | null | undefined, slug: string) {
  if (!userId || !slug) return;
  try { localStorage.setItem(SLUG_KEY(userId), slug); } catch { /* ignore */ }
}

export function getRememberedSlug(userId: string | null | undefined): string | null {
  if (!userId) return null;
  try { return localStorage.getItem(SLUG_KEY(userId)); } catch { return null; }
}

export function clearRememberedSlug(userId: string | null | undefined) {
  if (!userId) return;
  try { localStorage.removeItem(SLUG_KEY(userId)); } catch { /* ignore */ }
}

/** Kill switch: VITE_DISABLE_AUTO_SLUG_REDIRECT=true disables any auto redirect. */
export function autoSlugRedirectDisabled(): boolean {
  return String(import.meta.env.VITE_DISABLE_AUTO_SLUG_REDIRECT || "").toLowerCase() === "true";
}
