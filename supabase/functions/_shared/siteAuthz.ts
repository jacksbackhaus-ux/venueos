/**
 * Shared helper to confirm the calling auth user has active membership on
 * the requested site. Use after JWT validation, before any service-role
 * reads or writes scoped by site_id.
 *
 * Returns null on success. On failure, returns a Response that the caller
 * should return directly (403 / 401).
 */
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

export async function assertSiteAccess(opts: {
  authUserId: string;
  siteId: string;
  svc: ReturnType<typeof createClient>;
  corsHeaders: Record<string, string>;
}): Promise<Response | null> {
  const { authUserId, siteId, svc, corsHeaders } = opts;

  const { data: appUser, error: userErr } = await svc
    .from("users")
    .select("id, organisation_id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle();

  if (userErr || !appUser) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Site membership grants access. Org-level roles (org_owner/hq_admin/
  // hq_auditor) also grant access to any site in that organisation.
  const { data: membership } = await svc
    .from("memberships")
    .select("id")
    .eq("site_id", siteId)
    .eq("user_id", (appUser as any).id)
    .eq("active", true)
    .maybeSingle();

  if (membership) return null;

  const { data: site } = await svc
    .from("sites")
    .select("organisation_id")
    .eq("id", siteId)
    .maybeSingle();

  if (site && (site as any).organisation_id === (appUser as any).organisation_id) {
    const { data: orgRole } = await svc
      .from("org_users")
      .select("id")
      .eq("organisation_id", (appUser as any).organisation_id)
      .eq("user_id", (appUser as any).id)
      .eq("active", true)
      .in("org_role", ["org_owner", "hq_admin", "hq_auditor"])
      .maybeSingle();
    if (orgRole) return null;
  }

  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
