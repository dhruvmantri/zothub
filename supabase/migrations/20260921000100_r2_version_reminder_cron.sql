-- R2 — commit the hourly reminder schedule so it is reproducible from the repo.
--
-- THE RISK THIS CLOSES: `send-reminders-hourly` (jobid 1, `0 * * * *`) was
-- created by hand, out of repo. It exists ONLY as production state. If it is
-- ever dropped — a restore, a migration to a new project, a stray
-- `cron.unschedule` — **all reminder email stops silently**. Nothing alerts,
-- nothing errors, and the only symptom is students not receiving mail. Worse,
-- pass 3 of the function uses a one-hour lookback, so a pause does not delay
-- new-post emails, it SKIPS them permanently.
--
-- THE TOKEN. The live job embeds a service-role key in an Authorization header.
-- That must never enter git, so this migration reads it from Supabase Vault.
-- **Store it first** (see docs/HANDOFF.md) or this migration fails loudly and
-- changes nothing — which is the point: a missing secret must not be able to
-- leave the project with no schedule at all.
--
-- ORDER IS DELIBERATE: the secret is fetched and checked BEFORE the existing
-- job is touched. Unscheduling first and discovering the secret is missing
-- afterwards would replace a working hourly job with nothing.
--
-- Idempotent: safe to re-run. Only `send-reminders-hourly` is touched; every
-- other cron job (notably `archive-past-events-nightly`, jobid 2) is left alone.

DO $r2$
DECLARE
  v_token   text;
  v_command text;
  v_existing_schedule text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION
      'pg_cron is not installed (expected from 20260121010216); refusing to silently skip scheduling send-reminders';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION
      'pg_net is not installed; send-reminders is invoked over HTTP and cannot be scheduled without it';
  END IF;

  -- 1. Get the secret FIRST. Nothing is unscheduled until this succeeds.
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  -- Validate the SHAPE, not just the length. A length check alone is not
  -- enough, and that is not hypothetical: on 2026-09-21 this vault entry was
  -- found holding the literal placeholder text `<paste your service_role key>`
  -- — 29 characters, which sails past any "longer than 20" test. The migration
  -- would then have scheduled the job with a meaningless token and EVERY
  -- reminder email would have failed silently, hourly, forever. Caught only
  -- because the stored value was inspected rather than overwritten.
  --
  -- A Supabase service-role key is a JWT: three dot-separated base64url
  -- segments, the first beginning `eyJ` (the encoded `{"`), and well over 100
  -- characters in total.
  IF v_token IS NULL THEN
    RAISE EXCEPTION
      'Vault secret "service_role_key" does not exist. Store it first:  '
      'SELECT vault.create_secret(''<the real key>'', ''service_role_key'');  '
      'Nothing has been changed — the existing schedule is untouched.';
  END IF;

  IF v_token !~ '^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' OR length(v_token) < 100 THEN
    RAISE EXCEPTION
      'Vault secret "service_role_key" is not a JWT (got % characters, starting "%"). '
      'A placeholder or a truncated paste would schedule the job with a dead token '
      'and every reminder email would fail silently. Nothing has been changed.',
      length(v_token), left(v_token, 6);
  END IF;

  -- 2. Build the command. This mirrors the live job exactly (verified against
  --    cron.job on 2026-09-21): same URL, same headers, same body shape.
  v_command := format(
    $cmd$SELECT net.http_post( url := %L, headers := jsonb_build_object( 'Content-Type', 'application/json', 'Authorization', %L ), body := jsonb_build_object('time', now()) );$cmd$,
    'https://fguzpscguulkfctipeih.supabase.co/functions/v1/send-reminders',
    'Bearer ' || v_token
  );

  -- 3. Replace, never duplicate. Two jobs with this command would DOUBLE-SEND
  --    every reminder, and the claim-before-send fix in the function makes that
  --    survivable but still wrong.
  SELECT schedule INTO v_existing_schedule FROM cron.job WHERE jobname = 'send-reminders-hourly';
  IF v_existing_schedule IS NOT NULL THEN
    RAISE NOTICE 'Replacing existing send-reminders-hourly (schedule was %)', v_existing_schedule;
    PERFORM cron.unschedule('send-reminders-hourly');
  END IF;

  PERFORM cron.schedule('send-reminders-hourly', '0 * * * *', v_command);

  RAISE NOTICE 'send-reminders-hourly is scheduled at 0 * * * * and is now reproducible from the repo.';
END
$r2$;
