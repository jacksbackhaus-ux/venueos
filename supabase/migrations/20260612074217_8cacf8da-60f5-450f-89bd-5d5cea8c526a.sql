-- ============================================================
-- 1) Impersonation session table
-- ============================================================
CREATE TABLE public.internal_impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_user_id uuid NOT NULL,
  target_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  target_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  access_level text NOT NULL DEFAULT 'support',
  reason text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  ended_at timestamptz,
  created_by uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.internal_impersonation_sessions TO authenticated;
GRANT ALL ON public.internal_impersonation_sessions TO service_role;

ALTER TABLE public.internal_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Internal staff / super admins read their own sessions; super admins read all.
-- No INSERT/UPDATE/DELETE policies: all writes go through SECURITY DEFINER RPCs.
CREATE POLICY "Internal staff read own impersonation sessions"
  ON public.internal_impersonation_sessions FOR SELECT
  USING (
    ((public.is_internal_staff() OR public.is_super_admin()) AND internal_user_id = auth.uid())
    OR public.is_super_admin()
  );

-- Only one active session per internal user.
CREATE UNIQUE INDEX internal_impersonation_one_active_idx
  ON public.internal_impersonation_sessions (internal_user_id)
  WHERE active;

CREATE INDEX internal_impersonation_org_idx
  ON public.internal_impersonation_sessions (target_organisation_id, active);

CREATE TRIGGER touch_internal_impersonation_sessions
  BEFORE UPDATE ON public.internal_impersonation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 2) Helper: which org (if any) is the caller actively impersonating?
-- ============================================================
CREATE OR REPLACE FUNCTION public.active_impersonation_org()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.target_organisation_id
  FROM public.internal_impersonation_sessions s
  WHERE s.internal_user_id = auth.uid()
    AND s.active = true
    AND s.ended_at IS NULL
    AND s.expires_at > now()
  ORDER BY s.started_at DESC
  LIMIT 1;
$function$;

-- ============================================================
-- 3) Extend existing read helpers so the customer app can RENDER
--    during an active support session. Customer behaviour unchanged:
--    the fallback only applies to callers with no customer account row.
--    Write helpers (has_site_write_access, is_org_owner, etc.) are NOT touched.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT organisation_id FROM public.users WHERE auth_user_id = auth.uid() AND status = 'active' LIMIT 1),
    public.active_impersonation_org()
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_site_access(_site_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  )
  OR EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = _site_id AND s.organisation_id = public.active_impersonation_org()
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_hq_access(_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.org_users ou
    JOIN public.users u ON u.id = ou.user_id
    WHERE ou.organisation_id = _org_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND ou.active = true
      AND ou.org_role IN ('org_owner','hq_admin','hq_auditor')
  )
  OR _org_id = public.active_impersonation_org();
$function$;

-- Team list + role rows must be readable while supporting (the app shell
-- hydrates the customer owner profile). Read-only, scoped to the active session org.
CREATE POLICY "Active impersonators can view org users"
  ON public.users FOR SELECT
  USING (organisation_id = public.active_impersonation_org());

CREATE POLICY "Active impersonators can view org roles"
  ON public.org_users FOR SELECT
  USING (organisation_id = public.active_impersonation_org());

