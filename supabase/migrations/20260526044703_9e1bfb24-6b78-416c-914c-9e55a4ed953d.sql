
-- 1) Fix notification_prefs policy: use get_app_user_id() instead of auth.uid()
DROP POLICY IF EXISTS "Users manage own notification prefs" ON public.notification_prefs;
CREATE POLICY "Users manage own notification prefs"
ON public.notification_prefs
FOR ALL
TO authenticated
USING (user_id = public.get_app_user_id())
WITH CHECK (user_id = public.get_app_user_id());

-- 2) Fix push_devices policy similarly
DROP POLICY IF EXISTS "Users manage own push devices" ON public.push_devices;
CREATE POLICY "Users manage own push devices"
ON public.push_devices
FOR ALL
TO authenticated
USING (user_id = public.get_app_user_id())
WITH CHECK (user_id = public.get_app_user_id());

-- 3) Restrict sales-imports storage SELECT to org managers/HQ (matches write side)
DROP POLICY IF EXISTS "org members read sales imports" ON storage.objects;
CREATE POLICY "managers read sales imports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'sales-imports'
  AND public.is_org_manager_or_hq(((storage.foldername(name))[1])::uuid)
);

-- 4) Remove supervisor access to full users rows (sensitive fields exposure).
-- Org owners + HQ admins retain access via existing "Org owners and HQ admins can view org users" policy.
-- Users still see their own row via "Users can view their own row" policy.
DROP POLICY IF EXISTS "Site supervisors view shared-site teammates" ON public.users;
