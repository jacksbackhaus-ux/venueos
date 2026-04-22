DO $$ BEGIN
  CREATE TYPE public.subscription_tier AS ENUM ('starter','pro','multisite');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS tier public.subscription_tier;