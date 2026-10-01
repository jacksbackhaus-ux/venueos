CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.temp_unit_schedule_versions
  ADD CONSTRAINT temp_unit_schedule_versions_no_overlap
  EXCLUDE USING gist (
    temp_unit_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[)') WITH &&
  );

ALTER TABLE public.cleaning_task_schedule_versions
  ADD CONSTRAINT cleaning_task_schedule_versions_no_overlap
  EXCLUDE USING gist (
    cleaning_task_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[)') WITH &&
  );

CREATE OR REPLACE FUNCTION public.create_schedule_history_cutover_for_site()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.schedule_history_cutovers
      (site_id, organisation_id, cutover_date, site_timezone)
    VALUES
      (NEW.id, NEW.organisation_id, (now() AT TIME ZONE COALESCE(NEW.timezone, 'Europe/London'))::date, COALESCE(NEW.timezone, 'Europe/London'))
    ON CONFLICT (site_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.record_schedule_history_failure('sites', NEW.id, TG_OP, NEW.id, NEW.organisation_id, SQLERRM);
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_schedule_history_cutover_for_site() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER create_schedule_history_cutover_after_site_insert
AFTER INSERT ON public.sites
FOR EACH ROW EXECUTE FUNCTION public.create_schedule_history_cutover_for_site();