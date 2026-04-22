-- Allow auth_user_id to be re-linked across kiosk sessions: drop unique if any
-- (column is currently nullable text/uuid; we just need an upsert-style link)

CREATE OR REPLACE FUNCTION public.link_staff_session(_site_id text, _staff_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _auth_uid uuid := auth.uid();
  _resolved_site_id uuid;
  _user RECORD;
  _membership RECORD;
BEGIN
  IF _auth_uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No auth session');
  END IF;

  -- Resolve site by uuid or site_code
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
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid staff code');
  END IF;

  SELECT m.* INTO _membership
  FROM public.memberships m
  WHERE m.user_id = _user.id
    AND m.site_id = _resolved_site_id
    AND m.active = true;

  IF _membership IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No active membership on this site');
  END IF;

  -- Link the current anonymous auth session to this staff user row.
  -- (Overwrites any prior link so the same staff_code can be used from a new device.)
  UPDATE public.users
  SET auth_user_id = _auth_uid,
      last_login_at = now()
  WHERE id = _user.id;

  RETURN jsonb_build_object(
    'valid', true,
    'user_id', _user.id,
    'display_name', _user.display_name,
    'site_role', _membership.site_role,
    'organisation_id', _user.organisation_id,
    'site_id', _resolved_site_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_staff_session(text, text) TO authenticated, anon;