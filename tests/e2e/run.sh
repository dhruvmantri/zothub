#!/usr/bin/env bash
# Local-only E2E runner for the signup gate + club-claim security tests.
# NEVER targets production — it uses the LOCAL Supabase stack only.
#
# Usage:      bash tests/e2e/run.sh          (prompts before wiping local data)
#             FORCE=1 bash tests/e2e/run.sh  (skip the prompt, e.g. CI)
#             KEEP_STACK=1 bash tests/e2e/run.sh  (leave the stack running after)
#
# Prereqs: Docker running, the Supabase CLI (via npx), Node >= 22 (for
# --experimental-strip-types, so the test can import the functions' TS helpers).
#
# Permissions are PRODUCTION-LIKE: this runner grants nothing. service_role table
# grants come from the migrations (see 20260727000200/00300/00500), so a genuinely
# missing grant fails the test instead of being masked by a blanket GRANT.
set -euo pipefail
cd "$(cd "$(dirname "$0")/../.." && pwd)"

export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
SB="npx supabase"

# Exact local container for THIS project (from config.toml project_id) — used only
# for diagnostics; the runner does not exec SQL into it.
PROJECT_REF="$(grep -E '^project_id' supabase/config.toml | sed -E 's/.*"([^"]+)".*/\1/')"
DB_CONTAINER="supabase_db_${PROJECT_REF}"

# Guard: `db reset` WIPES the local database. Confirm unless FORCE=1 / CI=true.
if [ "${FORCE:-}" != "1" ] && [ "${CI:-}" != "true" ]; then
  echo "⚠️  This will RESET (WIPE) your LOCAL Supabase database (container ${DB_CONTAINER})"
  echo "    and restart local containers. It never touches production."
  read -r -p "Proceed? [y/N] " reply
  case "$reply" in [yY]*) ;; *) echo "Aborted."; exit 1 ;; esac
fi

echo "==> Starting local Supabase (idempotent)…"
$SB start || true

echo "==> Resetting local DB (applies all migrations, incl. exact service_role grants)…"
$SB db reset --local

ENVFILE="$(mktemp)"
# Dummy Resend key → no real email is sent (send-email returns HTTP 200 with an
# { error } body, which is exactly the false-success case the tests assert on).
# CAPTCHA_DISABLED=true is the ONLY way to skip Turnstile: the edge functions fail
# CLOSED (503) on a missing TURNSTILE_SECRET_KEY otherwise. Never set it in prod.
cat > "$ENVFILE" <<EOF
RESEND_API_KEY=local_dummy_key_no_send
PUBLIC_SITE_URL=http://localhost:8080
CAPTCHA_DISABLED=true
EOF

echo "==> Serving edge functions…"
$SB functions serve --env-file "$ENVFILE" --no-verify-jwt >/tmp/zh_functions_serve.log 2>&1 &
SERVE_PID=$!
cleanup() {
  kill "$SERVE_PID" 2>/dev/null || true
  rm -f "$ENVFILE"
  if [ "${KEEP_STACK:-}" != "1" ]; then
    echo "==> Stopping local Supabase (set KEEP_STACK=1 to keep it running)…"
    $SB stop --no-backup >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "==> Waiting for the functions runtime…"
for _ in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "http://127.0.0.1:54321/functions/v1/submit-club-claim" || echo 000)
  [ "$code" != "000" ] && break
  sleep 2
done

echo "==> Exporting local connection env from 'supabase status'…"
eval "$($SB status -o env | sed 's/^/export /')"
export SUPABASE_URL="${API_URL}"
export SUPABASE_ANON_KEY="${ANON_KEY}"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"
export PUBLIC_SITE_URL="http://localhost:8080"

echo "==> Running E2E…"
node --experimental-strip-types tests/e2e/claim-and-signup.e2e.mjs
