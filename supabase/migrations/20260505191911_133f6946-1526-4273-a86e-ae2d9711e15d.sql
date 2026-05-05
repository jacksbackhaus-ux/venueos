CREATE TABLE IF NOT EXISTS public.impersonation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_user_id UUID NOT NULL,
  target_organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  target_user_id UUID,
  reason TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_org ON public.impersonation_logs(target_organisation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin ON public.impersonation_logs(super_admin_user_id, started_at DESC);

ALTER TABLE public.impersonation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read impersonation logs"
  ON public.impersonation_logs FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can insert impersonation logs"
  ON public.impersonation_logs FOR INSERT
  WITH CHECK (public.is_super_admin() AND super_admin_user_id = auth.uid());

CREATE POLICY "Super admins can update impersonation logs"
  ON public.impersonation_logs FOR UPDATE
  USING (public.is_super_admin() AND super_admin_user_id = auth.uid());