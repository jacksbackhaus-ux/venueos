CREATE OR REPLACE FUNCTION public.staff_get_customer_360(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.has_staff_access_to_org(_org_id) THEN
    RAISE EXCEPTION 'Not authorised for this organisation' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'organisation', (
      SELECT jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'created_at', o.created_at)
      FROM public.organisations o WHERE o.id = _org_id
    ),
    'subscription', (
      SELECT to_jsonb(sub) FROM public.subscriptions sub WHERE sub.organisation_id = _org_id
    ),
    'sites', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'site_code', s.site_code,
        'address', s.address, 'active', s.active, 'timezone', s.timezone
      ) ORDER BY s.created_at)
      FROM public.sites s WHERE s.organisation_id = _org_id
    ), '[]'::jsonb),
    'org_owners', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', u.id, 'display_name', u.display_name, 'email', u.email, 'org_role', ou.org_role
      ))
      FROM public.org_users ou
      JOIN public.users u ON u.id = ou.user_id
      WHERE ou.organisation_id = _org_id AND ou.active = true
        AND ou.org_role IN ('org_owner','hq_admin')
    ), '[]'::jsonb),
    'user_count', (SELECT count(*) FROM public.users u WHERE u.organisation_id = _org_id AND u.status='active'),
    'assigned_staff', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_user_id', soa.staff_user_id,
        'access_level', soa.access_level,
        'reason', soa.reason,
        'granted_at', soa.created_at,
        'expires_at', soa.expires_at
      ))
      FROM public.staff_org_access soa
      WHERE soa.organisation_id = _org_id
        AND soa.revoked_at IS NULL
        AND (soa.expires_at IS NULL OR soa.expires_at > now())
    ), '[]'::jsonb),
    'ops_snapshot', jsonb_build_object(
      'open_incidents', (SELECT count(*) FROM public.incidents i WHERE i.organisation_id=_org_id AND COALESCE(i.status,'open') <> 'closed'),
      'last_temp_log_at', (SELECT max(t.logged_at) FROM public.temp_logs t WHERE t.organisation_id=_org_id),
      'last_cleaning_log_at', (SELECT max(c.completed_at) FROM public.cleaning_logs c WHERE c.organisation_id=_org_id),
      'waste_week_count', (SELECT count(*) FROM public.waste_logs w WHERE w.organisation_id=_org_id AND w.created_at > now() - interval '7 days')
    ),
    'recent_activity', COALESCE((
      SELECT jsonb_agg(row_to_jsonb(a) ORDER BY a.created_at DESC)
      FROM (
        SELECT created_at, action_type, reason, performed_by, metadata
        FROM public.admin_actions_log
        WHERE target_organisation_id = _org_id
           OR (metadata->>'organisation_id')::uuid = _org_id
        ORDER BY created_at DESC
        LIMIT 25
      ) a
    ), '[]'::jsonb),
    'impersonation_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'internal_user_id', s.internal_user_id,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'expires_at', s.expires_at,
        'active', s.active,
        'access_level', s.access_level,
        'reason', s.reason
      ) ORDER BY s.started_at DESC)
      FROM (
        SELECT * FROM public.internal_impersonation_sessions
        WHERE target_organisation_id = _org_id
        ORDER BY started_at DESC
        LIMIT 15
      ) s
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END $$;

GRANT EXECUTE ON FUNCTION public.staff_get_customer_360(uuid) TO authenticated;