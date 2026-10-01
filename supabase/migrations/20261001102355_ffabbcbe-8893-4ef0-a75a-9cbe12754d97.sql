CREATE TABLE public.schedule_history_cutovers (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  cutover_date date NOT NULL,
  site_timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.schedule_history_cutovers TO authenticated;
GRANT ALL ON public.schedule_history_cutovers TO service_role;
ALTER TABLE public.schedule_history_cutovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View schedule history cutovers" ON public.schedule_history_cutovers
  FOR SELECT TO authenticated USING (public.has_site_access(site_id));

CREATE TABLE public.temp_unit_schedule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temp_unit_id uuid NOT NULL REFERENCES public.temp_units(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  effective_from date NOT NULL,
  effective_to date,
  name text NOT NULL,
  unit_type text NOT NULL,
  min_temp numeric(5,1) NOT NULL,
  max_temp numeric(5,1) NOT NULL,
  expected_check_types text[] NOT NULL DEFAULT ARRAY['AM Check','PM Check']::text[],
  scheduled boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES public.users(id),
  created_by_name text NOT NULL DEFAULT 'System',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT temp_unit_schedule_valid_period CHECK (effective_to IS NULL OR effective_to > effective_from)
);
GRANT SELECT ON public.temp_unit_schedule_versions TO authenticated;
GRANT ALL ON public.temp_unit_schedule_versions TO service_role;
ALTER TABLE public.temp_unit_schedule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View temperature schedule history" ON public.temp_unit_schedule_versions
  FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE INDEX temp_unit_schedule_versions_lookup_idx
  ON public.temp_unit_schedule_versions(temp_unit_id, effective_from, effective_to);
CREATE UNIQUE INDEX temp_unit_schedule_versions_one_open_idx
  ON public.temp_unit_schedule_versions(temp_unit_id) WHERE effective_to IS NULL;

CREATE TABLE public.cleaning_task_schedule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaning_task_id uuid NOT NULL REFERENCES public.cleaning_tasks(id),
  site_id uuid NOT NULL REFERENCES public.sites(id),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id),
  effective_from date NOT NULL,
  effective_to date,
  area text NOT NULL,
  task text NOT NULL,
  frequency text NOT NULL,
  due_time text,
  assigned_to_name text,
  scheduled boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES public.users(id),
  created_by_name text NOT NULL DEFAULT 'System',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cleaning_task_schedule_valid_period CHECK (effective_to IS NULL OR effective_to > effective_from)
);
GRANT SELECT ON public.cleaning_task_schedule_versions TO authenticated;
GRANT ALL ON public.cleaning_task_schedule_versions TO service_role;
ALTER TABLE public.cleaning_task_schedule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View cleaning schedule history" ON public.cleaning_task_schedule_versions
  FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE INDEX cleaning_task_schedule_versions_lookup_idx
  ON public.cleaning_task_schedule_versions(cleaning_task_id, effective_from, effective_to);
CREATE UNIQUE INDEX cleaning_task_schedule_versions_one_open_idx
  ON public.cleaning_task_schedule_versions(cleaning_task_id) WHERE effective_to IS NULL;

CREATE TABLE public.schedule_history_write_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid,
  operation text NOT NULL,
  site_id uuid,
  organisation_id uuid,
  error_message text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.schedule_history_write_failures TO service_role;
ALTER TABLE public.schedule_history_write_failures ENABLE ROW LEVEL SECURITY;

INSERT INTO public.schedule_history_cutovers (site_id, organisation_id, cutover_date, site_timezone)
SELECT s.id, s.organisation_id, ((now() AT TIME ZONE s.timezone)::date + 1), s.timezone
FROM public.sites s
ON CONFLICT (site_id) DO NOTHING;

INSERT INTO public.temp_unit_schedule_versions (
  temp_unit_id, site_id, organisation_id, effective_from, name, unit_type,
  min_temp, max_temp, expected_check_types, scheduled, created_by_name
)
SELECT u.id, u.site_id, u.organisation_id, c.cutover_date, u.name, u.type,
       u.min_temp, u.max_temp, ARRAY['AM Check','PM Check']::text[], true, 'History cutover'
