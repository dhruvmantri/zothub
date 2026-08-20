# MB5 — Admin-reviewed club claim flow (as built)

**Status:** ✅ **SHIPPED TO PRODUCTION 2026-07-27** (commit `6c69a8d`) — security-hardened
and verified on a local Supabase stack (`tests/e2e`, **115/115** green). Migrations pushed,
the 5 edge functions deployed, Turnstile configured on both sides and verified live. Builds
on the live MB5 seed (724 unclaimed ZotSpot clubs). This document is the **as-built record**;
open follow-ups live in [`../BACKLOG.md`](../BACKLOG.md).

## 1. Objective
Let a real club officer take ownership of an unclaimed (ZotSpot-seeded) club
profile, gated by admin review. On approval a **dedicated club account** owns the
seeded `club_profiles` row (keeping its stable `id`, name, description, socials) and
gains the `club` role. Removal is out of scope (admin-unpublish only).

## 2. Who can claim — LOGGED-OUT ONLY
Claims are **logged-out only**. For any signed-in user the claim banner renders
**nothing at all** (no banner, no CTA, no nudge), and `submit-club-claim` **rejects
authenticated submissions with 403** — the server is the authoritative gate. A person
submits a **dedicated club email**; on approval a **separate club account is always
created** for that email. There is deliberately **no** existing-account binding and no
dual-role path — one account = one role.

## 3. Data model
**`public.club_claim_requests`** (`20260727000300`): `club_id`, `claimant_email`,
`note`, `status` (pending/approved/rejected), `created_user_id` (the club account
created on approval), `rejection_reason`, `email_status` (`sent`/`failed` — drives
the admin resend UI), `processing_at` (the shared approve/reject lock), timestamps +
reviewer. Partial unique index: one **pending** claim per `(club_id, lower(email))`.
RLS: admins SELECT; all writes are service-role edge functions only. Exact
service_role grants are declared in the migration (no blanket grant).

**`public.signup_email_authorizations`** (`20260727000200`): service-only, one-time
grants that let an approved **non-UCI** club email pass the DB signup gate.

**`public.rate_limit_events`** + `public.rate_limit_hit(bucket,max,window)` /
`public.increment_otp_attempt(id)` (`20260727000200`): atomic, service-only rate
limiting / attempt counting (see §6).

## 4. The signup gate (keeps @uci.edu authoritative)
`enforce_uci_email` is a `BEFORE INSERT` trigger on `auth.users`. `@uci.edu` (and the
admin allowlist) always pass; any other domain must present a live, unconsumed
`signup_email_authorizations` row for that exact email, which the trigger consumes
atomically. `verify-otp` (club OTP signup) and `review-club-claim` (claim approval)
mint that one-time grant immediately before `admin.createUser`. `email_verifications`
RLS is locked down (no anon insert/select) so a code / role / email cannot be forged.

## 5. Pending clubs are invisible until approved
A normal club signup (`verify-otp` or the Google OAuth path) writes its
`club_profiles` row with **`published = false`**, so it is excluded from the public
directory (`get_all_clubs_public` filters `WHERE published`) and the public profile
(RLS `USING (published)`). The `publish_club_on_waitlist_approval` trigger
(`20260727000400`) flips it to `published = true` **only** when the club's waitlist
row transitions to `approved` (admin action). The owner can still see/edit their own
unpublished row via the owner RLS policy. (Seeded ZotSpot clubs are already published
and are claimed by binding an existing published row, so the claim flow is unaffected.)

The same migration **backfills existing data**: organic (`source IS NULL`) clubs whose
waitlist row is `pending` or `rejected` are set to `published = false`. Approved clubs,
ZotSpot-seeded listings, and clubs with no waitlist row are deliberately untouched, and
the statement is idempotent.

