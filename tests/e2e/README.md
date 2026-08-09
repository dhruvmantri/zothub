# Security E2E — signup gate + club claim flow

Reproducible, **local-only** end-to-end tests for the signup email gate and the
admin-reviewed, **logged-out-only** club-claim flow. These never touch production —
they run against a disposable local Supabase stack with **production-like
permissions** (the runner grants nothing; service_role grants come from migrations).

## Run

```bash
bash tests/e2e/run.sh
```

The runner **warns before wiping** local data (skip with `FORCE=1`), starts the local
stack, resets the DB (applies all migrations, incl. the exact service_role grants),
serves the edge functions with a **dummy Resend key** (no real email is sent — the
function returns HTTP 200 with an `{ error }` body, which is exactly the false-success
case these tests assert on) and `CAPTCHA_DISABLED=true` (the only supported way to skip
Turnstile; the functions otherwise fail **closed** with 503), runs the Node test, then
**stops the stack** (keep it with `KEEP_STACK=1`). Expected final line:
`PASSED 115, FAILED 0 … ALL GREEN ✅`.

A few tests use direct SQL against the local DB container (fault injection, and running
the migration's real backfill statement). If `docker exec` is unavailable they report as
**SKIPPED**, never as passed.

To run the test alone against a running stack, export `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (from `npx supabase status -o env`):

```bash
node --experimental-strip-types tests/e2e/claim-and-signup.e2e.mjs
```

Node ≥ 22 is required for `--experimental-strip-types` (lets the test import the edge
functions' TypeScript escape helpers directly).

## What it covers

- **DB @uci.edu gate (finding #1):** direct non-UCI `createUser` is blocked; a
  service-issued one-time authorization allows it exactly once (then consumed).
- **`email_verifications` lockdown (finding #1):** anon cannot insert (forge a
  code/role) or read pending codes.
- **verify-otp:** UCI student auto-approved; NON-UCI club created **`published=false`**.
- **Pending-club visibility (finding #2):** a `published=false` club is absent from
  the public directory RPC, the public profile RPC, and anon direct select; it appears
  only once published.
- **OTP delivery (finding #5):** `send-otp` inspects the response body — a Resend
  `{error}` (false success) → 500 **and the unusable OTP record is deleted**.
- **Atomic rate limits (finding #6):** per-email OTP-request limit → 429; per-code OTP
  verification-attempt cap (atomic) deletes the record; per-email claim limit → 429.
- **send-email authorization (finding #3):** unknown type → 400; each service-only
  template rejects anon AND ordinary users (401) and admits the service role; every
  authoritative template rejects anon; an ordinary user can't send admin
  (`waitlist_approved` → 403) or unowned (`application_status` → 404) mail; self /
  service paths pass. Escaping helpers neutralise `<script>`, quotes, `javascript:`,
  `data:`.
- **submit-club-claim (findings #1/#5):** logged-out-only; requires `source='zotspot'`
  AND `published=true` (non-zotspot / unpublished / already-claimed → 409); idempotent;
  no account-existence leak; per-email rate limit.
- **review-club-claim (findings #2/#4):** admin/non-admin/anon guards; approval creates
  a SEPARATE account, binds the club, **saves the approved email to `club_profiles`**,
  grants the role, and reports the TRUE email result; approve/reject share one lock
  (race → exactly one wins, no partial state); concurrent same-club approvals → one
  owner (loser cleaned up); rejection emails are retryable; password-reset link.
- **Approval rollback (forced failure):** a trigger makes the FINAL `status='approved'`
  update fail; asserts the club is left unbound (and its email cleared), the created
  account is deleted, the request stays `pending` with the lock released, no cleanup
  problems are reported — and that a retry then succeeds.
- **Logged-out-only claims:** a signed-in submission (student **and** admin tokens) →
  403 with no row written; logged-out still works.
- **Rate-limit failure → 503:** with the rate-limit function unavailable, `send-otp`
  and `submit-club-claim` fail closed (503) and write nothing; both recover afterwards.
- **Migration backfill:** runs the real `UPDATE` extracted from
  `20260727000400_pending_club_publish.sql` and asserts existing pending/rejected
  organic clubs become hidden while approved, ZotSpot-seeded, and waitlist-less clubs
  are untouched.
- **HTTP 200 + `{ error }`:** asserts `send-email` really does answer 200 on a Resend
  failure and that the shared checker marks it FAILED.

## Unit tests

Pure-logic tests run on Node's built-in runner (no extra dependencies):

```bash
node --experimental-strip-types --test src/lib/captchaToken.test.ts src/lib/emailResult.test.ts
```

- `emailResult.test.ts` — the ONE shared email-result check (HTTP 200 + `{error}` is a
  failure; bulk `ok:false`; skips; unverifiable responses are not assumed sent).
- `captchaToken.test.ts` — the captcha token lifecycle: a consumed token is cleared and
  forces a widget reset, so **every OTP resend carries a fresh, non-replayed token**.

The HTML-escape helpers also have Deno unit tests (same runtime the functions use):

```bash
deno test supabase/functions/send-email/email-escape.test.ts
deno test supabase/functions/send-email/rsvp-email-rules.test.ts
```

The E2E also exercises `esc`/`safeUrl` directly, so escaping is covered without Deno.
