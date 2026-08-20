# ZotHub — Handoff: pre-launch fix-up phase

**Read this first.** It is the entry point for the next development session. Written
2026-08-11, at the close of the tracking-consolidation phase and the start of the
**pre-launch fix-up phase**.

Companion documents, and the only ones you need:

| File | What it is |
|---|---|
| **[`BACKLOG.md`](./BACKLOG.md)** | **The single log of everything open.** If any other doc disagrees, this one wins. |
| [`../prd.md`](../prd.md) | Product definition — what ZotHub is and is meant to do. Spec, not a tracker. |
| [`design/design-system.md`](./design/design-system.md) | Tokens, type, spacing, the 6 operating rules. **AA contrast is a merge gate.** |
| [`design/mb5-claim-flow.md`](./design/mb5-claim-flow.md) | As-built record of the club-claim flow (shipped). |
| [`archive/`](./archive/) | Superseded planning docs. Historical only — every file is bannered. |

---

## 1. What this phase is

**One goal: make every page as good as the landing page, and fix everything that is broken,
before launch.**

The landing page got the full redesign treatment and is the quality bar. The rest of the app
was re-skinned but never re-reviewed as an experience, and it shows: navigation feels slow,
CTAs go to the wrong places, list pages each grew their own toolbar, URLs contradict their
labels. None of this is exotic — it is mostly **one inconsistency repeated across pages**.

Scope of this phase, in priority order:

1. **`UX1`–`UX17`** — the UI/UX defect log in `BACKLOG.md`. Logged with root causes; **not
   started**.
2. **Launch blockers** — `MB4` (Help/Contact surface), `MB6` (account deletion),
   `MB7`/`UX4` (real contact email), `P1-license` (hero photo). `D2` (README), `MB1`
   (duplicate applications) and `S2` (admin audit) are **closed**.
   **`D1` (purge test data) is deliberately LAST** — Test Club is the only club with real
   data attached and is needed to verify `N1`–`N7`. Delete it immediately before launch
   using `scripts/purge_test_data.sql`; `D1a` is the reversible interim that hides its
   junk opportunities from the public site meanwhile.
3. **Visible quality** — `MB5-logo` (no club has a logo), `MB2` (students can't set an
   avatar), `UX17` (empty states become the default once Test Club is gone).
4. **Verification** — `N1`–`N7`: seven screens that have only ever been checked by reading
   code, never used with real data. Needs test accounts; **Test Club is retained
   specifically so this is possible.**

**Deliberately deferred** (logged, do not start): `S5`/`R1`/`R2` (the `send-reminders`
hardening), `S4`, `MB3`. These are preventative — nothing is hurting a user today. The
maintainer's call was explicit: **usability first, then the nitpicky security/email work.**

**One exception worth raising early:** `S6` — the `send-reminders-hourly` cron job stores an
`Authorization: Bearer …` token **in plaintext in `cron.job`**, readable by anyone with DB
read access. If that is the service-role key it is effectively a stored master credential.
Confirm which key it is; if service-role, rotate. It is cheap to check and lives in the same
migration as `R2`.

## 2. Where the product actually is

