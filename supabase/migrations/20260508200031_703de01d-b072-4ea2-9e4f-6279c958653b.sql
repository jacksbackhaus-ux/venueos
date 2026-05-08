CREATE OR REPLACE FUNCTION public.staff_list_assigned_orgs()
 RETURNS TABLE(organisation_id uuid, name text, slug text, access_level text, granted_at timestamp with time zone, expires_at timestamp with time zone, is_super_admin_view boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_internal_staff();

  -- Even super admins must be explicitly assigned to a tenant to see it here.
  -- Super-admin bypass is preserved at the RLS layer (has_staff_access_to_org)
  -- so they can self-assign via /staff/access if needed.
  RETURN QUERY
    SELECT o.id, o.name, o.slug,
           soa.access_level,
           soa.created_at, soa.expires_at,
           public.is_super_admin()
    FROM public.staff_org_access soa
    JOIN public.organisations o ON o.id = soa.organisation_id
    WHERE soa.staff_user_id = auth.uid()
      AND soa.revoked_at IS NULL
      AND (soa.expires_at IS NULL OR soa.expires_at > now())
    ORDER BY o.name ASC;
END $function$;