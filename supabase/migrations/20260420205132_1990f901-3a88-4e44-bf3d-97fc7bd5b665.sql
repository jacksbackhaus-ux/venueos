-- Per-date rota assignments table
CREATE TABLE public.rota_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  position TEXT,
  created_by_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rota_assignments_site_date ON public.rota_assignments(site_id, shift_date);
CREATE INDEX idx_rota_assignments_user_date ON public.rota_assignments(user_id, shift_date);

ALTER TABLE public.rota_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View rota assignments"
  ON public.rota_assignments FOR SELECT
  TO authenticated
  USING (public.has_site_access(site_id));

CREATE POLICY "Owners/Supervisors can insert rota assignments"
  ON public.rota_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_site_supervisor_or_owner(site_id) AND organisation_id = public.get_user_org_id());

CREATE POLICY "Owners/Supervisors can update rota assignments"
  ON public.rota_assignments FOR UPDATE
  TO authenticated
  USING (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Owners/Supervisors can delete rota assignments"
  ON public.rota_assignments FOR DELETE
  TO authenticated
  USING (public.is_site_supervisor_or_owner(site_id));

CREATE TRIGGER update_rota_assignments_updated_at
  BEFORE UPDATE ON public.rota_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();