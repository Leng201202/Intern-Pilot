-- Production-only template. Do not add real values to this file.
-- Create these Vault secrets in the hosted Supabase project first:
--   project_url       = https://<project-ref>.supabase.co
--   publishable_key   = hosted publishable/anon API key
--   scheduler_secret  = the same random value as the Edge Function secret
-- Then review and run this file once from the hosted SQL editor.

create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'internpilot-gmail-sync-daily',
  '0 1 * * *', -- 08:00 Asia/Bangkok
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
    ) || '/functions/v1/sync-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'publishable_key'
      ),
      'x-internpilot-scheduler-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'scheduler_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- The migration already schedules database-local follow-up generation at
-- 01:15 UTC daily and retention cleanup at 01:30 UTC on day 1 each month.
-- Check cron.job before re-running this template to avoid duplicate jobs.