FROM public.temp_units u
JOIN public.schedule_history_cutovers c ON c.site_id = u.site_id
WHERE u.active = true AND u.deleted_at IS NULL;

INSERT INTO public.cleaning_task_schedule_versions (
  cleaning_task_id, site_id, organisation_id, effective_from, area, task,
  frequency, due_time, assigned_to_name, scheduled, created_by_name
)
SELECT t.id, t.site_id, t.organisation_id, c.cutover_date, t.area, t.task,
       t.frequency, t.due_time, t.assigned_to_name, true, 'History cutover'
FROM public.cleaning_tasks t
JOIN public.schedule_history_cutovers c ON c.site_id = t.site_id
WHERE t.active = true AND t.deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.schedule_history_actor()
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id, u.display_name
  FROM public.users u
  WHERE u.id = public.get_app_user_id()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.record_schedule_history_failure(
  _source_table text, _source_id uuid, _operation text,
  _site_id uuid, _organisation_id uuid, _error_message text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.schedule_history_write_failures
      (source_table, source_id, operation, site_id, organisation_id, error_message)
    VALUES
      (_source_table, _source_id, _operation, _site_id, _organisation_id, left(_error_message, 2000));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_temp_unit_schedule_history()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _today date;
  _actor_id uuid;
  _actor_name text := 'System';
  _open public.temp_unit_schedule_versions%ROWTYPE;
  _should_be_open boolean;
BEGIN
  BEGIN
    SELECT (now() AT TIME ZONE COALESCE(s.timezone, 'Europe/London'))::date
      INTO _today FROM public.sites s WHERE s.id = NEW.site_id;
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
      IF _open.effective_from < _today THEN
        UPDATE public.temp_unit_schedule_versions SET effective_to = _today WHERE id = _open.id;
      ELSE
        DELETE FROM public.temp_unit_schedule_versions WHERE id = _open.id;
      END IF;
    END IF;

    IF _should_be_open THEN
      INSERT INTO public.temp_unit_schedule_versions
        (temp_unit_id, site_id, organisation_id, effective_from, name, unit_type,
         min_temp, max_temp, expected_check_types, scheduled, created_by_user_id, created_by_name)
      VALUES
        (NEW.id, NEW.site_id, NEW.organisation_id, _today, NEW.name, NEW.type,
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
  _actor_id uuid;
  _actor_name text := 'System';
  _open public.cleaning_task_schedule_versions%ROWTYPE;
  _should_be_open boolean;
BEGIN
  BEGIN
    SELECT (now() AT TIME ZONE COALESCE(s.timezone, 'Europe/London'))::date
      INTO _today FROM public.sites s WHERE s.id = NEW.site_id;
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
      IF _open.effective_from < _today THEN
        UPDATE public.cleaning_task_schedule_versions SET effective_to = _today WHERE id = _open.id;
      ELSE
        DELETE FROM public.cleaning_task_schedule_versions WHERE id = _open.id;
      END IF;
    END IF;

    IF _should_be_open THEN
      INSERT INTO public.cleaning_task_schedule_versions
        (cleaning_task_id, site_id, organisation_id, effective_from, area, task,
         frequency, due_time, assigned_to_name, scheduled, created_by_user_id, created_by_name)
      VALUES
        (NEW.id, NEW.site_id, NEW.organisation_id, _today, NEW.area, NEW.task,
         NEW.frequency, NEW.due_time, NEW.assigned_to_name, true, _actor_id, _actor_name);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.record_schedule_history_failure('cleaning_tasks', NEW.id, TG_OP, NEW.site_id, NEW.organisation_id, SQLERRM);
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_temp_unit_schedule_history_after_write
AFTER INSERT OR UPDATE ON public.temp_units
FOR EACH ROW EXECUTE FUNCTION public.sync_temp_unit_schedule_history();

CREATE TRIGGER sync_cleaning_task_schedule_history_after_write
AFTER INSERT OR UPDATE ON public.cleaning_tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_cleaning_task_schedule_history();