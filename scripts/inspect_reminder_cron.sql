-- READ-ONLY. Run in the Supabase SQL editor and paste the output back.
--
-- Why this is needed before R2 can be written: the hourly reminder job exists
-- ONLY as production state — it was created by hand, out of repo. A migration
-- that re-schedules it without knowing its current shape risks either
-- double-sending (two jobs) or silently killing all reminder email (wrong name
-- unscheduled). Neither is discoverable afterwards without reading this table.
--
-- Nothing here is secret EXCEPT the `command` column, which on an edge-function
-- job usually embeds a service-role token in an Authorization header.
-- ⚠️ REDACT that token before sharing the output.

SELECT
  jobid,
  jobname,
  schedule,
  active,
  database,
  username,
  -- The token is masked here so the output is safe to paste as-is.
  regexp_replace(command, '(Bearer\s+)[A-Za-z0-9._\-]+', '\1<REDACTED>', 'g') AS command_redacted
FROM cron.job
ORDER BY jobid;

-- How recently has it actually run, and did it succeed? A schedule that exists
-- but fails every hour looks identical to a healthy one from cron.job alone.
SELECT
  j.jobname,
  r.status,
  r.return_message,
  r.start_time
FROM cron.job_run_details r
JOIN cron.job j ON j.jobid = r.jobid
ORDER BY r.start_time DESC
LIMIT 10;
