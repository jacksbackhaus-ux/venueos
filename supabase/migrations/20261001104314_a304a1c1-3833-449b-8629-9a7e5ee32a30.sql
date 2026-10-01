REVOKE UPDATE, DELETE, TRUNCATE ON public.incident_stage_events FROM service_role;

CREATE OR REPLACE FUNCTION public.record_incident_reported_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.incident_stage_events
      (incident_id, organisation_id, site_id, stage, actor_user_id, actor_name, occurred_at, note, snapshot)
    VALUES
      (NEW.id, NEW.organisation_id, NEW.site_id, 'reported', NEW.reported_by_user_id,
       NEW.reported_by_name, NEW.reported_at, NEW.description, to_jsonb(NEW));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_incident_reported_stage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_incident_reported_stage() TO service_role;

CREATE TRIGGER incidents_record_reported_stage
AFTER INSERT ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.record_incident_reported_stage();