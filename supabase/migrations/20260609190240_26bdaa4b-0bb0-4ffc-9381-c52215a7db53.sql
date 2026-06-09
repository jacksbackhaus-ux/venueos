
-- 1) Migrate any legacy tier values to the new naming.
--    Safe-upgrade rule: never downgrade.
UPDATE public.subscriptions SET tier = 'compliance' WHERE tier = 'professional';
UPDATE public.subscriptions SET tier = 'profit'     WHERE tier = 'business_tier';

-- 2) Rebuild sync_org_modules with the new tier names and module groupings.
--    batch_tracking moves into Essentials, reports moves into Compliance.
--    Legacy tier values are still recognised as a safety net.
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
  -- Essentials = Run the Day (incl. Batch Tracking)
  _essentials text[] := ARRAY['temperatures','day_sheet','cleaning','shifts','timesheets','messenger','waste_log','customer_feedback','batch_tracking'];
  -- Compliance = Stay Compliant (incl. Inspection Pack reports)
  _compliance text[] := ARRAY['allergens','suppliers','pest_maintenance','incidents','staff_training','haccp','ppm_schedule','reports'];
  -- Profit = Protect Margin
  _profit     text[] := ARRAY['cost_margin','tip_tracker'];
  _ai         text[] := ARRAY['ai_insights'];
  _module text;
  _should_be_active boolean;
  _effective_tier text;
  _active boolean;
  _has_essentials boolean;
  _has_compliance boolean;
  _has_profit boolean;
  _has_intelligence boolean;
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

  -- Cumulative tier flags. Legacy names ('professional','business_tier') still recognised.
  _has_essentials   := _effective_tier IN ('essentials','compliance','profit','intelligence','professional','business_tier');
  _has_compliance   := _effective_tier IN ('compliance','profit','intelligence','professional','business_tier');
  _has_profit       := _effective_tier IN ('profit','intelligence','business_tier');
  _has_intelligence := _effective_tier = 'intelligence';

  FOR _site IN SELECT id FROM public.sites WHERE organisation_id = _org_id LOOP
    FOREACH _module IN ARRAY _all_modules LOOP
      IF NOT _active OR _effective_tier IS NULL THEN
        _should_be_active := false;
      ELSE
        _should_be_active :=
             (_has_essentials   AND _module = ANY(_essentials))
          OR (_has_compliance   AND _module = ANY(_compliance))
          OR (_has_profit       AND _module = ANY(_profit))
          OR (_has_intelligence AND _module = ANY(_ai));
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
$function$;

-- 3) Re-run sync for every org so module_activation reflects the new groupings immediately.
DO $$
DECLARE
  _org RECORD;
BEGIN
  FOR _org IN SELECT DISTINCT organisation_id FROM public.subscriptions WHERE organisation_id IS NOT NULL LOOP
    PERFORM public.sync_org_modules(_org.organisation_id);
  END LOOP;
END $$;
