CREATE POLICY "Service manages schedule history failures"
ON public.schedule_history_write_failures
FOR ALL TO service_role
USING (true) WITH CHECK (true);