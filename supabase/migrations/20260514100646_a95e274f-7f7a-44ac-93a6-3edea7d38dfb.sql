-- 1. ai_insights table
CREATE TABLE public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'morning_briefing','compliance_narrative','waste_insights',
    'equipment_alert','margin_alert','rota_suggestion'
  )),
  content JSONB NOT NULL,
  narrative TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  model_used TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_estimate NUMERIC(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_insights_site_type
  ON public.ai_insights(site_id, insight_type, generated_at DESC);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site members can read ai_insights"
  ON public.ai_insights FOR SELECT
  TO authenticated
  USING (public.has_site_access(site_id));

CREATE POLICY "Site members can insert ai_insights"
  ON public.ai_insights FOR INSERT
  TO authenticated
  WITH CHECK (public.has_site_access(site_id));

-- 2. ai_usage table
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  month TEXT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost NUMERIC(10,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, month)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read ai_usage"
  ON public.ai_usage FOR SELECT
  TO authenticated
  USING (organisation_id = public.get_user_org_id());

CREATE POLICY "Org members can insert ai_usage"
  ON public.ai_usage FOR INSERT
  TO authenticated
  WITH CHECK (organisation_id = public.get_user_org_id());

CREATE POLICY "Org members can update ai_usage"
  ON public.ai_usage FOR UPDATE
  TO authenticated
  USING (organisation_id = public.get_user_org_id())
  WITH CHECK (organisation_id = public.get_user_org_id());

-- 3. subscriptions.ai_active flag
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS ai_active BOOLEAN NOT NULL DEFAULT false;

-- 4. Extend module_activation CHECK constraint to include ai_insights
ALTER TABLE public.module_activation
  DROP CONSTRAINT IF EXISTS module_activation_module_check;

ALTER TABLE public.module_activation
  ADD CONSTRAINT module_activation_module_check CHECK (module_name = ANY (ARRAY[
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger',
    'waste_log','customer_feedback','allergens','suppliers','pest_maintenance',
    'incidents','batch_tracking','staff_training','haccp','ppm_schedule',
    'cost_margin','tip_tracker','reports','ai_insights'
  ]));

-- 5. Update sync_org_modules to handle ai plan
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
    'cost_margin','tip_tracker','reports','ai_insights'
  ];
  _base text[] := ARRAY['temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log','customer_feedback'];
  _compliance text[] := ARRAY['allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp','ppm_schedule'];
  _business text[] := ARRAY['cost_margin','tip_tracker','reports'];
  _ai text[] := ARRAY['ai_insights'];
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
        OR (_sub.business_active AND _module = ANY(_business))
        OR (_sub.ai_active AND _module = ANY(_ai));

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

-- 6. Update the subscription-change trigger to also fire when ai_active flips
CREATE OR REPLACE FUNCTION public.trg_sync_modules_on_sub_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT')
     OR NEW.base_active IS DISTINCT FROM OLD.base_active
     OR NEW.compliance_active IS DISTINCT FROM OLD.compliance_active
     OR NEW.business_active IS DISTINCT FROM OLD.business_active
     OR NEW.bundle_active IS DISTINCT FROM OLD.bundle_active
     OR NEW.ai_active IS DISTINCT FROM OLD.ai_active
  THEN
    PERFORM public.sync_org_modules(NEW.organisation_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 7. Backfill: seed ai_insights module rows (and any drift) for existing orgs
DO $$
DECLARE _org RECORD;
BEGIN
  FOR _org IN SELECT id FROM public.organisations LOOP
    PERFORM public.sync_org_modules(_org.id);
  END LOOP;
END $$;