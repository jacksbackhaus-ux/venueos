-- FIX 1: column-level protection on public.users
REVOKE SELECT ON public.users FROM anon;
REVOKE SELECT ON public.users FROM authenticated;
GRANT SELECT (id, auth_user_id, organisation_id, display_name, email, auth_type, status, created_at, last_login_at, deactivated_at, deactivated_by) ON public.users TO authenticated;

-- FIX 5: revoke anon EXECUTE on internal/pay-sensitive SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.list_org_user_hourly_rates(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_org_user_staff_codes(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_pay_context(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resync_org_modules(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_get_subscription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_get_customer_360(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_list_all_organisations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_update_subscription(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_internal_impersonation(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.end_internal_impersonation() FROM anon;

-- FIX 4: missing indexes on hot paths
CREATE INDEX IF NOT EXISTS idx_temp_logs_org ON public.temp_logs (organisation_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_org ON public.cleaning_logs (organisation_id);
CREATE INDEX IF NOT EXISTS idx_day_sheets_org ON public.day_sheets (organisation_id);
CREATE INDEX IF NOT EXISTS idx_incidents_org ON public.incidents (organisation_id);
CREATE INDEX IF NOT EXISTS idx_production_days_org ON public.production_days (organisation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_org ON public.reviews (organisation_id);
CREATE INDEX IF NOT EXISTS idx_site_events_site_date ON public.site_events (site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iph_site ON public.ingredient_price_history (site_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_log_site ON public.recipe_price_change_log (site_id, created_at DESC);