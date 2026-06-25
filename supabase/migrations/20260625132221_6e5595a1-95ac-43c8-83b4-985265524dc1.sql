
-- 1) Restrict ai_insights INSERT to managers/supervisors (server-side preferred via service role).
DROP POLICY IF EXISTS "Site members can insert ai_insights" ON public.ai_insights;
CREATE POLICY "Managers can insert ai_insights"
  ON public.ai_insights FOR INSERT
  TO authenticated
  WITH CHECK (public.is_site_supervisor_or_owner(site_id));

-- 2) Lock down users.hourly_rate at the column level so it can no longer be
--    selected directly by any authenticated client. Managers read it via the
--    SECURITY DEFINER helpers below. Service role retains full access for
--    edge functions.
REVOKE SELECT (hourly_rate) ON public.users FROM authenticated;
REVOKE SELECT (hourly_rate) ON public.users FROM anon;

-- Single-user pay context lookup. Allowed for the user themselves, or for any
-- manager/HQ role in that user's organisation.
CREATE OR REPLACE FUNCTION public.get_user_pay_context(_user_id uuid)
RETURNS TABLE(hourly_rate numeric, organisation_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _self uuid := public.get_app_user_id();
BEGIN
  SELECT u.organisation_id INTO _org_id FROM public.users u WHERE u.id = _user_id;
  IF _org_id IS NULL THEN RETURN; END IF;
  IF _user_id <> COALESCE(_self, '00000000-0000-0000-0000-000000000000'::uuid)
     AND NOT public.is_org_manager_or_hq(_org_id) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.hourly_rate, u.organisation_id
    FROM public.users u
    WHERE u.id = _user_id;
END $$;

REVOKE ALL ON FUNCTION public.get_user_pay_context(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_pay_context(uuid) TO authenticated;

-- Bulk lookup for managers (used by labour cost / margin dashboards).
CREATE OR REPLACE FUNCTION public.list_org_user_hourly_rates(_org_id uuid)
RETURNS TABLE(user_id uuid, hourly_rate numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_manager_or_hq(_org_id) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT u.id, u.hourly_rate
    FROM public.users u
    WHERE u.organisation_id = _org_id
      AND u.status = 'active';
END $$;

REVOKE ALL ON FUNCTION public.list_org_user_hourly_rates(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.list_org_user_hourly_rates(uuid) TO authenticated;
