-- 1. Additive columns on org_users
ALTER TABLE public.org_users
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reason      text,
  ADD COLUMN IF NOT EXISTS created_by  uuid;

-- 2. Helper honouring expires_at
CREATE OR REPLACE FUNCTION public.is_active_org_user(_org_id uuid, _auth_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_users ou
    JOIN public.users u ON u.id = ou.user_id
    WHERE ou.organisation_id = _org_id
      AND u.auth_user_id = _auth_uid
      AND u.status = 'active'
      AND ou.active = true
      AND (ou.expires_at IS NULL OR ou.expires_at > now())
  );
$$;

-- 3. Update manager check to include active onboarding_admin
CREATE OR REPLACE FUNCTION public.is_org_manager_or_hq(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_users ou
    JOIN public.users u ON u.id = ou.user_id
    WHERE ou.organisation_id = _org_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND ou.active = true
      AND (ou.expires_at IS NULL OR ou.expires_at > now())
      AND ou.org_role IN ('org_owner','hq_admin','hq_auditor','onboarding_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.users u ON u.id = m.user_id
    JOIN public.sites s ON s.id = m.site_id
    WHERE u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND m.active = true
      AND m.site_role IN ('owner','supervisor')
      AND s.organisation_id = _org_id
  );
$$;

-- 4. Trigger to validate onboarding_admin grants
CREATE OR REPLACE FUNCTION public.trg_org_users_onboarding_admin_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _granter_app_id uuid;
BEGIN
  IF NEW.org_role <> 'onboarding_admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.reason IS NULL OR length(trim(NEW.reason)) < 5 THEN
    RAISE EXCEPTION 'A reason (>=5 chars) is required to grant onboarding_admin';
  END IF;

  SELECT id INTO _granter_app_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  NEW.created_by := COALESCE(NEW.created_by, _granter_app_id);

  IF NEW.user_id = _granter_app_id AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Self-grant of onboarding_admin is not allowed';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS org_users_onboarding_admin_guard_ins ON public.org_users;
CREATE TRIGGER org_users_onboarding_admin_guard_ins
  BEFORE INSERT ON public.org_users
  FOR EACH ROW EXECUTE FUNCTION public.trg_org_users_onboarding_admin_guard();

DROP TRIGGER IF EXISTS org_users_onboarding_admin_guard_upd ON public.org_users;
CREATE TRIGGER org_users_onboarding_admin_guard_upd
  BEFORE UPDATE ON public.org_users
  FOR EACH ROW EXECUTE FUNCTION public.trg_org_users_onboarding_admin_guard();

-- 5. RLS: super admins can manage org_users (existing org-owner policies stay)
DROP POLICY IF EXISTS "Super admins can manage org roles" ON public.org_users;
CREATE POLICY "Super admins can manage org roles"
  ON public.org_users FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can update org roles" ON public.org_users;
CREATE POLICY "Super admins can update org roles"
  ON public.org_users FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can read org roles" ON public.org_users;
CREATE POLICY "Super admins can read org roles"
  ON public.org_users FOR SELECT TO authenticated
  USING (public.is_super_admin());