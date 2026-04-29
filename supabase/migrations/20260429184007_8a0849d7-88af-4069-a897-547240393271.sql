
-- 1) Tighten users SELECT policy
DROP POLICY IF EXISTS "Users can view users in own org" ON public.users;

-- Helper: is current auth user a manager/HQ in the org?
CREATE OR REPLACE FUNCTION public.is_org_manager_or_hq(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_users ou
    JOIN public.users u ON u.id = ou.user_id
    WHERE ou.organisation_id = _org_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND ou.active = true
      AND ou.org_role IN ('org_owner','hq_admin','hq_auditor')
  )
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.users u ON u.id = m.user_id
    JOIN public.sites s ON s.id = m.site_id
    WHERE u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND m.active = true
      AND m.site_role IN ('owner','supervisor')
      AND s.organisation_id = _org_id
  );
$$;

CREATE POLICY "Users can view their own row"
ON public.users
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Managers and HQ can view org users"
ON public.users
FOR SELECT
USING (
  organisation_id = get_user_org_id()
  AND public.is_org_manager_or_hq(organisation_id)
);

-- 2) Restrict has_hq_access to actual HQ roles
CREATE OR REPLACE FUNCTION public.has_hq_access(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_users ou
    JOIN public.users u ON u.id = ou.user_id
    WHERE ou.organisation_id = _org_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND ou.active = true
      AND ou.org_role IN ('org_owner','hq_admin','hq_auditor')
  );
$$;
