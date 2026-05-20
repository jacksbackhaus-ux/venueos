REVOKE ALL ON FUNCTION public.has_customer_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_customer_account(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_customer_account(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.can_view_shared_site_teammate(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_shared_site_teammate(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_view_shared_site_teammate(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_internal_role(public.internal_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_internal_role(public.internal_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_internal_role(public.internal_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_internal_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_internal_staff() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_internal_staff() TO authenticated;