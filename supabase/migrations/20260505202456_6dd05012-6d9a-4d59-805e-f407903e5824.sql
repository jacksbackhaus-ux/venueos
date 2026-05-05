-- Per-org staff access scoping (additive, non-destructive)

CREATE TABLE IF NOT EXISTS public.staff_org_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'support',
  reason TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  CONSTRAINT staff_org_access_level_chk CHECK (access_level IN ('support','onboarding','billing','engineering'))
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_org_access_active_uniq
  ON public.staff_org_access (staff_user_id, organisation_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS staff_org_access_staff_idx ON public.staff_org_access (staff_user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS staff_org_access_org_idx ON public.staff_org_access (organisation_id) WHERE revoked_at IS NULL;

ALTER TABLE public.staff_org_access ENABLE ROW LEVEL SECURITY;

-- Helper: super admins bypass; otherwise must be internal staff with active row for the org
CREATE OR REPLACE FUNCTION public.has_staff_access_to_org(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR (
      public.is_internal_staff()
      AND EXISTS (
        SELECT 1 FROM public.staff_org_access soa
        WHERE soa.staff_user_id = auth.uid()
          AND soa.organisation_id = _org_id
          AND soa.revoked_at IS NULL
          AND (soa.expires_at IS NULL OR soa.expires_at > now())
      )
    );
$$;

-- Guard: prevent self-grant unless super admin; require reason >=5 chars; stamp created_by
CREATE OR REPLACE FUNCTION public.trg_staff_org_access_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.reason IS NULL OR length(trim(NEW.reason)) < 5 THEN
    RAISE EXCEPTION 'A reason (>=5 chars) is required to grant staff_org_access';
  END IF;
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  IF NEW.staff_user_id = auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Self-grant of staff_org_access is not allowed';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS staff_org_access_guard ON public.staff_org_access;
CREATE TRIGGER staff_org_access_guard
  BEFORE INSERT ON public.staff_org_access
  FOR EACH ROW EXECUTE FUNCTION public.trg_staff_org_access_guard();

-- RLS policies
DROP POLICY IF EXISTS "Super admins manage staff_org_access" ON public.staff_org_access;
CREATE POLICY "Super admins manage staff_org_access"
  ON public.staff_org_access
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Internal staff read own staff_org_access" ON public.staff_org_access;
CREATE POLICY "Internal staff read own staff_org_access"
  ON public.staff_org_access
  FOR SELECT TO authenticated
  USING (public.is_internal_staff() AND staff_user_id = auth.uid());

-- Extend admin_actions_log additively for org-scoped audit (nullable, backwards-compatible)
ALTER TABLE public.admin_actions_log
  ADD COLUMN IF NOT EXISTS target_organisation_id UUID;

CREATE INDEX IF NOT EXISTS admin_actions_log_target_org_idx
  ON public.admin_actions_log (target_organisation_id)
  WHERE target_organisation_id IS NOT NULL;

-- RPC: list orgs the current internal staff member can access (super admins → all)
CREATE OR REPLACE FUNCTION public.staff_list_assigned_orgs()
RETURNS TABLE (
  organisation_id uuid,
  name text,
  slug text,
  access_level text,
  granted_at timestamptz,
  expires_at timestamptz,
  is_super_admin_view boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_internal_staff();

  IF public.is_super_admin() THEN
    RETURN QUERY
      SELECT o.id, o.name, o.slug,
             'super_admin'::text,
             NULL::timestamptz, NULL::timestamptz,
             true
      FROM public.organisations o
      ORDER BY o.name ASC;
  ELSE
    RETURN QUERY
      SELECT o.id, o.name, o.slug,
             soa.access_level,
             soa.created_at, soa.expires_at,
             false
      FROM public.staff_org_access soa
      JOIN public.organisations o ON o.id = soa.organisation_id
      WHERE soa.staff_user_id = auth.uid()
        AND soa.revoked_at IS NULL
        AND (soa.expires_at IS NULL OR soa.expires_at > now())
      ORDER BY o.name ASC;
  END IF;
END $$;

-- RPC: org detail (gated by has_staff_access_to_org)
CREATE OR REPLACE FUNCTION public.staff_get_org_detail(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _result jsonb;
BEGIN
  IF NOT public.has_staff_access_to_org(_org_id) THEN
    RAISE EXCEPTION 'Not authorised for this organisation' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'organisation', (SELECT jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug, 'created_at', o.created_at)
                     FROM public.organisations o WHERE o.id = _org_id),
    'sites', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'site_code', s.site_code, 'address', s.address))
                       FROM public.sites s WHERE s.organisation_id = _org_id), '[]'::jsonb),
    'subscription', (SELECT to_jsonb(sub) FROM public.subscriptions sub WHERE sub.organisation_id = _org_id),
    'user_count', (SELECT count(*) FROM public.users u WHERE u.organisation_id = _org_id AND u.status = 'active'),
    'org_owners', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', u.id, 'display_name', u.display_name, 'email', u.email, 'org_role', ou.org_role))
                            FROM public.org_users ou
                            JOIN public.users u ON u.id = ou.user_id
                            WHERE ou.organisation_id = _org_id AND ou.active = true
                              AND ou.org_role IN ('org_owner','hq_admin')), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END $$;

-- RPC: list internal staff (super admins only) for the access management UI
CREATE OR REPLACE FUNCTION public.staff_list_internal_staff()
RETURNS TABLE (
  user_id uuid,
  email text,
  role internal_role,
  granted_at timestamptz,
  expires_at timestamptz,
  reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_super_admin();
  RETURN QUERY
    SELECT isr.user_id,
           sa.email,
           isr.role,
           isr.created_at,
           isr.expires_at,
           isr.reason
    FROM public.internal_staff_roles isr
    LEFT JOIN public.super_admins sa ON sa.user_id = isr.user_id
    WHERE isr.revoked_at IS NULL
      AND (isr.expires_at IS NULL OR isr.expires_at > now())
    ORDER BY isr.created_at DESC;
END $$;

-- RPC: list active staff_org_access rows (super admins only)
CREATE OR REPLACE FUNCTION public.staff_list_org_assignments(_staff_user_id uuid DEFAULT NULL, _org_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  staff_user_id uuid,
  organisation_id uuid,
  organisation_name text,
  access_level text,
  reason text,
  granted_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_super_admin();
  RETURN QUERY
    SELECT soa.id, soa.staff_user_id, soa.organisation_id, o.name,
           soa.access_level, soa.reason, soa.created_at, soa.expires_at
    FROM public.staff_org_access soa
    JOIN public.organisations o ON o.id = soa.organisation_id
    WHERE soa.revoked_at IS NULL
      AND (soa.expires_at IS NULL OR soa.expires_at > now())
      AND (_staff_user_id IS NULL OR soa.staff_user_id = _staff_user_id)
      AND (_org_id IS NULL OR soa.organisation_id = _org_id)
    ORDER BY o.name ASC, soa.created_at DESC;
END $$;