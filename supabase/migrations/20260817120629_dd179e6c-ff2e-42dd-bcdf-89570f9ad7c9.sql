-- Re-point the site-transfer-cleanup schedule at the vault-held service role key.
-- The edge function now rejects any caller that is not service_role, so the old
-- anon-apikey invocation would 401.
select cron.unschedule('site-transfer-cleanup')
where exists (select 1 from cron.job where jobname = 'site-transfer-cleanup');

do $$
declare
  v_id bigint;
begin
  select jobid into v_id from cron.job where command like '%site-transfer-cleanup%' limit 1;
  if v_id is not null then
    perform cron.unschedule(v_id);
  end if;
end $$;

select cron.schedule(
  'site-transfer-cleanup',
  '15 2 * * *',
  $$
  select net.http_post(
    url := 'https://elcmnvgbmzusogudpenp.supabase.co/functions/v1/site-transfer-cleanup',
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