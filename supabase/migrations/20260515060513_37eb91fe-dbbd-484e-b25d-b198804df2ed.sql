
-- 1. Manager helper: org owner or site owner only
CREATE OR REPLACE FUNCTION public.is_site_manager(_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = _site_id AND public.is_org_owner(s.organisation_id)
  ) OR EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.users u ON u.id = m.user_id
    WHERE m.site_id = _site_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND m.active = true
      AND m.site_role = 'owner'
  );
$$;

-- 2. Add columns
ALTER TABLE public.temp_logs
  ADD COLUMN IF NOT EXISTS is_retrospective boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retrospective_note text,
  ADD COLUMN IF NOT EXISTS retrospective_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retrospective_at timestamptz;

ALTER TABLE public.cleaning_logs
  ADD COLUMN IF NOT EXISTS is_retrospective boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retrospective_note text,
  ADD COLUMN IF NOT EXISTS retrospective_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retrospective_at timestamptz;

ALTER TABLE public.day_sheets
  ADD COLUMN IF NOT EXISTS is_retrospective boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retrospective_note text,
  ADD COLUMN IF NOT EXISTS retrospective_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retrospective_at timestamptz;

ALTER TABLE public.day_sheet_entries
  ADD COLUMN IF NOT EXISTS is_retrospective boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retrospective_note text,
  ADD COLUMN IF NOT EXISTS retrospective_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retrospective_at timestamptz;

-- 3. Generic trigger function: enforces retrospective tagging and audits
CREATE OR REPLACE FUNCTION public.tag_retrospective_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _date_col text := TG_ARGV[0];
  _record_date date;
  _site_id uuid;
  _org_id uuid;
  _actor uuid;
  _is_past boolean;
BEGIN
  -- Resolve record date
  IF TG_TABLE_NAME = 'day_sheet_entries' THEN
    SELECT ds.sheet_date, ds.site_id, ds.organisation_id
      INTO _record_date, _site_id, _org_id
      FROM public.day_sheets ds WHERE ds.id = NEW.day_sheet_id;
  ELSIF _date_col = 'logged_at' THEN
    _record_date := COALESCE((NEW.logged_at)::date, current_date);
    _site_id := NEW.site_id;
    _org_id := NEW.organisation_id;
  ELSIF _date_col = 'log_date' THEN
    _record_date := NEW.log_date;
    _site_id := NEW.site_id;
    _org_id := NEW.organisation_id;
  ELSIF _date_col = 'sheet_date' THEN
    _record_date := NEW.sheet_date;
    _site_id := NEW.site_id;
    _org_id := NEW.organisation_id;
  END IF;

  _is_past := _record_date < current_date;
  _actor := public.get_app_user_id();

  IF _is_past THEN
    IF NOT public.is_site_manager(_site_id) THEN
      RAISE EXCEPTION 'Only managers can edit records from past days' USING ERRCODE = '42501';
    END IF;
    NEW.is_retrospective := true;
    NEW.retrospective_by := COALESCE(NEW.retrospective_by, _actor);
    NEW.retrospective_at := COALESCE(NEW.retrospective_at, now());
    IF NEW.retrospective_note IS NULL OR length(trim(NEW.retrospective_note)) = 0 THEN
      NEW.retrospective_note := 'Retrospectively updated by ' ||
        COALESCE((SELECT display_name FROM public.users WHERE id = _actor), 'a manager') ||
        ' on ' || to_char(now(), 'YYYY-MM-DD');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Audit trail writer (AFTER)
CREATE OR REPLACE FUNCTION public.audit_retrospective_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _site_id uuid;
  _org_id uuid;
BEGIN
  IF NEW.is_retrospective IS DISTINCT FROM true THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_retrospective = true
     AND OLD.retrospective_at IS NOT DISTINCT FROM NEW.retrospective_at THEN
    RETURN NEW; -- no new retrospective event
  END IF;

  IF TG_TABLE_NAME = 'day_sheet_entries' THEN
    SELECT ds.site_id, ds.organisation_id INTO _site_id, _org_id
      FROM public.day_sheets ds WHERE ds.id = NEW.day_sheet_id;
  ELSE
    _site_id := NEW.site_id;
    _org_id := NEW.organisation_id;
  END IF;

  INSERT INTO public.audit_trail
    (organisation_id, site_id, actor_user_id, action, entity_type, entity_id, metadata_json)
  VALUES (
    _org_id, _site_id, NEW.retrospective_by,
    'retrospective_update', TG_TABLE_NAME, NEW.id::text,
    jsonb_build_object(
      'note', NEW.retrospective_note,
      'edited_at', NEW.retrospective_at,
      'op', TG_OP
    )
  );
  RETURN NEW;
END;
$$;

-- 5. Attach triggers
DROP TRIGGER IF EXISTS trg_retro_temp_logs ON public.temp_logs;
CREATE TRIGGER trg_retro_temp_logs BEFORE INSERT OR UPDATE ON public.temp_logs
  FOR EACH ROW EXECUTE FUNCTION public.tag_retrospective_edit('logged_at');
DROP TRIGGER IF EXISTS trg_retro_audit_temp_logs ON public.temp_logs;
CREATE TRIGGER trg_retro_audit_temp_logs AFTER INSERT OR UPDATE ON public.temp_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_retrospective_edit();

DROP TRIGGER IF EXISTS trg_retro_cleaning_logs ON public.cleaning_logs;
CREATE TRIGGER trg_retro_cleaning_logs BEFORE INSERT OR UPDATE ON public.cleaning_logs
  FOR EACH ROW EXECUTE FUNCTION public.tag_retrospective_edit('log_date');
DROP TRIGGER IF EXISTS trg_retro_audit_cleaning_logs ON public.cleaning_logs;
CREATE TRIGGER trg_retro_audit_cleaning_logs AFTER INSERT OR UPDATE ON public.cleaning_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_retrospective_edit();

DROP TRIGGER IF EXISTS trg_retro_day_sheets ON public.day_sheets;
CREATE TRIGGER trg_retro_day_sheets BEFORE INSERT OR UPDATE ON public.day_sheets
  FOR EACH ROW EXECUTE FUNCTION public.tag_retrospective_edit('sheet_date');
DROP TRIGGER IF EXISTS trg_retro_audit_day_sheets ON public.day_sheets;
CREATE TRIGGER trg_retro_audit_day_sheets AFTER INSERT OR UPDATE ON public.day_sheets
  FOR EACH ROW EXECUTE FUNCTION public.audit_retrospective_edit();

DROP TRIGGER IF EXISTS trg_retro_day_sheet_entries ON public.day_sheet_entries;
CREATE TRIGGER trg_retro_day_sheet_entries BEFORE INSERT OR UPDATE ON public.day_sheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.tag_retrospective_edit('parent');
DROP TRIGGER IF EXISTS trg_retro_audit_day_sheet_entries ON public.day_sheet_entries;
CREATE TRIGGER trg_retro_audit_day_sheet_entries AFTER INSERT OR UPDATE ON public.day_sheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_retrospective_edit();
