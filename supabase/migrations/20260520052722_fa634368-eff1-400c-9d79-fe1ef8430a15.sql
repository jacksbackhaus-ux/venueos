
-- 1) users table: replace the over-broad manager policy
DROP POLICY IF EXISTS "Managers can view org users (sensitive cols hidden by view)" ON public.users;

-- HQ-level roles (hq_admin, hq_auditor) can read all users in their org.
-- Org owners are already covered by "Org owners can view all org users".
CREATE POLICY "HQ roles can view org users"
ON public.users
FOR SELECT
TO authenticated
USING (
  organisation_id = public.get_user_org_id()
  AND public.has_hq_access(organisation_id)
);

-- Site supervisors/owners can only see teammates that share at least one active
-- site membership with them (scoped to their site, not the whole org).
CREATE POLICY "Site supervisors view shared-site teammates"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m_self
    JOIN public.users u_self ON u_self.id = m_self.user_id
    JOIN public.memberships m_other ON m_other.site_id = m_self.site_id
    WHERE u_self.auth_user_id = auth.uid()
      AND u_self.status = 'active'
      AND m_self.active = true
      AND m_self.site_role IN ('owner','supervisor')
      AND m_other.active = true
      AND m_other.user_id = public.users.id
  )
);

-- 2) org_branding: restrict reads to own org or HQ access
DROP POLICY IF EXISTS "authenticated can view branding" ON public.org_branding;

CREATE POLICY "Org members can view their branding"
ON public.org_branding
FOR SELECT
TO authenticated
USING (
  organisation_id = public.get_user_org_id()
  OR public.has_hq_access(organisation_id)
);

-- 3) audit_trail: only supervisors+ can read; staff/read_only cannot
DROP POLICY IF EXISTS "Users can view audit trail in own org" ON public.audit_trail;

CREATE POLICY "Managers can view audit trail in own org"
ON public.audit_trail
FOR SELECT
TO authenticated
USING (
  organisation_id = public.get_user_org_id()
  AND (
    public.is_org_manager_or_hq(organisation_id)
    OR (site_id IS NOT NULL AND public.is_site_supervisor_or_owner(site_id))
  )
);

-- 4) org_users: narrow visibility
DROP POLICY IF EXISTS "Users can view org roles in own org" ON public.org_users;

-- Users can always see their own role assignment.
CREATE POLICY "Users can view their own org role"
ON public.org_users
FOR SELECT
TO authenticated
USING (user_id = public.get_app_user_id());

-- Managers (org_owner / hq_admin / hq_auditor / onboarding_admin) and site
-- supervisors/owners can see the full list for their org.
CREATE POLICY "Managers can view org roles in own org"
ON public.org_users
FOR SELECT
TO authenticated
USING (
  organisation_id = public.get_user_org_id()
  AND public.is_org_manager_or_hq(organisation_id)
);

-- 5) staff_code_attempts: RLS is enabled but had no policies. Add an explicit
-- deny so the linter is satisfied; only SECURITY DEFINER helpers (which run as
-- the owner) need to read/write this table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'staff_code_attempts' AND relnamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP POLICY IF EXISTS "No client access to staff_code_attempts" ON public.staff_code_attempts';
    EXECUTE 'CREATE POLICY "No client access to staff_code_attempts" ON public.staff_code_attempts FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)';
  END IF;
END $$;
