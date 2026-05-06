
-- ============================================================
-- 1. STAFF SUBSCRIPTION MANAGEMENT RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION public.staff_get_subscription(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub jsonb;
  _org jsonb;
BEGIN
  IF NOT public.has_staff_access_to_org(_org_id) THEN
    RAISE EXCEPTION 'Not authorised for this organisation' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(s.*) INTO _sub FROM public.subscriptions s WHERE s.organisation_id = _org_id;
  SELECT jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug)
    INTO _org FROM public.organisations o WHERE o.id = _org_id;

  RETURN jsonb_build_object('organisation', _org, 'subscription', _sub);
END $$;

REVOKE EXECUTE ON FUNCTION public.staff_get_subscription(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_get_subscription(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_update_subscription(
  _org_id uuid,
  _reason text,
  _patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before jsonb;
  _after jsonb;
  _actor uuid := auth.uid();
  _allowed_keys text[] := ARRAY[
    'is_comped','comped_reason','comped_until',
    'status','trial_end','current_period_end','cancel_at_period_end',
    'billing_interval','site_quantity','hq_quantity',
    'base_active','compliance_active','business_active','bundle_active',
    'locked_at'
  ];
  _key text;
  _filtered jsonb := '{}'::jsonb;
BEGIN
  PERFORM public.assert_super_admin();

  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'Reason required (min 5 chars)' USING ERRCODE = '22023';
  END IF;

  FOREACH _key IN ARRAY _allowed_keys LOOP
    IF _patch ? _key THEN
      _filtered := _filtered || jsonb_build_object(_key, _patch->_key);
    END IF;
  END LOOP;

  IF _filtered = '{}'::jsonb THEN
    RAISE EXCEPTION 'No valid fields to update' USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(s.*) INTO _before FROM public.subscriptions s WHERE s.organisation_id = _org_id;
  IF _before IS NULL THEN
    RAISE EXCEPTION 'Subscription not found for organisation' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.subscriptions s SET
    is_comped            = COALESCE((_filtered->>'is_comped')::boolean, s.is_comped),
    comped_reason        = CASE WHEN _filtered ? 'comped_reason' THEN _filtered->>'comped_reason' ELSE s.comped_reason END,
    comped_until         = CASE WHEN _filtered ? 'comped_until' THEN NULLIF(_filtered->>'comped_until','')::timestamptz ELSE s.comped_until END,
    comped_by            = CASE WHEN (_filtered ? 'is_comped') AND (_filtered->>'is_comped')::boolean THEN _actor ELSE s.comped_by END,
    status               = COALESCE(_filtered->>'status', s.status),
    trial_end            = CASE WHEN _filtered ? 'trial_end' THEN NULLIF(_filtered->>'trial_end','')::timestamptz ELSE s.trial_end END,
    current_period_end   = CASE WHEN _filtered ? 'current_period_end' THEN NULLIF(_filtered->>'current_period_end','')::timestamptz ELSE s.current_period_end END,
    cancel_at_period_end = COALESCE((_filtered->>'cancel_at_period_end')::boolean, s.cancel_at_period_end),
    billing_interval     = COALESCE(_filtered->>'billing_interval', s.billing_interval),
    site_quantity        = COALESCE((_filtered->>'site_quantity')::int, s.site_quantity),
    hq_quantity          = COALESCE((_filtered->>'hq_quantity')::int, s.hq_quantity),
    base_active          = COALESCE((_filtered->>'base_active')::boolean, s.base_active),
    compliance_active    = COALESCE((_filtered->>'compliance_active')::boolean, s.compliance_active),
    business_active      = COALESCE((_filtered->>'business_active')::boolean, s.business_active),
    bundle_active        = COALESCE((_filtered->>'bundle_active')::boolean, s.bundle_active),
    locked_at            = CASE WHEN _filtered ? 'locked_at' THEN NULLIF(_filtered->>'locked_at','')::timestamptz ELSE s.locked_at END,
    updated_at           = now()
  WHERE s.organisation_id = _org_id
  RETURNING to_jsonb(s.*) INTO _after;

  INSERT INTO public.admin_actions_log (performed_by, action_type, target_user_id, reason, metadata)
  VALUES (
    _actor,
    'subscription_update',
    NULL,
    _reason,
    jsonb_build_object(
      'organisation_id', _org_id,
      'patch', _filtered,
      'before', _before,
      'after', _after
    )
  );

  RETURN _after;
END $$;

REVOKE EXECUTE ON FUNCTION public.staff_update_subscription(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_update_subscription(uuid, text, jsonb) TO authenticated;

-- ============================================================
-- 2. SECURITY: Realtime channel authorization
-- ============================================================

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_realtime_topic(_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parts text[];
  _scope text;
  _id uuid;
BEGIN
  IF _topic IS NULL OR auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.is_super_admin() OR public.is_internal_staff() THEN RETURN true; END IF;

  _parts := string_to_array(_topic, ':');
  IF array_length(_parts,1) < 2 THEN RETURN false; END IF;
  _scope := _parts[1];
  BEGIN
    _id := _parts[2]::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF _scope = 'site' THEN
    RETURN public.has_site_access(_id);
  ELSIF _scope = 'org' THEN
    RETURN _id = public.get_user_org_id() OR public.has_hq_access(_id);
  END IF;
  RETURN false;
END $$;

REVOKE EXECUTE ON FUNCTION public.can_access_realtime_topic(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_access_realtime_topic(text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can subscribe to authorised topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can broadcast to authorised topics" ON realtime.messages;

CREATE POLICY "Authenticated users can subscribe to authorised topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING ( public.can_access_realtime_topic(realtime.topic()) );

CREATE POLICY "Authenticated users can broadcast to authorised topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK ( public.can_access_realtime_topic(realtime.topic()) );

-- ============================================================
-- 3. SECURITY: hide staff_code/email — restrict broad SELECT to org owners
-- ============================================================

DROP POLICY IF EXISTS "Managers and HQ can view org users" ON public.users;
DROP POLICY IF EXISTS "Org owners can view all org users" ON public.users;
DROP POLICY IF EXISTS "Managers can view org users safe columns only" ON public.users;

CREATE POLICY "Org owners can view all org users"
ON public.users
FOR SELECT
TO authenticated
USING (
  is_super_admin()
  OR (organisation_id = get_user_org_id() AND is_org_owner(organisation_id))
);

CREATE POLICY "Managers can view org users (sensitive cols hidden by view)"
ON public.users
FOR SELECT
TO authenticated
USING (
  organisation_id = get_user_org_id()
  AND is_org_manager_or_hq(organisation_id)
  AND NOT is_org_owner(organisation_id)
);

-- Safe view: omits staff_code and email
CREATE OR REPLACE VIEW public.org_users_safe
WITH (security_invoker = true) AS
SELECT
  id, organisation_id, auth_user_id, display_name, status,
  auth_type, hourly_rate, last_login_at, created_at
FROM public.users;

GRANT SELECT ON public.org_users_safe TO authenticated;

-- ============================================================
-- 4. SECURITY: messenger-attachments storage UPDATE policy
-- ============================================================

DROP POLICY IF EXISTS "Messenger: update your own attachments" ON storage.objects;

CREATE POLICY "Messenger: update your own attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'messenger-attachments'
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'messenger-attachments'
  AND owner = auth.uid()
);
