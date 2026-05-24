CREATE OR REPLACE FUNCTION public.verify_staff_session(_user_id uuid, _site_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _auth_uid uuid := auth.uid();
  _user RECORD;
  _membership RECORD;
BEGIN
  IF _auth_uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No auth session');
  END IF;

  IF COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Not a staff session');
  END IF;

  SELECT u.* INTO _user
  FROM public.users u
  WHERE u.id = _user_id
    AND u.auth_user_id = _auth_uid
    AND u.auth_type = 'staff_code'
    AND u.status = 'active';

  IF _user IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Staff session no longer matches this browser');
  END IF;

  SELECT m.* INTO _membership
  FROM public.memberships m
  JOIN public.sites s ON s.id = m.site_id AND s.organisation_id = _user.organisation_id
  WHERE m.user_id = _user.id
    AND m.site_id = _site_id
    AND m.active = true;

  IF _membership IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No active membership on this site');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'user_id', _user.id,
    'display_name', _user.display_name,
    'site_role', _membership.site_role,
    'organisation_id', _user.organisation_id,
    'site_id', _site_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_staff_session(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_staff_session(uuid, uuid) TO authenticated;