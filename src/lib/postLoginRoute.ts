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

/* ───────────────────── Canonical login destination resolver ───────────────────── */

import { supabase } from "@/integrations/supabase/client";

export type ResolvedDestination =
  | { kind: "manager_dashboard"; organisationId: string; slug: string | null }
  | { kind: "needs_org_picker"; options: Array<{ organisation_id: string; name: string; slug: string | null }> }
  | { kind: "staff_email_blocked" }            // staff role tried email login → must use PIN
  | { kind: "wrong_business"; expectedSlug: string }
  | { kind: "not_linked" }                     // no membership in any org
  | { kind: "staff_console"; siteId: string }; // PIN-validated staff session

export interface ResolveArgs {
  authUserId: string;
  loginMethod: "email" | "staff";
  requestedSlug?: string | null;
  /** For staff PIN flow only — already-validated site id. */
  staffSiteId?: string | null;
}

/**
 * Single source of truth for "where should this login land?". Every login UI
 * MUST consult this. It is the only place tenant routing is decided after
 * authentication succeeds.
 *
 * Rules (email):
 *  - 0 memberships → not_linked (caller signs out + shows error)
 *  - 1 membership → manager_dashboard for that org
 *  - >1 memberships → needs_org_picker, unless requestedSlug matches exactly one
 *  - staff site_role → staff_email_blocked (must use PIN flow)
 *  - requestedSlug present but no matching membership → wrong_business
 *  - NEVER returns staff_console for email logins.
 */
export async function resolveLoginDestination(args: ResolveArgs): Promise<ResolvedDestination> {
  if (args.loginMethod === "staff") {
    if (!args.staffSiteId) return { kind: "not_linked" };
    return { kind: "staff_console", siteId: args.staffSiteId };
  }

  // Email path. Pull every active org link this auth user has.
  const { data: appUserRows, error: uErr } = await supabase
    .from("users")
    .select("id, organisation_id, status, organisations:organisation_id(id, name, slug)")
    .eq("auth_user_id", args.authUserId)
    .eq("status", "active");

  if (uErr || !appUserRows || appUserRows.length === 0) {
    return { kind: "not_linked" };
  }

  // Resolve site_role across all memberships to detect "staff via email" abuse.
  const appUserIds = appUserRows.map(r => r.id);
  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, site_role, active")
    .in("user_id", appUserIds)
    .eq("active", true);

  const anyStaffOnly =
    !!memberships?.length &&
    memberships.every(m => (m.site_role || "").toLowerCase() === "staff");
  if (anyStaffOnly) return { kind: "staff_email_blocked" };

  const orgs = appUserRows
    .map(r => {
      const o = (r as { organisations?: { id: string; name: string; slug: string | null } | null }).organisations;
      return o ? { organisation_id: o.id, name: o.name, slug: o.slug ?? null } : null;
    })
    .filter((x): x is { organisation_id: string; name: string; slug: string | null } => !!x);

  if (orgs.length === 0) return { kind: "not_linked" };

  const requested = (args.requestedSlug || "").toLowerCase().trim();
  if (requested) {
    const match = orgs.find(o => (o.slug || "").toLowerCase() === requested);
    if (match) return { kind: "manager_dashboard", organisationId: match.organisation_id, slug: match.slug };
    return { kind: "wrong_business", expectedSlug: requested };
  }

  if (orgs.length === 1) {
    return { kind: "manager_dashboard", organisationId: orgs[0].organisation_id, slug: orgs[0].slug };
  }
  return { kind: "needs_org_picker", options: orgs };
}
