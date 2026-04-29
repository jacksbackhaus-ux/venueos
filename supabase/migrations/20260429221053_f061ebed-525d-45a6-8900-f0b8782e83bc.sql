ALTER TABLE public.module_activation DROP CONSTRAINT IF EXISTS module_activation_module_check;
ALTER TABLE public.module_activation ADD CONSTRAINT module_activation_module_check
  CHECK (module_name IN (
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log',
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp',
    'cost_margin','tip_tracker','reports'
  ));

CREATE TABLE public.haccp_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL,
  name TEXT NOT NULL,
  food_business_type TEXT,
  created_by UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  last_reviewed_at DATE,
  review_due_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_haccp_plans_site ON public.haccp_plans(site_id);
CREATE INDEX idx_haccp_plans_status ON public.haccp_plans(status);

ALTER TABLE public.haccp_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view published plans"
ON public.haccp_plans FOR SELECT
USING (status = 'published' AND public.has_site_access(site_id));

CREATE POLICY "Supervisors view all plans"
ON public.haccp_plans FOR SELECT
USING (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors insert plans"
ON public.haccp_plans FOR INSERT
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors update plans"
ON public.haccp_plans FOR UPDATE
USING (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors delete plans"
ON public.haccp_plans FOR DELETE
USING (public.is_site_supervisor_or_owner(site_id));

CREATE TRIGGER update_haccp_plans_updated_at
BEFORE UPDATE ON public.haccp_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.haccp_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.haccp_plans(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL DEFAULT 0,
  step_type TEXT NOT NULL CHECK (step_type IN ('process_step','hazard','critical_control_point','corrective_action','monitoring','verification')),
  title TEXT NOT NULL,
  description TEXT,
  critical_limit TEXT,
  monitoring_procedure TEXT,
  corrective_action TEXT,
  responsible_person TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_haccp_steps_plan ON public.haccp_steps(plan_id);

ALTER TABLE public.haccp_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View steps for accessible plans"
ON public.haccp_steps FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.haccp_plans p
  WHERE p.id = haccp_steps.plan_id
  AND ((p.status = 'published' AND public.has_site_access(p.site_id))
       OR public.is_site_supervisor_or_owner(p.site_id))
));

CREATE POLICY "Supervisors insert steps"
ON public.haccp_steps FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.haccp_plans p
  WHERE p.id = haccp_steps.plan_id AND public.is_site_supervisor_or_owner(p.site_id)
));

CREATE POLICY "Supervisors update steps"
ON public.haccp_steps FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.haccp_plans p
  WHERE p.id = haccp_steps.plan_id AND public.is_site_supervisor_or_owner(p.site_id)
));

CREATE POLICY "Supervisors delete steps"
ON public.haccp_steps FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.haccp_plans p
  WHERE p.id = haccp_steps.plan_id AND public.is_site_supervisor_or_owner(p.site_id)
));

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
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log',
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp',
    'cost_margin','tip_tracker','reports'
  ];
  _base text[] := ARRAY['temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log'];
  _compliance text[] := ARRAY['allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp'];
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

DO $$
DECLARE _o RECORD;
BEGIN
  FOR _o IN SELECT id FROM public.organisations LOOP
    PERFORM public.sync_org_modules(_o.id);
  END LOOP;
END $$;