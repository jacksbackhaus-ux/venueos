-- ============ tip_pools ============
CREATE TABLE public.tip_pools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL,
  date DATE NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  distribution_method TEXT NOT NULL DEFAULT 'equal',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tip_pools_method_chk CHECK (distribution_method IN ('equal','hours','manual')),
  CONSTRAINT tip_pools_status_chk CHECK (status IN ('draft','confirmed','exported'))
);

CREATE INDEX idx_tip_pools_site_date ON public.tip_pools (site_id, date DESC);

ALTER TABLE public.tip_pools ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_tip_pools_touch
BEFORE UPDATE ON public.tip_pools
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ============ tip_allocations ============
CREATE TABLE public.tip_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tip_pool_id UUID NOT NULL REFERENCES public.tip_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  hours_worked NUMERIC(6,2),
  tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tip_allocations_pool ON public.tip_allocations (tip_pool_id);
CREATE INDEX idx_tip_allocations_user ON public.tip_allocations (user_id);

ALTER TABLE public.tip_allocations ENABLE ROW LEVEL SECURITY;


-- ============ Policies (after both tables exist) ============

-- tip_pools policies
CREATE POLICY "Supervisors view tip pools on site"
ON public.tip_pools FOR SELECT
TO authenticated
USING (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id) OR public.has_hq_access(organisation_id));

CREATE POLICY "Staff view pools they share in"
ON public.tip_pools FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tip_allocations a
    WHERE a.tip_pool_id = tip_pools.id
      AND a.user_id = public.get_app_user_id()
  )
);

CREATE POLICY "Supervisors insert tip pools"
ON public.tip_pools FOR INSERT
TO authenticated
WITH CHECK (
  (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id))
  AND organisation_id = public.get_user_org_id()
);

CREATE POLICY "Supervisors update tip pools"
ON public.tip_pools FOR UPDATE
TO authenticated
USING (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));

CREATE POLICY "Supervisors delete tip pools"
ON public.tip_pools FOR DELETE
TO authenticated
USING (public.is_site_supervisor_or_owner(site_id) OR public.is_org_owner(organisation_id));


-- tip_allocations policies
CREATE POLICY "Staff view own allocations"
ON public.tip_allocations FOR SELECT
TO authenticated
USING (user_id = public.get_app_user_id());

CREATE POLICY "Supervisors view all allocations on site"
ON public.tip_allocations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tip_pools p
    WHERE p.id = tip_allocations.tip_pool_id
      AND (public.is_site_supervisor_or_owner(p.site_id) OR public.is_org_owner(p.organisation_id) OR public.has_hq_access(p.organisation_id))
  )
);

CREATE POLICY "Supervisors insert allocations"
ON public.tip_allocations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tip_pools p
    WHERE p.id = tip_allocations.tip_pool_id
      AND (public.is_site_supervisor_or_owner(p.site_id) OR public.is_org_owner(p.organisation_id))
  )
);

CREATE POLICY "Supervisors update allocations"
ON public.tip_allocations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tip_pools p
    WHERE p.id = tip_allocations.tip_pool_id
      AND (public.is_site_supervisor_or_owner(p.site_id) OR public.is_org_owner(p.organisation_id))
  )
);

CREATE POLICY "Supervisors delete allocations"
ON public.tip_allocations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tip_pools p
    WHERE p.id = tip_allocations.tip_pool_id
      AND (public.is_site_supervisor_or_owner(p.site_id) OR public.is_org_owner(p.organisation_id))
  )
);
