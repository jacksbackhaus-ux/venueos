-- 1. SITES: premises type, operating mode, archival
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS premises_type text NOT NULL DEFAULT 'commercial',
  ADD COLUMN IF NOT EXISTS operating_mode text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

ALTER TABLE public.sites
  DROP CONSTRAINT IF EXISTS sites_premises_type_check;
ALTER TABLE public.sites
  ADD CONSTRAINT sites_premises_type_check
  CHECK (premises_type IN ('commercial','home','mobile','production'));

ALTER TABLE public.sites
  DROP CONSTRAINT IF EXISTS sites_operating_mode_check;
ALTER TABLE public.sites
  ADD CONSTRAINT sites_operating_mode_check
  CHECK (operating_mode IN ('scheduled','on_demand'));

-- Explicit backfill: preserve current behaviour for every live customer
UPDATE public.sites SET premises_type = 'commercial' WHERE premises_type IS NULL;
UPDATE public.sites SET operating_mode = 'scheduled' WHERE operating_mode IS NULL;

-- 2. PRODUCTION DAYS
CREATE TABLE IF NOT EXISTS public.production_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  production_date date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  is_retrospective boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, production_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_days TO authenticated;
GRANT ALL ON public.production_days TO service_role;
ALTER TABLE public.production_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_days_select" ON public.production_days
  FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "production_days_insert" ON public.production_days
  FOR INSERT TO authenticated WITH CHECK (public.has_site_write_access(site_id));
CREATE POLICY "production_days_update" ON public.production_days
  FOR UPDATE TO authenticated USING (public.has_site_write_access(site_id))
  WITH CHECK (public.has_site_write_access(site_id));
CREATE POLICY "production_days_delete" ON public.production_days
  FOR DELETE TO authenticated USING (public.is_site_supervisor_or_owner(site_id));
CREATE TRIGGER production_days_touch BEFORE UPDATE ON public.production_days
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS production_days_site_date_idx
  ON public.production_days (site_id, production_date DESC);

-- 3. SITE REGISTRATIONS
CREATE TABLE IF NOT EXISTS public.site_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  local_authority_name text,
  registration_date date,
  registration_reference text,
  last_inspection_date date,
  fhrs_rating integer CHECK (fhrs_rating IS NULL OR (fhrs_rating BETWEEN 0 AND 5)),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_registrations TO authenticated;
GRANT ALL ON public.site_registrations TO service_role;
ALTER TABLE public.site_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_registrations_select" ON public.site_registrations
  FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "site_registrations_manage" ON public.site_registrations
  FOR ALL TO authenticated USING (public.is_site_supervisor_or_owner(site_id))
  WITH CHECK (public.is_site_supervisor_or_owner(site_id));
CREATE TRIGGER site_registrations_touch BEFORE UPDATE ON public.site_registrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. KITCHEN SETUP CHECK
CREATE TABLE IF NOT EXISTS public.site_kitchen_setup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_kitchen_setup TO authenticated;
GRANT ALL ON public.site_kitchen_setup TO service_role;
ALTER TABLE public.site_kitchen_setup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_kitchen_setup_select" ON public.site_kitchen_setup
  FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "site_kitchen_setup_manage" ON public.site_kitchen_setup
  FOR ALL TO authenticated USING (public.has_site_write_access(site_id))
  WITH CHECK (public.has_site_write_access(site_id));
CREATE TRIGGER site_kitchen_setup_touch BEFORE UPDATE ON public.site_kitchen_setup
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. MARKETS & EVENTS
CREATE TABLE IF NOT EXISTS public.site_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  event_date date NOT NULL,
  batch_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  transport_temp_checked boolean NOT NULL DEFAULT false,
  transport_temp numeric,
  notes text,
  logged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  logged_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_events TO authenticated;
GRANT ALL ON public.site_events TO service_role;
ALTER TABLE public.site_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_events_select" ON public.site_events
  FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "site_events_manage" ON public.site_events
  FOR ALL TO authenticated USING (public.has_site_write_access(site_id))
  WITH CHECK (public.has_site_write_access(site_id));
CREATE TRIGGER site_events_touch BEFORE UPDATE ON public.site_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. SITE TRANSFERS
CREATE TABLE IF NOT EXISTS public.site_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  from_site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  to_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  completed_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_transfers TO authenticated;
GRANT ALL ON public.site_transfers TO service_role;
ALTER TABLE public.site_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_transfers_select" ON public.site_transfers
  FOR SELECT TO authenticated USING (organisation_id = public.get_user_org_id());
