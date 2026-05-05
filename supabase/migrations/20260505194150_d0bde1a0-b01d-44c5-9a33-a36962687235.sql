ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS is_compound boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS composition_text text;

COMMENT ON COLUMN public.ingredients.composition_text IS 'Full sub-ingredient list for premade blends/pastes, copied from supplier label. Used to render FIC-compliant PPDS labels: e.g. "Tomato (60%), sugar, salt, basil, citric acid".';
COMMENT ON COLUMN public.ingredients.is_compound IS 'True when ingredient is a premade compound (paste, blend, sauce) with its own sub-ingredient list.';