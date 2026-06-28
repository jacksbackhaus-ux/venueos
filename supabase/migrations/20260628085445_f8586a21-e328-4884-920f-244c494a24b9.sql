
-- Tracking columns so we never double-send billing/compliance emails.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS subscription_active_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_compliance_reminder_on date;

-- Schedule daily reminder jobs. Both reuse the existing
-- email_queue_service_role_key vault secret that powers process-email-queue,
-- so no extra secret wiring is required.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-trial-reminders') THEN
    PERFORM cron.unschedule('send-trial-reminders');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-compliance-reminders') THEN
    PERFORM cron.unschedule('send-compliance-reminders');
  END IF;
END$$;

-- 06:00 UTC daily — trial reminders (~3 days before trial_end).
SELECT cron.schedule(
  'send-trial-reminders',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://elcmnvgbmzusogudpenp.supabase.co/functions/v1/send-trial-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 07:30 UTC daily — compliance reminders (only fires for orgs with outstanding items).
SELECT cron.schedule(
  'send-compliance-reminders',
  '30 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://elcmnvgbmzusogudpenp.supabase.co/functions/v1/send-compliance-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
