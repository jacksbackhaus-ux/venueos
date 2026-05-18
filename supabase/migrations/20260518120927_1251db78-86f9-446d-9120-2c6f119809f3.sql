
UPDATE public.subscriptions
SET tier = CASE
  WHEN ai_active AND (bundle_active OR (base_active AND compliance_active AND business_active)) THEN 'intelligence'
  WHEN bundle_active OR (base_active AND compliance_active AND business_active) THEN 'business_tier'
  WHEN base_active AND compliance_active THEN 'professional'
  WHEN base_active THEN 'essentials'
  WHEN ai_active THEN 'intelligence'
  ELSE NULL
END
WHERE tier IS NULL
  AND (base_active OR compliance_active OR business_active OR bundle_active OR ai_active);

CREATE OR REPLACE FUNCTION public.sync_org_modules(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub RECORD;
  _site RECORD;
  _all_modules text[] := ARRAY[
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log','customer_feedback',
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp','ppm_schedule',
    'cost_margin','tip_tracker','reports','ai_insights'
  ];
  _essentials text[] := ARRAY['temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log','customer_feedback'];
  _compliance text[] := ARRAY['allergens','suppliers','pest_maintenance','incidents','batch_tracking','staff_training','haccp','ppm_schedule'];
  _business   text[] := ARRAY['cost_margin','tip_tracker','reports'];
  _ai         text[] := ARRAY['ai_insights'];
  _module text;
  _should_be_active boolean;
  _effective_tier text;
  _active boolean;
BEGIN
  SELECT * INTO _sub FROM public.subscriptions WHERE organisation_id = _org_id;
  IF _sub IS NULL THEN RETURN; END IF;

  _active := (
    (_sub.is_comped AND (_sub.comped_until IS NULL OR _sub.comped_until > now()))
    OR (_sub.status IN ('active','trialing','past_due')
        AND (_sub.current_period_end IS NULL OR _sub.current_period_end > now()))
    OR (_sub.status = 'trialing' AND _sub.trial_end IS NOT NULL AND _sub.trial_end > now())
    OR (_sub.status = 'canceled' AND _sub.current_period_end IS NOT NULL AND _sub.current_period_end > now())
  );

  _effective_tier := COALESCE(
    _sub.tier::text,
    CASE WHEN _sub.status = 'trialing' AND _active THEN 'essentials' ELSE NULL END
  );

  FOR _site IN SELECT id FROM public.sites WHERE organisation_id = _org_id LOOP
    FOREACH _module IN ARRAY _all_modules LOOP
      IF NOT _active OR _effective_tier IS NULL THEN
        _should_be_active := false;
      ELSE
        _should_be_active :=
          (_effective_tier IN ('essentials','professional','business_tier','intelligence') AND _module = ANY(_essentials))
          OR (_effective_tier IN ('professional','business_tier','intelligence') AND _module = ANY(_compliance))
          OR (_effective_tier IN ('business_tier','intelligence') AND _module = ANY(_business))
          OR (_effective_tier = 'intelligence' AND _module = ANY(_ai));
      END IF;

      INSERT INTO public.module_activation (site_id, module_name, is_active, activated_at)
      VALUES (_site.id, _module, _should_be_active, CASE WHEN _should_be_active THEN now() ELSE NULL END)
      ON CONFLICT (site_id, module_name) DO UPDATE
        SET is_active = EXCLUDED.is_active,
            activated_at = CASE
              WHEN EXCLUDED.is_active AND NOT module_activation.is_active THEN now()
              WHEN NOT EXCLUDED.is_active THEN NULL
              ELSE module_activation.activated_at
            END,
            updated_at = now();
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_modules_on_sub_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT')
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
     OR NEW.trial_end IS DISTINCT FROM OLD.trial_end
     OR NEW.is_comped IS DISTINCT FROM OLD.is_comped
     OR NEW.comped_until IS DISTINCT FROM OLD.comped_until
  THEN
    PERFORM public.sync_org_modules(NEW.organisation_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.resync_org_modules(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.is_org_owner(_org_id) OR public.is_super_admin() OR public.has_staff_access_to_org(_org_id)) THEN
    RAISE EXCEPTION 'Not authorised to re-sync this organisation' USING ERRCODE = '42501';
  END IF;
  PERFORM public.sync_org_modules(_org_id);
  RETURN jsonb_build_object('ok', true, 'organisation_id', _org_id, 'synced_at', now());
END;
$$;

DO $$
DECLARE _o RECORD;
BEGIN
  FOR _o IN SELECT id FROM public.organisations LOOP
    PERFORM public.sync_org_modules(_o.id);
  END LOOP;
END $$;

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS recipe_number INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_recipe_number_unique
  ON public.batches (site_id, lower(product_name), recipe_number, date_produced)
  WHERE recipe_number IS NOT NULL;
