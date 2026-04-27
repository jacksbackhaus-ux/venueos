-- ============ timesheet_entries ============
CREATE TABLE public.timesheet_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  shift_id UUID,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_timesheet_entries_site_date ON public.timesheet_entries (site_id, clock_in);
CREATE INDEX idx_timesheet_entries_user_date ON public.timesheet_entries (user_id, clock_in);
CREATE INDEX idx_timesheet_entries_open ON public.timesheet_entries (user_id) WHERE clock_out IS NULL;

ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

-- Staff can view their own entries
CREATE POLICY "Staff view own entries"
ON public.timesheet_entries FOR SELECT
TO authenticated
USING (user_id = public.get_app_user_id() AND public.has_site_access(site_id));

-- Supervisors/managers view all entries on their site
CREATE POLICY "Supervisors view all site entries"
ON public.timesheet_entries FOR SELECT
TO authenticated
USING (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id) OR public.has_hq_access(organisation_id));

-- Staff insert own entries
CREATE POLICY "Staff insert own entries"
ON public.timesheet_entries FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_app_user_id()
  AND public.has_site_access(site_id)
  AND organisation_id = public.get_user_org_id()
);

-- Supervisors can insert any entry on their site
CREATE POLICY "Supervisors insert any site entries"
ON public.timesheet_entries FOR INSERT
TO authenticated
WITH CHECK (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));

-- Staff can update their own open entry (e.g., clocking out)
CREATE POLICY "Staff update own entries"
ON public.timesheet_entries FOR UPDATE
TO authenticated
USING (user_id = public.get_app_user_id() AND public.has_site_access(site_id));

-- Supervisors can update/approve any site entry
CREATE POLICY "Supervisors update any site entries"
ON public.timesheet_entries FOR UPDATE
TO authenticated
USING (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));

-- updated_at trigger
CREATE TRIGGER trg_timesheet_entries_touch
BEFORE UPDATE ON public.timesheet_entries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ============ timesheet_export_logs ============
CREATE TABLE public.timesheet_export_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL,
  exported_by UUID NOT NULL,
  export_type TEXT NOT NULL DEFAULT 'csv',
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_timesheet_export_logs_site ON public.timesheet_export_logs (site_id, created_at DESC);

ALTER TABLE public.timesheet_export_logs ENABLE ROW LEVEL SECURITY;

-- View export logs for accessible site
CREATE POLICY "View export logs on accessible site"
ON public.timesheet_export_logs FOR SELECT
TO authenticated
USING (public.has_site_access(site_id));

-- Only supervisors/managers can record exports
CREATE POLICY "Supervisors insert export logs"
ON public.timesheet_export_logs FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id))
  AND exported_by = public.get_app_user_id()
  AND organisation_id = public.get_user_org_id()
);
