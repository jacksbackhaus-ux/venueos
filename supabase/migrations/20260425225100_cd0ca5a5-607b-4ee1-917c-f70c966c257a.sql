
-- =========================================================================
-- PART A: subscriptions table — add new plan flags
-- =========================================================================
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS base_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bundle_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- billing_interval already exists ('month'/'year'); keep it as the source of truth.
-- Old `tier` column is left in place (nullable) for safety — app no longer reads it.

-- =========================================================================
-- PART B: module_activation table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.module_activation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_activation_unique UNIQUE (site_id, module_name),
  CONSTRAINT module_activation_module_check CHECK (module_name IN (
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger',
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking',
    'cost_margin','tip_tracker','reports'
  ))
);

CREATE INDEX IF NOT EXISTS idx_module_activation_site ON public.module_activation(site_id);

ALTER TABLE public.module_activation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Site members view module activation" ON public.module_activation;
CREATE POLICY "Site members view module activation"
  ON public.module_activation FOR SELECT
  TO authenticated
  USING (public.has_site_access(site_id));

DROP POLICY IF EXISTS "Org owners insert module activation" ON public.module_activation;
CREATE POLICY "Org owners insert module activation"
  ON public.module_activation FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = site_id AND public.is_org_owner(s.organisation_id)
  ));

DROP POLICY IF EXISTS "Org owners update module activation" ON public.module_activation;
CREATE POLICY "Org owners update module activation"
  ON public.module_activation FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = site_id AND public.is_org_owner(s.organisation_id)
  ));

-- =========================================================================
-- PART C: helper — modules covered by each plan flag
-- =========================================================================
CREATE OR REPLACE FUNCTION public.sync_org_modules(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub RECORD;
  _site RECORD;
  _all_modules text[] := ARRAY[
    'temperatures','day_sheet','cleaning','shifts','timesheets','messenger',
    'allergens','suppliers','pest_maintenance','incidents','batch_tracking',
    'cost_margin','tip_tracker','reports'
  ];
  _base text[] := ARRAY['temperatures','day_sheet','cleaning','shifts','timesheets','messenger'];
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
              -- If plan no longer covers it, force off.
              WHEN NOT EXCLUDED.is_active THEN false
              -- If plan now covers it AND it was previously off because of plan, turn back on.
              -- We don't override an explicit per-site off toggle when plan still covers it,
              -- so only turn ON if it's currently off.
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
$$;

-- =========================================================================
-- PART D: trigger to keep module_activation in sync with subscription flags
-- =========================================================================
CREATE OR REPLACE FUNCTION public.trg_sync_modules_on_sub_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT')
     OR NEW.base_active IS DISTINCT FROM OLD.base_active
     OR NEW.compliance_active IS DISTINCT FROM OLD.compliance_active
     OR NEW.business_active IS DISTINCT FROM OLD.business_active
     OR NEW.bundle_active IS DISTINCT FROM OLD.bundle_active
  THEN
    PERFORM public.sync_org_modules(NEW.organisation_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_modules_on_sub_change ON public.subscriptions;
CREATE TRIGGER sync_modules_on_sub_change
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_modules_on_sub_change();

-- New site → seed activation rows from current subscription
CREATE OR REPLACE FUNCTION public.trg_sync_modules_on_site_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_org_modules(NEW.organisation_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_modules_on_site_insert ON public.sites;
CREATE TRIGGER sync_modules_on_site_insert
AFTER INSERT ON public.sites
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_modules_on_site_insert();

-- =========================================================================
-- PART E: migrate existing orgs → Bundle trial (preserves access)
-- =========================================================================
UPDATE public.subscriptions
SET bundle_active = true,
    base_active = false,
    compliance_active = false,
    business_active = false,
    billing_interval = COALESCE(billing_interval, 'month'),
    trial_end = COALESCE(
      CASE WHEN trial_end > now() THEN trial_end ELSE NULL END,
      now() + interval '14 days'
    ),
    status = CASE
      WHEN status IN ('active','trialing') THEN status
      WHEN is_comped THEN status
      ELSE 'trialing'
    END,
    updated_at = now();

-- Reconcile module_activation for every org (idempotent)
DO $$
DECLARE _o RECORD;
BEGIN
  FOR _o IN SELECT organisation_id FROM public.subscriptions LOOP
    PERFORM public.sync_org_modules(_o.organisation_id);
  END LOOP;
END $$;

-- =========================================================================
-- PART F: realtime
-- =========================================================================
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.module_activation REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.module_activation;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
