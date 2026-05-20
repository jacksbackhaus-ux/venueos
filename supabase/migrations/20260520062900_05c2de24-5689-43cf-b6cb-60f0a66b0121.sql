-- Customer accounts must never be treated as MiseOS internal staff.
CREATE OR REPLACE FUNCTION public.has_customer_account(_auth_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = _auth_user_id
      AND u.status = 'active'
      AND u.organisation_id IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    NOT public.has_customer_account(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.internal_staff_roles r
      WHERE r.user_id = auth.uid()
        AND r.revoked_at IS NULL
        AND (r.expires_at IS NULL OR r.expires_at > now())
    );
$$;

CREATE OR REPLACE FUNCTION public.has_internal_role(_role public.internal_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    public.is_internal_staff()
    AND EXISTS (
      SELECT 1
      FROM public.internal_staff_roles r
      WHERE r.user_id = auth.uid()
        AND r.role = _role
        AND r.revoked_at IS NULL
        AND (r.expires_at IS NULL OR r.expires_at > now())
    );
$$;

-- Avoid recursive users-table policies by moving shared-site visibility into
-- a SECURITY DEFINER helper. Policies can call this without re-entering the
-- users table RLS stack.
CREATE OR REPLACE FUNCTION public.can_view_shared_site_teammate(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m_self
    JOIN public.users u_self ON u_self.id = m_self.user_id
    JOIN public.memberships m_other ON m_other.site_id = m_self.site_id
    WHERE u_self.auth_user_id = auth.uid()
      AND u_self.status = 'active'
      AND m_self.active = true
      AND m_self.site_role IN ('owner', 'supervisor')
      AND m_other.active = true
      AND m_other.user_id = _target_user_id
  );
$$;

DROP POLICY IF EXISTS "Site supervisors view shared-site teammates" ON public.users;
CREATE POLICY "Site supervisors view shared-site teammates"
ON public.users
FOR SELECT
TO authenticated
USING (public.can_view_shared_site_teammate(id));

GRANT EXECUTE ON FUNCTION public.has_customer_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_internal_role(public.internal_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_shared_site_teammate(uuid) TO authenticated;