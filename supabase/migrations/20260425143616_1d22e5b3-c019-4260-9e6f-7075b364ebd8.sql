ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_produced numeric,
  ADD COLUMN IF NOT EXISTS unit_cost_snapshot numeric,
  ADD COLUMN IF NOT EXISTS total_production_cost numeric;

CREATE INDEX IF NOT EXISTS idx_batches_recipe_id ON public.batches(recipe_id);