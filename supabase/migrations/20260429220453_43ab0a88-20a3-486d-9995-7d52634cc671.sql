-- Update module_activation check constraint to include staff_training
ALTER TABLE public.module_activation DROP CONSTRAINT IF EXISTS module_activation_module_check;
ALTER TABLE public.module_activation ADD CONSTRAINT module_activation_module_check
  CHECK (module_name IN (
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log',
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training',
    'cost_margin','tip_tracker','reports'
  ));

-- training_records
CREATE TABLE public.training_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  training_name TEXT NOT NULL,
  training_type TEXT NOT NULL CHECK (training_type IN ('induction','food_safety','allergens','haccp','fire_safety','manual_handling','other')),
  completed_date DATE NOT NULL,
  expiry_date DATE,
  certificate_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_training_records_site ON public.training_records(site_id);
CREATE INDEX idx_training_records_user ON public.training_records(user_id);
CREATE INDEX idx_training_records_expiry ON public.training_records(expiry_date);

ALTER TABLE public.training_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own training records"
ON public.training_records FOR SELECT
USING (user_id = public.get_app_user_id());

CREATE POLICY "Supervisors view site training records"
ON public.training_records FOR SELECT
USING (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors insert training records"
ON public.training_records FOR INSERT
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors update training records"
ON public.training_records FOR UPDATE
USING (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors delete training records"
ON public.training_records FOR DELETE
USING (public.is_site_supervisor_or_owner(site_id));

-- training_requirements
CREATE TABLE public.training_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  training_name TEXT NOT NULL,
  training_type TEXT NOT NULL CHECK (training_type IN ('induction','food_safety','allergens','haccp','fire_safety','manual_handling','other')),
  renewal_period_months INTEGER,
  required_for_roles TEXT[] NOT NULL DEFAULT '{}',
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_training_requirements_site ON public.training_requirements(site_id);

ALTER TABLE public.training_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site members view training requirements"
ON public.training_requirements FOR SELECT
USING (public.has_site_access(site_id));

CREATE POLICY "Supervisors insert training requirements"
ON public.training_requirements FOR INSERT
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors update training requirements"
ON public.training_requirements FOR UPDATE
USING (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors delete training requirements"
ON public.training_requirements FOR DELETE
USING (public.is_site_supervisor_or_owner(site_id));

-- Update sync_org_modules
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
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training',
    'cost_margin','tip_tracker','reports'
  ];
  _base text[] := ARRAY['temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log'];
  _compliance text[] := ARRAY['allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training'];
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

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-certificates', 'training-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: paths are <site_id>/<user_id>/<filename>
CREATE POLICY "View training certificates for site"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'training-certificates'
  AND (
    public.is_site_supervisor_or_owner(((storage.foldername(name))[1])::uuid)
    OR (((storage.foldername(name))[2])::uuid = public.get_app_user_id())
  )
);

CREATE POLICY "Upload training certificates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'training-certificates'
  AND (
    public.is_site_supervisor_or_owner(((storage.foldername(name))[1])::uuid)
    OR (
      public.has_site_access(((storage.foldername(name))[1])::uuid)
      AND ((storage.foldername(name))[2])::uuid = public.get_app_user_id()
    )
  )
);

CREATE POLICY "Delete training certificates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'training-certificates'
  AND (
    public.is_site_supervisor_or_owner(((storage.foldername(name))[1])::uuid)
    OR ((storage.foldername(name))[2])::uuid = public.get_app_user_id()
  )
);