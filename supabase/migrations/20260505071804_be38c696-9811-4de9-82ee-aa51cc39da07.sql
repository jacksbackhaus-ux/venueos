
ALTER TABLE public.day_sheet_entries ADD COLUMN IF NOT EXISTS completed_by_name text;
ALTER TABLE public.day_sheets ADD COLUMN IF NOT EXISTS locked_by_name text;
