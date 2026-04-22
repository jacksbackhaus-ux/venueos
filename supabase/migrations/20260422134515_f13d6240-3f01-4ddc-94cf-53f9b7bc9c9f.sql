
-- Tighten write policies so Staff (site_role='staff' or 'read_only') cannot
-- create/edit configuration/templates or supplier records, and cannot lock
-- day sheets. Members can still complete tasks (insert into *_logs/_entries
-- and *_completions tables).

-- ============ SUPPLIERS: supervisor+ only for INSERT/UPDATE ============
DROP POLICY IF EXISTS "Insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Update suppliers" ON public.suppliers;

CREATE POLICY "Supervisors can insert suppliers"
  ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors can update suppliers"
  ON public.suppliers FOR UPDATE TO authenticated
  USING (public.is_site_supervisor_or_owner(site_id));

-- ============ CLEANING TASKS (schedule templates): supervisor+ only ============
DROP POLICY IF EXISTS "Insert cleaning tasks" ON public.cleaning_tasks;
DROP POLICY IF EXISTS "Update cleaning tasks" ON public.cleaning_tasks;

CREATE POLICY "Supervisors can insert cleaning tasks"
  ON public.cleaning_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors can update cleaning tasks"
  ON public.cleaning_tasks FOR UPDATE TO authenticated
  USING (public.is_site_supervisor_or_owner(site_id));

-- ============ DAY SHEET SECTIONS / ITEMS (templates): supervisor+ ============
DROP POLICY IF EXISTS "Insert day sheet sections" ON public.day_sheet_sections;
DROP POLICY IF EXISTS "Update day sheet sections" ON public.day_sheet_sections;

CREATE POLICY "Supervisors can insert day sheet sections"
  ON public.day_sheet_sections FOR INSERT TO authenticated
  WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors can update day sheet sections"
  ON public.day_sheet_sections FOR UPDATE TO authenticated
  USING (public.is_site_supervisor_or_owner(site_id));

DROP POLICY IF EXISTS "Insert day sheet items" ON public.day_sheet_items;
DROP POLICY IF EXISTS "Update day sheet items" ON public.day_sheet_items;

CREATE POLICY "Supervisors can insert day sheet items"
  ON public.day_sheet_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.day_sheet_sections s
    WHERE s.id = day_sheet_items.section_id
      AND public.is_site_supervisor_or_owner(s.site_id)
  ));

CREATE POLICY "Supervisors can update day sheet items"
  ON public.day_sheet_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.day_sheet_sections s
    WHERE s.id = day_sheet_items.section_id
      AND public.is_site_supervisor_or_owner(s.site_id)
  ));

-- ============ DAY SHEETS: locking is supervisor+, completing is any member ============
-- Keep the existing INSERT (any site member can open today's sheet).
-- Replace UPDATE with two policies: any member can update problem_notes, but
-- only supervisors can flip "locked"/lock metadata. Postgres RLS can't
-- enforce per-column locking inline, so we restrict UPDATE itself to
-- supervisors+ — the front-end already only writes notes via day_sheet_entries.
DROP POLICY IF EXISTS "Update day sheets" ON public.day_sheets;
CREATE POLICY "Supervisors can update day sheets"
  ON public.day_sheets FOR UPDATE TO authenticated
  USING (public.is_site_supervisor_or_owner(site_id));

-- ============ SHIFTS (rota templates): supervisor+ ============
DROP POLICY IF EXISTS "Insert shifts" ON public.shifts;
DROP POLICY IF EXISTS "Update shifts" ON public.shifts;
CREATE POLICY "Supervisors can insert shifts"
  ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "Supervisors can update shifts"
  ON public.shifts FOR UPDATE TO authenticated
  USING (public.is_site_supervisor_or_owner(site_id));

DROP POLICY IF EXISTS "Insert shift tasks" ON public.shift_tasks;
DROP POLICY IF EXISTS "Update shift tasks" ON public.shift_tasks;
CREATE POLICY "Supervisors can insert shift tasks"
  ON public.shift_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "Supervisors can update shift tasks"
  ON public.shift_tasks FOR UPDATE TO authenticated
  USING (public.is_site_supervisor_or_owner(site_id));

-- ============ TEMP UNITS (fridge/freezer config): supervisor+ ============
DROP POLICY IF EXISTS "Insert temp units" ON public.temp_units;
DROP POLICY IF EXISTS "Update temp units" ON public.temp_units;
CREATE POLICY "Supervisors can insert temp units"
  ON public.temp_units FOR INSERT TO authenticated
  WITH CHECK (public.is_site_supervisor_or_owner(site_id));
CREATE POLICY "Supervisors can update temp units"
  ON public.temp_units FOR UPDATE TO authenticated
  USING (public.is_site_supervisor_or_owner(site_id));

-- ============ READ-ONLY ROLE: block all writes to logs/completions ============
-- Add a helper that returns true when the current user is a writer (not read_only)
-- on the given site.
CREATE OR REPLACE FUNCTION public.has_site_write_access(_site_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.users u ON u.id = m.user_id
    WHERE m.site_id = _site_id
      AND u.auth_user_id = auth.uid()
      AND u.status = 'active'
      AND m.active = true
      AND m.site_role <> 'read_only'
  ) OR EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = _site_id AND public.is_org_owner(s.organisation_id)
  );
$$;

-- Apply write-access requirement to log/completion tables
DROP POLICY IF EXISTS "Insert cleaning logs" ON public.cleaning_logs;
CREATE POLICY "Insert cleaning logs"
  ON public.cleaning_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_site_write_access(site_id));

DROP POLICY IF EXISTS "Update cleaning logs" ON public.cleaning_logs;
CREATE POLICY "Update cleaning logs"
  ON public.cleaning_logs FOR UPDATE TO authenticated
  USING (public.has_site_write_access(site_id));

-- temp_logs writes
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.temp_logs'::regclass AND polcmd = 'a'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.temp_logs', pol.polname); END LOOP;
END $$;
CREATE POLICY "Insert temp logs"
  ON public.temp_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_site_write_access(site_id));

-- delivery_logs
DROP POLICY IF EXISTS "Insert delivery logs" ON public.delivery_logs;
CREATE POLICY "Insert delivery logs"
  ON public.delivery_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_site_write_access(site_id));

-- incidents
DROP POLICY IF EXISTS "Insert incidents" ON public.incidents;
CREATE POLICY "Insert incidents"
  ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (public.has_site_write_access(site_id));

-- batches
DROP POLICY IF EXISTS "Site members can insert batches" ON public.batches;
CREATE POLICY "Members can insert batches"
  ON public.batches FOR INSERT TO authenticated
  WITH CHECK (public.has_site_write_access(site_id));
