-- Backfill: any active staff_code user in an org with sites but no membership
-- gets a 'staff' membership on the first (oldest) site of their org so they can log in.
INSERT INTO public.memberships (site_id, user_id, site_role, active)
SELECT
  (SELECT s.id FROM public.sites s
    WHERE s.organisation_id = u.organisation_id AND s.active = true
    ORDER BY s.created_at ASC LIMIT 1) AS site_id,
  u.id AS user_id,
  'staff'::site_role,
  true
FROM public.users u
WHERE u.auth_type = 'staff_code'
  AND u.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.user_id = u.id AND m.active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.sites s WHERE s.organisation_id = u.organisation_id AND s.active = true
  );