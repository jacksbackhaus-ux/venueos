DROP POLICY IF EXISTS "Service role webhook insert events" ON public.billing_events;
CREATE POLICY "Service role webhook insert events"
ON public.billing_events
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');