
-- 1. ai_usage: remove client-side write policies
DROP POLICY IF EXISTS "Org members can insert ai_usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Org members can update ai_usage" ON public.ai_usage;

-- 2. org-logos storage: restrict writes to org owners
DROP POLICY IF EXISTS "org members can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "org members can update logos" ON storage.objects;
DROP POLICY IF EXISTS "org members can delete logos" ON storage.objects;

CREATE POLICY "Org owners can upload logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = (public.get_user_org_id())::text
    AND public.is_org_owner(public.get_user_org_id())
  );

CREATE POLICY "Org owners can update logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = (public.get_user_org_id())::text
    AND public.is_org_owner(public.get_user_org_id())
  );

CREATE POLICY "Org owners can delete logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = (public.get_user_org_id())::text
    AND public.is_org_owner(public.get_user_org_id())
  );

-- 3. shift_compensation_logs: remove staff self-read
DROP POLICY IF EXISTS "Managers view compensation logs" ON public.shift_compensation_logs;
CREATE POLICY "Managers view compensation logs" ON public.shift_compensation_logs
  FOR SELECT TO authenticated
  USING (
    public.is_site_supervisor_or_owner(site_id)
    OR public.is_org_owner(organisation_id)
    OR public.has_hq_access(organisation_id)
  );

-- 4. suppliers: restrict reads to supervisors+
DROP POLICY IF EXISTS "View suppliers" ON public.suppliers;
CREATE POLICY "Supervisors view suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    public.is_site_supervisor_or_owner(site_id)
    OR public.is_org_owner(organisation_id)
    OR public.has_hq_access(organisation_id)
  );

-- 5. users: consolidate SELECT policies
DROP POLICY IF EXISTS "Org owners and HQ admins can view org users" ON public.users;
DROP POLICY IF EXISTS "Org owners can view all org users" ON public.users;

CREATE POLICY "Org owners and HQ admins can view org users" ON public.users
  FOR SELECT TO authenticated
  USING (
    organisation_id = public.get_user_org_id()
    AND public.is_org_owner_or_hq_admin(organisation_id)
  );

CREATE POLICY "Super admins can view all users" ON public.users
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
