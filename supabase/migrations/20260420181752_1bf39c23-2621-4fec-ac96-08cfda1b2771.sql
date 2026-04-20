CREATE TABLE public.closed_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  site_id uuid NOT NULL,
  closed_date date NOT NULL,
  reason text,
  closed_by_user_id uuid,
  closed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, closed_date)
);

ALTER TABLE public.closed_days ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is owner or supervisor on a site
CREATE OR REPLACE FUNCTION public.is_site_supervisor_or_owner(_site_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.users u ON u.id = m.user_id
    WHERE m.site_id = _site_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND m.active = true
      AND m.site_role IN ('owner','supervisor')
  ) OR EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = _site_id AND public.is_org_owner(s.organisation_id)
  );
$$;

CREATE POLICY "View closed days"
ON public.closed_days FOR SELECT TO authenticated
USING (has_site_access(site_id));

CREATE POLICY "Owners/Supervisors can close days"
ON public.closed_days FOR INSERT TO authenticated
WITH CHECK (is_site_supervisor_or_owner(site_id) AND organisation_id = get_user_org_id());

CREATE POLICY "Owners/Supervisors can reopen days"
ON public.closed_days FOR DELETE TO authenticated
USING (is_site_supervisor_or_owner(site_id));

CREATE INDEX idx_closed_days_site_date ON public.closed_days (site_id, closed_date);