
-- 1. New columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS term_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS term_end   TIMESTAMPTZ;

-- 2. Backfill tier from legacy flags where missing
UPDATE public.subscriptions
SET tier = CASE
  WHEN ai_active AND (bundle_active OR business_active OR (base_active AND compliance_active)) THEN 'intelligence'
  WHEN ai_active THEN 'intelligence'
  WHEN bundle_active OR business_active THEN 'business_tier'
  WHEN compliance_active THEN 'professional'
  WHEN base_active THEN 'essentials'
  ELSE 'essentials'
END
WHERE tier IS NULL;

-- 3. Normalise billing_interval values to new vocabulary
UPDATE public.subscriptions
SET billing_interval = CASE
  WHEN billing_interval IN ('year','annual','annual_upfront') THEN 'annual_upfront'
  ELSE 'monthly_term'
END
WHERE billing_interval IS DISTINCT FROM 'annual_upfront'
   AND billing_interval IS DISTINCT FROM 'monthly_term';

-- 4. Backfill term_start / term_end
UPDATE public.subscriptions
SET term_start = COALESCE(term_start, current_period_start, created_at, now()),
    term_end   = COALESCE(
      term_end,
      CASE
        WHEN billing_interval = 'annual_upfront' THEN COALESCE(current_period_end, created_at + interval '1 year', now() + interval '1 year')
        ELSE COALESCE(current_period_start, created_at, now()) + interval '12 months'
      END
    );

-- 5. Re-sync module activation for every org (function already tier-aware)
DO $$
DECLARE _org RECORD;
BEGIN
  FOR _org IN SELECT id FROM public.organisations LOOP
    PERFORM public.sync_org_modules(_org.id);
  END LOOP;
END $$;
