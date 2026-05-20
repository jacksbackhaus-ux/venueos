
-- Grant EXECUTE on RLS helper functions to anon and authenticated so that
-- RLS policies can call them without "permission denied" errors during
-- evaluation. The functions are SECURITY DEFINER and return false for
-- unauthenticated callers, so granting to anon is safe.

GRANT EXECUTE ON FUNCTION public.has_site_access(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_site_supervisor_or_owner(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_customer_account(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_shared_site_teammate(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_internal_role(public.internal_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_owner_or_hq_admin(uuid) TO anon, authenticated;
