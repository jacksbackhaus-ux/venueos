-- Replace the unused starter/pro/multisite enum tier column with a plain text column
-- that holds the new 4-tier IDs (essentials | professional | business_tier | intelligence).
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS tier;
DROP TYPE IF EXISTS public.subscription_tier;
ALTER TABLE public.subscriptions ADD COLUMN tier text;
COMMENT ON COLUMN public.subscriptions.tier IS
  'New 4-tier model: essentials | professional | business_tier | intelligence. Null for legacy subs.';