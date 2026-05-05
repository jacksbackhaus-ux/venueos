-- 1) is_internal_staff() helper
CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_staff_roles
    WHERE user_id = auth.uid()
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_internal_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_internal_staff() TO authenticated;

-- 2) assert_internal_staff()
CREATE OR REPLACE FUNCTION public.assert_internal_staff()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_internal_staff() THEN
    RAISE EXCEPTION 'Not authorised: internal staff required' USING ERRCODE = '42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.assert_internal_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_internal_staff() TO authenticated;

-- 3) Last-staff protection trigger
CREATE OR REPLACE FUNCTION public.trg_internal_staff_protect_last()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _active_after int;
BEGIN
  SELECT count(*) INTO _active_after
  FROM public.internal_staff_roles
  WHERE revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND id <> COALESCE(OLD.id, NEW.id);

  IF TG_OP = 'UPDATE'
     AND NEW.revoked_at IS NULL
     AND (NEW.expires_at IS NULL OR NEW.expires_at > now()) THEN
    _active_after := _active_after + 1;
  END IF;

  IF _active_after < 1 THEN
    RAISE EXCEPTION 'Cannot remove the last active internal staff member';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS internal_staff_protect_last_del ON public.internal_staff_roles;
CREATE TRIGGER internal_staff_protect_last_del
  BEFORE DELETE ON public.internal_staff_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_internal_staff_protect_last();

DROP TRIGGER IF EXISTS internal_staff_protect_last_upd ON public.internal_staff_roles;
CREATE TRIGGER internal_staff_protect_last_upd
  BEFORE UPDATE ON public.internal_staff_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_internal_staff_protect_last();

-- 4) Read-only migrations status function for /staff/migrations
CREATE OR REPLACE FUNCTION public.staff_list_migrations()
RETURNS TABLE(version text, name text, applied_at_estimate timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_internal_staff();
  RETURN QUERY
    SELECT m.version::text, m.name::text, to_timestamp(m.version::bigint / 100000000.0)
    FROM supabase_migrations.schema_migrations m
    ORDER BY m.version DESC
    LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION public.staff_list_migrations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_migrations() TO authenticated;

-- 5) BOOTSTRAP — founder account
DO $$
DECLARE
  _uid uuid;
  _email text := 'jacksbackhaus@gmail.com';
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;

  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Bootstrap aborted: no auth.users row for %. Sign up at /auth first, then re-run this migration.', _email;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _uid AND revoked_at IS NULL) THEN
    INSERT INTO public.super_admins (user_id, email, granted_by, created_by, reason, notes)
    VALUES (_uid, _email, _uid, _uid, 'Initial bootstrap super admin (MiseOS founder)', 'Bootstrapped via migration');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.internal_staff_roles
    WHERE user_id = _uid AND role = 'engineering'::internal_role AND revoked_at IS NULL
  ) THEN
    INSERT INTO public.internal_staff_roles (user_id, role, created_by, reason)
    VALUES (_uid, 'engineering'::internal_role, _uid, 'Initial bootstrap engineering staff (MiseOS founder)');
  END IF;
END $$;