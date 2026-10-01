REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.incident_stage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.incident_stage_events TO authenticated;