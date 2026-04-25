-- Add unit + cost fields to ingredients
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS cost_per_unit numeric(10,4);

-- Add unit + cost override to recipe_ingredients
ALTER TABLE public.recipe_ingredients
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS cost_per_unit_override numeric(10,4);

-- Per-recipe costing fields
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS packaging_cost numeric(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_minutes numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sell_price_ex_vat numeric(10,4),
  ADD COLUMN IF NOT EXISTS vat_rate text NOT NULL DEFAULT 'zero',
  ADD COLUMN IF NOT EXISTS monthly_volume numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_margin_override numeric(5,2);

-- Org-level cost settings
CREATE TABLE IF NOT EXISTS public.org_cost_settings (
  organisation_id uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  target_margin_pct numeric(5,2) NOT NULL DEFAULT 60,
  labour_hourly_rate numeric(10,2) NOT NULL DEFAULT 12,
  monthly_overhead numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view cost settings"
  ON public.org_cost_settings FOR SELECT TO authenticated
  USING (organisation_id = public.get_user_org_id());

CREATE POLICY "Org owners insert cost settings"
  ON public.org_cost_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_org_owner(organisation_id) OR public.has_hq_access(organisation_id));

CREATE POLICY "Org owners update cost settings"
  ON public.org_cost_settings FOR UPDATE TO authenticated
  USING (public.is_org_owner(organisation_id) OR public.has_hq_access(organisation_id));

CREATE TRIGGER touch_org_cost_settings
  BEFORE UPDATE ON public.org_cost_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();