
-- 1) Lock down users.staff_code and users.hourly_rate at column level
REVOKE SELECT (staff_code)  ON public.users FROM authenticated;
REVOKE SELECT (staff_code)  ON public.users FROM anon;
REVOKE SELECT (hourly_rate) ON public.users FROM authenticated;
REVOKE SELECT (hourly_rate) ON public.users FROM anon;

-- Secure helper: only org owners / HQ admins can read staff codes for their org
CREATE OR REPLACE FUNCTION public.list_org_user_staff_codes(_org_id uuid)
RETURNS TABLE(user_id uuid, staff_code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_owner_or_hq_admin(_org_id) THEN
    RAISE EXCEPTION 'not authorised';
  END IF;
  RETURN QUERY
    SELECT u.id, u.staff_code
    FROM public.users u
    WHERE u.organisation_id = _org_id;
END;
$$;
REVOKE ALL ON FUNCTION public.list_org_user_staff_codes(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.list_org_user_staff_codes(uuid) TO authenticated;

-- 2) Explicit write policies on internal_impersonation_sessions (super admins only).
--    Inserts in production happen via service-role edge functions which bypass RLS,
--    but these explicit policies make the intent clear and defence-in-depth.
DROP POLICY IF EXISTS "Super admins can create impersonation sessions" ON public.internal_impersonation_sessions;
DROP POLICY IF EXISTS "Super admins can end impersonation sessions"    ON public.internal_impersonation_sessions;
DROP POLICY IF EXISTS "Super admins can delete impersonation sessions" ON public.internal_impersonation_sessions;

CREATE POLICY "Super admins can create impersonation sessions"
  ON public.internal_impersonation_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can end impersonation sessions"
  ON public.internal_impersonation_sessions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete impersonation sessions"
  ON public.internal_impersonation_sessions
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- 3) Pin search_path on the email queue helper functions
ALTER FUNCTION public.delete_email(text, bigint)            SET search_path = pgmq, public;
ALTER FUNCTION public.enqueue_email(text, jsonb)            SET search_path = pgmq, public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = pgmq, public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = pgmq, public;
