-- =========================================================================
-- SHIFT HIVE: Database foundation
-- =========================================================================

-- 1. ENUMS ----------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.shift_request_type AS ENUM ('swap', 'cover');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shift_request_status AS ENUM (
    'pending_teammate',   -- swap awaiting target user response
    'pending_approval',   -- awaiting manager approval
    'approved',
    'declined',
    'cancelled',          -- requester withdrew
    'expired'             -- shift passed without action
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. ALTER existing tables ------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);

ALTER TABLE public.rota_assignments
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid;

-- 3. site_compensation_settings ------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_compensation_settings (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  short_notice_hours integer NOT NULL DEFAULT 48,
  very_short_notice_hours integer NOT NULL DEFAULT 24,
  short_notice_pct numeric(5,2) NOT NULL DEFAULT 25.00,        -- 24-48h
  very_short_notice_pct numeric(5,2) NOT NULL DEFAULT 50.00,   -- <24h
  default_hourly_rate numeric(10,2),                            -- fallback if user has none
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_compensation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comp settings on accessible sites"
  ON public.site_compensation_settings FOR SELECT TO authenticated
  USING (public.has_site_access(site_id));

CREATE POLICY "Managers insert comp settings"
  ON public.site_compensation_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));

CREATE POLICY "Managers update comp settings"
  ON public.site_compensation_settings FOR UPDATE TO authenticated
  USING (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));

CREATE TRIGGER trg_site_comp_settings_updated
  BEFORE UPDATE ON public.site_compensation_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. shift_requests -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  original_shift_id uuid NOT NULL REFERENCES public.rota_assignments(id) ON DELETE CASCADE,
  request_type public.shift_request_type NOT NULL,
  requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- For swap: the proposed target. For cover: NULL = open pool, else specific person.
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- For swap: the target's shift being offered in exchange (optional).
  target_shift_id uuid REFERENCES public.rota_assignments(id) ON DELETE SET NULL,
  status public.shift_request_status NOT NULL DEFAULT 'pending_teammate',
  message text,
  manager_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  manager_decision_at timestamptz,
  manager_note text,
  teammate_responded_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_requests_site ON public.shift_requests(site_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_requests_requester ON public.shift_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_shift_requests_target ON public.shift_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_shift_requests_shift ON public.shift_requests(original_shift_id);

ALTER TABLE public.shift_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View shift requests on your site or targeting you"
  ON public.shift_requests FOR SELECT TO authenticated
  USING (
    public.has_site_access(site_id)
    AND (
      requester_id = public.get_app_user_id()
      OR target_user_id = public.get_app_user_id()
      OR target_user_id IS NULL  -- open cover pool visible to all on site
      OR public.is_site_supervisor_or_owner(site_id)
      OR public.is_org_owner(organisation_id)
    )
  );

CREATE POLICY "Staff create their own shift requests"
  ON public.shift_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = public.get_app_user_id()
    AND public.has_site_membership(site_id)
  );

CREATE POLICY "Requester, target, or manager can update"
  ON public.shift_requests FOR UPDATE TO authenticated
  USING (
    requester_id = public.get_app_user_id()
    OR target_user_id = public.get_app_user_id()
    OR public.is_site_supervisor_or_owner(site_id)
    OR public.is_org_owner(organisation_id)
  );

-- No DELETE policy: 7-year retention requirement.

