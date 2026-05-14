
CREATE TABLE public.org_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE UNIQUE,
  logo_url TEXT,
  business_display_name TEXT,
  primary_colour TEXT DEFAULT '#0D9488',
  secondary_colour TEXT DEFAULT '#F59E0B',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.org_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view branding"
  ON public.org_branding FOR SELECT
  TO authenticated
  USING (organisation_id = public.get_user_org_id() OR public.has_staff_access_to_org(organisation_id));

CREATE POLICY "managers can insert branding"
  ON public.org_branding FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE POLICY "managers can update branding"
  ON public.org_branding FOR UPDATE
  TO authenticated
  USING (public.is_org_manager_or_hq(organisation_id))
  WITH CHECK (public.is_org_manager_or_hq(organisation_id));

CREATE POLICY "managers can delete branding"
  ON public.org_branding FOR DELETE
  TO authenticated
  USING (public.is_org_manager_or_hq(organisation_id));

CREATE TRIGGER touch_org_branding_updated
  BEFORE UPDATE ON public.org_branding
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: folder name must equal user's organisation_id
CREATE POLICY "org logos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');

CREATE POLICY "org members can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.get_user_org_id()::text
  );

CREATE POLICY "org members can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.get_user_org_id()::text
  );

CREATE POLICY "org members can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.get_user_org_id()::text
  );
