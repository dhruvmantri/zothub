# ZotHub — Launch Backlog & Remediation Plan

**Single source of truth** for every deferred / broken / missing / unverified item
across the redesign (implementation, design, planning stages). Supersedes the
scattered "still outstanding" notes in `00-handoff.md` §6 and
`implementation-audit.md` — when those conflict with this file, this file wins.

- **Created:** 2026-07-27 (post-merge, redesign live).
- **How to read it:** items carry stable IDs (`S1`, `D1`, …) grouped by category
  below, and are sequenced into phases at the top. Status: ⬜ open · 🔄 in progress
  · ✅ done · ⏸️ deferred-by-decision.
- **Scope note:** the redesign was a re-skin; most `missing-backend` items are
  original product gaps, not regressions. `broken-bug` and `accessibility` are
  empty — the redesign closed all known ones (see *Verified-closed*).

> ✅ **Prod state resolved (maintainer-confirmed 2026-07-27):** the `user_roles`
> security migration (S1) is **applied to the linked production DB**, and
> `verify-otp` (S3) is **deployed and ACTIVE (Version 3)**. Older docs calling
> these "not pushed" / "uncommitted" were stale on two counts — they were
> committed to git *and* are now live. N9 (the prod-state unknown) is closed.

---

## Phased plan (do in this order)

### Phase 0 — Security posture · ✅ mostly resolved (2026-07-27)
Pre-deploy blockers cleared (maintainer-confirmed): **S1 applied to prod**, **S3
deployed (v3 ACTIVE)**, **N9 closed**. One audit remains — no longer a deploy
blocker, but still worth doing:
1. **S2 — run the post-hoc admin-role audit.** The read-only query is now written:
   `scripts/audit_admin_roles.sql` (Q1 every role row with admins flagged, Q2
   admins-only vs the expected admin `zothub.uci@gmail.com`, Q3 sanity counts).
   Run it in the Supabase SQL Editor and review — confirm the only admin is the
   intended one and nobody self-granted while the hole was open. **Correction:**
   the migration only `DROP`s a policy — it deletes **no rows** (verified in the
   SQL), so despite the docs' "it destroys the evidence" claim, nothing was lost
   and rogue admin rows still show. Not a deploy blocker (S1 already applied).

### Phase 1 — Launch blockers · product credibility & completeness
5. **D1 — purge Test Club** (backup first; run the review query for attached
   real applications/RSVPs). It's the first thing every officer sees.
6. **MB4 — ship a Help / Support / Contact surface** (prd tags launch-blocking).
7. **MB1 — stop duplicate applications** (DB unique constraint / `ON CONFLICT`).
8. **D2 — fix stale `README.md`** access-model paragraph to match S3.

### Phase 2 — Verification pass · exercise "code-verified only" screens
Create the test data/logins, then walk N1–N8. Several unblock once D1 is done.
9. Test accounts: a **student** (with applications/RSVPs/saves/follows), an
   **admin** (`user_roles.role='admin'`), a **second student** (for capacity &
   member tests), and ≥1 **club team member**.
10. Walk **N1–N8** (populated Team row, MEMBER chip, student Messages/Activity,
    Waitlist pending+rejected, Admin approve/reject/delete, event-full guard,
    profile-missing nudge, RSVP-email preference behavior).

### Phase 3 — Polish & cleanup · quick wins, not launch-blocking
11. **P1** hero → WebP/AVIF (needs `cwebp`/`avifenc`). **DP3/DP4/DP5** delete dead
    assets/code. **DP6** club-name placeholder. **N8** reconcile RSVP-email prefs.
    **S4** harden OTP password hashing. **DP7/DP8/DP9** low-priority.

### Phase 4 — ZotPot seeding (item 3) · GATED on Phases 0–1 being clean
12. **MB5** — the claim/seed flow. Separate plan to be written when we get here
    (sourcing method + dedupe/verify + claim auth + `claimed`/`source` schema).

