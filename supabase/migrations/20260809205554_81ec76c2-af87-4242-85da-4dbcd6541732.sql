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
  _closing uuid;
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

  ELSE
    -- commercial / production defaults
    INSERT INTO public.temp_units (site_id, organisation_id, name, type, min_temp, max_temp, sort_order) VALUES
      (_site_id, _org, 'Main Fridge', 'fridge', 0, 5, 1),
      (_site_id, _org, 'Display Chiller', 'display', 0, 8, 2),
      (_site_id, _org, 'Freezer', 'freezer', -22, -18, 3);

    INSERT INTO public.cleaning_tasks (site_id, organisation_id, area, task, frequency, sort_order) VALUES
      (_site_id, _org, 'Front of house', 'Wipe down counters and surfaces', 'daily', 1),
      (_site_id, _org, 'Kitchen', 'Sanitise prep surfaces', 'daily', 2),
      (_site_id, _org, 'Kitchen', 'Sweep and mop floors', 'daily', 3),
      (_site_id, _org, 'Toilets', 'Clean and restock', 'daily', 4),
      (_site_id, _org, 'Kitchen', 'Deep clean ovens', 'weekly', 5),
      (_site_id, _org, 'Storage', 'Check and clean shelving', 'weekly', 6);

    INSERT INTO public.day_sheet_sections (site_id, organisation_id, title, default_time, icon, sort_order)
    VALUES (_site_id, _org, 'Opening', '07:00', 'Sunrise', 1) RETURNING id INTO _section;
    INSERT INTO public.day_sheet_sections (site_id, organisation_id, title, default_time, icon, sort_order)
    VALUES (_site_id, _org, 'Closing', '18:00', 'Moon', 2) RETURNING id INTO _closing;

    INSERT INTO public.day_sheet_items (section_id, label, sort_order) VALUES
      (_section, 'AM fridge/freezer temps logged', 1),
      (_section, 'Hand-wash stations stocked (soap, towels)', 2),
      (_section, 'Display cabinets stocked and labelled', 3),
      (_section, 'Allergen info displayed and up to date', 4),
      (_closing, 'All food covered, labelled, and dated', 1),
      (_closing, 'PM fridge/freezer temps logged', 2),
      (_closing, 'Bins emptied and area clean', 3),
      (_closing, 'Equipment switched off / cleaned', 4),
      (_closing, 'Premises secured', 5);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_signup(_org_name text, _site_name text, _display_name text, _email text, _site_address text DEFAULT NULL::text, _premises_type text DEFAULT 'commercial'::text)
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

  PERFORM public.seed_premises_defaults(_site_id);

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
$function$;