CREATE OR REPLACE FUNCTION public.staff_list_all_organisations()
 RETURNS TABLE(id uuid, name text, slug text, subscription_status text, created_at timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Internal staff only. Read-only listing for the Staff Access Management page.
  PERFORM public.assert_internal_staff();

  RETURN QUERY
    SELECT o.id, o.name, o.slug,
           (SELECT s.status::text FROM public.subscriptions s WHERE s.organisation_id = o.id LIMIT 1),
           o.created_at
    FROM public.organisations o
    ORDER BY o.name ASC;
END $function$;