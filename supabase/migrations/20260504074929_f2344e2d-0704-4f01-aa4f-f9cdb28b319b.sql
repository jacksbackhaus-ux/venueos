-- ============================================================
-- True Margin Engine — schema redesign
-- ============================================================

-- 1) INGREDIENTS: add new costing fields
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS default_recipe_unit text NOT NULL DEFAULT 'g',
  ADD COLUMN IF NOT EXISTS density_g_per_ml numeric NULL,
  ADD COLUMN IF NOT EXISTS supplier_item_id uuid NULL,
  ADD COLUMN IF NOT EXISTS supplier_id uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vat_rate_percent numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS supplier_price_input_mode text NOT NULL DEFAULT 'INC_VAT',
  ADD COLUMN IF NOT EXISTS yield_percent_default numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS pack_quantity numeric NULL,
  ADD COLUMN IF NOT EXISTS pack_unit text NULL,
  ADD COLUMN IF NOT EXISTS pack_price numeric NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.ingredients
  DROP CONSTRAINT IF EXISTS ingredients_default_recipe_unit_chk;
ALTER TABLE public.ingredients
  ADD CONSTRAINT ingredients_default_recipe_unit_chk
  CHECK (default_recipe_unit IN ('g','ml','each'));

ALTER TABLE public.ingredients
  DROP CONSTRAINT IF EXISTS ingredients_pack_unit_chk;
ALTER TABLE public.ingredients
  ADD CONSTRAINT ingredients_pack_unit_chk
  CHECK (pack_unit IS NULL OR pack_unit IN ('g','kg','ml','l','each'));

ALTER TABLE public.ingredients
  DROP CONSTRAINT IF EXISTS ingredients_vat_input_mode_chk;
ALTER TABLE public.ingredients
  ADD CONSTRAINT ingredients_vat_input_mode_chk
  CHECK (supplier_price_input_mode IN ('INC_VAT','EX_VAT'));

ALTER TABLE public.ingredients
  DROP CONSTRAINT IF EXISTS ingredients_yield_chk;
ALTER TABLE public.ingredients
  ADD CONSTRAINT ingredients_yield_chk
  CHECK (yield_percent_default > 0 AND yield_percent_default <= 100);

-- Backfill default_recipe_unit from existing `unit` text where possible
UPDATE public.ingredients
SET default_recipe_unit = CASE
  WHEN lower(unit) IN ('g','kg') THEN 'g'
  WHEN lower(unit) IN ('ml','l') THEN 'ml'
  WHEN lower(unit) IN ('each','unit','pcs') THEN 'each'
  ELSE 'g'
END
WHERE default_recipe_unit = 'g';

-- Backfill pack info from legacy cost_per_unit (treat as price for 1 base unit, INC VAT)
UPDATE public.ingredients
SET
  pack_quantity = COALESCE(pack_quantity,
    CASE WHEN lower(unit) IN ('kg','l') THEN 1
         WHEN lower(unit) IN ('g','ml') THEN 1
         ELSE 1 END),
  pack_unit = COALESCE(pack_unit,
    CASE WHEN lower(unit) IN ('g','kg','ml','l','each') THEN lower(unit)
         ELSE default_recipe_unit END),
  pack_price = COALESCE(pack_price, cost_per_unit)
WHERE pack_price IS NULL AND cost_per_unit IS NOT NULL;

-- 2) RECIPES: add new costing/sale fields
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS recipe_type text NOT NULL DEFAULT 'menu_item',
  ADD COLUMN IF NOT EXISTS portions numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sale_price numeric NULL,
  ADD COLUMN IF NOT EXISTS sale_price_vat_rate_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_gp_percent numeric NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS labor_estimate_mode text NOT NULL DEFAULT 'BLENDED',
  ADD COLUMN IF NOT EXISTS notes text NULL,
  ADD COLUMN IF NOT EXISTS batch_yield_quantity numeric NULL,
  ADD COLUMN IF NOT EXISTS batch_yield_unit text NULL,
  ADD COLUMN IF NOT EXISTS total_prep_time_minutes numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_recipe_type_chk;
ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_recipe_type_chk
  CHECK (recipe_type IN ('menu_item','prep_batch'));

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_labor_mode_chk;
ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_labor_mode_chk
  CHECK (labor_estimate_mode IN ('BLENDED','ROLE_BASED'));

ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_batch_yield_unit_chk;
ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_batch_yield_unit_chk
  CHECK (batch_yield_unit IS NULL OR batch_yield_unit IN ('g','ml','each'));

-- Backfill from legacy fields
UPDATE public.recipes
SET
  sale_price = COALESCE(sale_price, sell_price_ex_vat),
  total_prep_time_minutes = COALESCE(NULLIF(total_prep_time_minutes,0), labour_minutes, 0),
  target_gp_percent = COALESCE(NULLIF(target_gp_percent,70), target_margin_override, 70);

-- 3) RECIPE_INGREDIENTS: support nested recipes + per-line yield
ALTER TABLE public.recipe_ingredients
  ADD COLUMN IF NOT EXISTS line_type text NOT NULL DEFAULT 'ingredient',
  ADD COLUMN IF NOT EXISTS nested_recipe_id uuid NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS quantity numeric NULL,
  ADD COLUMN IF NOT EXISTS yield_percent_override numeric NULL;

ALTER TABLE public.recipe_ingredients
  DROP CONSTRAINT IF EXISTS recipe_ingredients_line_type_chk;
ALTER TABLE public.recipe_ingredients
  ADD CONSTRAINT recipe_ingredients_line_type_chk
  CHECK (line_type IN ('ingredient','nested_recipe'));

ALTER TABLE public.recipe_ingredients
  DROP CONSTRAINT IF EXISTS recipe_ingredients_yield_override_chk;
ALTER TABLE public.recipe_ingredients
  ADD CONSTRAINT recipe_ingredients_yield_override_chk
  CHECK (yield_percent_override IS NULL OR (yield_percent_override > 0 AND yield_percent_override <= 100));

-- Allow ingredient_id to be NULL when this line is a nested_recipe
ALTER TABLE public.recipe_ingredients
  ALTER COLUMN ingredient_id DROP NOT NULL;

-- Backfill quantity from legacy weight
UPDATE public.recipe_ingredients
SET quantity = COALESCE(quantity, weight)
WHERE quantity IS NULL;

-- 4) ORG_COST_SETTINGS: new global toggles
ALTER TABLE public.org_cost_settings
  ADD COLUMN IF NOT EXISTS business_vat_registered boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS costing_view_mode text NOT NULL DEFAULT 'EX_VAT',
  ADD COLUMN IF NOT EXISTS labor_rate_lookback_days int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS labor_rate_manual_override_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS labor_rate_manual_override_value numeric NULL;

ALTER TABLE public.org_cost_settings
  DROP CONSTRAINT IF EXISTS org_cost_settings_view_mode_chk;
ALTER TABLE public.org_cost_settings
  ADD CONSTRAINT org_cost_settings_view_mode_chk
  CHECK (costing_view_mode IN ('EX_VAT','INC_VAT'));

-- 5) Indexes for fast cost rollups
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON public.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_nested ON public.recipe_ingredients(nested_recipe_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_site ON public.ingredients(site_id);
CREATE INDEX IF NOT EXISTS idx_recipes_site_type ON public.recipes(site_id, recipe_type);

-- 6) Touch updated_at triggers
DROP TRIGGER IF EXISTS trg_ingredients_touch ON public.ingredients;
CREATE TRIGGER trg_ingredients_touch
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_recipes_touch ON public.recipes;
CREATE TRIGGER trg_recipes_touch
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
