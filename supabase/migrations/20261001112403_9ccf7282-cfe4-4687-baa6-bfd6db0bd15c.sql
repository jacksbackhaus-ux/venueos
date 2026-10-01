ALTER TABLE public.incidents ALTER COLUMN stage_schema_version DROP DEFAULT;

CREATE OR REPLACE FUNCTION private.advance_incident_stage_impl(
  _incident_id uuid,
  _stage text,
  _note text
)
RETURNS public.incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _incident public.incidents%ROWTYPE;
  _actor_id uuid;
  _actor_name text;
  _stage_name text := lower(btrim(COALESCE(_stage, '')));
  _stage_note text := btrim(COALESCE(_note, ''));
  _now timestamptz := now();
BEGIN
  IF _stage_name NOT IN ('resolved', 'corrective_action', 'verified') THEN
    RAISE EXCEPTION 'Invalid incident stage';
  END IF;
  IF _stage_note = '' THEN
    RAISE EXCEPTION 'A stage note is required';
  END IF;

  _actor_id := public.get_app_user_id();
  IF _actor_id IS NULL THEN RAISE EXCEPTION 'Signed-in user not found'; END IF;
  SELECT COALESCE(NULLIF(btrim(u.display_name), ''), 'MiseOS user')
    INTO _actor_name FROM public.users u WHERE u.id = _actor_id;

  SELECT * INTO _incident FROM public.incidents WHERE id = _incident_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found'; END IF;
  IF NOT public.has_site_write_access(_incident.site_id) THEN
    RAISE EXCEPTION 'You do not have permission to update this incident';
  END IF;
  IF _stage_name = 'verified' AND NOT public.is_site_supervisor_or_owner(_incident.site_id) THEN
    RAISE EXCEPTION 'Only a supervisor or owner can verify an incident';
  END IF;

  IF _stage_name = 'resolved' THEN
    IF _incident.status IN ('action-taken', 'verified', 'closed')
       OR _incident.verified_at IS NOT NULL
       OR _incident.resolved_at_stage IS NOT NULL
       OR _incident.corrective_action_at IS NOT NULL
       OR _incident.verification_at_stage IS NOT NULL THEN
      RAISE EXCEPTION 'Resolution cannot be recorded at the current incident stage';
    END IF;
    UPDATE public.incidents SET resolved_summary=_stage_note, resolved_at_stage=_now,
      resolved_by_user_id=_actor_id, resolved_by_name=_actor_name
      WHERE id=_incident_id RETURNING * INTO _incident;
  ELSIF _stage_name = 'corrective_action' THEN
    IF _incident.resolved_at_stage IS NULL OR _incident.corrective_action_at IS NOT NULL
       OR _incident.verification_at_stage IS NOT NULL OR _incident.verified_at IS NOT NULL
       OR _incident.status IN ('action-taken','verified','closed') THEN
      RAISE EXCEPTION 'Corrective action must follow a separately recorded resolution';
    END IF;
    UPDATE public.incidents SET corrective_action_summary=_stage_note, corrective_action_at=_now,
      corrective_action_by_user_id=_actor_id, corrective_action_by_name=_actor_name,
      status='action-taken'
      WHERE id=_incident_id RETURNING * INTO _incident;
  ELSE
    -- Evidence-based: verification needs either recorded corrective action,
    -- or an old-flow incident already at 'action-taken'.
    IF _incident.verification_at_stage IS NOT NULL OR _incident.verified_at IS NOT NULL
       OR _incident.status IN ('verified','closed')
       OR (_incident.corrective_action_at IS NULL AND _incident.status <> 'action-taken') THEN
      RAISE EXCEPTION 'Verification must follow a completed corrective action';
    END IF;
    UPDATE public.incidents SET verification_summary=_stage_note, verification_at_stage=_now,
      verification_by_user_id=_actor_id, verification_by_name=_actor_name,
      verified_by_name=_actor_name, verified_at=_now, status='verified'
      WHERE id=_incident_id RETURNING * INTO _incident;
  END IF;

  INSERT INTO public.incident_stage_events
    (incident_id, organisation_id, site_id, stage, actor_user_id, actor_name, occurred_at, note, snapshot)
  VALUES (_incident.id, _incident.organisation_id, _incident.site_id, _stage_name,
    _actor_id, _actor_name, _now, _stage_note, to_jsonb(_incident));
  RETURN _incident;
END;
$$;
REVOKE ALL ON FUNCTION private.advance_incident_stage_impl(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.advance_incident_stage_impl(uuid,text,text) TO authenticated, service_role;