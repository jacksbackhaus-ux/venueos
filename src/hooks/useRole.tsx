import { useAuth } from '@/contexts/AuthContext';
import { useSite } from '@/contexts/SiteContext';

export type EffectiveRole = 'manager' | 'supervisor' | 'staff' | 'read_only' | 'hq_admin' | 'hq_auditor' | null;

/**
 * Single source of truth for what the current user can do.
 * Combines org role (HQ side) and site membership role (site side).
 *
 * - manager  = org_owner OR site owner   → full access
 * - supervisor = site supervisor         → ops + reports + verify/lock + edit schedules
 * - staff    = site staff                → only complete tasks / log readings
 * - read_only = site read_only OR hq_auditor → view + export only
 */
export function useRole() {
  const { orgRole, staffSession } = useAuth();
  const { currentMembership } = useSite();

  // Server-sourced membership role takes priority over the client-stored
  // staff session role to avoid client-side privilege escalation.
  const siteRole = currentMembership?.site_role || staffSession?.site_role || null;
  const orgRoleName = orgRole?.org_role || null;

  // Resolve the effective role
  let role: EffectiveRole = null;
  if (orgRoleName === 'org_owner' || siteRole === 'owner') role = 'manager';
  else if (orgRoleName === 'hq_admin') role = 'manager';
  else if (orgRoleName === 'hq_auditor') role = 'read_only';
  else if (siteRole === 'supervisor') role = 'supervisor';
  else if (siteRole === 'staff') role = 'staff';
  else if (siteRole === 'read_only') role = 'read_only';

  const isManager = role === 'manager';
  const isSupervisorPlus = role === 'manager' || role === 'supervisor';
  const isStaffPlus = role === 'manager' || role === 'supervisor' || role === 'staff';
  const isReadOnly = role === 'read_only';

  return {
    role,
    isManager,
    isSupervisorPlus,
    isStaffPlus,
    isReadOnly,

    // Capabilities (use these in components instead of role checks)
    canViewSettings: isManager,
    canManageUsers: isManager,
    canManageBilling: isManager,
    canViewReports: isSupervisorPlus,
    canExport: isSupervisorPlus || isReadOnly,
    canVerifyDaySheet: isSupervisorPlus,
    canLockDaySheet: isSupervisorPlus,
    canEditCleaningSchedule: isSupervisorPlus,
    canEditDaySheetTemplate: isSupervisorPlus,
    canEditSuppliers: isSupervisorPlus,
    canEditTempUnits: isSupervisorPlus,
    canEditShifts: isSupervisorPlus,
    canViewAdmin: false, // super-admin handled separately

    // Write capabilities (anything that creates a record). Read-only gets none.
    canWrite: !isReadOnly && role !== null,
    canLogTemperature: !isReadOnly && role !== null,
    canCompleteTask: !isReadOnly && role !== null,
    canReportIncident: !isReadOnly && role !== null,
    canCreateBatch: !isReadOnly && role !== null,
    canLogDelivery: !isReadOnly && role !== null,
  };
}
