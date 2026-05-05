
-- =====================================================================
-- 1) Migrate has_site_membership() → has_site_write_access() on WRITE policies
-- =====================================================================
-- (Read policies and trigger paths keep has_site_membership semantics.)

-- batch_stage_events
DROP POLICY IF EXISTS "Site members can insert stage events" ON public.batch_stage_events;
CREATE POLICY "Site members can insert stage events" ON public.batch_stage_events
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.batches b
  WHERE b.id = batch_stage_events.batch_id AND public.has_site_write_access(b.site_id)
));

DROP POLICY IF EXISTS "Site members can update stage events" ON public.batch_stage_events;
CREATE POLICY "Site members can update stage events" ON public.batch_stage_events
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.batches b
  WHERE b.id = batch_stage_events.batch_id AND public.has_site_write_access(b.site_id)
));

-- batch_templates (config) — supervisor/owner only
DROP POLICY IF EXISTS "Site members can insert batch templates" ON public.batch_templates;
CREATE POLICY "Site members can insert batch templates" ON public.batch_templates
FOR INSERT TO authenticated
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

DROP POLICY IF EXISTS "Site members can update batch templates" ON public.batch_templates;
CREATE POLICY "Site members can update batch templates" ON public.batch_templates
FOR UPDATE TO authenticated
USING (public.is_site_supervisor_or_owner(site_id));

-- batches
DROP POLICY IF EXISTS "Site members can update batches" ON public.batches;
CREATE POLICY "Site members can update batches" ON public.batches
FOR UPDATE TO authenticated
USING (public.has_site_write_access(site_id));

-- day_sheets (INSERT)
DROP POLICY IF EXISTS "Insert day sheets" ON public.day_sheets;
CREATE POLICY "Insert day sheets" ON public.day_sheets
FOR INSERT TO authenticated
WITH CHECK (public.has_site_write_access(site_id));

-- day_sheet_entries
DROP POLICY IF EXISTS "Insert day sheet entries" ON public.day_sheet_entries;
CREATE POLICY "Insert day sheet entries" ON public.day_sheet_entries
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.day_sheets ds
  WHERE ds.id = day_sheet_entries.day_sheet_id AND public.has_site_write_access(ds.site_id)
));

DROP POLICY IF EXISTS "Update day sheet entries" ON public.day_sheet_entries;
CREATE POLICY "Update day sheet entries" ON public.day_sheet_entries
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.day_sheets ds
  WHERE ds.id = day_sheet_entries.day_sheet_id AND public.has_site_write_access(ds.site_id)
));

-- incidents
DROP POLICY IF EXISTS "Update incidents" ON public.incidents;
CREATE POLICY "Update incidents" ON public.incidents
FOR UPDATE TO authenticated
USING (public.has_site_write_access(site_id));

-- ingredients (config) — supervisor/owner only
DROP POLICY IF EXISTS "Insert ingredients" ON public.ingredients;
CREATE POLICY "Insert ingredients" ON public.ingredients
FOR INSERT TO authenticated
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

DROP POLICY IF EXISTS "Update ingredients" ON public.ingredients;
CREATE POLICY "Update ingredients" ON public.ingredients
FOR UPDATE TO authenticated
USING (public.is_site_supervisor_or_owner(site_id));

-- maintenance_logs
DROP POLICY IF EXISTS "Insert maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Insert maintenance logs" ON public.maintenance_logs
FOR INSERT TO authenticated
WITH CHECK (public.has_site_write_access(site_id));

DROP POLICY IF EXISTS "Update maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Update maintenance logs" ON public.maintenance_logs
FOR UPDATE TO authenticated
USING (public.has_site_write_access(site_id));

-- pest_logs
DROP POLICY IF EXISTS "Insert pest logs" ON public.pest_logs;
CREATE POLICY "Insert pest logs" ON public.pest_logs
FOR INSERT TO authenticated
WITH CHECK (public.has_site_write_access(site_id));

DROP POLICY IF EXISTS "Update pest logs" ON public.pest_logs;
CREATE POLICY "Update pest logs" ON public.pest_logs
FOR UPDATE TO authenticated
USING (public.has_site_write_access(site_id));

-- preventative_checks
DROP POLICY IF EXISTS "Insert preventative checks" ON public.preventative_checks;
CREATE POLICY "Insert preventative checks" ON public.preventative_checks
FOR INSERT TO authenticated
WITH CHECK (public.has_site_write_access(site_id));

DROP POLICY IF EXISTS "Update preventative checks" ON public.preventative_checks;
CREATE POLICY "Update preventative checks" ON public.preventative_checks
FOR UPDATE TO authenticated
USING (public.has_site_write_access(site_id));

-- recipes (config) — supervisor/owner only
DROP POLICY IF EXISTS "Insert recipes" ON public.recipes;
CREATE POLICY "Insert recipes" ON public.recipes
FOR INSERT TO authenticated
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

DROP POLICY IF EXISTS "Update recipes" ON public.recipes;
CREATE POLICY "Update recipes" ON public.recipes
FOR UPDATE TO authenticated
USING (public.is_site_supervisor_or_owner(site_id));

-- recipe_ingredients (config) — supervisor/owner only
DROP POLICY IF EXISTS "Insert recipe ingredients" ON public.recipe_ingredients;
CREATE POLICY "Insert recipe ingredients" ON public.recipe_ingredients
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.recipes r
  WHERE r.id = recipe_ingredients.recipe_id AND public.is_site_supervisor_or_owner(r.site_id)
));

