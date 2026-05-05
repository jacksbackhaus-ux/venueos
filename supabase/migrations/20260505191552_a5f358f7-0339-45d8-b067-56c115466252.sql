CREATE TABLE IF NOT EXISTS public.support_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_notes_org ON public.support_notes(organisation_id, created_at DESC);

ALTER TABLE public.support_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read support notes"
  ON public.support_notes FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can insert support notes"
  ON public.support_notes FOR INSERT
  WITH CHECK (public.is_super_admin() AND created_by = auth.uid());

CREATE POLICY "Super admins can update support notes"
  ON public.support_notes FOR UPDATE
  USING (public.is_super_admin());

CREATE POLICY "Super admins can delete support notes"
  ON public.support_notes FOR DELETE
  USING (public.is_super_admin());