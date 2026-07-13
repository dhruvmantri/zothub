-- WS6: schedule the nightly auto-archive of past events.
--
-- public.archive_past_events() (defined in migration 20251223162738) flips
-- events.is_active to false for events more than one hour past their
-- event_date, but no cron.schedule for it was ever committed — only the
-- pg_cron/pg_net extensions were enabled (migration 20260121010216); the
-- hourly send-reminders job was scheduled manually, out-of-repo. This
-- migration commits the archive schedule so it is reproducible from the repo.
--
-- Runs daily at 09:00 UTC (01:00 PST / 02:00 PDT — "nightly" for the UCI
-- audience). The exact hour is not load-bearing: archive_past_events() only
-- archives events already more than an hour past, so any once-a-day time is
-- correct.
--
-- Idempotent: an existing job with the same name is replaced, never
-- duplicated. Only the 'archive-past-events-nightly' job is touched — any
-- other cron job (e.g. the manually created send-reminders-hourly) is
-- deliberately left alone. Archival semantics are unchanged (the function
-- body is not modified here).

DO $ws6$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION
      'pg_cron is not installed (expected from migration 20260121010216); refusing to silently skip scheduling archive_past_events()';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive-past-events-nightly') THEN
    PERFORM cron.unschedule('archive-past-events-nightly');
  END IF;

  PERFORM cron.schedule(
    'archive-past-events-nightly',
    '0 9 * * *',
    $job$SELECT public.archive_past_events();$job$
  );
END
$ws6$;
