ALTER TABLE public.day_sheets
  ADD COLUMN IF NOT EXISTS signed_off boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_off_by text,
  ADD COLUMN IF NOT EXISTS signed_off_at timestamptz;