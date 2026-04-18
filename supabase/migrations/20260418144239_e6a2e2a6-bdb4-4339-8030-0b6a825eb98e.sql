-- Update handle_signup to seed sensible UK bakery defaults for new sites
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
  _opening_section_id UUID;
  _closing_section_id UUID;
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

  -- Seed sensible UK bakery defaults
  -- Temperature units (typical UK food safety ranges)
  INSERT INTO public.temp_units (site_id, organisation_id, name, type, min_temp, max_temp, sort_order) VALUES
    (_site_id, _org_id, 'Main Fridge', 'fridge', 0, 5, 1),
    (_site_id, _org_id, 'Display Chiller', 'display', 0, 8, 2),
    (_site_id, _org_id, 'Freezer', 'freezer', -22, -18, 3);

  -- Cleaning tasks
  INSERT INTO public.cleaning_tasks (site_id, organisation_id, area, task, frequency, sort_order) VALUES
    (_site_id, _org_id, 'Front of house', 'Wipe down counters and surfaces', 'daily', 1),
    (_site_id, _org_id, 'Kitchen', 'Sanitise prep surfaces', 'daily', 2),
    (_site_id, _org_id, 'Kitchen', 'Sweep and mop floors', 'daily', 3),
    (_site_id, _org_id, 'Toilets', 'Clean and restock', 'daily', 4),
    (_site_id, _org_id, 'Kitchen', 'Deep clean ovens', 'weekly', 5),
    (_site_id, _org_id, 'Storage', 'Check and clean shelving', 'weekly', 6);

  -- Day sheet sections + items
  INSERT INTO public.day_sheet_sections (site_id, organisation_id, title, default_time, icon, sort_order)
  VALUES (_site_id, _org_id, 'Opening', '07:00', 'Sunrise', 1)
  RETURNING id INTO _opening_section_id;

  INSERT INTO public.day_sheet_sections (site_id, organisation_id, title, default_time, icon, sort_order)
  VALUES (_site_id, _org_id, 'Closing', '18:00', 'Moon', 2)
  RETURNING id INTO _closing_section_id;

  INSERT INTO public.day_sheet_items (section_id, label, sort_order) VALUES
    (_opening_section_id, 'AM fridge/freezer temps logged', 1),
    (_opening_section_id, 'Hand-wash stations stocked (soap, towels)', 2),
    (_opening_section_id, 'Display cabinets stocked and labelled', 3),
    (_opening_section_id, 'Allergen info displayed and up to date', 4),
    (_closing_section_id, 'All food covered, labelled, and dated', 1),
    (_closing_section_id, 'PM fridge/freezer temps logged', 2),
    (_closing_section_id, 'Bins emptied and area clean', 3),
    (_closing_section_id, 'Equipment switched off / cleaned', 4),
    (_closing_section_id, 'Premises secured', 5);

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