CREATE POLICY "site_transfers_manage" ON public.site_transfers
  FOR ALL TO authenticated USING (public.is_org_owner_or_hq_admin(organisation_id))
  WITH CHECK (public.is_org_owner_or_hq_admin(organisation_id));
CREATE TRIGGER site_transfers_touch BEFORE UPDATE ON public.site_transfers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- Only one active transfer per organisation
CREATE UNIQUE INDEX IF NOT EXISTS site_transfers_one_active_per_org
  ON public.site_transfers (organisation_id) WHERE status = 'active';

-- 7. PREMISES-AWARE DEFAULT SEEDING
CREATE OR REPLACE FUNCTION public.seed_premises_defaults(_site_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
  _type text;
  _section uuid;
BEGIN
  SELECT organisation_id, premises_type INTO _org, _type
  FROM public.sites WHERE id = _site_id;
  IF _org IS NULL THEN RETURN; END IF;

  IF NOT public.has_site_write_access(_site_id) AND NOT public.is_org_owner(_org) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;

  -- Only seed once
  IF EXISTS (SELECT 1 FROM public.day_sheet_sections WHERE site_id = _site_id)
     OR EXISTS (SELECT 1 FROM public.cleaning_tasks WHERE site_id = _site_id) THEN
    RETURN;
  END IF;

  IF _type = 'home' THEN
    INSERT INTO public.temp_units (site_id, organisation_id, name, type, min_temp, max_temp, sort_order)
    VALUES (_site_id, _org, 'Fridge', 'fridge', 0, 5, 1),
           (_site_id, _org, 'Freezer', 'freezer', -25, -18, 2);

    INSERT INTO public.day_sheet_sections (site_id, organisation_id, title, icon, default_time, sort_order)
    VALUES (_site_id, _org, 'Before you start', 'sunrise', '08:00', 1) RETURNING id INTO _section;
    INSERT INTO public.day_sheet_items (section_id, label, sort_order) VALUES
      (_section, 'Kitchen cleaned before starting', 1),
      (_section, 'Hands washed, clean apron on', 2),
      (_section, 'Pets excluded from kitchen', 3),
      (_section, 'Fridge temperature checked (below 5°C)', 4),
      (_section, 'Freezer temperature checked (below -18°C)', 5),
      (_section, 'Ingredients checked in date', 6),
      (_section, 'Work surfaces sanitised', 7),
      (_section, 'Equipment clean and in good condition', 8);

    INSERT INTO public.day_sheet_sections (site_id, organisation_id, title, icon, default_time, sort_order)
    VALUES (_site_id, _org, 'After you finish', 'moon', '17:00', 2) RETURNING id INTO _section;
    INSERT INTO public.day_sheet_items (section_id, label, sort_order) VALUES
      (_section, 'Surfaces cleaned and sanitised', 1),
      (_section, 'Equipment washed and stored', 2),
      (_section, 'Food stored correctly and labelled', 3),
      (_section, 'Waste removed', 4),
      (_section, 'Fridge temperature checked', 5);

    INSERT INTO public.cleaning_tasks (site_id, organisation_id, area, task, frequency, sort_order)
    VALUES
      (_site_id, _org, 'Kitchen', 'Work surfaces', 'daily', 1),
      (_site_id, _org, 'Kitchen', 'Sink', 'daily', 2),
      (_site_id, _org, 'Kitchen', 'Floor', 'daily', 3),
      (_site_id, _org, 'Kitchen', 'Bins', 'daily', 4),
      (_site_id, _org, 'Kitchen', 'Fridge interior', 'weekly', 5),
      (_site_id, _org, 'Kitchen', 'Oven', 'weekly', 6),
      (_site_id, _org, 'Kitchen', 'Small appliances', 'weekly', 7),
      (_site_id, _org, 'Kitchen', 'Cupboard fronts', 'weekly', 8),
      (_site_id, _org, 'Kitchen', 'Freezer', 'monthly', 9),
      (_site_id, _org, 'Kitchen', 'Deep clean', 'monthly', 10),
      (_site_id, _org, 'Kitchen', 'Check for pests', 'monthly', 11),
      (_site_id, _org, 'Kitchen', 'Extractor', 'monthly', 12);

  ELSIF _type = 'mobile' THEN
    INSERT INTO public.temp_units (site_id, organisation_id, name, type, min_temp, max_temp, sort_order)
    VALUES (_site_id, _org, 'Cool box / fridge', 'fridge', 0, 5, 1),
           (_site_id, _org, 'Freezer', 'freezer', -25, -18, 2);

    INSERT INTO public.day_sheet_sections (site_id, organisation_id, title, icon, default_time, sort_order)
    VALUES (_site_id, _org, 'Before you start', 'sunrise', '07:00', 1) RETURNING id INTO _section;
    INSERT INTO public.day_sheet_items (section_id, label, sort_order) VALUES
      (_section, 'Vehicle/stall clean', 1),
      (_section, 'Handwashing facilities set up and working', 2),
      (_section, 'Cool boxes / fridges at temperature', 3),
      (_section, 'Transport temperatures recorded', 4),
      (_section, 'Waste arrangements in place', 5),
      (_section, 'Allergen information available', 6);

    INSERT INTO public.day_sheet_sections (site_id, organisation_id, title, icon, default_time, sort_order)
    VALUES (_site_id, _org, 'After you finish', 'moon', '17:00', 2) RETURNING id INTO _section;
    INSERT INTO public.day_sheet_items (section_id, label, sort_order) VALUES
      (_section, 'Surfaces cleaned and sanitised', 1),
      (_section, 'Equipment washed and stored', 2),
      (_section, 'Food stored correctly and labelled', 3),
      (_section, 'Waste removed', 4);

    INSERT INTO public.cleaning_tasks (site_id, organisation_id, area, task, frequency, sort_order)
    VALUES
      (_site_id, _org, 'Stall / vehicle', 'Serving surfaces', 'daily', 1),
      (_site_id, _org, 'Stall / vehicle', 'Handwash station', 'daily', 2),
      (_site_id, _org, 'Stall / vehicle', 'Bins and waste', 'daily', 3),
      (_site_id, _org, 'Stall / vehicle', 'Cool box interiors', 'weekly', 4),
      (_site_id, _org, 'Stall / vehicle', 'Equipment deep clean', 'weekly', 5),
      (_site_id, _org, 'Stall / vehicle', 'Vehicle deep clean', 'monthly', 6),
      (_site_id, _org, 'Stall / vehicle', 'Check for pests', 'monthly', 7);
  END IF;
  -- commercial / production: existing defaults elsewhere remain unchanged
END;
$$;

-- 8. SIGNUP: accept premises type (defaults keep old behaviour)
CREATE OR REPLACE FUNCTION public.handle_signup(
  _org_name text,
  _site_name text,
  _display_name text,
  _email text,
  _site_address text DEFAULT NULL::text,
  _premises_type text DEFAULT 'commercial'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id UUID;
  _user_id UUID;
  _site_id UUID;
  _membership_id UUID;
  _type text := COALESCE(NULLIF(_premises_type, ''), 'commercial');
  _mode text;
BEGIN
  IF _type NOT IN ('commercial','home','mobile','production') THEN
    _type := 'commercial';
  END IF;
  _mode := CASE WHEN _type IN ('home','mobile') THEN 'on_demand' ELSE 'scheduled' END;

  INSERT INTO public.organisations (name) VALUES (_org_name) RETURNING id INTO _org_id;

  INSERT INTO public.users (auth_user_id, organisation_id, display_name, email, auth_type, status)
  VALUES (auth.uid(), _org_id, _display_name, _email, 'email', 'active')
  RETURNING id INTO _user_id;

  INSERT INTO public.sites (organisation_id, name, address, owner_user_id, premises_type, operating_mode)
  VALUES (_org_id, _site_name, _site_address, _user_id, _type, _mode)
  RETURNING id INTO _site_id;

  INSERT INTO public.memberships (site_id, user_id, site_role, active)
  VALUES (_site_id, _user_id, 'owner', true)
  RETURNING id INTO _membership_id;

  INSERT INTO public.org_users (organisation_id, user_id, org_role, active)
  VALUES (_org_id, _user_id, 'org_owner', true);

  INSERT INTO public.audit_trail (organisation_id, site_id, actor_user_id, action, entity_type, entity_id, metadata_json)
  VALUES (_org_id, _site_id, _user_id, 'signup', 'organisation', _org_id::text,
          jsonb_build_object('site_id', _site_id, 'site_name', _site_name, 'premises_type', _type));

  RETURN jsonb_build_object(
    'organisation_id', _org_id,
    'user_id', _user_id,
    'site_id', _site_id,
    'membership_id', _membership_id,
    'premises_type', _type,
    'operating_mode', _mode
  );
END;
$$;