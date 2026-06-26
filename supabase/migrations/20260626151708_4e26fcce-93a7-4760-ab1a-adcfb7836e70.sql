
-- Feedback widget: customer-submitted feedback, bug reports, feature requests.
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('feedback','bug','feature','other')),
  title text NOT NULL,
  description text NOT NULL,
  page text,
  browser_info text,
  screenshot_url text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','planned','done','closed')),
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_org_idx ON public.feedback(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_status_idx ON public.feedback(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can submit feedback for their own org (client supplies organisation_id and user_id).
CREATE POLICY "Authenticated can submit feedback"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Customers may read back their own submissions only.
CREATE POLICY "Users read own feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Internal staff can read and update everything (notes, status).
CREATE POLICY "Internal staff read all feedback"
  ON public.feedback FOR SELECT TO authenticated
  USING (public.is_internal_staff());

CREATE POLICY "Internal staff update feedback"
  ON public.feedback FOR UPDATE TO authenticated
  USING (public.is_internal_staff())
  WITH CHECK (public.is_internal_staff());

-- updated_at trigger (reuse standard helper if present)
CREATE OR REPLACE FUNCTION public.feedback_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS feedback_updated_at ON public.feedback;
CREATE TRIGGER feedback_updated_at BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_set_updated_at();
