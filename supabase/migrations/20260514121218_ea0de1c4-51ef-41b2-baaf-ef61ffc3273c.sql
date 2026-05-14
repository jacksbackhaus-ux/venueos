
-- Public can read branding (non-sensitive: logo + display name + colours).
CREATE POLICY "public can view branding"
  ON public.org_branding FOR SELECT
  TO anon, authenticated
  USING (true);

-- Drop the previous restrictive select; the public policy above is permissive enough.
DROP POLICY IF EXISTS "org members can view branding" ON public.org_branding;

CREATE OR REPLACE FUNCTION public.get_org_public_by_slug(_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug,
    'branding', (
      SELECT jsonb_build_object(
        'logo_url', b.logo_url,
        'business_display_name', b.business_display_name,
        'primary_colour', b.primary_colour,
        'secondary_colour', b.secondary_colour
      )
      FROM public.org_branding b
      WHERE b.organisation_id = o.id
    )
  )
  FROM public.organisations o
  WHERE lower(o.slug) = lower(trim(_slug))
  LIMIT 1;
$function$;
