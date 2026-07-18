
-- Link training records to catalog entries (nullable to preserve legacy free-text records)
ALTER TABLE public.training_records
  ADD COLUMN IF NOT EXISTS training_catalog_id UUID REFERENCES public.training_requirements(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_training_records_catalog ON public.training_records(training_catalog_id);

-- Soft-delete + active flag on catalog
ALTER TABLE public.training_requirements
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Backfill: link existing records to a catalog entry with the same site + case-insensitive name.
UPDATE public.training_records tr
SET training_catalog_id = req.id
FROM public.training_requirements req
WHERE tr.training_catalog_id IS NULL
  AND req.site_id = tr.site_id
  AND lower(req.training_name) = lower(tr.training_name);

-- Individual (per-user) assignment overrides
CREATE TABLE IF NOT EXISTS public.training_individual_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  training_catalog_id UUID NOT NULL REFERENCES public.training_requirements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (training_catalog_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tia_site ON public.training_individual_assignments(site_id);
CREATE INDEX IF NOT EXISTS idx_tia_user ON public.training_individual_assignments(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_individual_assignments TO authenticated;
GRANT ALL ON public.training_individual_assignments TO service_role;

ALTER TABLE public.training_individual_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site members view individual assignments"
ON public.training_individual_assignments FOR SELECT
USING (public.has_site_access(site_id));

CREATE POLICY "Supervisors insert individual assignments"
ON public.training_individual_assignments FOR INSERT
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors update individual assignments"
ON public.training_individual_assignments FOR UPDATE
USING (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors delete individual assignments"
ON public.training_individual_assignments FOR DELETE
USING (public.is_site_supervisor_or_owner(site_id));

-- Allow staff to insert their OWN training records (self-service certificate upload)
CREATE POLICY "Staff insert own training records"
ON public.training_records FOR INSERT
WITH CHECK (
  user_id = public.get_app_user_id()
  AND public.has_site_access(site_id)
);
