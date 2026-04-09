
-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.auth_type AS ENUM ('email', 'staff_code');
CREATE TYPE public.user_status AS ENUM ('active', 'suspended');
CREATE TYPE public.site_role AS ENUM ('owner', 'supervisor', 'staff', 'read_only');
CREATE TYPE public.org_role AS ENUM ('org_owner', 'hq_admin', 'hq_auditor');

-- ============================================
-- TABLES
-- ============================================

-- 1) organisations
CREATE TABLE public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- 2) users (app-level user profiles)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  organisation_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  auth_type public.auth_type NOT NULL DEFAULT 'email',
  staff_code TEXT,
  status public.user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_users_org ON public.users(organisation_id);
CREATE INDEX idx_users_auth_user ON public.users(auth_user_id);
CREATE UNIQUE INDEX idx_users_staff_code_org ON public.users(organisation_id, staff_code) WHERE staff_code IS NOT NULL;

-- 3) sites
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  active BOOLEAN NOT NULL DEFAULT true,
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sites_org ON public.sites(organisation_id);

-- Add FK from users to organisations (deferred to avoid circular)
ALTER TABLE public.users ADD CONSTRAINT fk_users_org FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

-- 4) memberships
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  site_role public.site_role NOT NULL DEFAULT 'staff',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, user_id)
);
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_memberships_site ON public.memberships(site_id);
CREATE INDEX idx_memberships_user ON public.memberships(user_id);

-- 5) org_users
CREATE TABLE public.org_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_role public.org_role NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);
ALTER TABLE public.org_users ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_org_users_org ON public.org_users(organisation_id);
CREATE INDEX idx_org_users_user ON public.org_users(user_id);

-- 6) devices
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_key TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_devices_site ON public.devices(site_id);

-- 7) audit_trail (immutable)
CREATE TABLE public.audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL,
  site_id UUID,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata_json JSONB DEFAULT '{}'::jsonb
);
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_org ON public.audit_trail(organisation_id);
CREATE INDEX idx_audit_site ON public.audit_trail(site_id);
CREATE INDEX idx_audit_timestamp ON public.audit_trail(server_timestamp DESC);

-- ============================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================

-- Get the app user_id for the current auth.uid()
CREATE OR REPLACE FUNCTION public.get_app_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() AND status = 'active' LIMIT 1;
$$;

-- Get the organisation_id for the current auth user
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organisation_id FROM public.users WHERE auth_user_id = auth.uid() AND status = 'active' LIMIT 1;
$$;

-- Check if auth user has an active membership on a given site
CREATE OR REPLACE FUNCTION public.has_site_membership(_site_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.users u ON u.id = m.user_id
    WHERE m.site_id = _site_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND m.active = true
  );
$$;

-- Check if auth user has HQ access to a given organisation
CREATE OR REPLACE FUNCTION public.has_hq_access(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_users ou
    JOIN public.users u ON u.id = ou.user_id
    WHERE ou.organisation_id = _org_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND ou.active = true
  );
$$;

-- Check if auth user is an org_owner
CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_users ou
    JOIN public.users u ON u.id = ou.user_id
    WHERE ou.organisation_id = _org_id
      AND ou.org_role = 'org_owner'
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND ou.active = true
  );
$$;

-- Check if auth user has site access (membership OR hq)
CREATE OR REPLACE FUNCTION public.has_site_access(_site_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.users u ON u.id = m.user_id
    WHERE m.site_id = _site_id AND u.auth_user_id = auth.uid() AND u.status = 'active' AND m.active = true
  )
  OR EXISTS (
    SELECT 1 FROM public.sites s
    JOIN public.org_users ou ON ou.organisation_id = s.organisation_id
    JOIN public.users u ON u.id = ou.user_id
    WHERE s.id = _site_id AND u.auth_user_id = auth.uid() AND u.status = 'active' AND ou.active = true
  );
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- organisations
CREATE POLICY "Users can view own org" ON public.organisations
  FOR SELECT TO authenticated
  USING (id = public.get_user_org_id());

CREATE POLICY "Org owners can update org" ON public.organisations
  FOR UPDATE TO authenticated
  USING (public.is_org_owner(id));

-- users
CREATE POLICY "Users can view users in own org" ON public.users
  FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_org_id());

CREATE POLICY "Org owners can insert users" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_org_id() AND public.is_org_owner(organisation_id));

CREATE POLICY "Org owners can update users in org" ON public.users
  FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_org_id() AND public.is_org_owner(organisation_id));

-- sites
CREATE POLICY "Users can view sites with access" ON public.sites
  FOR SELECT TO authenticated
  USING (
    public.has_site_membership(id) OR public.has_hq_access(organisation_id)
  );

CREATE POLICY "Org owners can insert sites" ON public.sites
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_org_id() AND public.is_org_owner(organisation_id));

