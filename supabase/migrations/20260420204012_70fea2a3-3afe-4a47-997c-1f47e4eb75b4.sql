ALTER TABLE public.temp_logs
  ADD COLUMN IF NOT EXISTS food_item text,
  ALTER COLUMN unit_id DROP NOT NULL;