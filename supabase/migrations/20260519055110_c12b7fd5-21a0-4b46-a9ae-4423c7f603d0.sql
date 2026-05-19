DROP POLICY IF EXISTS "public can view branding" ON public.org_branding;
CREATE POLICY "authenticated can view branding" ON public.org_branding FOR SELECT TO authenticated USING (true);