CREATE TRIGGER trg_shift_requests_updated
  BEFORE UPDATE ON public.shift_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. shift_compensation_logs ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_compensation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.rota_assignments(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  shift_date date NOT NULL,
  shift_start time NOT NULL,
  shift_end time NOT NULL,
  shift_hours numeric(6,2) NOT NULL,
  hourly_rate_used numeric(10,2) NOT NULL,
  cancellation_reason text,
  notice_given_hours numeric(6,2) NOT NULL,
  pct_applied numeric(5,2) NOT NULL,
  compensation_amount numeric(10,2) NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  paid_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  payroll_export_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_comp_logs_site ON public.shift_compensation_logs(site_id, is_paid);
CREATE INDEX IF NOT EXISTS idx_comp_logs_user ON public.shift_compensation_logs(user_id);

ALTER TABLE public.shift_compensation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers view compensation logs"
  ON public.shift_compensation_logs FOR SELECT TO authenticated
  USING (
    public.is_site_supervisor_or_owner(site_id)
    OR public.is_org_owner(organisation_id)
    OR public.has_hq_access(organisation_id)
    OR user_id = public.get_app_user_id()  -- staff can see their own
  );

CREATE POLICY "System and managers insert compensation"
  ON public.shift_compensation_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_site_supervisor_or_owner(site_id)
    OR public.is_org_owner(organisation_id)
  );

CREATE POLICY "Managers update unpaid compensation"
  ON public.shift_compensation_logs FOR UPDATE TO authenticated
  USING (
    (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id))
    AND is_paid = false  -- locked once paid
  );

-- 6. staff_availability ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  notes text,
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_avail_user ON public.staff_availability(user_id, site_id);
CREATE INDEX IF NOT EXISTS idx_avail_site_day ON public.staff_availability(site_id, day_of_week);

ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View availability on accessible sites"
  ON public.staff_availability FOR SELECT TO authenticated
  USING (public.has_site_access(site_id));

CREATE POLICY "Staff manage their own availability"
  ON public.staff_availability FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.get_app_user_id()
    OR public.is_site_supervisor_or_owner(site_id)
  );

CREATE POLICY "Staff update their own availability"
  ON public.staff_availability FOR UPDATE TO authenticated
  USING (
    user_id = public.get_app_user_id()
    OR public.is_site_supervisor_or_owner(site_id)
  );

CREATE POLICY "Staff delete their own availability"
  ON public.staff_availability FOR DELETE TO authenticated
  USING (
    user_id = public.get_app_user_id()
    OR public.is_site_supervisor_or_owner(site_id)
  );