DROP POLICY IF EXISTS "Update recipe ingredients" ON public.recipe_ingredients;
CREATE POLICY "Update recipe ingredients" ON public.recipe_ingredients
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.recipes r
  WHERE r.id = recipe_ingredients.recipe_id AND public.is_site_supervisor_or_owner(r.site_id)
));

DROP POLICY IF EXISTS "Delete recipe ingredients" ON public.recipe_ingredients;
CREATE POLICY "Delete recipe ingredients" ON public.recipe_ingredients
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.recipes r
  WHERE r.id = recipe_ingredients.recipe_id AND public.is_site_supervisor_or_owner(r.site_id)
));

-- shift_requests
DROP POLICY IF EXISTS "Staff create their own shift requests" ON public.shift_requests;
CREATE POLICY "Staff create their own shift requests" ON public.shift_requests
FOR INSERT TO authenticated
WITH CHECK (
  requester_id = public.get_app_user_id()
  AND public.has_site_write_access(site_id)
);

-- shift_staff
DROP POLICY IF EXISTS "Insert shift staff" ON public.shift_staff;
CREATE POLICY "Insert shift staff" ON public.shift_staff
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shifts s
  WHERE s.id = shift_staff.shift_id AND public.has_site_write_access(s.site_id)
));

DROP POLICY IF EXISTS "Delete shift staff" ON public.shift_staff;
CREATE POLICY "Delete shift staff" ON public.shift_staff
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.shifts s
  WHERE s.id = shift_staff.shift_id AND public.has_site_write_access(s.site_id)
));

-- shift_task_completions
DROP POLICY IF EXISTS "Insert shift task completions" ON public.shift_task_completions;
CREATE POLICY "Insert shift task completions" ON public.shift_task_completions
FOR INSERT TO authenticated
WITH CHECK (public.has_site_write_access(site_id));

DROP POLICY IF EXISTS "Delete shift task completions" ON public.shift_task_completions;
CREATE POLICY "Delete shift task completions" ON public.shift_task_completions
FOR DELETE TO authenticated
USING (public.has_site_write_access(site_id));


-- =====================================================================
-- 2) Server-side rate limiting for staff-code login
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.staff_code_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id uuid NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_code_attempts_auth_user_id_key UNIQUE (auth_user_id)
);
ALTER TABLE public.staff_code_attempts ENABLE ROW LEVEL SECURITY;
-- Only SECURITY DEFINER functions read/write this table; no direct access from clients.

CREATE OR REPLACE FUNCTION public._check_staff_code_lockout(_auth_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.staff_code_attempts;
BEGIN
  SELECT * INTO _row FROM public.staff_code_attempts WHERE auth_user_id = _auth_uid;
  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('locked', false);
  END IF;
  IF _row.locked_until IS NOT NULL AND _row.locked_until > now() THEN
    RETURN jsonb_build_object('locked', true, 'until', _row.locked_until);
  END IF;
  RETURN jsonb_build_object('locked', false);
END $$;

CREATE OR REPLACE FUNCTION public._record_staff_code_failure(_auth_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _new_count int;
BEGIN
  INSERT INTO public.staff_code_attempts (auth_user_id, attempt_count, last_attempt_at)
  VALUES (_auth_uid, 1, now())
  ON CONFLICT (auth_user_id) DO UPDATE
    SET attempt_count = CASE
          WHEN public.staff_code_attempts.last_attempt_at < now() - interval '15 minutes'
          THEN 1
          ELSE public.staff_code_attempts.attempt_count + 1
        END,
        last_attempt_at = now()
  RETURNING attempt_count INTO _new_count;

  IF _new_count >= 8 THEN
    UPDATE public.staff_code_attempts
    SET locked_until = now() + interval '15 minutes'
    WHERE auth_user_id = _auth_uid;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._clear_staff_code_attempts(_auth_uid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.staff_code_attempts WHERE auth_user_id = _auth_uid;
$$;

-- Wrap link_staff_session with rate limiting
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

-- Wrap link_staff_session_for_org with rate limiting
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

-- =====================================================================
-- 3) Lock down EXECUTE on internal SECURITY DEFINER functions
-- =====================================================================
-- Revoke from anon: anything not intended for signed-out callers.
-- Keep public RPC: get_org_public_by_slug (used by /login/:slug landing).
-- Keep authenticated EXECUTE for everything legitimately called from the app.

REVOKE EXECUTE ON FUNCTION public.assert_internal_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.assert_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_staff_code(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_unique_org_slug(text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_app_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_weekly_hours(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_signup(text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_channel_audit_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_clopen_conflict(uuid, date, time, time, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_hq_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_internal_role(internal_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_site_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_site_membership(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_site_write_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_staff_access_to_org(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_org_user(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_channel_participant(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_internal_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_hq(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_site_supervisor_or_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin_revoke_safe(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.messenger_mark_read(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_has_active_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_messenger_channels_for_site(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.staff_get_org_detail(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_list_assigned_orgs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_list_internal_staff() FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_list_migrations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_list_org_assignments(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_org_modules(uuid) FROM anon, authenticated;

-- validate_staff_code: legacy unauthenticated path; remove anon access (clients should use link_staff_session*).
REVOKE EXECUTE ON FUNCTION public.validate_staff_code(text, text) FROM anon;

-- New rate-limit helpers must NOT be callable from clients.
REVOKE EXECUTE ON FUNCTION public._check_staff_code_lockout(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._record_staff_code_failure(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._clear_staff_code_attempts(uuid) FROM anon, authenticated, public;
