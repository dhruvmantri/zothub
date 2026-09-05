-- S6 — Which key is embedded in the reminder cron job?
--
-- The `send-reminders-hourly` job was scheduled out-of-repo and its command embeds
-- an `Authorization: Bearer <token>` header directly in the SQL stored in
-- `cron.job`. Anyone who can read that table can read the token. The question is
-- whether it is the ANON key (public by design, harmless) or the SERVICE ROLE key
-- (full database authority, bypasses every RLS policy — an effective master
-- credential sitting in a readable table).
--
-- ⚠️ SAFE TO RUN AND SAFE TO SHARE: this deliberately prints only the `role` claim
--    from inside the token. It never prints the token itself. Supabase keys are
--    JWTs, whose middle section is base64-encoded (NOT encrypted) and carries a
--    `role` field. Decoding that field reveals which key it is without revealing
--    the key.
--
-- Run in: Supabase dashboard -> SQL Editor. Read-only; writes nothing.

WITH jobs AS (
  SELECT
    jobid,
    jobname,
    schedule,
    active,
    substring(command FROM 'Bearer\s+([A-Za-z0-9._-]+)') AS token
  FROM cron.job
),
claims AS (
  SELECT
    jobs.*,
    split_part(token, '.', 2) AS payload_b64
  FROM jobs
)
SELECT
  jobid,
  jobname,
  schedule,
  active,
  CASE WHEN token IS NULL THEN 'no bearer token in this job' ELSE 'token present' END AS has_token,
  CASE
    WHEN payload_b64 IS NULL OR payload_b64 = '' THEN NULL
    ELSE (
      convert_from(
        decode(
          -- base64url -> base64, then pad to a multiple of 4
          rpad(
            translate(payload_b64, '-_', '+/'),
            ((length(payload_b64) + 3) / 4) * 4,
            '='
          ),
          'base64'
        ),
        'UTF8'
      )::json ->> 'role'
    )
  END AS token_role   -- <<< THIS is the answer
FROM claims
ORDER BY jobname;

-- HOW TO READ THE RESULT — paste only the `jobname` and `token_role` columns:
--
--   token_role = 'anon'          -> FINE. The anon key is public by design; it is
--                                   already in the browser bundle. Nothing to do
--                                   beyond versioning the schedule (R2).
--
--   token_role = 'service_role'  -> ACT. This is full database authority stored in
--                                   plaintext in a readable table. Rotate the
--                                   service-role key in the Supabase dashboard,
--                                   then reschedule the job reading the key from
--                                   Vault instead of inlining it. Rotating
--                                   invalidates the old key, so the edge function
--                                   secrets must be updated in the same sitting.
--
--   token_role = NULL            -> The job does not embed a JWT (it may use a
--                                   different auth method). Report what you see.
