
-- 1. Add site_code column to sites
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS site_code text;

-- Function to generate a random 6-char alphanumeric code (avoids confusing chars: 0/O, 1/I)
CREATE OR REPLACE FUNCTION public.generate_site_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  attempts int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sites WHERE site_code = result);
    attempts := attempts + 1;
    IF attempts > 50 THEN RAISE EXCEPTION 'Could not generate unique site code'; END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- Backfill existing sites
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.sites WHERE site_code IS NULL LOOP
    UPDATE public.sites SET site_code = public.generate_site_code() WHERE id = r.id;
  END LOOP;
END $$;

-- Make site_code NOT NULL with default for new rows
ALTER TABLE public.sites ALTER COLUMN site_code SET NOT NULL;
ALTER TABLE public.sites ALTER COLUMN site_code SET DEFAULT public.generate_site_code();
CREATE UNIQUE INDEX IF NOT EXISTS sites_site_code_key ON public.sites (site_code);

-- 2. Unique staff_code within org (partial — only when set)
CREATE UNIQUE INDEX IF NOT EXISTS users_org_staff_code_key
  ON public.users (organisation_id, staff_code)
  WHERE staff_code IS NOT NULL;

-- 3. Update validate_staff_code to accept either UUID or site_code
CREATE OR REPLACE FUNCTION public.validate_staff_code(_site_id text, _staff_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user RECORD;
  _membership RECORD;
  _resolved_site_id uuid;
BEGIN
  -- Resolve site: try as UUID first, then as site_code (case-insensitive)
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

  UPDATE public.users SET last_login_at = now() WHERE id = _user.id;

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

-- 4. RPC to generate a unique short staff code within an organisation
CREATE OR REPLACE FUNCTION public.generate_staff_code(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  attempts int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..5 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE organisation_id = _org_id AND upper(staff_code) = result
    );
    attempts := attempts + 1;
    IF attempts > 50 THEN RAISE EXCEPTION 'Could not generate unique staff code'; END IF;
  END LOOP;
  RETURN result;
END;
$$;
