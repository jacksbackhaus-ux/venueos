/**
 * Map a memberships.site_role to the customer-facing role label.
 * Owner (org-level) is Manager everywhere. Supervisor and site-owner both
 * present as "Manager" in the UI. Staff and read-only present as their names.
 */

export type SiteRoleLabel = "Manager" | "Staff" | "Read-only" | "";

export function siteRoleLabel(
  siteRole: string | null | undefined,
  opts: { isOrgOwner?: boolean } = {},
): SiteRoleLabel {
  if (opts.isOrgOwner) return "Manager";
  switch (siteRole) {
    case "owner":
    case "supervisor":
      return "Manager";
    case "staff":
      return "Staff";
    case "read_only":
      return "Read-only";
    default:
      return "";
  }
}

export function isManagerRole(siteRole: string | null | undefined): boolean {
  return siteRole === "owner" || siteRole === "supervisor";
}
