-- 1. Extend existing safe_methods (additive only)
ALTER TABLE public.safe_methods
  ADD COLUMN IF NOT EXISTS responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS completed_by_name text;

-- Backfill: existing documented methods keep their evidence
UPDATE public.safe_methods
SET completed_at = COALESCE(completed_at, updated_at),
    completed_by = COALESCE(completed_by, updated_by),
    completed_by_name = COALESCE(completed_by_name, updated_by_name)
WHERE status = 'documented';

-- 2. Site-level food safety management system record
CREATE TABLE public.sfbb_system (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  route text NOT NULL DEFAULT 'undecided'
    CHECK (route IN ('undecided','in_app','uploaded','both')),
  first_completed_at date,
  last_reviewed_at date,
  reviewed_by uuid,
  reviewed_by_name text,
  review_reminder_dismissed_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sfbb_system TO authenticated;
GRANT ALL ON public.sfbb_system TO service_role;
ALTER TABLE public.sfbb_system ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sfbb_system_select" ON public.sfbb_system
  FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "sfbb_system_insert" ON public.sfbb_system
  FOR INSERT TO authenticated WITH CHECK (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "sfbb_system_update" ON public.sfbb_system
  FOR UPDATE TO authenticated USING (public.is_site_supervisor_or_owner(site_id))
  WITH CHECK (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "sfbb_system_delete" ON public.sfbb_system
  FOR DELETE TO authenticated USING (public.is_site_supervisor_or_owner(site_id));

CREATE TRIGGER sfbb_system_touch BEFORE UPDATE ON public.sfbb_system
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Uploaded SFBB pack documents
CREATE TABLE public.sfbb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size integer,
  date_completed date,
  review_date date,
  notes text,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sfbb_documents_site_idx ON public.sfbb_documents(site_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sfbb_documents TO authenticated;
GRANT ALL ON public.sfbb_documents TO service_role;
ALTER TABLE public.sfbb_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sfbb_documents_select" ON public.sfbb_documents
  FOR SELECT TO authenticated USING (public.has_site_access(site_id));
CREATE POLICY "sfbb_documents_insert" ON public.sfbb_documents
  FOR INSERT TO authenticated WITH CHECK (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "sfbb_documents_update" ON public.sfbb_documents
  FOR UPDATE TO authenticated USING (public.is_site_supervisor_or_owner(site_id))
  WITH CHECK (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "sfbb_documents_delete" ON public.sfbb_documents
  FOR DELETE TO authenticated USING (public.is_site_supervisor_or_owner(site_id));

CREATE TRIGGER sfbb_documents_touch BEFORE UPDATE ON public.sfbb_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();