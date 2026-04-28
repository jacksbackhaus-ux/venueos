-- Allow waste_log in module_activation
ALTER TABLE public.module_activation DROP CONSTRAINT IF EXISTS module_activation_module_check;
ALTER TABLE public.module_activation ADD CONSTRAINT module_activation_module_check
  CHECK (module_name = ANY (ARRAY[
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log',
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking',
    'cost_margin','tip_tracker','reports'
  ]));

-- Waste Log table
CREATE TABLE public.waste_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL,
  organisation_id UUID NOT NULL,
  logged_by UUID REFERENCES public.users(id),
  logged_by_name TEXT NOT NULL DEFAULT 'Unknown',
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL CHECK (category IN ('food_prep','overproduction','spoilage','returned','packaging','other')),
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  estimated_cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waste_logs_site_date ON public.waste_logs(site_id, shift_date DESC);
CREATE INDEX idx_waste_logs_logged_at ON public.waste_logs(logged_at DESC);

ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site members can log waste"
ON public.waste_logs FOR INSERT TO authenticated
WITH CHECK (has_site_write_access(site_id));

CREATE POLICY "Site members can view waste logs"
ON public.waste_logs FOR SELECT TO authenticated
USING (has_site_access(site_id));

CREATE POLICY "Supervisors can update waste logs"
ON public.waste_logs FOR UPDATE TO authenticated
USING (is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors can delete waste logs"
ON public.waste_logs FOR DELETE TO authenticated
USING (is_site_supervisor_or_owner(site_id));

CREATE TRIGGER trg_waste_logs_touch
BEFORE UPDATE ON public.waste_logs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Update sync function to include waste_log under Base plan
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
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking',
    'cost_margin','tip_tracker','reports'
  ];
  _base text[] := ARRAY['temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log'];
  _compliance text[] := ARRAY['allergens','suppliers','pest_maintenance','incidents','batch_tracking'];
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

-- Backfill for all existing orgs
DO $$
DECLARE _org RECORD;
BEGIN
  FOR _org IN SELECT id FROM public.organisations LOOP
    PERFORM public.sync_org_modules(_org.id);
  END LOOP;
END $$;