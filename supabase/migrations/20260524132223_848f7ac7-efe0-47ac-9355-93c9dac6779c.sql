CREATE OR REPLACE FUNCTION public.link_staff_session(_site_id text, _staff_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _auth_uid uuid := auth.uid();
  _resolved_site_id uuid;
  _user RECORD;
  _membership RECORD;
  _lockout jsonb;
BEGIN
  IF _auth_uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No auth session');
  END IF;

  -- Staff PIN sessions must be backed by an anonymous temporary auth session.
  -- Never attach a customer manager/owner auth account to a staff-code user row.
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Staff login must start a fresh staff session');
  END IF;

  _lockout := public._check_staff_code_lockout(_auth_uid);
  IF (_lockout->>'locked')::boolean THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Too many attempts. Try again later.');
  END IF;

  BEGIN
    _resolved_site_id := _site_id::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = _resolved_site_id) THEN
      _resolved_site_id := NULL;
    END IF;
  EXCEPTION WHEN others THEN
    _resolved_site_id := NULL;
  END;

  IF _resolved_site_id IS NULL THEN
    SELECT id INTO _resolved_site_id FROM public.sites
    WHERE upper(site_code) = upper(trim(_site_id)) LIMIT 1;
  END IF;

  IF _resolved_site_id IS NULL THEN
    PERFORM public._record_staff_code_failure(_auth_uid);
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid site code');
  END IF;

  SELECT u.* INTO _user
  FROM public.users u
  JOIN public.sites s ON s.organisation_id = u.organisation_id
  WHERE s.id = _resolved_site_id
    AND upper(u.staff_code) = upper(trim(_staff_code))
    AND u.auth_type = 'staff_code'
    AND u.status = 'active';

  IF _user IS NULL THEN
    PERFORM public._record_staff_code_failure(_auth_uid);
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid staff code');
  END IF;

  SELECT m.* INTO _membership
  FROM public.memberships m
  WHERE m.user_id = _user.id
    AND m.site_id = _resolved_site_id
    AND m.active = true;

  IF _membership IS NULL THEN
    PERFORM public._record_staff_code_failure(_auth_uid);
    RETURN jsonb_build_object('valid', false, 'error', 'No active membership on this site');
  END IF;

  -- Move this temporary staff session cleanly if it was previously linked to
  -- another staff-code user on the same device/browser.
  UPDATE public.users
  SET auth_user_id = NULL
  WHERE auth_user_id = _auth_uid
    AND id <> _user.id
    AND auth_type = 'staff_code';

  UPDATE public.users
  SET auth_user_id = _auth_uid,
      last_login_at = now()
  WHERE id = _user.id;

  PERFORM public._clear_staff_code_attempts(_auth_uid);

  RETURN jsonb_build_object(
    'valid', true,
    'user_id', _user.id,
    'display_name', _user.display_name,
    'site_role', _membership.site_role,
    'organisation_id', _user.organisation_id,
    'site_id', _resolved_site_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_staff_session_for_org(_org_slug text, _site_id text, _staff_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _auth_uid uuid := auth.uid();
  _org_id uuid;
  _resolved_site_id uuid;
  _user RECORD;
  _membership RECORD;
  _lockout jsonb;
BEGIN
  IF _auth_uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No auth session');
  END IF;

  -- Staff PIN sessions must be backed by an anonymous temporary auth session.
  -- Never attach a customer manager/owner auth account to a staff-code user row.
  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Staff login must start a fresh staff session');
  END IF;

  _lockout := public._check_staff_code_lockout(_auth_uid);
  IF (_lockout->>'locked')::boolean THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Too many attempts. Try again later.');
  END IF;

  SELECT id INTO _org_id FROM public.organisations
  WHERE lower(slug) = lower(trim(_org_slug)) LIMIT 1;
  IF _org_id IS NULL THEN
    PERFORM public._record_staff_code_failure(_auth_uid);
    RETURN jsonb_build_object('valid', false, 'error', 'Organisation not found');
  END IF;

  BEGIN
    _resolved_site_id := _site_id::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM public.sites
      WHERE id = _resolved_site_id AND organisation_id = _org_id
    ) THEN
      _resolved_site_id := NULL;
    END IF;
  EXCEPTION WHEN others THEN
    _resolved_site_id := NULL;
  END;

  IF _resolved_site_id IS NULL THEN
    SELECT id INTO _resolved_site_id FROM public.sites
    WHERE upper(site_code) = upper(trim(_site_id))
      AND organisation_id = _org_id
    LIMIT 1;
  END IF;

  IF _resolved_site_id IS NULL THEN
    PERFORM public._record_staff_code_failure(_auth_uid);
    RETURN jsonb_build_object('valid', false, 'error', 'Site not found for this organisation');
  END IF;

  SELECT u.* INTO _user
  FROM public.users u
  WHERE u.organisation_id = _org_id
    AND upper(u.staff_code) = upper(trim(_staff_code))
    AND u.auth_type = 'staff_code'
    AND u.status = 'active';

  IF _user IS NULL THEN
    PERFORM public._record_staff_code_failure(_auth_uid);
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid staff code');
  END IF;

  SELECT m.* INTO _membership
  FROM public.memberships m
  WHERE m.user_id = _user.id
    AND m.site_id = _resolved_site_id
    AND m.active = true;

  IF _membership IS NULL THEN
    PERFORM public._record_staff_code_failure(_auth_uid);
    RETURN jsonb_build_object('valid', false, 'error', 'No active membership on this site');
  END IF;

  -- Move this temporary staff session cleanly if it was previously linked to
  -- another staff-code user on the same device/browser.
  UPDATE public.users
  SET auth_user_id = NULL
  WHERE auth_user_id = _auth_uid
    AND id <> _user.id
    AND auth_type = 'staff_code';

  UPDATE public.users
  SET auth_user_id = _auth_uid,
      last_login_at = now()
  WHERE id = _user.id;

  PERFORM public._clear_staff_code_attempts(_auth_uid);

  RETURN jsonb_build_object(
    'valid', true,
    'user_id', _user.id,
    'display_name', _user.display_name,
    'site_role', _membership.site_role,
    'organisation_id', _user.organisation_id,
    'site_id', _resolved_site_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.link_staff_session(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_staff_session(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.link_staff_session_for_org(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_staff_session_for_org(text, text, text) TO authenticated;