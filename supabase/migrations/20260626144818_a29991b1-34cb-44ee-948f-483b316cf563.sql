ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS has_used_trial boolean NOT NULL DEFAULT false;

-- Backfill: any org that already has a Stripe subscription or a recorded trial_end
-- has effectively used their trial. Do not reset live customers.
UPDATE public.subscriptions
SET has_used_trial = true
WHERE has_used_trial = false
  AND (stripe_subscription_id IS NOT NULL OR trial_end IS NOT NULL);