Live at [zothub.app](https://zothub.app) on Vercel + self-owned Supabase.

**Shipped and working:** the full redesign; 724 seeded ZotSpot clubs; the admin-reviewed,
logged-out-only club-claim flow with Turnstile; the signup/email security hardening (strict
template allowlist, HTML escaping, one shared delivery check, atomic rate limits); students
auto-approved on `@uci.edu` OTP, clubs admin-reviewed and unpublished until approved.

**What a visitor sees right now** (verified read-only, 2026-08-11):

- 725 clubs — and **every single one renders grey initials**: 0 have a `logo_url`, 589 are
  re-hostable from `source_logo_url`, 136 have no source logo at all.
- **5 opportunities, all junk**: `opp 1`, `opp 2`, `opp 3`, `opp 3`, `opp 5`, all owned by
  **"Test Club"**. That is the entire opportunity inventory of the site.
- **0 active events.** 0 claimed clubs.

**Phase 0 verification is complete and the security posture is clean:** the `published`
backfill hid nothing it shouldn't; the duplicate-application constraint survived the Lovable
restore (`MB1` was a false alarm — two opportunities merely shared the title `opp 3`); and
the admin audit found exactly one admin, the expected one, never self-granted (`S2`).

Read that again before designing anything: **those 5 opportunities are test data that gets
deleted right before launch, so discovery ships EMPTY.** Design the empty state as the
default launch experience — do not let today's junk-filled screen mislead you (`UX17`).

## 3. The four root causes behind most of the defect log

Fix these and a dozen symptoms go with them. Do not fix the symptoms one page at a time.

**(a) There is no data layer.** TanStack Query is installed and wired — `App.tsx:54,64`
creates a `QueryClient` and wraps the tree — and then **`src/` contains zero `useQuery` or
`useMutation` calls.** All 17 data-driven pages hand-roll `useEffect` + `useState` +
their own `isLoading` skeleton. No cache, no dedupe, no shared loading state. This is why
navigation feels like the page never left (`UX1`) and why the avatar initials re-flash on
every route (`UX7`). Decide deliberately: adopt it, or drop the dependency. (`UX15`)

**(b) Auth-state CTAs silently bounce.** `Signup.tsx:57-63` redirects any authenticated
visitor to their dashboard. So every marketing CTA pointing at `/signup` sends a signed-in
user to Activity or Responses instead of where the button says. That is `UX9` and `UX10` —
and the same audit found `UX12`, a button labelled "Browse clubs" that links to
`/opportunities`. **Sweep every CTA label against its target and its behaviour in all three
auth states** (signed out / student / club).

**(c) Shared components exist, but no shared compositions.** `components/discover/` already
has `FilterChip`, `ViewToggle`, `DiscoverList`, `EmptyState` — but there is **no toolbar
component**, so Clubs / Events / Opportunities each assembled their own and drifted:
Opportunities has search+sort+view+filter, **Events has no sort**, **Clubs has no card/list
toggle** (`UX11`, `UX13`). Build the composition once, adopt it in three places.

**(d) Hooks expose the right signal; consumers ignore it.** `useAccountIdentity` returns
`isLoading` *specifically* so nav surfaces can skeleton instead of flashing an email-derived
name — its own comment says so. `club/ClubHome.tsx:97` honours it; `ClubTopNav.tsx:14` and
`StudentTopNav.tsx:12` drop it (`UX7`). When you fix a hook's consumer, check **all** of
them.

## 4. Rules that carry over — do not relearn these the hard way

**Deploy order is migrations → functions → frontend.** Vercel **auto-deploys on push to
`main`**, so the frontend ships first unless you deploy the backend before pushing. On
2026-07-27 that ordering nearly took signup down.

**`VITE_TURNSTILE_SITE_KEY` is inlined at build time.** A production build without it
renders a visible error and **blocks signup and club claims entirely** — by design
(fail-closed). It must be set in Vercel *before* the build. Server-side,
`TURNSTILE_SECRET_KEY` is required or `send-otp` / `submit-club-claim` return 503;
`CAPTCHA_DISABLED=true` is local-only and must never be set in production.

**Production is the maintainer's.** Do not commit, push, or deploy without explicit
approval, and do not write to prod. Read-only checks are fine when authorised. Note
`supabase db dump` prints "Initialising login role…" and may create a role on the remote —
avoid it under a read-only constraint; hand over SQL instead.

**Emails:** one shared delivery check at
`supabase/functions/_shared/email-result.ts`, imported by both the edge functions and the
client. **HTTP 200 carrying `{error}` is a failure** (Resend's false-success shape). Never
report "sent" or "notified" without checking it. All templates live in `send-email` behind a
strict allowlist and are HTML-escaped — `send-reminders` is the one path that still bypasses
this (`S5`).

**AA contrast is a merge gate**, and every design ships both light and dark palettes,
designed — never a naive inversion (`design/design-system.md` §5).

## 5. How to verify work in this phase

```bash
npx tsc -p tsconfig.app.json --noEmit          # must be 0 errors
npm run build                                   # must succeed
node --experimental-strip-types --test src/lib/captchaToken.test.ts src/lib/emailResult.test.ts   # 14/14
bash tests/e2e/run.sh                           # 115/115 — warns before wiping local data
```

`tests/e2e/run.sh` spins up a disposable local Supabase, runs the security suite with
production-like permissions, and stops the stack afterwards. **Run it before touching
anything auth-, email-, or claim-related** so a usability fix cannot silently regress the
security work.

For UI work, verify in the browser against the dev server — both themes, and at mobile
widths — not by reading the code. Several `UX*` items exist precisely because a screen was
only ever code-verified.

## 6. Useful state

- **Repo is clean at `6c69a8d`** plus the docs/tracking changes from this session (unstaged).
- `scripts/` — `verify_prod_state.sql` and `audit_admin_roles.sql` are **SELECT-only** and
  still need running; `verify_seeded_clubs.mjs` is a re-runnable seed check;
  `publish_seeded_clubs.mjs --unpublish` is the only sanctioned way to hide a seeded club.
- `/dev/clubs-preview` is a DEV-only fixture harness for the seeded-club UI (stripped from
  production builds).
- **No `CLAUDE.md` exists.** Consider writing one from §4 of this document.
