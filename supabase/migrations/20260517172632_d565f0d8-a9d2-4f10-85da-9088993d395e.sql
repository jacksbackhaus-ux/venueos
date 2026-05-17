-- Restrict staff_availability writes to managers (supervisors/owners) only.
DROP POLICY IF EXISTS "Staff manage their own availability" ON public.staff_availability;
DROP POLICY IF EXISTS "Staff update their own availability" ON public.staff_availability;
DROP POLICY IF EXISTS "Staff delete their own availability" ON public.staff_availability;

CREATE POLICY "Managers manage staff availability"
ON public.staff_availability
FOR INSERT
TO authenticated
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Managers update staff availability"
ON public.staff_availability
FOR UPDATE
TO authenticated
USING (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Managers delete staff availability"
ON public.staff_availability
FOR DELETE
TO authenticated
USING (public.is_site_supervisor_or_owner(site_id));
