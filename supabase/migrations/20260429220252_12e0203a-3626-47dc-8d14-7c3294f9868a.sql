CREATE TABLE public.holiday_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_holiday_requests_site ON public.holiday_requests(site_id);
CREATE INDEX idx_holiday_requests_user ON public.holiday_requests(user_id);
CREATE INDEX idx_holiday_requests_dates ON public.holiday_requests(start_date, end_date);

ALTER TABLE public.holiday_requests ENABLE ROW LEVEL SECURITY;

-- Staff: view own requests
CREATE POLICY "Staff can view own holiday requests"
ON public.holiday_requests FOR SELECT
USING (user_id = public.get_app_user_id());

-- Staff: insert own requests
CREATE POLICY "Staff can create own holiday requests"
ON public.holiday_requests FOR INSERT
WITH CHECK (
  user_id = public.get_app_user_id()
  AND public.has_site_access(site_id)
);

-- Supervisors/Managers: view all for their site
CREATE POLICY "Supervisors can view site holiday requests"
ON public.holiday_requests FOR SELECT
USING (public.is_site_supervisor_or_owner(site_id));

-- Supervisors/Managers: insert for any user on their site
CREATE POLICY "Supervisors can create site holiday requests"
ON public.holiday_requests FOR INSERT
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

-- Supervisors/Managers: update
CREATE POLICY "Supervisors can update site holiday requests"
ON public.holiday_requests FOR UPDATE
USING (public.is_site_supervisor_or_owner(site_id));

-- Supervisors/Managers: delete
CREATE POLICY "Supervisors can delete site holiday requests"
ON public.holiday_requests FOR DELETE
USING (public.is_site_supervisor_or_owner(site_id));

CREATE TRIGGER trg_holiday_requests_updated_at
BEFORE UPDATE ON public.holiday_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();