---

## security (4)

### ✅ (context) — Brand assets — see DP1/DP2, now shipped 2026-07-27.

### ✅ S1 — `user_roles` self-insert privilege-escalation migration — APPLIED TO PROD (2026-07-27)
- **File:** `supabase/migrations/20260723000100_drop_self_insert_user_roles_policy.sql` (git `4eb35e2`).
- **State:** Guarded + idempotent; drops the orphaned "Users can insert their own
  role on signup" INSERT policy that let any authed user self-grant `admin`.
  **Applied to the linked production DB** (maintainer-confirmed 2026-07-27) — the
  loophole is closed.
- **Follow-up:** S2 (post-hoc admin-abuse audit) is still worth running — the
  migration deletes no rows, so it removed no evidence.

### ⬜ S2 — post-hoc admin-role audit — query WRITTEN, run OUTSTANDING
- **Origin:** `00-handoff.md` + `implementation-audit.md` referenced an "abuse-check
  query [in the plan]" to run before deploying S1. Independent search confirmed
  **no such query ever existed**: grepped all `.md/.sql/.ts/.tsx/.toml` for "abuse"
  (only the doc refs + an unrelated `Privacy.tsx:70`); `plan.md:922-927` holds only
  per-migration **precondition** guards (`select 1 from pg_policies …`), not an
  abuse detector; `scripts/audit_auth_orphans.sql` is a **different** workstream
  (auth-orphan FK cleanup). Not renamed, not folded elsewhere — a planned step
  never written.
- **Now written:** `scripts/audit_admin_roles.sql` — strictly read-only (SELECT
  only), schema verified from migrations: Q1 every `user_roles` row (admins
  flagged, full context + timestamps), Q2 admins-only with a self-grant assessment
  vs the expected admin (`zothub.uci@gmail.com`), Q3 sanity counts.
- **Correction:** S1's migration only `DROP`s a policy, deleting no rows (verified)
  — so "it destroys the evidence" is **false**; any rogue admin row persists.