CREATE POLICY "Org owners can update sites" ON public.sites
  FOR UPDATE TO authenticated
  USING (organisation_id = public.get_user_org_id() AND public.is_org_owner(organisation_id));

-- memberships
CREATE POLICY "Users can view memberships for accessible sites" ON public.memberships
  FOR SELECT TO authenticated
  USING (public.has_site_access(site_id));

CREATE POLICY "Org owners can manage memberships" ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_org_owner(s.organisation_id)
    )
  );

CREATE POLICY "Org owners can update memberships" ON public.memberships
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_org_owner(s.organisation_id)
    )
  );

-- org_users
CREATE POLICY "Users can view org roles in own org" ON public.org_users
  FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_org_id());

CREATE POLICY "Org owners can manage org roles" ON public.org_users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(organisation_id));

CREATE POLICY "Org owners can update org roles" ON public.org_users
  FOR UPDATE TO authenticated
  USING (public.is_org_owner(organisation_id));

-- devices
CREATE POLICY "Users with site access can view devices" ON public.devices
  FOR SELECT TO authenticated
  USING (public.has_site_access(site_id));

CREATE POLICY "Org owners can manage devices" ON public.devices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_org_owner(s.organisation_id)
    )
  );

CREATE POLICY "Org owners can update devices" ON public.devices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s WHERE s.id = site_id AND public.is_org_owner(s.organisation_id)
    )
  );

-- audit_trail (append-only: insert allowed, no update/delete)
CREATE POLICY "Users can view audit trail in own org" ON public.audit_trail
  FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_org_id());

CREATE POLICY "Authenticated users can insert audit entries" ON public.audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.get_user_org_id());

-- ============================================
-- SIGNUP FUNCTION (creates org + site + owner atomically)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_signup(
  _org_name TEXT,
  _site_name TEXT,
  _display_name TEXT,
  _email TEXT,
  _site_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id UUID;
  _user_id UUID;
  _site_id UUID;
  _membership_id UUID;
BEGIN
  -- Create organisation
  INSERT INTO public.organisations (name) VALUES (_org_name) RETURNING id INTO _org_id;
  
  -- Create user
  INSERT INTO public.users (auth_user_id, organisation_id, display_name, email, auth_type, status)
  VALUES (auth.uid(), _org_id, _display_name, _email, 'email', 'active')
  RETURNING id INTO _user_id;
  
  -- Create site
  INSERT INTO public.sites (organisation_id, name, address, owner_user_id)
  VALUES (_org_id, _site_name, _site_address, _user_id)
  RETURNING id INTO _site_id;
  
  -- Create membership (owner on site)
  INSERT INTO public.memberships (site_id, user_id, site_role, active)
  VALUES (_site_id, _user_id, 'owner', true)
  RETURNING id INTO _membership_id;
  
  -- Create org_users entry (org_owner)
  INSERT INTO public.org_users (organisation_id, user_id, org_role, active)
  VALUES (_org_id, _user_id, 'org_owner', true);
  
  -- Audit trail
  INSERT INTO public.audit_trail (organisation_id, site_id, actor_user_id, action, entity_type, entity_id, metadata_json)
  VALUES (_org_id, _site_id, _user_id, 'signup', 'organisation', _org_id::text, jsonb_build_object('site_id', _site_id, 'site_name', _site_name));

  RETURN jsonb_build_object(
    'organisation_id', _org_id,
    'user_id', _user_id,
    'site_id', _site_id,
    'membership_id', _membership_id
  );
END;
$$;

-- Allow the signup function to bypass RLS during initial creation
-- (it's SECURITY DEFINER so it runs as the function owner)

-- ============================================
-- STAFF CODE LOGIN HELPER (validates and returns user info)
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_staff_code(
  _site_id UUID,
  _staff_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user RECORD;
  _membership RECORD;
BEGIN
  -- Find user by staff code within the site's organisation
  SELECT u.* INTO _user
  FROM public.users u
  JOIN public.sites s ON s.organisation_id = u.organisation_id
  WHERE s.id = _site_id
    AND u.staff_code = _staff_code
    AND u.auth_type = 'staff_code'
    AND u.status = 'active';

  IF _user IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid staff code');
  END IF;

  -- Check active membership on this site
  SELECT m.* INTO _membership
  FROM public.memberships m
  WHERE m.user_id = _user.id
    AND m.site_id = _site_id
    AND m.active = true;

  IF _membership IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'No active membership on this site');
  END IF;

  -- Update last_login_at
  UPDATE public.users SET last_login_at = now() WHERE id = _user.id;

  RETURN jsonb_build_object(
    'valid', true,
    'user_id', _user.id,
    'display_name', _user.display_name,
    'site_role', _membership.site_role,
    'organisation_id', _user.organisation_id
  );
END;
$$;

-- Grant anon access to validate_staff_code (staff don't have auth sessions)
GRANT EXECUTE ON FUNCTION public.validate_staff_code TO anon;
GRANT EXECUTE ON FUNCTION public.handle_signup TO authenticated;