-- ============================================================
-- 4) Start impersonation (secure RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_internal_impersonation(
  _target_organisation_id uuid,
  _reason text,
  _target_site_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _org RECORD;
  _site RECORD;
  _access_level text;
  _session RECORD;
  _target RECORD;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;

  -- Must be internal staff or super admin
  IF NOT (public.is_internal_staff() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Not authorised: internal staff required' USING ERRCODE = '42501';
  END IF;

  -- Must have staff access to this org (super-admin bypass OR active assignment)
  IF NOT public.has_staff_access_to_org(_target_organisation_id) THEN
    RAISE EXCEPTION 'No active assignment for this organisation. Grant access first.' USING ERRCODE = '42501';
  END IF;

  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'A reason (>=5 chars) is required to start impersonation';
  END IF;

  SELECT o.id, o.name, o.slug INTO _org FROM public.organisations o WHERE o.id = _target_organisation_id;
  IF _org.id IS NULL THEN
    RAISE EXCEPTION 'Organisation not found';
  END IF;

  IF _target_site_id IS NOT NULL THEN
    SELECT s.id, s.name INTO _site FROM public.sites s
    WHERE s.id = _target_site_id AND s.organisation_id = _target_organisation_id;
    IF _site.id IS NULL THEN
      RAISE EXCEPTION 'Site does not belong to this organisation';
    END IF;
  END IF;

  -- Access level comes from the assignment; never broader than assigned.
  IF public.is_super_admin() THEN
    _access_level := COALESCE(
      (SELECT soa.access_level FROM public.staff_org_access soa
       WHERE soa.staff_user_id = _caller AND soa.organisation_id = _target_organisation_id
         AND soa.revoked_at IS NULL AND (soa.expires_at IS NULL OR soa.expires_at > now())
       ORDER BY soa.created_at DESC LIMIT 1),
      'super_admin');
  ELSE
    SELECT soa.access_level INTO _access_level FROM public.staff_org_access soa
    WHERE soa.staff_user_id = _caller AND soa.organisation_id = _target_organisation_id
      AND soa.revoked_at IS NULL AND (soa.expires_at IS NULL OR soa.expires_at > now())
    ORDER BY soa.created_at DESC LIMIT 1;
    IF _access_level IS NULL THEN
      RAISE EXCEPTION 'No active assignment for this organisation. Grant access first.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Pick the customer's primary manager account as the view context
  SELECT u.id, u.auth_user_id, u.organisation_id, u.display_name, u.email,
         u.auth_type, u.staff_code, u.status, ou.org_role
    INTO _target
  FROM public.org_users ou
  JOIN public.users u ON u.id = ou.user_id
  WHERE ou.organisation_id = _target_organisation_id
    AND ou.active = true
    AND u.status = 'active'
  ORDER BY CASE ou.org_role WHEN 'org_owner' THEN 0 WHEN 'hq_admin' THEN 1 ELSE 2 END,
           u.created_at ASC
  LIMIT 1;
  IF _target.id IS NULL THEN
    RAISE EXCEPTION 'No manager account found for this organisation';
  END IF;

  -- One active session per staff member: end any previous session first
  UPDATE public.internal_impersonation_sessions
  SET active = false, ended_at = now()
  WHERE internal_user_id = _caller AND active = true;

  INSERT INTO public.internal_impersonation_sessions
    (internal_user_id, target_organisation_id, target_site_id, access_level, reason, created_by)
  VALUES
    (_caller, _target_organisation_id, _target_site_id, _access_level, trim(_reason), _caller)
  RETURNING * INTO _session;

  -- Audit trail (internal log)
  INSERT INTO public.admin_actions_log (performed_by, action_type, target_user_id, reason, metadata)
  VALUES (_caller, 'impersonation_start', _target.id, trim(_reason),
          jsonb_build_object('session_id', _session.id, 'organisation_id', _target_organisation_id,
                             'organisation_name', _org.name, 'site_id', _target_site_id,
                             'access_level', _access_level));

  -- Legacy super-admin audit sink stays populated for continuity
  IF public.is_super_admin() THEN
    INSERT INTO public.impersonation_logs (super_admin_user_id, target_organisation_id, target_user_id, reason)
    VALUES (_caller, _target_organisation_id, _target.id, trim(_reason));
  END IF;

  RETURN jsonb_build_object(
    'session_id', _session.id,
    'organisation', jsonb_build_object('id', _org.id, 'name', _org.name, 'slug', _org.slug),
    'site', CASE WHEN _site.id IS NULL THEN NULL
                 ELSE jsonb_build_object('id', _site.id, 'name', _site.name) END,
    'access_level', _access_level,
    'reason', _session.reason,
    'started_at', _session.started_at,
    'expires_at', _session.expires_at,
    'target_user', jsonb_build_object(
      'id', _target.id, 'auth_user_id', _target.auth_user_id,
      'organisation_id', _target.organisation_id, 'display_name', _target.display_name,
      'email', _target.email, 'auth_type', _target.auth_type,
      'staff_code', _target.staff_code, 'status', _target.status),
    'org_role', jsonb_build_object('org_role', _target.org_role, 'organisation_id', _target.organisation_id)
  );
END $function$;

-- ============================================================
-- 5) End impersonation (secure RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION public.end_internal_impersonation()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _ended int := 0;
  _last RECORD;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;

  UPDATE public.internal_impersonation_sessions
  SET active = false, ended_at = now()
  WHERE internal_user_id = _caller AND active = true
  RETURNING * INTO _last;
  GET DIAGNOSTICS _ended = ROW_COUNT;

  -- Close any open legacy super-admin log rows
  UPDATE public.impersonation_logs
  SET ended_at = now()
  WHERE super_admin_user_id = _caller AND ended_at IS NULL;

  IF _ended > 0 THEN
    INSERT INTO public.admin_actions_log (performed_by, action_type, reason, metadata)
    VALUES (_caller, 'impersonation_end', COALESCE(_last.reason, 'Session ended'),
            jsonb_build_object('session_id', _last.id, 'organisation_id', _last.target_organisation_id));
  END IF;

  RETURN jsonb_build_object('ended', _ended > 0);
END $function$;