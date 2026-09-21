#!/usr/bin/env bash
# Proves the R2 cron migration against a THROWAWAY Postgres, the same way
# scripts/test_o5_counters.sql proved the O5 one. Nothing here touches any real
# project. Needs Docker (`sudo dockerd` in a cloud session).
#
#   bash scripts/test_r2_cron_migration.sh
#
# The two checks that matter, and why:
#   - a MISSING secret must fail loudly and leave the working job ALONE.
#     Unscheduling first and discovering the secret is gone afterwards would
#     replace a working hourly job with nothing, and the only symptom would be
#     students not getting mail.
#   - re-running must leave exactly ONE job. Two jobs double-send every reminder.
set -uo pipefail
cd "$(dirname "$0")/.."
MIG=supabase/migrations/20260921000100_r2_version_reminder_cron.sql
NAME=r2test-$$
PORT=55432
pass=0; fail=0
ok(){ if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 — got '$2', wanted '$3'"; fail=$((fail+1)); fi; }

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pw -p $PORT:5432 postgres:16 >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 60); do PGPASSWORD=pw psql -h 127.0.0.1 -p $PORT -U postgres -c "select 1" >/dev/null 2>&1 && break; sleep 1; done
q(){ PGPASSWORD=pw psql -h 127.0.0.1 -p $PORT -U postgres -tAq -c "$1"; }
run(){ PGPASSWORD=pw psql -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=1 -f "$1" 2>&1; }

# 1. Real file on a database with no pg_cron.
out=$(run "$MIG"); case "$out" in *"pg_cron is not installed"*) r=yes;; *) r=no;; esac
ok "no pg_cron: refuses rather than silently skipping" "$r" "yes"

# Stub the Supabase-only objects so the migration BODY can be exercised.
PGPASSWORD=pw psql -h 127.0.0.1 -p $PORT -U postgres -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS cron; CREATE SCHEMA IF NOT EXISTS vault;
CREATE TABLE cron.job (jobid serial primary key, jobname text unique, schedule text, command text);
CREATE TABLE vault.decrypted_secrets (name text primary key, decrypted_secret text);
CREATE FUNCTION cron.schedule(p_name text,p_sched text,p_cmd text) RETURNS bigint AS
  $$INSERT INTO cron.job(jobname,schedule,command) VALUES (p_name,p_sched,p_cmd) RETURNING jobid;$$ LANGUAGE sql;
CREATE FUNCTION cron.unschedule(p_name text) RETURNS boolean AS
  $$DELETE FROM cron.job WHERE jobname=p_name; SELECT true;$$ LANGUAGE sql;
INSERT INTO cron.job(jobname,schedule,command) VALUES
  ('send-reminders-hourly','0 * * * *','SELECT net.http_post(...)'),
  ('archive-past-events-nightly','0 9 * * *','SELECT public.archive_past_events();');
SQL
BODY=$(mktemp); sed '/pg_extension WHERE extname/,+3d' "$MIG" | sed '/IF NOT EXISTS (SELECT 1$/d' > "$BODY"

# 2. No secret: must fail AND not disturb the live job.
run "$BODY" >/dev/null 2>&1
ok "no vault secret: the working job is left untouched" \
   "$(q "select schedule from cron.job where jobname='send-reminders-hourly'")" "0 * * * *"

# 3. With the secret: replaces cleanly.
q "insert into vault.decrypted_secrets values ('service_role_key','eyJhbGciOiJIUzI1NiJ9.FAKE.sig')" >/dev/null
run "$BODY" >/dev/null 2>&1
ok "with the secret: the job is scheduled hourly" \
   "$(q "select schedule from cron.job where jobname='send-reminders-hourly'")" "0 * * * *"
ok "it calls send-reminders" \
   "$(q "select command like '%functions/v1/send-reminders%' from cron.job where jobname='send-reminders-hourly'")" "t"
ok "it carries the bearer token from the vault" \
   "$(q "select command like '%Bearer eyJ%' from cron.job where jobname='send-reminders-hourly'")" "t"
ok "the OTHER cron job is not touched" \
   "$(q "select schedule from cron.job where jobname='archive-past-events-nightly'")" "0 9 * * *"

# 4. Idempotency — two jobs would double-send every reminder.
run "$BODY" >/dev/null 2>&1
ok "re-running leaves exactly one reminder job" \
   "$(q "select count(*) from cron.job where jobname='send-reminders-hourly'")" "1"
ok "and still exactly two jobs in total" "$(q "select count(*) from cron.job")" "2"

rm -f "$BODY"
echo; echo "EXECUTED $((pass+fail)) checks — $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
