CREATE TABLE public.mcp_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  actor_auth_user_id uuid NOT NULL,
  actor_email text,
  client_name text,
  tool_name text NOT NULL,
  arguments jsonb,
  outcome text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mcp_activity_log_org_created_idx ON public.mcp_activity_log (organisation_id, created_at DESC);
CREATE INDEX mcp_activity_log_actor_created_idx ON public.mcp_activity_log (actor_auth_user_id, created_at DESC);

GRANT SELECT, INSERT ON public.mcp_activity_log TO authenticated;
GRANT ALL ON public.mcp_activity_log TO service_role;
ALTER TABLE public.mcp_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Actors can log their own assistant activity"
  ON public.mcp_activity_log FOR INSERT TO authenticated
  WITH CHECK (actor_auth_user_id = auth.uid() AND organisation_id = public.get_user_org_id());

CREATE POLICY "Managers see org assistant activity, users see their own"
  ON public.mcp_activity_log FOR SELECT TO authenticated
  USING (
    actor_auth_user_id = auth.uid()
    OR public.is_org_manager_or_hq(organisation_id)
    OR public.has_staff_access_to_org(organisation_id)
  );

CREATE TABLE public.mcp_settings (
  organisation_id uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.mcp_settings TO authenticated;
GRANT ALL ON public.mcp_settings TO service_role;
ALTER TABLE public.mcp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view assistant settings"
  ON public.mcp_settings FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_org_id() OR public.has_staff_access_to_org(organisation_id));

CREATE POLICY "Owners can create assistant settings"
  ON public.mcp_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner_or_hq_admin(organisation_id));

CREATE POLICY "Owners can update assistant settings"
  ON public.mcp_settings FOR UPDATE TO authenticated
  USING (public.is_org_owner_or_hq_admin(organisation_id))
  WITH CHECK (public.is_org_owner_or_hq_admin(organisation_id));

CREATE TRIGGER mcp_settings_touch BEFORE UPDATE ON public.mcp_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();