#!/usr/bin/env bash
# Run browser scripts against a dev server this script owns.
#
# Why: a separately-started `npx vite` does not reliably survive between
# commands in a cloud session, and a dead server makes EVERY assertion fail in
# a way that looks like a code regression. Owning the server for the length of
# the run removes that whole class of false result.
#
#   bash tests/browser/run.sh                 # every script
#   bash tests/browser/run.sh a5-role-guard   # one, by name
set -uo pipefail
cd "$(dirname "$0")/../.."

PORT="${ZOTHUB_TEST_PORT:-8080}"
export ZOTHUB_BASE_URL="http://127.0.0.1:${PORT}"
[ -x /opt/pw-browsers/chromium-1194/chrome-linux/chrome ] && \
  export PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome

npx vite --host 127.0.0.1 --port "$PORT" --strictPort > /tmp/zothub-vite-$$.log 2>&1 &
VITE_PID=$!
cleanup() { kill "$VITE_PID" 2>/dev/null; wait "$VITE_PID" 2>/dev/null; }
trap cleanup EXIT

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "$ZOTHUB_BASE_URL/" && break
  sleep 1
done
if ! curl -sf -o /dev/null "$ZOTHUB_BASE_URL/"; then
  echo "dev server never came up; last log lines:"; tail -20 "/tmp/zothub-vite-$$.log"; exit 1
fi

if [ $# -gt 0 ]; then
  SCRIPTS=()
  for name in "$@"; do SCRIPTS+=("tests/browser/${name%.mjs}.mjs"); done
else
  SCRIPTS=(tests/browser/*.mjs)
fi

total=0; passed=0; bad=0
for s in "${SCRIPTS[@]}"; do
  out=$(node "$s" 2>&1); code=$?
  line=$(echo "$out" | grep -E '^EXECUTED' | tail -1)
  n=$(echo "$line" | grep -oE 'EXECUTED [0-9]+' | grep -oE '[0-9]+')
  p=$(echo "$line" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+')
  total=$((total + ${n:-0})); passed=$((passed + ${p:-0}))
  if [ $code -ne 0 ]; then
    bad=$((bad + 1))
    printf '%-26s %s\n' "$(basename "$s" .mjs)" "${line:-NO RESULT LINE — script crashed}"
    echo "$out" | grep -E '^FAIL' | sed 's/^/    /'
  else
    printf '%-26s %s\n' "$(basename "$s" .mjs)" "$line"
  fi
done

echo "-----"
echo "EXECUTED $total checks — $passed passed; $bad script(s) failed"
[ "$bad" -eq 0 ] || exit 1
