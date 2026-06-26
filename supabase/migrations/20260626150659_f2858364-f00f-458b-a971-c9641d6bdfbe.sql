
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL;