CREATE TRIGGER trg_staff_avail_updated
  BEFORE UPDATE ON public.staff_availability
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. rota_audit_trail -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rota_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  rota_assignment_id uuid,  -- not FK so deletes preserve audit
  action text NOT NULL,     -- 'created' | 'updated' | 'deleted' | 'cancelled' | 'swapped'
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name text,
  before_data jsonb,
  after_data jsonb,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rota_audit_site ON public.rota_audit_trail(site_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_rota_audit_assignment ON public.rota_audit_trail(rota_assignment_id);

ALTER TABLE public.rota_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and HQ view rota audit"
  ON public.rota_audit_trail FOR SELECT TO authenticated
  USING (
    public.is_site_supervisor_or_owner(site_id)
    OR public.is_org_owner(organisation_id)
    OR public.has_hq_access(organisation_id)
  );

CREATE POLICY "System inserts rota audit"
  ON public.rota_audit_trail FOR INSERT TO authenticated
  WITH CHECK (public.has_site_access(site_id));

-- 8. TRIGGER: auto-audit rota_assignments ---------------------------------
CREATE OR REPLACE FUNCTION public.trg_audit_rota_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := get_app_user_id();
  _actor_name text;
  _action text;
BEGIN
  SELECT display_name INTO _actor_name FROM public.users WHERE id = _actor;

  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    INSERT INTO public.rota_audit_trail
      (organisation_id, site_id, rota_assignment_id, action, actor_user_id, actor_name, after_data)
    VALUES
      (NEW.organisation_id, NEW.site_id, NEW.id, _action, _actor, _actor_name, to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL THEN
      _action := 'cancelled';
    ELSIF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      _action := 'swapped';
    ELSE
      _action := 'updated';
    END IF;
    INSERT INTO public.rota_audit_trail
      (organisation_id, site_id, rota_assignment_id, action, actor_user_id, actor_name, before_data, after_data)
    VALUES
      (NEW.organisation_id, NEW.site_id, NEW.id, _action, _actor, _actor_name, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.rota_audit_trail
      (organisation_id, site_id, rota_assignment_id, action, actor_user_id, actor_name, before_data)
    VALUES
      (OLD.organisation_id, OLD.site_id, OLD.id, 'deleted', _actor, _actor_name, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_rota_audit ON public.rota_assignments;
CREATE TRIGGER trg_rota_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.rota_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_rota_assignment();

-- 9. TRIGGER: auto-create compensation log on late cancellation -----------
-- Fires when a rota_assignment is DELETED. Computes notice hours, looks up
-- the user's hourly rate (with fallback chain), applies the site's % rule,
-- and writes a shift_compensation_logs row only if within short-notice window.
CREATE OR REPLACE FUNCTION public.trg_compensation_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _settings RECORD;
  _user_rate numeric;
  _org_rate numeric;
  _final_rate numeric;
  _hours_until numeric;
  _shift_hours numeric;
  _pct numeric;
  _amount numeric;
  _actor uuid := get_app_user_id();
BEGIN
  -- Only operate on DELETE of a published assignment in the future.
  IF OLD.published_at IS NULL THEN RETURN OLD; END IF;
  IF (OLD.shift_date::timestamptz + OLD.start_time::time) <= now() THEN RETURN OLD; END IF;

  SELECT * INTO _settings FROM public.site_compensation_settings WHERE site_id = OLD.site_id;
  -- If no settings, create defaults so future cancels work
  IF _settings IS NULL THEN
    INSERT INTO public.site_compensation_settings (site_id, organisation_id)
    VALUES (OLD.site_id, OLD.organisation_id)
    ON CONFLICT (site_id) DO NOTHING;
    SELECT * INTO _settings FROM public.site_compensation_settings WHERE site_id = OLD.site_id;
  END IF;

  _hours_until := EXTRACT(EPOCH FROM ((OLD.shift_date::timestamptz + OLD.start_time::time) - now())) / 3600;

  -- Outside short-notice window → no compensation
  IF _hours_until >= _settings.short_notice_hours THEN RETURN OLD; END IF;

  -- Determine % to apply
  IF _hours_until < _settings.very_short_notice_hours THEN
    _pct := _settings.very_short_notice_pct;
  ELSE
    _pct := _settings.short_notice_pct;
  END IF;

  -- Resolve hourly rate: user → site default → org default → 12.00
  SELECT hourly_rate INTO _user_rate FROM public.users WHERE id = OLD.user_id;
  SELECT labour_hourly_rate INTO _org_rate FROM public.org_cost_settings WHERE organisation_id = OLD.organisation_id;
  _final_rate := COALESCE(_user_rate, _settings.default_hourly_rate, _org_rate, 12.00);

  -- Compute shift hours (handle overnight)
  _shift_hours := EXTRACT(EPOCH FROM (OLD.end_time::time - OLD.start_time::time)) / 3600;
  IF _shift_hours < 0 THEN _shift_hours := _shift_hours + 24; END IF;

  _amount := ROUND(_shift_hours * _final_rate * (_pct / 100.0), 2);

  INSERT INTO public.shift_compensation_logs (
    organisation_id, site_id, shift_id, user_id,
    shift_date, shift_start, shift_end, shift_hours,
    hourly_rate_used, cancellation_reason, notice_given_hours,
    pct_applied, compensation_amount, created_by_user_id
  ) VALUES (
    OLD.organisation_id, OLD.site_id, OLD.id, OLD.user_id,
    OLD.shift_date, OLD.start_time, OLD.end_time, _shift_hours,
    _final_rate, OLD.cancellation_reason, _hours_until,
    _pct, _amount, _actor
  );

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_rota_compensation ON public.rota_assignments;
CREATE TRIGGER trg_rota_compensation
  BEFORE DELETE ON public.rota_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trg_compensation_on_cancel();

-- 10. TRIGGER: post Messenger card when shift_request is approved ---------
CREATE OR REPLACE FUNCTION public.trg_messenger_shift_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel_id uuid;
  _content text;
  _requester_name text;
  _target_name text;
  _kind text;
  _payload jsonb;
BEGIN
  IF NEW.status NOT IN ('approved','declined') THEN RETURN NEW; END IF;
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT id INTO _channel_id FROM public.messenger_channels
  WHERE site_id = NEW.site_id AND name = 'notifications' AND is_system LIMIT 1;
  IF _channel_id IS NULL THEN RETURN NEW; END IF;

  SELECT display_name INTO _requester_name FROM public.users WHERE id = NEW.requester_id;
  IF NEW.target_user_id IS NOT NULL THEN
    SELECT display_name INTO _target_name FROM public.users WHERE id = NEW.target_user_id;
  END IF;

  IF NEW.status = 'approved' THEN
    IF NEW.request_type = 'swap' THEN
      _kind := 'swap_approved';
      _content := format('🔄 Shift swap approved: %s ↔ %s', _requester_name, COALESCE(_target_name,'teammate'));
    ELSE
      _kind := 'cover_approved';
      _content := format('✅ Cover approved: %s will cover %s''s shift', COALESCE(_target_name,'a teammate'), _requester_name);
    END IF;
  ELSE
    _kind := NEW.request_type || '_declined';
    _content := format('❌ %s request declined for %s', initcap(NEW.request_type::text), _requester_name);
  END IF;

  _payload := jsonb_build_object(
    'kind', _kind,
    'request_id', NEW.id,
    'request_type', NEW.request_type,
    'requester_id', NEW.requester_id,
    'requester_name', _requester_name,
    'target_user_id', NEW.target_user_id,
    'target_name', _target_name,
    'shift_id', NEW.original_shift_id
  );

  INSERT INTO public.messenger_messages
    (channel_id, site_id, sender_id, sender_name_snapshot, content, message_type, system_payload)
  VALUES
    (_channel_id, NEW.site_id, NULL, 'System', _content, 'shift_card', _payload);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shift_request_messenger ON public.shift_requests;
CREATE TRIGGER trg_shift_request_messenger
  AFTER UPDATE ON public.shift_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_messenger_shift_request();

-- 11. Helper function: weekly hours for a user ---------------------------
CREATE OR REPLACE FUNCTION public.get_user_weekly_hours(_user_id uuid, _week_start date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN end_time > start_time
        THEN EXTRACT(EPOCH FROM (end_time::time - start_time::time)) / 3600
      ELSE EXTRACT(EPOCH FROM (end_time::time - start_time::time)) / 3600 + 24
    END
  ), 0)::numeric
  FROM public.rota_assignments
  WHERE user_id = _user_id
    AND cancelled_at IS NULL
    AND shift_date >= _week_start
    AND shift_date < _week_start + 7;
$$;

-- 12. Helper function: clopen detection (last shift end → next shift start)
CREATE OR REPLACE FUNCTION public.has_clopen_conflict(
  _user_id uuid,
  _shift_date date,
  _start_time time,
  _end_time time,
  _exclude_assignment_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rota_assignments
    WHERE user_id = _user_id
      AND cancelled_at IS NULL
      AND (id IS DISTINCT FROM _exclude_assignment_id)
      AND (
        -- Previous-day shift ending late, this shift starting early next day
        (shift_date = _shift_date - 1
          AND EXTRACT(EPOCH FROM (_shift_date::timestamptz + _start_time)
                                - (shift_date::timestamptz + end_time::time)) < 11 * 3600)
        OR
        -- This shift ending late, next-day shift starting early
        (shift_date = _shift_date + 1
          AND EXTRACT(EPOCH FROM (shift_date::timestamptz + start_time::time)
                                - (_shift_date::timestamptz + _end_time)) < 11 * 3600)
      )
  );
$$;