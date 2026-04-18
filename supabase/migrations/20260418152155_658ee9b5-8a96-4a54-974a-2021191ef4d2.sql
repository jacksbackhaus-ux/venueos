CREATE OR REPLACE FUNCTION public.handle_signup(_org_name text, _site_name text, _display_name text, _email text, _site_address text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _org_id UUID;
  _user_id UUID;
  _site_id UUID;
  _membership_id UUID;
BEGIN
  INSERT INTO public.organisations (name) VALUES (_org_name) RETURNING id INTO _org_id;

  INSERT INTO public.users (auth_user_id, organisation_id, display_name, email, auth_type, status)
  VALUES (auth.uid(), _org_id, _display_name, _email, 'email', 'active')
  RETURNING id INTO _user_id;

  INSERT INTO public.sites (organisation_id, name, address, owner_user_id)
  VALUES (_org_id, _site_name, _site_address, _user_id)
  RETURNING id INTO _site_id;

  INSERT INTO public.memberships (site_id, user_id, site_role, active)
  VALUES (_site_id, _user_id, 'owner', true)
  RETURNING id INTO _membership_id;

  INSERT INTO public.org_users (organisation_id, user_id, org_role, active)
  VALUES (_org_id, _user_id, 'org_owner', true);

  INSERT INTO public.audit_trail (organisation_id, site_id, actor_user_id, action, entity_type, entity_id, metadata_json)
  VALUES (_org_id, _site_id, _user_id, 'signup', 'organisation', _org_id::text, jsonb_build_object('site_id', _site_id, 'site_name', _site_name));

  RETURN jsonb_build_object(
    'organisation_id', _org_id,
    'user_id', _user_id,
    'site_id', _site_id,
    'membership_id', _membership_id
  );
END;
$function$;