- **Outstanding:** the maintainer must **run it against prod and review** (this env
  can't reach prod). Not a deploy blocker (S1 applied). Phase 0.

### ✅ S3 — Day-0 auth (student auto-approve) — DEPLOYED (2026-07-27)
- **Files:** `supabase/functions/verify-otp/index.ts:150-234`; `src/pages/Signup.tsx`.
- **State:** Students auto-approved (get a `user_roles` row + `waitlist='approved'`);
  clubs still queued. **`verify-otp` deployed and ACTIVE — Version 3**
  (maintainer-confirmed 2026-07-27); the docs' "uncommitted" was stale.
- **Follow-up:** D2 — root `README.md` still describes the pre-auto-approve model;
  update it (Phase 1).

### ⬜ S4 — unsalted SHA-256 password stored during OTP flow (borderline / pre-existing)
- **Files:** `supabase/functions/send-otp/index.ts:24-31, 117-125`.
- **State:** Raw password hashed with single unsalted SHA-256 into
  `email_verifications.password_hash` until OTP verification. Rows transient; real
  credential lives in Supabase auth.
- **Risk/order:** Phase 3. Follow-up: salt + slow KDF, or don't store it at all.

---

## data-ops (2)

### ⬜ D1 — "Test Club" seed/demo data live in production
- **Where:** Prod DB only (no seed file in repo). Purge procedure + review query:
  `docs/strategy/notes-superseded-10-day-plan.md:100-108`.
- **State:** One club "Test Club" with junk opportunities (`opp 2/3/3/5`) + an event
  at "duh" — first thing an officer sees. Also why N1/N2 can't be verified (no members).
- **Risk/order:** Phase 1 step 5. Irreversible delete → **back up first**; check for
  real applications/RSVPs (they cascade from `club_id`).

### ⬜ D2 — root `README.md` stale on access model
- **File:** `README.md:84` (says signup needs manual admin approval; students are now auto-approved — S3).
- **Risk/order:** Phase 1 step 8. Low risk, doc-only.

---

## performance (1)

### ⬜ P1 — hero image not WebP/AVIF
- **File:** `public/images/hero-campus.jpg` (~233 KB, 1440×500), used at
  `src/pages/Landing.tsx:95` (`fetchpriority="high"`), the LCP element.
- **State:** JPEG already re-encoded 704 KB → 233 KB; no WebP/AVIF.
- **Risk/order:** Phase 3. Blocked on tooling (`cwebp`/`avifenc` not installed).
  Also **needs licensing** before public launch. (See DP3: `hero-bg.jpg` is dead.)

---

## deferred-polish (9)

### ✅ DP1 — favicon / og:image / apple-touch / manifest / theme-color — SHIPPED 2026-07-27
- **What shipped:** branded stacked-disc favicon (`.ico`+`.svg`+PNGs),
  `apple-touch-icon` (180), manifest icons (192/512 + maskable), `site.webmanifest`,
  `theme-color`, `og:image`+`twitter:image` (1200×630 dark card), `twitter:card`
  restored to `summary_large_image`. Wired in `index.html`; verified served 200 +
  build clean. Assets in `/public`; kit in `/brand`.

### ✅ DP2 — production outlined-glyph SVG for the mark — SHIPPED 2026-07-27
- All brand glyphs outlined from Instrument Sans (wght 700) to vector paths.
  Reproducible generator + fonts: `/brand/generator`. Kit: `/brand`
  (`mark-*.svg`, `wordmark-*.svg`).
- **In-app wordmark aligned to spec (2026-07-27):** `src/components/Logo.tsx` now
  renders weight **700** (`font-bold`) and italic `hub` as `--accent-text` (light)
  / `--accent` (dark, via `dark:text-accent`) — browser-verified `#0B4E8C` light /
  `#5AA2E6` dark. Was 600 + `#8FBEF2` in dark (unintentional drift, per
  `design-system.html §01`).

### ⬜ DP3 — dead asset `src/assets/hero-bg.jpg`
- 172 KB, **zero importers**. App uses `public/images/hero-campus.jpg`. Safe delete. Phase 3.

### ⬜ DP4 — dead code files
- `src/components/dashboard/DashboardLayout.tsx`, `src/components/NavLink.tsx` (0 importers),
  `src/pages/Index.tsx` (Lovable scaffold, `implementation-audit.md:82-84` — verify no
  importer, generic name). Phase 3.

### ⬜ DP5 — `@deprecated` type aliases with no consumers
- `src/types/index.ts:23,26,38,41` (`Question`/`Answer` aliases). Trivial. Phase 3.

### ⏸️ DP6 — `verify-otp` writes club_name placeholder (known pattern)
- `supabase/functions/verify-otp/index.ts:215` (`email.split("@")[0]`). Nav already
  skeletons while loading. Risk only if a club never completes setup. Phase 3.

### ⏸️ DP7 — RSVP-journey realtime UX deferred
- `supabase/migrations/20260710000200_add_messages_to_realtime.sql:29`. EventDetail
  already has working RSVP realtime; this is a scoped enhancement. Low priority.

### ⏸️ DP8 — accent-colored sent message bubbles (design open item)
- `docs/design/design-system.md:140`. Shipped as accent; "toneable on request." Cosmetic.

### ⏸️ DP9 — maintainer's pending UI tweaks + design-archive housekeeping
- `design-system.md:138`, `00-handoff.md:173,341`. Open-ended; not launch-blocking.

---

## missing-backend (5)

### ⬜ MB1 — duplicate applications allowed
- **Where:** `applications` table / `ApplicationForm` submit. `implementation-audit.md:815`.
- **State:** No unique constraint/guard; a student can hold multiple apps to one
  opportunity. Redesigned Activity UI hides the duplicate *invite* but can't prevent one.
- **Risk/order:** Phase 1 step 7. Add DB unique constraint / `ON CONFLICT`.

### ⬜ MB2 — `student_profiles.avatar_url` read but no setter
- Read by messaging; no upload screen. `implementation-audit.md:816-817`. Needs a
  storage bucket + RLS (Bucket B, maintainer decision). Falls back to initials (designed). Phase 4.

### ⬜ MB3 — shallow discovery search, no pagination
- `src/pages/Opportunities.tsx:113` / `Events.tsx:104` (`.limit(50)`), `Clubs.tsx`;
  client-side substring filter. `prd.md:154`. Scales poorly past 50 rows. Phase 4.

### ⬜ MB4 — no in-product help/support surface
- No `/help` `/faq` `/support` `/contact` `/report` route. `prd.md:155` (WS12) tags
  **launch-blocking**. Only an email exists. Phase 1 step 6.

### ⏸️ MB5 — ZotSpot seed / claim flow (item 3)
- Mocks `direction-11-v4-clubs.html`; `implementation-audit.md:388,394`. No
  `claimed`/`source` columns, no scraper, no claim mutation. **Deliberately deferred.**
  UI must ship marked "not yet live" with no dead buttons — verify that marking. Phase 4.

---

## needs-verification (9 · N9 ✅ closed 2026-07-27) — code exists, never exercised with real data/logins

| ID | Screen / behavior | Files | Needs to verify |
|---|---|---|---|
| N1 | Populated club Team row | `TeamManagement.tsx`, public in `ClubDetail.tsx` | club login + ≥1 `club_team_members` row (blocked by D1) |
| N2 | Messages MEMBER chip | `useMessages.ts:108-119`, `ConversationList.tsx:75-77`, `MessagesContainer.tsx:121-128` | a real club member in a student convo (depends on N1) |
| N3 | Student Messages + Activity | `StudentMessages.tsx`, `MessagesContainer.tsx`, `StudentDashboard.tsx` | student login w/ apps, RSVPs (incl. pending), saves, follows |
| N4 | Waitlist pending + rejected | `Waitlist.tsx`, `WaitlistRejected.tsx` | users at `status='pending'` (+30s poll) and `'rejected'` w/ reason |
| N5 | Admin dashboard | `admin/AdminDashboard.tsx` (`AdminRoute`) | admin login — approve/reject-w-reason/delete + stats/search/filter (ties to S1) |
| N6 | Event full/at-capacity guard | `useEventRSVP` + `rsvps` capacity trigger; `implementation-audit.md:683` | 2nd student RSVPing a capacity-1 event |
| N7 | Profile "still missing" nudge | `StudentProfile.tsx`; `implementation-audit.md:786` | a fresh/incomplete student profile |
| N8 | RSVP emails NOT preference-gated (doc self-contradiction) | `send-email/index.ts:33-37` | decide intended behavior; reconcile `prd.md:134` vs `:139` |
| ~~N9~~ ✅ | S1/S3 prod apply/deploy state | as S1/S3 | **RESOLVED 2026-07-27** — S1 applied to prod; `verify-otp` deployed v3 ACTIVE (maintainer-confirmed) |

---

## Verified-closed (do NOT re-plan — confirmed fixed in the redesign)

- Broken routes: `/reset-password` added; `/student/messages?to=` member link + handler
  (`MessagesContainer.tsx:32-61`); `NotificationCard` → `/club/dashboard/applications`.
- `normalizeOpportunityType()` coercion removed (`src/lib/formatters.ts:78-93`).
- Clubs category filter now data-derived (`Clubs.tsx`).
- `reviewed` status now settable; chart colors tokenised (`ClubAnalytics`).
- Accessibility sweep: labelled controls, 44px targets, 0/0 contrast on re-skinned
  screens — **no open a11y items**.
- Route-level code splitting; recharts out of the eager bundle (`vite.config.ts`).
