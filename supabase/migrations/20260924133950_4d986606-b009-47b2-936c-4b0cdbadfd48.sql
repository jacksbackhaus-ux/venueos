ALTER TABLE public.users ADD COLUMN IF NOT EXISTS anonymised_at timestamptz NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS anonymised_by uuid NULL;

CREATE OR REPLACE FUNCTION public.gdpr_anonymise_user(_target uuid, _actor uuid, _self boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _u record;
  _ref record;
  _before jsonb := '{}'::jsonb;
  _after jsonb := '{}'::jsonb;
  _n bigint;
  _key text;
BEGIN
  SELECT * INTO _u FROM public.users WHERE id = _target FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF _u.anonymised_at IS NOT NULL THEN RAISE EXCEPTION 'Already anonymised'; END IF;
  IF EXISTS (SELECT 1 FROM public.org_users WHERE user_id = _target AND org_role = 'org_owner') THEN
    RAISE EXCEPTION 'Business owners cannot be anonymised';
  END IF;
  IF NOT _self AND _u.status = 'active' THEN
    RAISE EXCEPTION 'Deactivate this person before anonymising them';
  END IF;

  -- Count every row linked to this user by a foreign key, plus fitness_to_work.
  FOR _ref IN
    SELECT c.conrelid::regclass::text AS t, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass
    UNION SELECT 'fitness_to_work', 'user_id'
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', _ref.t, _ref.col) INTO _n USING _target;
    _before := _before || jsonb_build_object(_ref.t || '.' || _ref.col, _n);
  END LOOP;

  IF _self AND _u.status = 'active' THEN
    UPDATE public.users SET status = 'suspended', deactivated_at = now(), deactivated_by = _actor WHERE id = _target;
  END IF;

  UPDATE public.users
     SET display_name = 'Former staff member', email = NULL, staff_code = NULL,
         anonymised_at = now(), anonymised_by = _actor
   WHERE id = _target;

  FOR _key IN SELECT jsonb_object_keys(_before) LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', split_part(_key, '.', 1), split_part(_key, '.', 2)) INTO _n USING _target;
    _after := _after || jsonb_build_object(_key, _n);
  END LOOP;
  IF _before <> _after THEN
    RAISE EXCEPTION 'Linked record counts changed; nothing was anonymised';
  END IF;

  INSERT INTO public.audit_trail (organisation_id, actor_user_id, action, entity_type, entity_id, metadata_json)
  VALUES (_u.organisation_id, _actor, 'gdpr_anonymise', 'user', _target::text, jsonb_build_object('self_service', _self));

  RETURN jsonb_build_object('ok', true, 'auth_user_id', _u.auth_user_id, 'organisation_id', _u.organisation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.gdpr_anonymise_user(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gdpr_anonymise_user(uuid, uuid, boolean) TO service_role;