-- Add 'engineering' to internal_role enum (must be in its own transaction)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'internal_role' AND e.enumlabel = 'engineering'
  ) THEN
    ALTER TYPE public.internal_role ADD VALUE 'engineering';
  END IF;
END $$;