## 6. Abuse controls (atomic; no trusted IP)
The edge runtime has **no trusted client IP** (`x-forwarded-for` is caller-spoofable),
so limits are keyed on the **normalized email** via the atomic `rate_limit_hit`
function (advisory-locked count+insert, so it can't be raced): OTP requests
(3/email/hour), OTP verification (20/email/hour), claim submissions (5/email/hour).
The per-code OTP attempt cap uses the atomic `increment_otp_attempt` RPC (single
`UPDATE ... RETURNING`). If a rate-limit **check itself** fails, the request is refused
with **503** — never admitted unmetered.

Bot control is **Cloudflare Turnstile** on `send-otp` and `submit-club-claim`, and it
**fails closed**: without `TURNSTILE_SECRET_KEY` the functions return **503** unless a
deployment explicitly sets `CAPTCHA_DISABLED=true` (local/dev only). Production requires
**both** keys — `TURNSTILE_SECRET_KEY` (edge functions) and `VITE_TURNSTILE_SITE_KEY`
(client build); a production build missing the site key shows an explicit error and
blocks submission. Client-side, submission stays disabled until a valid token exists, the
widget shows loading/error states, and a consumed token is cleared with the widget reset
so **every OTP resend carries a fresh token** (tokens are single-use).

## 7. Email sending (send-email)
Strict runtime template allowlist — unknown types are rejected (400). Two tiers:
- **Service-role only**: `email_otp`, `claim_approved`, `claim_rejected`,
  `new_club_post`, `deadline_reminder`, `rsvp_reminder`.
- **Authoritative** (verify caller + derive recipient/content from DB ownership; a
  trusted service caller may supply them directly): `application_notification`,
  `application_confirmation`, `application_status`, `rsvp_confirmation`,
  `rsvp_declined`, `event_cancelled`, `waitlist_confirmation` (recipient = the
  signed-in caller's own email), `waitlist_approved`/`waitlist_rejected` (admin only;
  recipient derived from the referenced waitlist row).

No ordinary signed-in user can choose an arbitrary recipient or send official ZotHub
content — recipients are always DB-derived, self, or (for admins) a real waitlisted
user. All dynamic content is HTML-escaped and links are scheme-checked
(`send-email/email-escape.ts`, unit-tested).

**Delivery is judged by ONE shared checker** — `supabase/functions/_shared/email-result.ts`,
imported by both the edge functions and the browser client. It treats an **HTTP 200
carrying `{ error }`** (Resend's false-success shape) as a FAILURE, along with transport
errors, non-2xx responses, and bulk results with `ok:false`. Consequently no surface —
claim approval/rejection, resend, waitlist approve/reject, application, or event
cancellation — ever reports "sent"/"notified" for mail that did not go out; the admin UI
says so plainly and offers a retry.

## 8. Edge functions
- **`submit-club-claim`** (public, logged-out): validates a PUBLISHED, unclaimed
  ZotSpot listing (`source='zotspot'` AND `published=true`); idempotent on
  `(club,email)`; atomic per-email rate limit + Turnstile; never reveals whether an
  email already has an account.
- **`review-club-claim`** (admin, verified from JWT): `approve` / `reject` / `resend`.
  approve **and** reject share ONE transactional lock (a conditional transition out of
  `pending`), so they can't race into a split state. approve creates the account (via
  the one-time grant), atomically binds the club **only if still unowned** (saving the
  approved email onto `club_profiles.email`), grants `club`, and reports the TRUE email
  result (`email_status`). **Every** step is checked — including the final
  `status='approved'` write (via `.select()`, which also catches an affected-0-rows
  update). Any failure rolls back in reverse order (role removed, club unbound and its
  email cleared, created account deleted, lock released); cleanup failures are
  themselves checked and surfaced as `cleanupProblems` rather than swallowed, and the
  request is left `pending` so it can simply be retried. Both approval and rejection
  emails are retryable via `resend`.

## 9. Admin UI (`/admin` → `ClubClaimsPanel`)
Pending queue with **Approve** (confirmation naming the club + claimant) / **Reject
w/ reason**. A load **error** is surfaced (not shown as "no claims"). A second section
lists reviewed claims whose email **failed** (approval OR rejection), each with
**Resend**. Toasts report the true delivery outcome — never "sent" on a failure.

## 10. Change password
`ChangePasswordCard` requires the current password. This is **UX friction** (prevents
an accidental change; lightly deters a walk-up) — NOT, by itself, protection against a
hijacked session (a token-holding attacker could call `updateUser` directly). The real
server-side control is GoTrue's **`secure_password_change`** (Auth settings); enable it
server-side to make that guarantee real.

## 11. Prod rollout — ✅ COMPLETED 2026-07-27
Kept as the record of what was done (and the runbook for a rebuild).
Order: **migrations → functions → frontend.**

1. Back up, then `supabase db push` (migrations `20260727000200`, `00300`, `00400`,
   `00500`). `00400` also **backfills** existing pending/rejected organic clubs to
   `published=false` — expect those to disappear from the public directory.
2. **Set the edge-function secrets BEFORE deploying the functions**, or signup and
   claims will fail closed with 503:
   - `TURNSTILE_SECRET_KEY` — **required** (no captcha secret ⇒ 503).
   - `PUBLIC_SITE_URL=https://zothub.app`
   - Do **not** set `CAPTCHA_DISABLED` in production (it is the local/dev opt-out only).
3. `supabase functions deploy send-otp verify-otp send-email submit-club-claim review-club-claim`
4. Allowlist `https://zothub.app/reset-password` in Auth → redirect URLs.
5. Build/deploy the frontend with **`VITE_TURNSTILE_SITE_KEY`** set (a production build
   without it renders a visible error and blocks signup/claim submission). Both keys must
   come from the **same** Turnstile widget.
6. Optional: enable `secure_password_change` in Auth settings (see §10). **Still open** —
   tracked in `../BACKLOG.md`.

## 12. Non-goals
No self-service removal (admin-unpublish only). No automated ownership verification.
No bulk claim. General/accuracy questions route to the future Help/Contact surface (MB4).
