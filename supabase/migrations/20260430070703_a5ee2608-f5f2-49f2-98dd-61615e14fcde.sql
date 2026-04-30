-- Allow customer_feedback in module_activation
ALTER TABLE public.module_activation DROP CONSTRAINT IF EXISTS module_activation_module_check;
ALTER TABLE public.module_activation ADD CONSTRAINT module_activation_module_check
  CHECK (module_name IN (
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log','customer_feedback',
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp',
    'cost_margin','tip_tracker','reports'
  ));

-- Customer Feedback table
CREATE TABLE public.feedback_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  logged_by UUID REFERENCES public.users(id),
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL CHECK (source IN ('in_person','google','social_media','email','phone','other')),
  category TEXT NOT NULL CHECK (category IN ('food_quality','service','cleanliness','allergen_concern','complaint','compliment','suggestion')),
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive','neutral','negative')),
  description TEXT NOT NULL,
  action_taken TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_entries_site_date ON public.feedback_entries(site_id, feedback_date DESC);
CREATE INDEX idx_feedback_entries_logged_by ON public.feedback_entries(logged_by);

ALTER TABLE public.feedback_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view their own feedback"
ON public.feedback_entries FOR SELECT
USING (logged_by = public.get_app_user_id());

CREATE POLICY "Supervisors and managers can view site feedback"
ON public.feedback_entries FOR SELECT
USING (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Site members can insert feedback"
ON public.feedback_entries FOR INSERT
WITH CHECK (
  public.has_site_access(site_id)
  AND logged_by = public.get_app_user_id()
);

CREATE POLICY "Supervisors and managers can update feedback"
ON public.feedback_entries FOR UPDATE
USING (public.is_site_supervisor_or_owner(site_id))
WITH CHECK (public.is_site_supervisor_or_owner(site_id));

CREATE POLICY "Supervisors and managers can delete feedback"
ON public.feedback_entries FOR DELETE
USING (public.is_site_supervisor_or_owner(site_id));

-- Update sync_org_modules to include customer_feedback in BASE
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
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp',
    'cost_margin','tip_tracker','reports'
  ];
  _base text[] := ARRAY['temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log','customer_feedback'];
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

-- Backfill
DO $$
DECLARE _org RECORD;
BEGIN
  FOR _org IN SELECT id FROM public.organisations LOOP
    PERFORM public.sync_org_modules(_org.id);
  END LOOP;
END $$;