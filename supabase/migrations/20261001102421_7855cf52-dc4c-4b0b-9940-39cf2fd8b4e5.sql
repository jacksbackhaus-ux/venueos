CREATE POLICY "Internal schedule history failures are service-only"
ON public.schedule_history_write_failures
FOR ALL TO authenticated
USING (false) WITH CHECK (false);

REVOKE ALL ON FUNCTION public.schedule_history_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_schedule_history_failure(text, uuid, text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_temp_unit_schedule_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_cleaning_task_schedule_history() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_temp_unit_schedule_history()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _today date;
  _effective_date date;
  _actor_id uuid;
  _actor_name text := 'System';
  _open public.temp_unit_schedule_versions%ROWTYPE;
  _should_be_open boolean;
BEGIN
  BEGIN
    SELECT (now() AT TIME ZONE COALESCE(s.timezone, 'Europe/London'))::date
      INTO _today FROM public.sites s WHERE s.id = NEW.site_id;
    SELECT greatest(_today, c.cutover_date) INTO _effective_date
      FROM public.schedule_history_cutovers c WHERE c.site_id = NEW.site_id;
    _effective_date := COALESCE(_effective_date, _today);
    SELECT a.user_id, a.display_name INTO _actor_id, _actor_name
      FROM public.schedule_history_actor() a;
    _actor_name := COALESCE(_actor_name, 'System');
    _should_be_open := NEW.active AND NEW.deleted_at IS NULL;

    IF TG_OP = 'INSERT' THEN
      IF _should_be_open THEN
        INSERT INTO public.temp_unit_schedule_versions
          (temp_unit_id, site_id, organisation_id, effective_from, name, unit_type,
           min_temp, max_temp, expected_check_types, scheduled, created_by_user_id, created_by_name)
        VALUES
          (NEW.id, NEW.site_id, NEW.organisation_id, _today, NEW.name, NEW.type,
           NEW.min_temp, NEW.max_temp, ARRAY['AM Check','PM Check']::text[], true, _actor_id, _actor_name);
      END IF;
      RETURN NEW;
    END IF;

    IF NOT (OLD.name IS DISTINCT FROM NEW.name OR OLD.type IS DISTINCT FROM NEW.type OR
            OLD.min_temp IS DISTINCT FROM NEW.min_temp OR OLD.max_temp IS DISTINCT FROM NEW.max_temp OR
            OLD.active IS DISTINCT FROM NEW.active OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
      RETURN NEW;
    END IF;

    SELECT * INTO _open FROM public.temp_unit_schedule_versions
      WHERE temp_unit_id = NEW.id AND effective_to IS NULL FOR UPDATE;

    IF FOUND THEN
      IF _open.effective_from < _effective_date THEN
        UPDATE public.temp_unit_schedule_versions SET effective_to = _effective_date WHERE id = _open.id;
      ELSE
        DELETE FROM public.temp_unit_schedule_versions WHERE id = _open.id;
      END IF;
    END IF;

    IF _should_be_open THEN
      INSERT INTO public.temp_unit_schedule_versions
        (temp_unit_id, site_id, organisation_id, effective_from, name, unit_type,
         min_temp, max_temp, expected_check_types, scheduled, created_by_user_id, created_by_name)
      VALUES
        (NEW.id, NEW.site_id, NEW.organisation_id, _effective_date, NEW.name, NEW.type,
         NEW.min_temp, NEW.max_temp, ARRAY['AM Check','PM Check']::text[], true, _actor_id, _actor_name);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.record_schedule_history_failure('temp_units', NEW.id, TG_OP, NEW.site_id, NEW.organisation_id, SQLERRM);
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_cleaning_task_schedule_history()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _today date;
  _effective_date date;
  _actor_id uuid;
  _actor_name text := 'System';
  _open public.cleaning_task_schedule_versions%ROWTYPE;
  _should_be_open boolean;
BEGIN
  BEGIN
    SELECT (now() AT TIME ZONE COALESCE(s.timezone, 'Europe/London'))::date
      INTO _today FROM public.sites s WHERE s.id = NEW.site_id;
    SELECT greatest(_today, c.cutover_date) INTO _effective_date
      FROM public.schedule_history_cutovers c WHERE c.site_id = NEW.site_id;
    _effective_date := COALESCE(_effective_date, _today);
    SELECT a.user_id, a.display_name INTO _actor_id, _actor_name
      FROM public.schedule_history_actor() a;
    _actor_name := COALESCE(_actor_name, 'System');
    _should_be_open := NEW.active AND NEW.deleted_at IS NULL;

    IF TG_OP = 'INSERT' THEN
      IF _should_be_open THEN
        INSERT INTO public.cleaning_task_schedule_versions
          (cleaning_task_id, site_id, organisation_id, effective_from, area, task,
           frequency, due_time, assigned_to_name, scheduled, created_by_user_id, created_by_name)
        VALUES
          (NEW.id, NEW.site_id, NEW.organisation_id, _today, NEW.area, NEW.task,
           NEW.frequency, NEW.due_time, NEW.assigned_to_name, true, _actor_id, _actor_name);
      END IF;
      RETURN NEW;
    END IF;

    IF NOT (OLD.area IS DISTINCT FROM NEW.area OR OLD.task IS DISTINCT FROM NEW.task OR
            OLD.frequency IS DISTINCT FROM NEW.frequency OR OLD.due_time IS DISTINCT FROM NEW.due_time OR
            OLD.assigned_to_name IS DISTINCT FROM NEW.assigned_to_name OR OLD.active IS DISTINCT FROM NEW.active OR
            OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
      RETURN NEW;
    END IF;

    SELECT * INTO _open FROM public.cleaning_task_schedule_versions
      WHERE cleaning_task_id = NEW.id AND effective_to IS NULL FOR UPDATE;

    IF FOUND THEN
      IF _open.effective_from < _effective_date THEN
        UPDATE public.cleaning_task_schedule_versions SET effective_to = _effective_date WHERE id = _open.id;
      ELSE
        DELETE FROM public.cleaning_task_schedule_versions WHERE id = _open.id;
      END IF;
    END IF;

    IF _should_be_open THEN
      INSERT INTO public.cleaning_task_schedule_versions
        (cleaning_task_id, site_id, organisation_id, effective_from, area, task,
         frequency, due_time, assigned_to_name, scheduled, created_by_user_id, created_by_name)
      VALUES
        (NEW.id, NEW.site_id, NEW.organisation_id, _effective_date, NEW.area, NEW.task,
         NEW.frequency, NEW.due_time, NEW.assigned_to_name, true, _actor_id, _actor_name);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.record_schedule_history_failure('cleaning_tasks', NEW.id, TG_OP, NEW.site_id, NEW.organisation_id, SQLERRM);
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_temp_unit_schedule_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_cleaning_task_schedule_history() FROM PUBLIC, anon, authenticated;