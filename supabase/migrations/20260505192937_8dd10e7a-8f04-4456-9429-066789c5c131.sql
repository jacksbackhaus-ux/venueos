-- 4.1 Extend super_admins (additive)
ALTER TABLE public.super_admins
  ADD COLUMN IF NOT EXISTS created_by  uuid,
  ADD COLUMN IF NOT EXISTS reason      text,
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by  uuid;

CREATE INDEX IF NOT EXISTS idx_super_admins_active
  ON public.super_admins (user_id)
  WHERE revoked_at IS NULL;

-- 4.2 Audit log
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by            uuid NOT NULL,
  action_type             text NOT NULL,
  target_user_id          uuid,
  target_organisation_id  uuid,
  reason                  text NOT NULL,
  metadata                jsonb,
  created_at              timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_actions_log_created_at
  ON public.admin_actions_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_log_target_user
  ON public.admin_actions_log (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_log_action_type
  ON public.admin_actions_log (action_type, created_at DESC);

DROP POLICY IF EXISTS "Super admins read audit" ON public.admin_actions_log;
CREATE POLICY "Super admins read audit"
  ON public.admin_actions_log FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins write audit" ON public.admin_actions_log;
CREATE POLICY "Super admins write audit"
  ON public.admin_actions_log FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() AND performed_by = auth.uid());

-- 4.3 Internal staff roles
DO $$ BEGIN
  CREATE TYPE public.internal_role AS ENUM ('support','onboarding','ops');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.internal_staff_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  role        public.internal_role NOT NULL,
  created_by  uuid NOT NULL,
  reason      text NOT NULL,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  revoked_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.internal_staff_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins read internal roles" ON public.internal_staff_roles;
CREATE POLICY "Super admins read internal roles"
  ON public.internal_staff_roles FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins insert internal roles" ON public.internal_staff_roles;
CREATE POLICY "Super admins insert internal roles"
  ON public.internal_staff_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() AND user_id <> auth.uid());

DROP POLICY IF EXISTS "Super admins update internal roles" ON public.internal_staff_roles;
CREATE POLICY "Super admins update internal roles"
  ON public.internal_staff_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins delete internal roles" ON public.internal_staff_roles;
CREATE POLICY "Super admins delete internal roles"
  ON public.internal_staff_roles FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- 4.4 Helper functions (backwards compatible)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = auth.uid()
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_super_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorised: super admin required' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_internal_role(_role public.internal_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internal_staff_roles
    WHERE user_id = auth.uid() AND role = _role
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Pre-flight check used by UI: would removing this row leave 0 active super admins?
CREATE OR REPLACE FUNCTION public.is_super_admin_revoke_safe(_row_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    SELECT count(*) FROM public.super_admins
    WHERE id <> _row_id
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  ) >= 1;
$$;

-- 4.5 Guardrail triggers
CREATE OR REPLACE FUNCTION public.trg_super_admin_insert_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _existing int;
BEGIN
  SELECT count(*) INTO _existing FROM public.super_admins;

  -- Bootstrap path: if table is empty, allow self-grant without reason check.
  IF _existing = 0 THEN
    NEW.created_by := COALESCE(NEW.created_by, NEW.user_id);
    NEW.granted_by := COALESCE(NEW.granted_by, NEW.user_id);
    NEW.reason     := COALESCE(NEW.reason, 'Initial bootstrap super admin');
    RETURN NEW;
  END IF;

  IF NEW.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Self-grant of super admin is not allowed';
  END IF;
  IF NEW.reason IS NULL OR length(trim(NEW.reason)) < 5 THEN
    RAISE EXCEPTION 'A reason (>=5 chars) is required to grant super admin';
  END IF;
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  NEW.granted_by := COALESCE(NEW.granted_by, auth.uid());
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_super_admin_protect_last()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _active_after int;
BEGIN
  SELECT count(*) INTO _active_after
  FROM public.super_admins
  WHERE revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
    AND id <> COALESCE(OLD.id, NEW.id);

  IF TG_OP = 'UPDATE'
     AND NEW.revoked_at IS NULL
     AND (NEW.expires_at IS NULL OR NEW.expires_at > now()) THEN
    _active_after := _active_after + 1;
  END IF;

  IF _active_after < 1 THEN
    RAISE EXCEPTION 'Cannot remove the last active super admin';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS super_admins_insert_guard ON public.super_admins;
CREATE TRIGGER super_admins_insert_guard
  BEFORE INSERT ON public.super_admins
  FOR EACH ROW EXECUTE FUNCTION public.trg_super_admin_insert_guard();

DROP TRIGGER IF EXISTS super_admins_protect_last_upd ON public.super_admins;
CREATE TRIGGER super_admins_protect_last_upd
  BEFORE UPDATE ON public.super_admins
  FOR EACH ROW EXECUTE FUNCTION public.trg_super_admin_protect_last();

DROP TRIGGER IF EXISTS super_admins_protect_last_del ON public.super_admins;
CREATE TRIGGER super_admins_protect_last_del
  BEFORE DELETE ON public.super_admins
  FOR EACH ROW EXECUTE FUNCTION public.trg_super_admin_protect_last();

-- 4.6 RLS adjustments on super_admins
DROP POLICY IF EXISTS "Super admins can insert super_admins" ON public.super_admins;
CREATE POLICY "Super admins can insert super_admins"
  ON public.super_admins FOR INSERT TO authenticated
  WITH CHECK (
    -- bootstrap: empty table → allow first row
    (NOT EXISTS (SELECT 1 FROM public.super_admins))
    OR (public.is_super_admin() AND user_id <> auth.uid())
  );

DROP POLICY IF EXISTS "Super admins can update super_admins" ON public.super_admins;
CREATE POLICY "Super admins can update super_admins"
  ON public.super_admins FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());