-- 1) Add slug column (nullable initially so backfill is non-destructive)
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS slug text;

-- 2) Helper: derive a base slug from a name
CREATE OR REPLACE FUNCTION public.slugify_org_name(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  s text;
BEGIN
  s := lower(coalesce(_name, ''));
  -- replace anything that is not a-z/0-9 with a hyphen
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  -- trim leading/trailing hyphens
  s := regexp_replace(s, '^-+|-+$', '', 'g');
  -- collapse repeated hyphens
  s := regexp_replace(s, '-{2,}', '-', 'g');
  IF s IS NULL OR length(s) = 0 THEN
    s := 'org';
  END IF;
  -- cap length to keep URLs sane
  IF length(s) > 48 THEN
    s := substr(s, 1, 48);
    s := regexp_replace(s, '-+$', '', 'g');
  END IF;
  RETURN s;
END;
$$;

-- 3) Helper: pick a unique slug, appending -2, -3 ... if needed
CREATE OR REPLACE FUNCTION public.generate_unique_org_slug(_name text, _exclude_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base text := slugify_org_name(_name);
  candidate text := base;
  n int := 2;
BEGIN
  WHILE EXISTS (
    SELECT 1 FROM public.organisations
    WHERE slug = candidate
      AND (_exclude_id IS NULL OR id <> _exclude_id)
  ) LOOP
    candidate := base || '-' || n;
    n := n + 1;
    IF n > 9999 THEN
      candidate := base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      EXIT;
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 4) Backfill existing orgs (only those without a slug)
DO $$
DECLARE
  r RECORD;
  s text;
BEGIN
  FOR r IN SELECT id, name FROM public.organisations WHERE slug IS NULL OR length(trim(slug)) = 0 LOOP
    s := public.generate_unique_org_slug(r.name, r.id);
    UPDATE public.organisations SET slug = s WHERE id = r.id;
  END LOOP;
END $$;

-- 5) Lock down: NOT NULL + unique index
ALTER TABLE public.organisations
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organisations_slug_key
  ON public.organisations (slug);

-- 6) Trigger to auto-assign slug on insert when not provided
CREATE OR REPLACE FUNCTION public.trg_organisations_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR length(trim(NEW.slug)) = 0 THEN
    NEW.slug := public.generate_unique_org_slug(NEW.name, NULL);
  ELSE
    -- normalise + ensure uniqueness even if a slug was supplied
    NEW.slug := public.slugify_org_name(NEW.slug);
    NEW.slug := public.generate_unique_org_slug(NEW.slug, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organisations_set_slug ON public.organisations;
CREATE TRIGGER organisations_set_slug
BEFORE INSERT ON public.organisations
FOR EACH ROW EXECUTE FUNCTION public.trg_organisations_set_slug();

-- 7) Slug-aware staff session linker — same shape as link_staff_session,
--    but constrains site lookup to the org identified by _org_slug.
CREATE OR REPLACE FUNCTION public.link_staff_session_for_org(
  _org_slug text,
  _site_id text,
  _staff_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _auth_uid uuid := auth.uid();
  _org_id uuid;
  _resolved_site_id uuid;
  _user RECORD;
  _membership RECORD;
BEGIN
  IF _auth_uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No auth session');
  END IF;

  SELECT id INTO _org_id FROM public.organisations
  WHERE lower(slug) = lower(trim(_org_slug)) LIMIT 1;
  IF _org_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Organisation not found');
  END IF;

  -- Resolve site by uuid or site_code, BUT only within this org
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
    RETURN jsonb_build_object('valid', false, 'error', 'Site not found for this organisation');
  END IF;

  SELECT u.* INTO _user
  FROM public.users u
  WHERE u.organisation_id = _org_id
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

-- 8) Public lookup so the /login/:slug page can show the org name
--    without leaking sensitive data.
CREATE OR REPLACE FUNCTION public.get_org_public_by_slug(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug
  )
  FROM public.organisations o
  WHERE lower(o.slug) = lower(trim(_slug))
  LIMIT 1;
$$;