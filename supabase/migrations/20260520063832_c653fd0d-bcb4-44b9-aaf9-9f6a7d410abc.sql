-- Restrict full-row access on public.users to org_owner and hq_admin only.
-- hq_auditor (read-only auditor) must not see sensitive fields (email, staff_code, hourly_rate, auth_user_id).

CREATE OR REPLACE FUNCTION public.is_org_owner_or_hq_admin(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_users ou
    JOIN public.users u ON u.id = ou.user_id
    WHERE ou.organisation_id = _org_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND ou.active = true
      AND (ou.expires_at IS NULL OR ou.expires_at > now())
      AND ou.org_role IN ('org_owner','hq_admin')
  );
$$;

DROP POLICY IF EXISTS "HQ roles can view org users" ON public.users;

CREATE POLICY "Org owners and HQ admins can view org users"
ON public.users
FOR SELECT
TO authenticated
USING (
  organisation_id = public.get_user_org_id()
  AND public.is_org_owner_or_hq_admin(organisation_id)
);
