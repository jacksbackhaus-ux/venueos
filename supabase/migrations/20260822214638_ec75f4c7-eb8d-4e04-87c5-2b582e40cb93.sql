DROP POLICY IF EXISTS "Super admins can insert super_admins" ON public.super_admins;

CREATE POLICY "Super admins can insert super_admins"
ON public.super_admins
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin() AND user_id <> auth.uid());