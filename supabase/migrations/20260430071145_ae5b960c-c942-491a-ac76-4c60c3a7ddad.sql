-- Allow ppm_schedule in module_activation
ALTER TABLE public.module_activation DROP CONSTRAINT IF EXISTS module_activation_module_check;
ALTER TABLE public.module_activation ADD CONSTRAINT module_activation_module_check
  CHECK (module_name IN (
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log','customer_feedback',
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp','ppm_schedule',
    'cost_margin','tip_tracker','reports'
  ));

-- ppm_tasks
CREATE TABLE public.ppm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','biannual','annual')),
  category TEXT NOT NULL CHECK (category IN ('electrical','plumbing','hvac','fire_safety','pest_control','equipment','building','other')),
  assigned_to TEXT,
  contractor_name TEXT,
  estimated_duration_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ppm_tasks_site ON public.ppm_tasks(site_id, is_active);

ALTER TABLE public.ppm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site members can view ppm tasks"
ON public.ppm_tasks FOR SELECT
USING (public.has_site_access(site_id));

CREATE POLICY "Supervisors and managers can insert ppm tasks"
ON public.ppm_tasks FOR INSERT
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors and managers can update ppm tasks"
ON public.ppm_tasks FOR UPDATE
USING (public.is_site_supervisor_or_owner(site_id))
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors and managers can delete ppm tasks"
ON public.ppm_tasks FOR DELETE
USING (public.is_site_supervisor_or_owner(site_id));

-- ppm_completions
CREATE TABLE public.ppm_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.ppm_tasks(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES public.users(id),
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_due_date DATE NOT NULL,
  notes TEXT,
  cost NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ppm_completions_task ON public.ppm_completions(task_id, completed_date DESC);
CREATE INDEX idx_ppm_completions_site ON public.ppm_completions(site_id, completed_date DESC);

ALTER TABLE public.ppm_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site members can view ppm completions"
ON public.ppm_completions FOR SELECT
USING (public.has_site_access(site_id));

CREATE POLICY "Site write users can insert ppm completions"
ON public.ppm_completions FOR INSERT
WITH CHECK (
  public.has_site_write_access(site_id)
  AND completed_by = public.get_app_user_id()
);

CREATE POLICY "Supervisors and managers can update ppm completions"
ON public.ppm_completions FOR UPDATE
USING (public.is_site_supervisor_or_owner(site_id))
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors and managers can delete ppm completions"
ON public.ppm_completions FOR DELETE
USING (public.is_site_supervisor_or_owner(site_id));

-- Add ppm_schedule to sync_org_modules (Compliance group)
CREATE OR REPLACE FUNCTION public.sync_org_modules(_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sub RECORD;
  _site RECORD;
  _all_modules text[] := ARRAY[
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log','customer_feedback',
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp','ppm_schedule',
    'cost_margin','tip_tracker','reports'
  ];
  _base text[] := ARRAY['temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log','customer_feedback'];
  _compliance text[] := ARRAY['allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp','ppm_schedule'];
  _business text[] := ARRAY['cost_margin','tip_tracker','reports'];
  _module text;
  _should_be_active boolean;
BEGIN
  SELECT * INTO _sub FROM public.subscriptions WHERE organisation_id = _org_id;
  IF _sub IS NULL THEN RETURN; END IF;

  FOR _site IN SELECT id FROM public.sites WHERE organisation_id = _org_id LOOP
    FOREACH _module IN ARRAY _all_modules LOOP
      _should_be_active :=
        _sub.bundle_active
        OR (_sub.base_active AND _module = ANY(_base))
        OR (_sub.compliance_active AND _module = ANY(_compliance))
        OR (_sub.business_active AND _module = ANY(_business));

      INSERT INTO public.module_activation (site_id, module_name, is_active, activated_at)
      VALUES (_site.id, _module, _should_be_active, CASE WHEN _should_be_active THEN now() ELSE NULL END)
      ON CONFLICT (site_id, module_name) DO UPDATE
        SET is_active = CASE
              WHEN NOT EXCLUDED.is_active THEN false
              ELSE module_activation.is_active OR EXCLUDED.is_active
            END,
            activated_at = CASE
              WHEN EXCLUDED.is_active AND NOT module_activation.is_active THEN now()
              ELSE module_activation.activated_at
            END,
            updated_at = now();
    END LOOP;
  END LOOP;
END;
$function$;

-- Backfill
DO $$
DECLARE _org RECORD;
BEGIN
  FOR _org IN SELECT id FROM public.organisations LOOP
    PERFORM public.sync_org_modules(_org.id);
  END LOOP;
END $$;