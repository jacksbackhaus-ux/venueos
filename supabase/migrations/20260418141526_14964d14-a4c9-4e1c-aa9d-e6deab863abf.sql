-- Fix touch_updated_at search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Replace overly permissive FOR ALL with explicit per-command policies
DROP POLICY IF EXISTS "Super admins manage subscriptions" ON public.subscriptions;
CREATE POLICY "Super admins insert subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins update subscriptions" ON public.subscriptions
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admins delete subscriptions" ON public.subscriptions
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- Allow service role inserts via webhook (uses bypass anyway, but explicit policy for clarity)
CREATE POLICY "Service role webhook insert events" ON public.billing_events
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());