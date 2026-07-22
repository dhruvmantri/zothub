# ZotHub — Engineering Execution Plan

> **Active engineering source of truth.** ZotHub is **live in production** and in **normal product-development** (the Lovable→Supabase/Vercel migration is fully closed). `prd.md` is the product spec (what the product is + product-level gaps); `README.md` is setup/deploy. Read this for *what to build next and how*.
>
> **A fresh Claude Code session should read `README.md`, `prd.md`, and this file, then jump to "▶ Start here" immediately below.**

---

## Current stage: normal product development (migration closed)

> **Status banner (2026-07-09):** The Lovable Cloud → owned-Supabase/Vercel **migration and cutover are fully closed.** ZotHub is live in production. This document is now a **normal product-development execution plan**, not a migration or stabilization plan. Start with the **"▶ Start here"** section (recommended next workstream), then the **"Backlog — ranked workstreams"** — the Phase 1 audit, the Bug Inventory, and the migration-history repair audit that follow are kept as the historical record the current backlog is drawn from.

**Migration / infrastructure — closed:**
- ✅ Vercel production live; `zothub.app` **and** `www.zothub.app` verified on Vercel with valid TLS (DNS cutover complete).
- ✅ Owned Supabase project (`fguzpscguulkfctipeih`) live — schema, data, storage, and all 4 edge functions (`send-email`, `send-otp`, `verify-otp`, `send-reminders`) deployed; hourly reminder cron active. Resend DNS records preserved.
- ✅ **Supabase migration-history repair complete.** `npx supabase migration list --linked` shows all 34 local migrations matching remote; `npx supabase db push --linked --dry-run` reports **"Remote database is up to date."** The manual raw-SQL workaround is **no longer needed** — future migrations go through the normal `supabase db push` flow.
- ✅ Production smoke tests passed; core flows verified end-to-end (signup, OTP, waitlist, admin approval, student/club profile, opportunity creation, application submit/review/accept, event RSVP/approval, notifications, resume upload/view).
- 🟡 **Lovable** is no longer serving production traffic but is **kept untouched temporarily as a fallback.** Decommission is a deliberate **future manual step** — see the **"Lovable decommission checklist"** below. Do not decommission yet.

**How work is organized now:** the migration-era "audit before you fix" phases are done. From here, pick **one coherent workstream** from the ranked backlog, fix its root cause plus directly-coupled defects, verify, and update the docs. Add any newly found bug to the **Confirmed bug & risk inventory** before fixing it.

---

## ▶ Start here — recommended next workstream

> **The correctness/data-hygiene backlog (WS1–WS8 + auth-orphan cleanup) is fully cleared and production-verified (2026-07-13). The project is now in a pre-launch experience phase.** The recommended next pass is **WS10 — Design Direction & Brand (mockup + spec)**, the first of three phases in the **Pre-Launch Experience Roadmap** (WS10 → WS11 → WS12; see the Backlog and `prd.md`'s "Pre-Launch Experience Roadmap"). Triage any newly-appeared production incident first (add it to the Confirmed bug & risk inventory), otherwise start WS10.
>
> **Phase overview (see per-workstream detail blocks below):**
> - **WS10 — Design Direction & Brand:** a clickable design-direction mockup (via `artifact-design`) of the hero screens + a committed design spec (`docs/design-system.md`). Locks brand (evolve vs. rebrand), theme (dark-only vs. light), and typography before any re-skin. *User approves the mockup + spec before WS11.*
> - **WS11 — Design System Implementation & UX Refresh:** implement the spec; re-skin the existing shells/pages in **vertical slices** (public → student → club → admin), folding each screen's coupled UX fix and dead-code cleanup into its slice. Keeps the routing/state/hooks wiring intact.
> - **WS12 — New Feature Build-out:** the comprehensive catalog of net-new surfaces/features (support center, digest, saved searches, recommendations, account deletion, etc.), each tagged launch-blocking vs post-launch and verified at build. (Absorbs the former WS9 "future features.")
>
> **Guardrail:** the correctness backbone (capacity enforcement, realtime, RLS, application/RSVP integrity, email idempotency, cron) is solid — **re-skin, don't rebuild the wiring**; preserve all correctness migrations and the smoke suite.

> **✅ WS1 (Application-pipeline notifications & email correctness) is COMPLETE (2026-07-10).** Completion record below.
> **✅ WS2 (Realtime delivery for messages) is COMPLETE (2026-07-10).** Completion record below.
> **✅ WS3 (Unify follow/bookmark semantics & new-post notifications) is COMPLETE (2026-07-10).** Completion record below.
> **✅ WS4 (Event RSVP integrity & email correctness) is COMPLETE (2026-07-11).** Includes a club-terminology (Follow/Following/Unfollow) product-language cleanup. Completion record below.
> **✅ WS5 (Discovery access-model consistency — PUBLIC DISCOVERY) is COMPLETE (2026-07-12).** Completion record below.
> **✅ WS6 (Scheduler & launch-ops hardening) is COMPLETE (2026-07-13).** Nightly archive scheduled + production-verified, `send-reminders-hourly` confirmed, toast-pluralization fix shipped, and the operational ownership items (support contact, `/admin` waitlist owner, backup cadence) are now decided and recorded in the Operational responsibilities section. Completion record below.
> **✅ WS7 (Test / lint / type hardening) is COMPLETE (2026-07-13).** Completion record below.
> **✅ WS8 (UX polish & data hygiene) is COMPLETE (2026-07-14).** Completion record below.
> **✅ Auth-orphan cleanup — COMPLETE & production-verified (2026-07-13).** Migrations `20260714000300` (deterministic row cleanup) + `20260714000400` (restore/add the 11 managed auth.users FKs, drop the retained `messages` CASCADE FKs, fail loud on orphaned profiles) were pushed to production, migration history is synchronized, and the post-push audit confirmed zero orphans, `valid_user_roles = 3`, and **13 validated auth FKs with `messages` intentionally FK-free**. Completion record below.
>
> **All correctness/data-hygiene workstreams (WS1–WS8 + auth-orphan cleanup) are complete.** The active plan is the **Pre-Launch Experience Roadmap (WS10 → WS11 → WS12)** above — a design-direction mockup, then a design-system + UX refresh, then a feature build-out. The former WS9 "future features" are absorbed into WS12.

#### ✅ WS6 completion record (Scheduler & launch-ops hardening, 2026-07-13)

**Engineering — shipped, deployed, and production-verified:**
- **Migration `20260713000100_ws6_schedule_archive_past_events.sql`** — schedules `cron.schedule('archive-past-events-nightly', '0 9 * * *', 'SELECT public.archive_past_events();')` (09:00 UTC; the exact hour is not load-bearing since the function archives events already >1h past). Idempotent (unschedule-if-exists then schedule), touches only its own job name (`send-reminders-hourly` left alone), fails loudly if `pg_cron` is absent, and does not change `archive_past_events()` semantics. Pushed to production; the read-only `cron.job` query confirmed **both** `archive-past-events-nightly` (`0 9 * * *`) and the out-of-repo `send-reminders-hourly` (`0 * * * *`, calls the deployed `send-reminders` Edge Function) exist and are `active = true`.
- **Toast pluralization fix** — `useBookmarks` now uses a `TYPE_PLURALS` map ("opportunities"/"events"/"clubs") instead of naive `` `${type}s` `` ("opportunitys"); other bookmark/follow toasts audited and unaffected. Shipped via the normal Vercel flow.
- **Verified** on the local PG16.13 harness (real pg_cron 1.6.2): all migrations apply cleanly; re-applying the WS6 migration is idempotent; a real pg_cron background-worker run of the committed command archived a past event and left a future one active. `tsc`/`build` clean; lint 0 errors on the touched file.

**Operational ownership — decided and recorded (2026-07-13):** the three outside-code items are now assigned (support contact, `/admin` waitlist-queue owner, backup cadence). They live in the **Operational responsibilities** section below and are reflected in `prd.md`'s Launch Readiness Criteria. WS6 is therefore fully closed.

---

## Pre-Launch Experience Roadmap — WS10 → WS11 → WS12 (active plan)

> **Why this phase exists.** The correctness/data-hygiene backbone is done and solid; two code explorations (2026-07-13) confirmed the remaining pre-launch weaknesses are **experiential and visual**, not correctness: no onboarding/first-run, dead-end "complete your profile first" toasts (no link), no in-product help/support, unguarded high-regret review actions with no revert, a missing club→applicant message path, an unreachable `reviewed` status, shallow discovery search (client substring on title+club only, `limit(50)`, no pagination), and a signup that bounces to `/login` after OTP. Design-system debt: forced-dark single theme (no light palette), a phantom `font-display` class used 39× that resolves to nothing, an orphaned `DashboardLayout.tsx`, badge-color drift between list/detail, two mobile-nav paradigms, a skeleton/real-card mismatch, and dead `Index.tsx` + `club_followers`.
>
> **Phase-order rationale (critique baked in).** (1) Screen-coupled UX fixes and dead-code cleanups ride *inside* the re-skin (WS11), not a separate later phase — you're already touching those screens. (2) Re-skin in **vertical slices**, not one big-bang, so each slice is shippable/verifiable. (3) The mockup phase outputs a **written design spec** so the refresh implements rather than re-decides. (4) Accessibility + mobile are acceptance criteria in WS11, not deferred. (5) Every WS12 feature is tagged launch-blocking vs post-launch so "all features" stays honestly sequenced. (6) *Optional fast-path:* if launch timing tightens, the pure-logic experiential fixes (auto-sign-in after OTP, profile-link CTAs, review confirmations/revert, admin new-signup alerts) can ship as a small pass before the redesign; otherwise they ride in the WS11 slices. (7) Preserve the backbone — re-skin, don't rebuild the wiring; keep all correctness migrations and the smoke suite.

#### ⏭️ WS10 — Design Direction & Brand (mockup + spec) — *recommended next pass* — **[planned]**

**Goal:** lock the visual/interaction direction before touching 30+ screens.
**Do:**
- Build a **self-contained clickable design-direction mockup** (via the `artifact-design` skill) of the hero screens: Landing/marketing, a discovery list (`Opportunities`), a detail page, `StudentDashboard`, and a club review/dashboard screen.
- **Decisions to lock:** evolve the current indigo `#5565dd` / coral `#dd7255` on dark **vs.** a fresh rebrand; **dark-only vs. add light mode**; the real display typeface behind `font-display`; unify the two mobile-nav paradigms.
- **Output:** a committed **`docs/design-system.md`** design spec — tokens (color, type scale, spacing, radius, shadow, motion), component treatments, empty/loading/error patterns, nav model, mobile + a11y baseline. This is the contract WS11 implements.
**Evidence to inspect:** `tailwind.config.ts`, `src/index.css`, `src/components/ui/*`, `src/components/Logo.tsx`, `src/components/ui/page-transition.tsx`, the Landing/discovery/dashboard pages.
**Done / verification:** the user reviews and **approves the mockup + spec** before WS11 begins. (No app code changes required in WS10 beyond the mockup artifact + the spec doc.)

#### ⏭️ WS11 — Design System Implementation & UX Refresh (vertical slices) — **[planned]**

**Goal:** implement the WS10 spec and re-skin every surface, folding each screen's UX fix + cleanup into its slice. Keep routing/state/hooks (`RoleBasedLayout`, `Student/ClubLayout`, `DashboardTabs`, card + hooks layer) intact.
- **Foundation first:** define/fix `font-display` + type scale; shared `<EmptyState>`; route all loading through `PageLoader`; single type→badge-color map; unified card treatment; motion via `ui/page-transition.tsx`; theme decision from WS10. **Delete dead code:** `src/pages/Index.tsx`, `src/components/dashboard/DashboardLayout.tsx`, unused `club_followers` reads/types.
- **WS11a — Public/marketing + discovery:** `Landing`, `Opportunities`/`Events`/`Clubs`, detail pages. Fold in: server-side search depth + true multi-facet filters + pagination; logged-out apply/RSVP CTA carries return-to context.
- **WS11b — Student:** `StudentDashboard`, `StudentFeed`, `StudentProfileSetup`, `StudentMessages`. Fold in: auto-sign-in after OTP; first-run/profile-completion flow + nudges; replace dead-end "complete your profile" toasts (`ApplicationForm.tsx`) with inline links.
- **WS11c — Club:** `ClubHome` tabs, `CreateOpportunity`/`CreateEvent` + edits, `ApplicationReview`/`RSVPReview`, `ClubAnalytics`, `TeamManagement`. Fold in: confirmation dialogs + revert on accept/reject; wire the `reviewed` status; **"Message applicant"** from review (backend exists); theme-aware analytics palettes (via `dataviz`).
- **WS11d — Admin + shared:** `AdminDashboard`, `Notifications`. Fold in: admin new-signup alert (email/in-app); bulk approve/reject.
**Per-slice done / verification:** matches the spec visually; a11y + mobile pass; `tsc -p tsconfig.app.json --noEmit`, `npm run build`, focused lint clean; Playwright smoke expanded for the slice; targeted manual drive. Each slice is its own branch/PR.

#### ⏭️ WS12 — New Feature Build-out (comprehensive catalog) — **[planned]** *(absorbs former WS9)*

**Goal:** build the net-new surfaces/capabilities not coupled to a single re-skinned screen. **Tag each [launch-blocking] / [post-launch] and verify scope at build time.** Full catalog in `prd.md`'s Pre-Launch Experience Roadmap; summary:
- **Support & trust:** in-product **Support Center** (`/help`: FAQ, Contact Support → `zothub.uci@gmail.com`, Report an Issue, troubleshooting) **[launch-blocking]**; self-service account deletion **[compliance]**; update the live `/privacy` contact line **[launch-blocking, tiny]**.
- **Onboarding/activation:** profile-completeness indicator + guided checklist; post-login return-to-context (if not fully covered in WS11a).
- **Student engagement:** weekly email digest of followed-club posts; saved searches / opportunity alerts; application tracking timeline; personalized/matched recommendations.
- **Club recruiting:** applicant notes/rating/shortlisting; templated status-change messaging; saved application filter views.
- **Discovery/search:** full-text server-side search; multi-facet filters; pagination (if not fully delivered in WS11a).
- **Admin/access model:** relax gated beta → open `@uci.edu` signup (keep OTP + DB domain trigger); admin audit surfacing.
- **Platform/quality:** error monitoring (e.g. Sentry); RSVP confirmation-email consistency (no-questions path currently sends none); expanded authenticated-journey e2e; accessibility audit pass.
- **Parked (post-launch/long-term):** multi-campus, premium/monetization, paid ticketing.
**Per-feature done / verification:** same rigor as WS1–WS8 (`tsc`/`build`/lint, expanded Playwright, the local Postgres harness for DB changes, targeted manual drive).

---

#### ✅ WS7 completion record (2026-07-13)

**What shipped (no new dependencies; no product/auth/RLS/email/migration behavior changed):**
- **Playwright repair** — `playwright.config.ts` imported `lovable-agent-playwright-config`, which is not in `package.json` (and never was on the owned stack), so no e2e could run. Rewritten as a standard `@playwright/test` `defineConfig` (already a dependency): `testDir: e2e`, single chromium project, and a `webServer` that boots vite on `127.0.0.1:8080` (explicit loopback — the app's dev default `host: "::"` needs IPv6, which not every CI/sandbox has). The dev server gets real `VITE_SUPABASE_*` vars when present, otherwise **unreachable placeholders** (the Supabase client throws at boot without env vars; with placeholders, data pages render their documented loading/empty/error states — so the suite is backend-independent). `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally points at a pre-installed Chromium (sandbox/CI); unset, it's a no-op. `playwright-fixture.ts` now re-exports `test`/`expect` from `@playwright/test`. Added `npm run test:e2e`; `test-results/`/`playwright-report/` gitignored.
- **Smoke e2e (`e2e/smoke.spec.ts`, 9 tests)** — landing hero + "Browse Opportunities" CTA; `/opportunities`, `/events`, `/clubs` render their page shells (heading + search) without crashing; `/privacy` renders; unknown route → 404 page; `/login` renders the login form; `/signup` renders; a protected route (`/student/dashboard`) redirects a logged-out visitor to `/login`. Every test also fails on any **uncaught page error** (`pageerror`), so an ErrorBoundary crash can't pass. Assertions are mode-agnostic (they hold against a real backend too). Authenticated journeys (apply/RSVP/review) need a seeded backend — deliberately out of smoke scope.
- **All 26 ESLint errors cleared** (warnings deliberately untouched — see below): **16× `no-explicit-any`** — removed `: any` from Supabase query-result callbacks in `StudentDashboard`, `StudentFeed`, `ClubFeed`, `Clubs`, `ApplicationReview`, `RSVPReview` and let the typed client infer (it inferred everything except the JSONB columns, which got explicit boundary casts: `answers` → `FormAnswer[]`, `application_questions`/`rsvp_questions` → `FormQuestion[]` — the shapes the form/question-builder flows write); typed `StudentDashboard`'s `stats` array (`icon: LucideIcon`, optional `link`) replacing three `(stat as any).link`; `send-reminders` now pre-declares `newPostEmails: 0` in `results` instead of `(results as any).newPostEmails = …` (same response payload — the field was always assigned before the response). **4× `prefer-const`** (`ClubAnalytics`, `Clubs`). **3× `no-empty-object-type`** — empty `interface X extends Y {}` → `type X = Y` (`ui/textarea`, `ui/command`, `useWaitlist`). **2× `no-case-declarations`** — braces around the `application_status` case block in `send-email` (pure syntax). **1× `no-require-imports`** — `tailwind.config.ts` now ESM-imports `tailwindcss-animate`.
- **React Router v7 future flags** (the optional scope item) — `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` on `BrowserRouter`; verified in a real browser that the per-route Future Flag warnings are gone.

**Verified:** `npx playwright test` — **9/9 pass** against the vite dev server with the placeholder backend. `npm run lint` — **0 errors** (31 warnings remain: the pre-existing `react-hooks/exhaustive-deps` + `react-refresh` warnings, intentionally out of this pass's "clear the errors" scope). `tsc -p tsconfig.app.json --noEmit` and `npm run build` clean. Console check on a live page: no router future-flag warnings; the only console noise with the placeholder backend is the expected failed-fetch messages of the empty/error-state path. *Environment notes:* this sandbox pre-installs Chromium build 1194 while `@playwright/test` 1.57 wants 1200, so the run used `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium` (on a normal dev machine, `npx playwright install chromium` is the standard path); `deno` is unavailable here, so the two edge functions got no `deno check` — their changes are lint-only and behavior-identical (a brace-wrapped case block; a pre-declared counter field).

**Deployment steps a human must run (after merge; nothing deployed by this branch):** frontend ships via the normal Vercel flow on merge. Edge Functions: **no redeploy required** (`send-email`/`send-reminders` changes are behavior-identical lint fixes); redeploying both at the next routine deploy keeps deployed source in sync with the repo. No DB changes.

---

#### ✅ Auth-orphan cleanup record (2026-07-13) — COMPLETE & production-verified

*(Revised 2026-07-13 after review: messages FKs dropped in favor of preservation; FK migration fails loud instead of leaving NOT VALID constraints; existing FKs verified by referenced column + ON DELETE action; migrations use the next monotonic versions after WS8; root cause stated as inference.)*

**Production facts (maintainer-confirmed):** `public.user_roles` has **8 rows** whose `user_id` no longer exists in `auth.users`, and **3 valid rows**.

**Root cause (strong inference, not a directly-verified restore record):** migration `20251223013805` *declares* an FK on `user_roles.user_id → auth.users`, yet production carries orphaned `user_roles` rows — which that FK, if present and validated, would forbid. The most consistent explanation is that production was stood up by `pg_restore` from the Lovable dump with `auth.users` intentionally not migrated, so several originally-declared `auth.users` FKs could not validate against the fresh `auth.users` and were dropped/skipped. The production audit (Q1) shows the loss was **partial/inconsistent**: `user_roles` (and, by inference, the other per-user tables that now carry orphans) lost their FK, while `messages.sender_id`/`receiver_id` **retained** their original `ON DELETE CASCADE` — which is exactly why this pass must actively drop the messages FKs rather than assume them gone. The cleanup does **not** depend on any of this being proven — it targets rows referencing a nonexistent auth account, drops the messages FKs whether or not they exist, and no-ops on an already-clean DB. The two post-repair FKs (`rsvps.status_updated_by` WS4, `club_team_members.user_id` WS8) are real in production.

**Full schema audit — all 15 user-ID columns, classified** (`scripts/audit_auth_orphans.sql` is the runnable read-only version):

| column | orphan classification | cleanup (`…000200`) | FK (`…000300`) |
|---|---|---|---|
| `user_roles.user_id` | **safe to delete** — a role grant for a nonexistent account authorizes nothing (`auth.uid()` can never match) and anchors no content | DELETE | CASCADE |
| `bookmarks.user_id` | safe to delete — private saved-list of a dead account | DELETE | CASCADE |
| `notifications.user_id` | safe to delete — inbox of a dead account | DELETE | CASCADE |
| `notification_preferences.user_id` | safe to delete — settings of a dead account | DELETE | CASCADE |
| `reminder_logs.user_id` | safe to delete — cron dedup ledger for a recipient that can never recur (new accounts get new UUIDs) | DELETE | CASCADE |
| `club_followers.user_id` | safe to delete — legacy table, unread since WS3; doubly inert | DELETE | CASCADE |
| `waitlist.user_id` | safe to delete — a queue entry that can never be approved (its auth account doesn't exist; approving would only re-create orphaned `user_roles` rows) | DELETE | CASCADE |
| `messages` — **both** parties dead | safe to delete — invisible to every living user (RLS: `sender_id = auth.uid() OR receiver_id = auth.uid()`) | DELETE (one-time) | **FK dropped, not recreated** (see below) |
| `messages` — exactly **one** party dead | **preserve** — the living party's conversation history | none | **FK dropped, not recreated** (see below) |
| `student_profiles.user_id` | **requires manual review** — anchors applications/RSVPs (expected 0; cleaned in 2026-07-09 QA) | none | CASCADE (migration **hard-fails** if any remain) |
| `club_profiles.user_id` | **requires manual review** — anchors opportunities/events/applications (expected 0) | none | CASCADE (migration **hard-fails** if any remain) |
| `waitlist.reviewed_by` | **safe to null** — audit metadata; the review record itself is kept | SET NULL | SET NULL |
| `page_views.user_id` | **safe to null** — column is already "nullable for anonymous visitors"; the analytics row keeps counting | SET NULL | SET NULL |
| `club_team_members.user_id` | already self-healing (WS8 FK, production-confirmed) | audit-only | excluded (exists) |
| `rsvps.status_updated_by` | orphans impossible (WS4 FK enforced since the column was created) | audit-only | excluded (exists) |

**`messages` — the existing auth FK is DROPPED and not recreated (revised policy).** `sender_id`/`receiver_id` are `NOT NULL`, so `ON DELETE SET NULL` is impossible without a schema change; `ON DELETE CASCADE` — the original behavior declared in `20251223013805`, and **which production still has** (Q1 confirmed: the restore did not lose the messages FKs) — deletes a **living** user's conversation history when the other party is deleted, contradicting the preservation decision; `RESTRICT/NO ACTION` would block deleting any account that ever messaged. So `20260714000400` **actively drops any auth.users FK on `messages.sender_id`/`receiver_id`** (found by catalog lookup on the referencing column + referenced `auth.users.id`, not by name) and does **not** recreate it. This converges pristine (where the original CASCADE FKs are present) and drifted/production (where Q1 shows CASCADE present) onto the **same** state: `messages` carries no auth FK, columns stay `NOT NULL`, rows/RLS unchanged. Preserving history *and* re-adding integrity later needs a **separate product decision** (nullable columns + SET NULL, or a "deleted user" tombstone) — *a documented follow-up, not part of this pass*. The cleanup migration still one-time-deletes both-parties-dead rows (unreadable by anyone).

*Not user references (audited, out of scope):* `notifications.related_id`, `reminder_logs.target_id`, `page_views.item_id` (polymorphic content ids); `applications.student_id`/`rsvps.student_id`/`*.club_id` (public→public FKs — these restored intact, so profile-layer orphans are impossible); `email_verifications` (email-keyed, no user column).

**What shipped (migrations use the next unused versions after the applied WS8 migrations — `20260714000300`/`20260714000400` — so migration history stays monotonically increasing; logic is independent of WS8, and `db push` applies them as the next new versions):**
- **`scripts/audit_auth_orphans.sql`** — read-only, structured for the Supabase SQL Editor (5 numbered queries, **run one at a time** since the editor shows only the last result set): **Q1** existing auth FKs verified by referenced column + ON DELETE; **Q2** orphan counts for all 15 columns; **Q3** one consolidated result set with **row-level detail of every row the cleanup will DELETE or SET NULL** (across all 10 classes, not just user_roles/waitlist); **Q4** manual-review/preservation detail (orphaned profiles with dependency counts + one-party-dead messages) — **any row here means STOP**; **Q5** valid `user_roles` sanity (expected 3).
- **Migration `20260714000300_cleanup_orphaned_auth_user_refs.sql`** — deletes only the deterministic-junk classes; nulls `waitlist.reviewed_by`/`page_views.user_id` dead references; deletes both-parties-dead messages; **never touches** profiles, one-party-dead messages, or anything anchoring content. Idempotent; no-op on a healthy DB.
- **Migration `20260714000400_restore_auth_user_fks.sql`** — **Step 1:** drops any auth.users FK on `messages.sender_id`/`receiver_id` (catalog lookup by referencing column + referenced `auth.users.id`, name-agnostic; no-op once gone; not recreated). **Step 2:** adds the **11 managed** auth.users FKs (9 CASCADE + 2 SET NULL) as **plain VALIDATED constraints** via a catalog-driven DO block. **Unambiguous success state:** it completes only if all 11 are present and validated and `messages` carries no auth FK. An existing managed FK is skipped **only** after verifying its **referenced column (`id`) and ON DELETE action** match the spec — a mismatch **raises**. If a managed column still has an orphan (only the manual-review profile classes), the `ADD CONSTRAINT` **fails loud** (raises with guidance) and the whole migration rolls back, rather than leaving an unvalidated constraint. The pre-existing WS4/WS8 FKs are left untouched. Idempotent.

**Verified (two local PG16.13 harnesses — both converge on 13 validated auth FKs with `messages` FK-free):**
- *Pristine path:* all **44** migrations apply cleanly in sorted order (the cleanup migrations run after the WS8 migrations — no dependency inversion). This models a database that **kept its messages CASCADE FKs** (like production): before the cleanup pass, `messages` has both `messages_sender_id_fkey` and `messages_receiver_id_fkey` (CASCADE); `20260714000400` **drops both** (NOTICE emitted) and adds the 6 never-had managed FKs, ending at **13 auth FKs / 13 validated, `messages` carrying no auth FK, `sender_id`/`receiver_id` still `NOT NULL`**; idempotent re-run stays 13 with messages FK-free; audit runs clean and read-only.
- *Production-drift simulation:* applied the 42 pre-existing migrations, **dropped the 7 original auth FKs** (messages then already FK-free), seeded the known facts (8 orphaned + 3 valid `user_roles`) plus one orphan of every class **and** the preservation cases (orphaned club+student profiles anchoring an opportunity + 2 applications; one-party-dead messages both directions; dead reviewer on a valid waitlist row; dead viewer + anonymous page_views). Audit reported **exactly** the seeded matrix (incl. trigger-generated orphan notifications, caught generically). Cleanup: all delete-class orphans removed; `user_roles` = 3; every valid sibling survived; `reviewed_by` nulled with row kept; both-dead message deleted; **both one-sided messages, both orphaned profiles, and both applications preserved**; idempotent. FK migration: the messages-drop is a no-op (already gone); **with orphaned profiles present it failed loud and rolled back (still 2 FKs, nothing partially added)**; after simulating the manual-review resolution it succeeded at **13 FKs / 13 validated with `messages` carrying no auth FK** (columns still `NOT NULL`); CASCADE + SET NULL exercised live on account deletion; future-write enforcement proven (a dead-ref insert is rejected 23503); an existing FK with the **wrong ON DELETE** correctly **raised**; idempotent re-run. `tsc`/`build` clean; lint 0 errors (31 pre-existing warnings); Playwright smoke 11/11 (no frontend changes this pass).

**Deployed & production-verified (2026-07-13):**
1. **Pre-push audit** — `scripts/audit_auth_orphans.sql` (read-only) was run against production: Q4 (manual-review) returned **zero rows**, Q1 confirmed the two legacy `messages` CASCADE FKs were present, Q2 showed `user_roles = 8` orphaned / rest 0, and Q5 showed `valid_user_roles = 3`.
2. **Push** — `npx supabase db push --linked` applied `20260714000300` + `20260714000400` to production (migration history synchronized; no Edge Function redeploy, no frontend change in this pass).
3. **Post-push confirmation** — re-running the audit confirmed the intended end state: **zero orphans across all 15 user-ID columns**, `valid_user_roles = 3`, and **13 auth.users FKs, all validated (`convalidated = t`)**, with `messages` intentionally carrying **no** auth FK (`sender_id`/`receiver_id` still `NOT NULL`). The workstream is closed.

**Documented follow-up (separate product decision, not this pass):** re-adding referential integrity for `messages` — via nullable `sender_id`/`receiver_id` + `ON DELETE SET NULL`, or a "deleted user" tombstone — so account deletion neither orphans nor cascades away a surviving party's history. Captured here so it isn't lost; no work is scheduled.

---

#### ✅ WS8 completion record (2026-07-14)

**All eight documented WS8 items shipped (no new dependencies; no auth/RLS/email/discovery behavior changed beyond the fixes themselves):**

1. **Render-time `navigate()` removed** — `Waitlist`/`WaitlistRejected` replaced the `if (!user) { navigate("/login"); return null; }` render-body call with a declarative `<Navigate to="/login" replace />`. No more "Cannot update a component while rendering" warning. (The role-based redirects in `Waitlist` were already in a `useEffect`.)
2. **Role-less pending OAuth users routed to `/waitlist`** — `Login`'s redirect effect keyed only off `user && role`, stranding a Google-OAuth user who is approved-pending (roles are granted only on approval, so `role` is null). It now also consumes `useWaitlist`: a logged-in role-less user is sent to `/waitlist` (status `pending`) or `/waitlist-rejected` (status `rejected`) once waitlist load settles; `null`/`approved` status never triggers a spurious redirect, and the role branch still handles approved users. Matches `ProtectedRoute`'s existing pending/rejected routing.
3. **Unsubscribe auto-opt-out preserves loaded prefs** — `Unsubscribe.checkAuthAndLoadPreferences` built the auto-disable payload from the `preferences` **state**, which (because `setState` is async) still held the all-true defaults, silently re-enabling every other preference. It now builds `newPrefs` from a local `loadedPrefs` (the freshly fetched row, falling back to defaults only when no row exists), disabling just the `type` from the email link.
4. **Orphaned club team members hardened (migration `20260714000200`)** — `club_team_members.user_id` was nullable with **no FK**, so a row pointing at a dead (never-migrated) Lovable auth UUID rendered as a real member and its "Message" button would target a ghost. The migration is self-guarding: it first NULLs any `user_id` absent from `auth.users` (dead references only — cannot touch an active account, keeps the roster row's name/email/role), then adds `FK (user_id) → auth.users(id) ON DELETE SET NULL` so future auth deletions self-heal. The existing UI already hides the Message button when `user_id` is null, so a nulled link degrades gracefully. **Because step 1 removes every possible orphan before step 2, the FK add cannot fail regardless of live data** — but the read-only orphan check (below) should still be run against production first to confirm the expected zero-orphan state.
5. **`/privacy` names all processors** — the "Service Providers" line now names **Supabase** (database/auth/storage), **Vercel** (hosting), and **Resend** (email) explicitly, replacing "Resend … authentication, and hosting." No stale "Lovable."
6. **`waitlist.reviewed_by` recorded** — `approveUser`/`rejectUser` now resolve the acting admin via `supabase.auth.getUser()` and write `reviewed_by` (null-safe) alongside `status`/`reviewed_at`, giving the approval queue an audit trail. The column already existed.
7. **Bookmark uniqueness completed (migration `20260714000100`)** — added per-column partial unique indexes `bookmarks_user_opportunity_unique` and `bookmarks_user_event_unique` (each `WHERE <col> IS NOT NULL`), matching the WS3 club-follow index, each preceded by a one-time earliest-wins dedup. `useBookmarks` already swallows `23505` on insert for **all** types, so client behavior stays idempotent (comment updated to reflect all three are now DB-unique).
8. **Documented dead/duplicated code removed** — deleted the never-called `AuthContext.signUp` (a divergent second copy of the waitlist/profile-creation logic; email signup goes through `send-otp`/`verify-otp`), and its context-type/provider-value entries; `ClubProfileSetup` now imports `CLUB_CATEGORIES` from `@/lib/constants` (dropping the identical local `CATEGORY_OPTIONS`) and uses the shared `<Logo>` component instead of the bespoke Sparkles+"ZotHub" header.

**Verified (local PG16.13 harness — all 42 migrations apply cleanly in order):**
- **Bookmark uniqueness:** the two new partial indexes exist; a duplicate opportunity-bookmark insert is rejected with `bookmarks_user_opportunity_unique` (23505); the WS3 club-follow uniqueness is unchanged; seeding 3 duplicate opportunity bookmarks then running the migration left exactly **one** — the earliest `created_at` — and a second run is a no-op (idempotent).
- **Team-member FK:** `club_team_members_user_id_fkey` present with `confdeltype = n` (SET NULL); deleting a standalone auth user nulls the team-member link and **keeps the row**; a simulated pre-existing orphan (`user_id` = a UUID absent from `auth.users`) was nulled by the migration while the row (name "Ghost") survived, the FK was added, and a second run left exactly one FK (idempotent).
- **Frontend:** `tsc -p tsconfig.app.json --noEmit` clean; `npm run build` clean; `npm run lint` **0 errors** (31 pre-existing warnings, unchanged count). Playwright smoke **11/11 pass** (added two WS8 tests: `/waitlist` and `/waitlist-rejected` redirect a logged-out visitor to `/login` with no page error — exercising the `<Navigate>` fix).

**Production-only checks still required (before `db push`):** run this read-only orphan check against the linked project to confirm the expected zero-orphan state; the migration is safe even if it returns rows (it nulls only dead links), but confirming keeps the deploy boring:
```sql
-- Expect 0 rows. Any row is a club_team_members entry whose user_id points at
-- a non-existent auth user; migration 20260714000200 will NULL exactly these.
select ctm.id, ctm.email, ctm.user_id
from public.club_team_members ctm
where ctm.user_id is not null
  and not exists (select 1 from auth.users u where u.id = ctm.user_id);
```
The Google-OAuth pending→`/waitlist` routing (item 2) could not be exercised end-to-end here (no OAuth provider / seeded pending OAuth account in this environment; provider config on the owned project is "assumed working, not re-verified" per the migration doc). It was verified by reading the auth/waitlist flow: the effect only redirects a logged-in, role-less user on a settled `pending`/`rejected` status, so approved and normal-login users are unaffected.

**Deployed & production-verified (maintainer, 2026-07-14):** WS8 is merged and fully deployed — both WS8 bookmark unique indexes exist in production, the `club_team_members.user_id` FK exists with `ON DELETE SET NULL`, and the migration history is fully synced. Frontend shipped via the normal Vercel flow; no Edge Function redeploy was needed.

---

#### ✅ WS5 completion record (2026-07-12)

**Product decision (maintainer): PUBLIC DISCOVERY** — logged-out (anon) visitors may browse active clubs/opportunities/events; every write and all private data still require auth.

**Investigation findings:** the discovery routes (`/`, `/clubs`, `/clubs/:id`, `/opportunities`, `/opportunities/:id`, `/events`, `/events/:id`) are **already public** (not behind `ProtectedRoute`); the Landing "Browse Opportunities" CTA already targets `/opportunities`; gated actions already prompt login for anon (Apply is gated to `role === "student"` with a "Log In to Apply" CTA; RSVP shows "Log in to RSVP"; follow/bookmark toast "Please log in"; Apply/RSVP forms re-check `user`). The discovery list/detail queries select only safe columns and embed just `club_profiles(club_name, logo_url)` + `applications(id)`/`rsvps(id)` counts. The **only** blockers were RLS: `opportunities`/`events` SELECT policies were `TO authenticated`, and `club_profiles`' `TO public USING(true)` policy exposed the club **email** to anon (contradicting the original `get_club_public_profile()` design, which excludes email). The RLS/policy change is the core of WS5; a follow-up least-privilege hardening pass added exact per-column anon grants (below), which required three small detail-page query changes so anon never requests an ungranted (auth-only) column.

**Migration `20260712000100_ws5_public_discovery.sql`** (idempotent; applies cleanly on a fresh 39-migration harness). Uses **least-privilege column grants** — anon rows are restricted by RLS, and anon *columns* are restricted by grant, so a direct `select("*")` by anon fails (can't read excluded columns) even on an otherwise-visible active row:
- `opportunities` / `events` — SELECT policy → `TO public USING (is_active = true)` (anon + authenticated, active rows only); club-owner "view all their own (incl. inactive)" + all write policies untouched. Anon column grant reduced from table-level to an exact allowlist: `REVOKE SELECT … FROM anon` then `GRANT SELECT (<allowlist>)`.
  - opportunities anon allowlist (10): `id, club_id, title, type, description, requirements, deadline, is_active, created_at, show_application_count`. Excluded: `application_questions` (auth-only apply form), `views` (analytics), `updated_at`.
  - events anon allowlist (10): `id, club_id, title, description, event_date, location, capacity, banner_url, is_active, requires_approval`. Excluded: `rsvp_questions` (auth-only RSVP form), `views`, `created_at`, `updated_at`.
- `club_profiles` — row access stays public (needed for the `club_name`/`logo_url` embeds). Anon column allowlist (11): `id, user_id, club_name, description, category, logo_url, banner_url, website_url, instagram_url, discord_url, linkedin_url`. Excluded: **`email`** (private contact), `views`, `created_at`, `updated_at`. **`user_id` is intentionally kept** — the SELECT RLS policies on `opportunities`/`events`/`applications`/`rsvps` all subquery `club_profiles.user_id` in their club-owner check (`club_id IN (SELECT id FROM club_profiles WHERE user_id = auth.uid())`), evaluated with the caller's privileges; without anon SELECT on that column, anon reads of opportunities/events and the applications/rsvps discovery embeds fail with "permission denied" at plan time. It is a non-sensitive UUID (not email/PII; auth.users is never anon-exposed). The grant exists solely for RLS evaluation: the **logged-out UI does not request `user_id`** (ClubDetail adds it to its select only when authenticated, for messaging); a direct anon `select("user_id")` remains technically possible because the RLS dependency forces the column grant.
- **Caveat:** anon's grants on all three tables are now column-level, so any future column must be `GRANT`ed to anon explicitly to be publicly discoverable.

**Client changes (least-privilege — anon must not request an ungranted column):**
- `EventDetail` used `select("*")` on events → replaced with an explicit public column list; `rsvp_questions` (auth-only) is added to the select only when logged in; the unused `views` field was dropped.
- `OpportunityDetail` — `application_questions` (auth-only) is added to the select only when logged in.
- `ClubDetail` — `user_id` is added to the club select **only when authenticated** (needed to message the club owner); the logged-out UI never requests it. The "Contact Club" button and the `ContactClubDialog` are gated on `club.user_id` being present, so messaging can't open/target an undefined owner across the auth loading→resolved transition. `email`/`views` were never selected.

**Data-exposure review (per column):** *Required-for-discovery* → the anon allowlists above. *Excluded (private/internal)* → `club_profiles.email` (private contact), `views` on all three (analytics counters), `opportunities.updated_at` / `events.created_at`+`updated_at` (internal timestamps), `opportunities.application_questions` + `events.rsvp_questions` (form config used only by the authenticated apply/RSVP flows). *Kept in the grant with justification, but NOT requested by the anon UI* → `club_profiles.user_id` (RLS-policy dependency, non-sensitive UUID; ClubDetail selects it only when authenticated — see above). Private tables (`applications`, `rsvps`, `messages`, `notifications`, `student_profiles`) return 0 rows for anon (RLS); the count embeds return empty arrays (no error, no leak). Pre-existing, out of scope: **authenticated** users can still read any club's `email` — a lower-risk exposure among logged-in UCI users; not changed to avoid touching authenticated `select("*")` flows.

**Verified (local PG16 harness, Supabase-style default grants, RLS as gatekeeper):** **direct-API tests** — anon `select("*")` on each of the three tables → permission denied; anon explicit selection of every allowlisted column → succeeds (active rows only); anon selection of each excluded column (`application_questions`, `rsvp_questions`, `email`, `views`, `created_at`/`updated_at`) → permission denied. Active rows visible, inactive hidden; the public list/detail column sets and the `applications`/`rsvps` embeds succeed and return 0 private rows. Authenticated student sees active discovery + own applications/rsvps/messages/notifications and can read `application_questions`; club owner sees own rows incl. drafts, reads `rsvp_questions`, and INSERT/UPDATE/DELETE succeed. Migration idempotent (re-applied twice; `email` still denied). `tsc -p tsconfig.app.json --noEmit` + `npm run build` clean; lint on the 3 touched files has 0 new errors (pre-existing exhaustive-deps warnings only).

**Deployment steps a human must run (after merge; nothing deployed by this branch):** `supabase db push --linked` (applies only `20260712000100_ws5_public_discovery.sql`) **and** deploy the frontend via the normal **Vercel** flow (the 3 detail-page query changes ship with it). **No** Edge Function redeploy. Rollback: revert the migration (restore the `TO authenticated` policies and a table-level `GRANT SELECT … TO anon`) and the client query changes; low risk.

---

#### ✅ WS4 completion record (2026-07-11)

**Migration `20260711000100_ws4_rsvp_integrity.sql`** (all rsvps DB changes; idempotent, applies cleanly on a fresh 38-migration harness):
- **Capacity guard** — `BEFORE INSERT/UPDATE` trigger `enforce_rsvp_capacity` (SECURITY DEFINER). Only a `confirmed` RSVP consumes a seat (`pending`/`cancelled` don't); NULL `capacity` = unlimited. The no-op shortcut skips **only** a `confirmed`→`confirmed` update that stays on the **same** event (`OLD.event_id IS NOT DISTINCT FROM NEW.event_id`); a confirmed RSVP that **moves to another event** is enforced against the destination's capacity (previously it escaped). It `SELECT … FROM events WHERE id = NEW.event_id … FOR UPDATE` to lock the **destination** event row so concurrent confirmations/moves serialize (no overbooking race), then counts confirmed rows on the destination — explicitly by `TG_OP` (INSERT counts every confirmed row; UPDATE excludes only `NEW.id`, so it never relies on whether `NEW.id` already holds its default) — and `RAISE`s `'Event is at full capacity'` (ERRCODE check_violation) when full. SECURITY DEFINER is required so the count sees all rows (a student's RLS would undercount).
- **Club-decline notification** — `notify_rsvp_status_change()` extended: still notifies the student on approval (pending→confirmed), and now also on a **club** decline/cancel (any→cancelled where the actor is the club owner). The actor is `auth.uid()` (the request JWT) — **server-authoritative, never a client field** — so a student's own self-cancel (actor = the student) is correctly NOT notified. Gated on the student's `event_reminders` preference.
- **Realtime** — `public.rsvps` added to `supabase_realtime` (idempotent), default replica identity (the EventDetail subscription filters on `student_id`, present in the new row).
- **Transition-actor stamp** — new nullable `rsvps.status_updated_by uuid` (FK `auth.users ON DELETE SET NULL`) + a `BEFORE INSERT/UPDATE` trigger `stamp_rsvp_status_actor` that records `auth.uid()` on insert and on every real status change, and preserves the prior value on non-status updates. It is **only** written by this trigger — never accepted from a client. This persists who cancelled an RSVP so a later Edge Function call can tell a club decline from a student self-cancel (a student self-cancel and a club decline both land on `cancelled`).

**`send-email` edge function:**
- New **`rsvp_declined`** template (decline wording — no "You're In"/"confirmed"; "declined by the organizer" + Browse Events CTA).
- New **RSVP-authoritative branch** (mirrors WS1): for `rsvp_confirmation`/`rsvp_declined` the client sends only an `rsvpId`; the function requires the JWT user, loads the RSVP → student/event/club (+ the persisted `status_updated_by`), then validates the request against the caller's role, the authoritative RSVP status, **and the persisted transition actor** (never a client-supplied status/actor) via a pure, unit-tested rule (`rsvp-email-rules.ts`): **`rsvp_declined`** is club-only, requires status `cancelled`, **and requires the recorded canceller to be the club** (`status_updated_by == club.user_id`) — so a student self-cancel (recorded actor = the student) can never yield a club decline email, even if the club calls the function afterward; **`rsvp_confirmation`** from the club requires status `confirmed`, from the student allows `pending`/`confirmed` (initial acknowledgment). Any mismatch returns 403 (wrong actor) or 409 (status/actor conflict) and **never calls Resend**. It then derives recipient + event data from DB rows (never client input) and gates on the student's **`event_reminders`** preference (fail-closed by construction).

**Client:**
- `sendRSVPConfirmation(rsvpId)` and `sendRSVPStatusEmail(rsvpId, newStatus)` (→ `rsvp_confirmation` on confirm, `rsvp_declined` on cancel) now send only the id; recipient/data derived server-side. `RSVPForm` captures the upserted `rsvp.id`; `RSVPReview` passes the id. Over-capacity DB errors are surfaced as a clean "at full capacity" toast in `RSVPForm`, `useEventRSVP`, and `RSVPReview` (approve + bulk) instead of a raw error.
- **Live RSVP status** — a targeted realtime subscription in `useEventRSVP` (the hook `EventDetail` uses; owns `rsvpStatus`/`checkRSVP`) on the student's own `rsvps` (`filter student_id=eq.<profileId>`, reacts only to this event's row), refreshing status live on approval/decline; unique channel per event+student, cleaned up via `removeChannel`.

**Part A — club terminology cleanup (product language):** "Follow / Following / Unfollow" is the club relationship language. The one incorrect surface — the `useBookmarks` toast for a club follow ("Club bookmarked"/"Bookmark removed", shown by the `ClubDetail` follow button) — now says "Following"/"Unfollowed" (login-prompt and error toasts likewise). Opportunity/event bookmark/"save" wording is unchanged, and the internal `bookmarks` table / `bookmarks.club_id` persistence is unchanged. No hook rename (ClubDetail already exposes `isFollowing`/`handleFollowToggle`); avoided broad refactoring.

**Verified (local PG16 harness):** capacity — under capacity succeeds, the final seat succeeds, the next confirm is rejected, pending/cancelled don't consume, approval (pending→confirmed) at capacity is rejected, a freed seat reopens, unlimited accepts many, and **two concurrent transactions racing for the last seat produced exactly one confirmed** (the loser blocked on the event lock then was rejected). Capacity **move-escape** (hardening) — `confirmed`→`confirmed` on the same event doesn't double-count/error; a confirmed RSVP moved to an event with space succeeds; moved to a full event is rejected (and stays put); **two concurrent moves into the same 1-seat event yield exactly one confirmed**; ordinary insert and pending→confirmed still enforced. Notifications — club decline → one "RSVP Declined", self-cancel → none, approval → "RSVP Approved", `event_reminders=false` suppresses. Transition-actor stamp — an INSERT records the student; a student self-cancel records the student; a club decline/organizer-cancel records the club; a **non-status update (answers) preserves the prior actor** (no laundering). Decline-authorization simulation: a student-self-cancelled RSVP → decline email **rejected 409** even when the club calls it; a club-cancelled RSVP → **allowed**; approval confirmation + in-app "RSVP Approved"/"RSVP Cancelled" behavior unchanged. Realtime — WAL decode shows an `rsvps` UPDATE streams `student_id` (filter matches). Edge — the RSVP email type/status/actor rules are covered by a **`deno test` matrix over every (type × role × status × transition-actor) combination** (all pass, exact fail-closed truth table), the RSVP-load/authorize query resolves against the schema, and `deno check` passes for `send-email` + the extracted `rsvp-email-rules.ts` (and `send-reminders`). Migration idempotent (re-applied twice). `tsc -p tsconfig.app.json --noEmit` and `npm run build` clean; lint on touched TS/TSX introduced no new errors (pre-existing warnings only). Full `functions serve` not possible here (deno.land egress-blocked), so the edge branch was verified by `deno check` + the `deno test` matrix + query simulation.

**Deferred / notes:** the no-questions RSVP path (`useEventRSVP.handleRSVP`) still sends no confirmation email (pre-existing; only the form path emails) — left as-is to avoid adding a new email path. RSVP emails are not `reminder_logs`-deduped (transactional, best-effort; a re-approve could resend — acceptable).

**Deployment steps a human must run (after merge; nothing deployed by this branch):**
1. `supabase db push --linked` — applies only `20260711000100_ws4_rsvp_integrity.sql`.
2. `supabase functions deploy send-email` — required (new `rsvp_declined` template + RSVP-authoritative branch).
3. Frontend (`RSVPForm`, `RSVPReview`, `useEventRSVP`, `useBookmarks`, `emailService`, `eventNotifications`) ships via the normal Vercel flow on merge. `send-reminders` unchanged this pass. Rollback: revert the migration (drop the capacity trigger, restore the prior `notify_rsvp_status_change` body, `ALTER PUBLICATION … DROP TABLE public.rsvps`) and redeploy the prior `send-email`.

---

#### ✅ WS3 completion record (2026-07-10)

**Root cause:** "following a club" is stored as a bookmark (`bookmarks.club_id`) — the follow button (`useBookmarks("club")`), the personalized feed (`StudentFeed`), the followed-clubs list, and the dashboard "Following" count all read/write `bookmarks`. But the new-post in-app trigger `notify_followers_on_new_post()` and the `send-reminders` new-post emails read `public.club_followers`, a table the app **never writes**. So a student who followed a club received **no** new-post notification or email even though the feed worked. The notifications were also gated on the semantically-wrong `deadline_reminders` preference.

**Source-of-truth decision:** make `bookmarks.club_id` the single source of truth (repoint the two server-side consumers at it), rather than migrating the app to `club_followers`. Rationale: the entire app already uses `bookmarks.club_id`; this is the smallest change that matches existing behavior/naming, is non-destructive (no backfill — `bookmarks` already holds the real follow data), and avoids maintaining two divergent stores. `club_followers` is left in place (no destructive drop) but is no longer read.

**What shipped:**
- **Migration `20260710000300_unify_follow_new_post_notifications.sql`** — (1) adds a dedicated `new_post_notifications boolean NOT NULL DEFAULT true` to `notification_preferences`; (2) `CREATE OR REPLACE`s `notify_followers_on_new_post()` to iterate `SELECT DISTINCT b.user_id FROM bookmarks b WHERE b.club_id = NEW.club_id` and gate on `new_post_notifications`; (3) **makes club follows DB-unique** — a partial unique index `bookmarks_user_club_unique ON bookmarks (user_id, club_id) WHERE club_id IS NOT NULL`, preceded by a one-time dedup that keeps one canonical row per `(user_id, club_id)` (retention rule: earliest `created_at`, tie-break smallest `id`) and leaves opportunity/event bookmarks (`club_id IS NULL`) untouched. So club follows are now unique at the database level, not merely deduped at read time; the trigger's `DISTINCT` (and the `send-reminders` `Set`) remain as defense in depth. The existing `notify_followers_new_opportunity`/`notify_followers_new_event` triggers keep calling the replaced function. Idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`, `CREATE UNIQUE INDEX IF NOT EXISTS`; the dedup DELETE is naturally a no-op once unique).
- **`useBookmarks.ts`** — club follow is now idempotent: a duplicate insert (double-click / retry / concurrent) raises `23505` against the partial unique index, which the hook treats as success (the follow already exists) instead of surfacing a raw error. Loading state, toasts, cache/refetch, unfollow, and all non-club bookmark behavior are unchanged.
- **`send-reminders` edge function** — both new-post email paths (opportunities + events) now read followers from `bookmarks` (deduped via a JS `Set`), gate on `new_post_notifications`, and point the "unsubscribe from new posts" link at `?type=new_post_notifications` (was `deadline_reminders`). The separate deadline-reminder path (bookmarked *opportunities*) is untouched and still correctly uses `deadline_reminders`.
- **Preference decision (confirmed with maintainer):** no existing preference matched "new post from a followed club", so a dedicated `new_post_notifications` column was added rather than silently repurposing `deadline_reminders`. Exposed as a "New Posts from Followed Clubs" toggle in `NotificationPreferencesDialog`, the `Unsubscribe` page, and the `useNotifications` preferences model; added to the generated `types.ts`.

**Verified (local PG16 harness, all 37 migrations clean):** following a club then that club posting creates exactly **one** `new_post` notification for the follower (correct type/title/message/`related_id`); a non-follower gets none; a follower with `new_post_notifications=false` gets none; unfollowing stops further notifications. Uniqueness: the partial unique index exists with predicate `WHERE (club_id IS NOT NULL)`; seeding 3 duplicate club-follow rows then running the migration's dedup left exactly **one** row — the earliest-created (`created_at` tie-break `id`) — while a duplicate opportunity bookmark and the event bookmark were untouched; a duplicate club insert now raises `23505`, a duplicate opportunity bookmark is still allowed; unfollow→refollow leaves exactly one row. The `send-reminders` follower-resolution + preference gate was exercised in SQL. `tsc -p tsconfig.app.json --noEmit` and `npm run build` clean; lint on touched TS/TSX introduced no new errors; `deno check` passes for `send-reminders` (and `send-email` unchanged) against local module stubs (deno.land is egress-blocked, so a full `functions serve` isn't possible here).

**Data/backfill:** the migration performs a one-time dedup of existing duplicate club-follow rows (keep earliest per `(user_id, club_id)`); this is safe (idempotent, no-op when there are no duplicates) and only touches `club_id IS NOT NULL` rows. `bookmarks` already holds the real follow data; `club_followers` (which the app never wrote) becomes irrelevant, no migration of its rows needed. No risk of duplicate notifications from the cutover: `CREATE OR REPLACE` swaps the function in place, so only the new logic runs.

**Deployment steps a human must run (after merge; nothing is deployed by this branch):** `supabase db push --linked` (applies only `20260710000300_unify_follow_new_post_notifications.sql`) **and** `supabase functions deploy send-reminders`. Frontend changes (`useNotifications`, `NotificationPreferencesDialog`, `Unsubscribe`, `types.ts`) deploy via the normal Vercel flow on merge. Rollback: revert the migration (drop the column and restore the prior function body) and redeploy the prior `send-reminders`; low risk (additive column + function-body change).

---

#### ✅ WS2 completion record (2026-07-10)

**What shipped:**
- **Migration `20260710000200_add_messages_to_realtime.sql`** — idempotently adds `public.messages` to the `supabase_realtime` publication (guarded by a `pg_publication_tables` existence check and a `pg_publication` existence check, so re-running is safe). This is the single root cause: the frontend already subscribes to `messages` in `useMessages` (event `INSERT`, filter `receiver_id=eq.<uid>`) and `useNavigationCounts` (event `*`, filter `receiver_id=eq.<uid>`), but `messages` was never in the publication, so those subscriptions received nothing — live chat and the unread-message badge silently didn't update.
- **Replica identity: left at DEFAULT (PK) — `REPLICA IDENTITY FULL` deliberately NOT set.** Every filter the app uses is on `receiver_id`, which is evaluated against the NEW row; the NEW row is fully present for INSERT and UPDATE regardless of replica identity — i.e., the two flows that matter (a message arriving; a message being marked read) work under default identity. FULL would only affect DELETE events (whose OLD row otherwise carries just the PK), and no subscription depends on matching a non-PK filter on a DELETE. `notifications` — realtime and working in production — also runs on DEFAULT identity, so this matches the established pattern.

**`rsvps` deliberately deferred to WS4.** Investigation found **no** frontend subscription to the `rsvps` table anywhere (grep across all hooks/components). The student's RSVP-approval signal is already delivered live via the `notifications` table (which is in the publication) — the `rsvp_update` notification from `notify_rsvp_status_change`. Publishing `rsvps` with no consumer would change no observable behavior and can't be verified against an app subscription; making the EventDetail page itself flip live requires a NEW client subscription (an RSVP-journey/UX change). That belongs with WS4, which owns the RSVP journey. (Decision confirmed with the maintainer.)

**Verified (local PG16 harness, `wal_level=logical`):** all 36 migrations apply cleanly; `messages` now appears in `pg_publication_tables` for `supabase_realtime` (with `notifications`, `club_team_members`); `rsvps` does not; `messages` replica identity is `default`; the migration is idempotent (re-applied twice → exactly one membership row). Real WAL-level decode of a message lifecycle proved the delivery path: INSERT and UPDATE (mark-read) stream the full new tuple **including `receiver_id`** (so the app's `receiver_id` filter matches and the subscriptions fire), while a DELETE streams only the PK under default identity (the one uncovered edge — a sender deleting an unread message won't live-decrement the receiver's badge; it self-heals on the next fetch). `tsc -p tsconfig.app.json --noEmit` and `npm run build` clean; no TS/TSX changed (DB-only), so no lint delta. A full websocket `supabase functions serve`/Realtime-server test wasn't possible here (needs Docker images that can't be pulled), so WAL logical decoding was used as the strongest available proof.

**Deployment steps a human must run (after merge; nothing is deployed by this branch):** `supabase db push --linked` — applies only `20260710000200_add_messages_to_realtime.sql`. **No** Edge Function redeploy and **no** Vercel deploy required (no app code changed). Rollback: `ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;` (reverts to the pre-WS2 no-op behavior; low risk).

---

#### ✅ WS1 completion record (2026-07-10)

**What shipped:**
- **Migration `20260710000100_notify_club_on_new_application.sql`** — `AFTER INSERT` trigger `on_new_application` on `public.applications` (`notify_club_on_new_application()`, `SECURITY DEFINER`, mirrors `notify_application_status_change`). On a new application it inserts **exactly one** in-app `notifications` row (`type = 'new_application'`) for the owning club account, with the club derived server-side from `opportunity.club_id → club_profiles.user_id` (never client input) and gated on the club's `application_updates` preference (`COALESCE(..., true)`). Because it's `AFTER INSERT`, a blocked duplicate (unique key, 23505) produces no notification. Idempotent (`CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS`). **This in-app notification is the reliable, transactional channel** (fires in the same transaction as the insert).
- **`send-email` edge function — `application_notification` (club email), fully server-authoritative.** The client sends only an authoritative `applicationId`. The function: (1) **requires a valid authenticated user** from the request JWT (`auth.getUser(token)`; a service-role or anonymous caller is rejected 401); (2) loads the application server-side; (3) **verifies the application belongs to the authenticated student** (else 403), returning 404 when the application or owning club can't be resolved; (4) derives club recipient, club `user_id`, applicant name/major/year, and opportunity title **entirely from DB rows** — no client-provided applicant/recipient data is trusted; (5) gates on the club's `application_updates` preference; (6) **de-duplicates** by claiming a `reminder_logs` row (`reminder_type='application_notification'`, `target_id=applicationId`, `user_id=club`) before sending — reusing the existing idempotency table's unique key, so a repeat call is skipped (23505 → `already_sent`). The email is therefore **best-effort and at-most-once** (may be zero if Resend fails after the claim; the in-app trigger above remains the reliable channel).
- **`send-email` — preference gating for `application_confirmation` / `application_status`.** These still take a client-provided recipient email; the function resolves it to a `user_id` and **fails closed** — if the recipient can't be resolved to a user it is skipped (`recipient_unresolved`) rather than sent past the preference check; if resolved, it is gated on `application_updates` (default-send only when a resolved user has no prefs row). Done server-side because RLS blocks a club from reading a student's prefs and vice-versa. Other email types (OTP/waitlist/event) are unchanged.
- **Client** — `sendNewApplicationNotification(applicationId)` in `src/lib/emailService.ts`; `ApplicationForm` now captures the inserted row id (`.select("id").single()`) and passes only that id, in the same success block as the student confirmation (fires only after a confirmed insert, never on the 23505 duplicate path). `NotificationCard` links the club's `new_application` notification to `/club/applications`. `ApplicationReview` needs no change: its status email targets the applicant's own profile email, which resolves to the applicant's `user_id` for gating.

**Verified:** all 34 migrations + the new one apply cleanly on a local PG16 harness; a new application creates exactly one in-app notification to the correct owning club; a duplicate creates none; toggling the club's `application_updates` off suppresses it and back on re-enables it. `tsc -p tsconfig.app.json --noEmit` and `npm run build` clean; lint on touched files introduces no new errors. The edge function was type-checked with `deno check` (against local stubs, since `deno.land` is egress-blocked so a full `functions serve` isn't possible here); its authoritative-derivation, ownership, and `reminder_logs` dedup queries were exercised directly against the harness schema (owner passes, non-owner rejected, second dedup claim → 23505).

**Deferred / limitations:** RSVP transactional emails still bypass preferences (WS4 owns RSVP email correctness); the `application_notification` email shares the `application_updates` preference (no dedicated per-club column — intentional); the club email is best-effort (a Resend failure after the dedup claim yields no email — the in-app notification is the guaranteed channel); a full local `supabase functions serve` couldn't be run because `deno.land` is blocked in this environment.

**Deployment steps a human must run (after merge; nothing is deployed by this branch):**
1. `supabase db push --linked` — applies only `20260710000100_notify_club_on_new_application.sql` (history is reconciled). `reminder_logs` already exists; no new table.
2. `supabase functions deploy send-email` — required (auth/ownership/dedup/preference logic lives here; uses the already-present `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).
3. **Frontend** (`ApplicationForm.tsx`, `emailService.ts`, `NotificationCard.tsx`): deploy through the **normal Vercel flow** — merging to `main` triggers the standard Vercel production build/deploy; no manual step beyond the merge.

---

## Operating rules for future Claude Code sessions

1. **Start from `main` and synchronize safely** — `git fetch`, branch from the latest `main`; never force-push shared history; preserve unrelated changes.
2. **Read `README.md`, `prd.md`, and this `plan.md`** before coding.
3. **Choose exactly one coherent workstream** — normally the top of **"▶ Start here"** / the ranked backlog. Do not random-walk the backlog.
4. **Inspect the relevant user journey and adjacent systems first** (the "Evidence to inspect" list for that workstream), so the fix targets the root cause, not a symptom.
5. **Fix directly-coupled issues in the same pass** when they share the workstream's root cause or verification path — but avoid unrelated rewrites. Do not interpret "one task" so narrowly that you leave a known root cause or directly-coupled behavior broken.
6. **Database changes use normal migration files + the Supabase CLI** (`supabase/migrations/*.sql`, `supabase db push --linked`). Migration history is reconciled — no manual raw-SQL workaround, no `db reset`. Make migrations idempotent where practical.
7. **Verify:** run `tsc --noEmit`, `vite build`, `npm run lint` (at least on touched files), any tests, and a targeted behavior check of the affected flow (the repo's local-Postgres harness is the standard way to exercise triggers/RLS).
8. **Update docs after each pass** — move the finished workstream's inventory entries to "fixed," refresh **"▶ Start here"** to the new top workstream, and record any newly found issue.
9. **Document deployment steps** the change requires (migrations to push, edge functions to redeploy, Vercel redeploy) in the PR/commit.
10. **Do not decommission Lovable** until every box in the **"Lovable decommission checklist"** is satisfied.

---

## Task-selection method

When "▶ Start here" is stale or you must choose among workstreams, rank by (in order):
1. **Impact on core user value** — does it fix the two-sided marketplace loop (discover → apply/RSVP → review → decide → engage)?
2. **User trust & correctness** — silent failures, wrong content, or "success" shown when nothing persisted rank above cosmetic issues.
3. **Security / data-integrity risk** — authorization boundaries, RLS gaps, data that can be corrupted (e.g. over-capacity).
4. **Operational risk** — scheduled jobs, backups, support/admin ownership.
5. **Dependencies & sequencing** — prefer root causes that unblock several downstream items; don't build on something you're about to change.
6. **Ability to verify** — favor work you can exercise and confirm in one pass (local-DB harness, build, targeted drive).
7. **Breadth of affected systems** — group issues that share a root cause or verification path into one workstream; keep unrelated ones out.

Group related issues into **workstreams**, not a flat bug list. A good workstream is one root cause + its directly-coupled defects, completable and verifiable in a single focused pass.

---

## Development stages (current)

**As of 2026-07-13 the ranked bug/correctness backlog (WS1–WS8 + auth-orphan cleanup) is fully cleared and production-verified.** The project is past the "drive down the backlog" phase and into the **Pre-Launch Experience Roadmap (WS10 → WS11 → WS12)** — a design-direction mockup, a design-system + UX refresh, then a feature build-out (see "▶ Start here"). Stages below are retained as the cadence model.

1. **Stability monitoring (ongoing).** Keep watching production for regressions before anything irreversible (especially Lovable decommission). Spot-check: auth (signup → OTP → waitlist → approval → dashboard), storage (resume upload + club view), email deliverability (Resend), DNS/TLS on `zothub.app` + `www.zothub.app`, and the Supabase logs. A clean run of several consecutive days remains the gate for Lovable decommission. Keep the Lovable fallback untouched.
2. **Medium/Low bug backlog — ✅ cleared.** All ranked workstreams (WS1–WS8) and the auth-orphan cleanup are done; see **"Backlog — ranked workstreams."** Address any newly-found defect by adding it to the Confirmed bug & risk inventory and handling it in a focused pass.
3. **Pre-launch experience — ⏭️ active (WS10 → WS11 → WS12).** The design-direction mockup + spec (WS10), the design-system + UX refresh re-skinning every surface in vertical slices and folding in the experiential dead-end fixes (WS11), and the new-feature build-out incl. the in-product support center (WS12). This is where the experiential/visual pre-launch weaknesses are addressed. Privacy-policy accuracy, lint/test cleanup, and the scheduler are already done.
4. **Post-launch feature development.** Items tagged post-launch within the WS12 catalog and the parked long-term list (multi-campus, monetization, ticketing) — after launch and once the roadmap above is delivered.

---

## Backlog — ranked workstreams

Coherent workstreams (one root cause + directly-coupled defects each), ranked by the **Task-selection method** above. Work top-down. Each cross-references its **Confirmed bug & risk inventory** entry. Severity in brackets is the worst defect in the workstream.

**WS1 — Application-pipeline notifications & email correctness** — **✅ DONE (2026-07-10)**
Clubs now receive a reliable in-app notification (`on_new_application` trigger, transactional) **and** a best-effort, de-duplicated email (`application_notification`) on each new application. The email is fully server-authoritative: the client sends only an `applicationId`, and `send-email` verifies the authenticated caller owns the application, derives the club/applicant/opportunity from DB rows, gates on `application_updates`, and claims a `reminder_logs` row to prevent duplicate sends. Application confirmation/status emails are preference-gated server-side and fail closed when the recipient can't be resolved. Completion record in "▶ Start here". *Remaining RSVP-email preference gap is tracked in WS4.*

**WS2 — Realtime delivery for messages** — **✅ DONE (2026-07-10)**
`public.messages` is now in the `supabase_realtime` publication (migration `20260710000200`), so the existing `useMessages`/`useNavigationCounts` subscriptions deliver live chat and the unread-message badge. Default replica identity is sufficient (filters are on `receiver_id`, present in the new row for INSERT/UPDATE); `REPLICA IDENTITY FULL` intentionally not set. Completion record in "▶ Start here". **`rsvps` realtime was deferred to WS4** — no frontend subscription consumes it today, and RSVP approval already arrives live via the published `notifications` channel; wiring a real rsvps subscription is an RSVP-journey change owned by WS4. *([Messages] Real-time messaging… — fixed; rsvps realtime folded into WS4.)*

**WS3 — Unify follow/bookmark semantics & fire new-post notifications** — **✅ DONE (2026-07-10)**
`bookmarks.club_id` is now the single source of truth: `notify_followers_on_new_post()` and the `send-reminders` new-post emails read `bookmarks` (was `club_followers`, which the app never wrote), so followers now receive new-post notifications/emails. New-post is gated on a new dedicated `new_post_notifications` preference (was the semantically-wrong `deadline_reminders`), exposed in the preferences + unsubscribe UI. Club follows are made **DB-unique** (partial unique index `(user_id, club_id) WHERE club_id IS NOT NULL` + one-time dedup) and `useBookmarks` follow is idempotent (swallows `23505`); DISTINCT/Set kept as defense in depth. Completion record in "▶ Start here". *([Feed/Notifications] "Follow" writes bookmarks… — fixed; club-follow half of [Data] bookmarks-uniqueness also addressed.)*

**WS4 — Event RSVP integrity & email correctness** — **✅ DONE (2026-07-11)**
All five items shipped (migration `20260711000100` + `send-email` + client): (a) DB capacity guard on `rsvps` (`BEFORE INSERT/UPDATE`, event-row `FOR UPDATE` lock — verified no overbooking under concurrency); (b) dedicated `rsvp_declined` email template + status branch; (c) club-decline in-app notification distinguished from student self-cancel via `auth.uid()` (server-authoritative); (d) RSVP confirmation/status emails gated server-side on `event_reminders` (WS1 authoritative-derivation pattern, `rsvpId`-based); (e) live rsvps realtime — `rsvps` published + a targeted EventDetail (via `useEventRSVP`) subscription for the student's own RSVP. Also included the **club Follow/Following/Unfollow terminology cleanup** (`bookmarks` table unchanged). Completion record in "▶ Start here". *([Events] Event capacity… — fixed; [Events/Email] Declining an RSVP… — fixed; rsvps realtime — done.)*

**WS5 — Discovery access-model consistency (anonymous browsing)** — **✅ DONE (2026-07-12)**
Product decision: **public discovery.** Migration `20260712000100` makes `opportunities`/`events` SELECT `TO public USING (is_active = true)` (anon can browse active rows) and applies **least-privilege per-column anon grants** on all three discovery tables — excluding `club_profiles.email`, the `views` counters, internal timestamps, and the auth-only `application_questions`/`rsvp_questions` — so even a direct `select("*")` by anon fails. Three detail-page queries were adjusted so anon never requests an ungranted column. Verified anon reads only active discovery rows (allowlisted columns only, no email/private tables/writes) and authenticated/club-owner flows unchanged. Completion record in "▶ Start here". *([Discovery/RLS] Logged-out visitors… — fixed.)*

**WS6 — Scheduler & launch-ops hardening** — **✅ DONE (2026-07-13)**
Migration `20260713000100` schedules `archive-past-events-nightly` (`0 9 * * *` UTC → `SELECT public.archive_past_events();`), idempotently and without touching any other cron job; the `useBookmarks` "opportunitys" toast-pluralization bug was fixed in the same pass. Both were pushed/deployed, and the read-only `cron.job` query confirmed `archive-past-events-nightly` and `send-reminders-hourly` are `active` in production. The three operational ownership items (support contact, `/admin` waitlist owner, backup cadence) are now decided and recorded in the **Operational responsibilities** section. Completion record in "▶ Start here". *([Cron] `archive_past_events()`… — fixed.)*

**WS7 — Test / lint / type hardening** — **✅ DONE (2026-07-13)**
The Playwright config is repaired (standard `@playwright/test` `defineConfig` — the unavailable `lovable-agent-playwright-config` import is gone) with a 9-test, backend-independent smoke suite (`e2e/smoke.spec.ts`, `npm run test:e2e`) covering the public discovery shells, auth entry points, 404, and the protected-route redirect, each test failing on any uncaught page error. All 26 ESLint errors cleared (0 errors / 31 pre-existing warnings remain: exhaustive-deps + fast-refresh, intentionally untouched); React Router v7 future flags opted in (console warnings gone). No new dependencies; no behavior changes (the two edge-function edits are lint-only and payload-identical). Completion record in "▶ Start here". *([Tooling] ESLint… — fixed; [Console] React Router… — fixed.)*

**WS8 — UX polish & data hygiene** — **✅ DONE (2026-07-14)**
All eight items shipped: `Waitlist`/`WaitlistRejected` now redirect via `<Navigate>` (no render-time `navigate()`); `Login` routes role-less pending/rejected OAuth users to `/waitlist`/`/waitlist-rejected` via `useWaitlist`; unsubscribe auto-opt-out builds from the freshly loaded prefs row (no more re-enabling others); `club_team_members` got a self-healing `ON DELETE SET NULL` FK on `user_id` (migration `20260714000200`, pre-nulls any dead reference) — the existing UI already hides the Message button for null `user_id`; `/privacy` names Supabase/Vercel/Resend; `approveUser`/`rejectUser` record `reviewed_by`; opportunity/event bookmark partial unique indexes added (migration `20260714000100`, `useBookmarks` already idempotent on `23505`); and the documented dead/duplicated code removed (`AuthContext.signUp`, `ClubProfileSetup`'s local `CATEGORY_OPTIONS`→`CLUB_CATEGORIES`, bespoke header→`<Logo>`). Completion record in "▶ Start here". *(individual inventory entries marked fixed below.)*

**WS10 — Design Direction & Brand (mockup + spec)** — **[planned] — recommended next pass**
Clickable design-direction mockup (via `artifact-design`) of the hero screens + a committed `docs/design-system.md` spec. Locks brand (evolve current indigo/coral-on-dark vs. rebrand), theme (dark-only vs. light), and typography before any re-skin. User approves the mockup + spec before WS11. Detail block in "▶ Start here".

**WS11 — Design System Implementation & UX Refresh (vertical slices)** — **[planned]**
Implement the WS10 spec and re-skin every surface in slices (WS11a public/discovery, WS11b student, WS11c club, WS11d admin/shared), keeping the routing/state/hooks wiring intact and folding each screen's coupled UX fix + dead-code cleanup into its slice (onboarding dead-ends, review-action safety + `reviewed` + club→applicant messaging, search depth/pagination, delete `Index.tsx`/`DashboardLayout.tsx`/`club_followers`, fix `font-display`/badges/loaders). a11y + mobile are acceptance criteria. Detail block in "▶ Start here".

**WS12 — New Feature Build-out (comprehensive catalog)** — **[planned] — absorbs former WS9**
Net-new surfaces/features, each tagged launch-blocking vs post-launch, verified at build: **Support Center** (`/help`/FAQ/Contact/Report-an-Issue), self-service account deletion, `/privacy` contact fix, weekly digest, saved searches/alerts, recommendations, applicant notes/rating, templated messaging, richer search/filters, relax gated beta → open `@uci.edu`, error monitoring, RSVP-email consistency, expanded e2e, a11y audit; parked: multi-campus/monetization/ticketing. Full catalog in `prd.md`'s Pre-Launch Experience Roadmap; detail block in "▶ Start here". *(The former WS9 "future features" and the previously-parked "user support experience" Planned Product Area are both folded in here.)*

---

## Operational responsibilities (WS6 — standing, non-engineering)

> These are ongoing operational commitments (the outside-code half of WS6), now **decided and recorded** rather than placeholders. They are people/process decisions, not engineering tasks — record changes here as the team/policies evolve. The backup item is also a prerequisite of the Lovable decommission checklist below.

- [x] **Support contact:** **`zothub.uci@gmail.com`** — the official production support address. *Places that should reference it:* the `/privacy` contact line (`Privacy.tsx`) and the future in-product support center. *(Not wired into website code in this pass — documentation only.)*
- [x] **`/admin` waitlist-queue owner:** **Dhruv** — reviews the `/admin` approval queue **twice daily during beta** (an unapproved user is fully blocked, so a stale queue directly blocks growth). Revisit the cadence as volume grows or the gated beta relaxes to open `@uci.edu` signup.
- [x] **DB backup/export policy:** **Owner: Dhruv.** **Weekly manual Supabase backup/export**, **plus an additional backup immediately before every production schema migration.** Deliberately lightweight for an early-stage product; revisit toward automated/scheduled snapshots as usage grows. (Also satisfies the Lovable-decommission "current backup/export exists" prerequisite once the first backup is taken and a restore verified.)
- [x] **Cron scheduled & verified live** — ✅ `20260713000100` was pushed to production and the frontend deployed; the read-only query below confirmed (2026-07-13) that **both** jobs exist and are `active = true`: `archive-past-events-nightly` (`0 9 * * *` → `SELECT public.archive_past_events();`) and `send-reminders-hourly` (`0 * * * *`, command calls the deployed `send-reminders` Edge Function; scheduled out-of-repo — deliberately not owned by a migration). Re-run this query anytime to re-confirm:
  ```sql
  -- Both jobs exist, active, with the expected schedules:
  --    send-reminders-hourly        '0 * * * *'
  --    archive-past-events-nightly  '0 9 * * *' → SELECT public.archive_past_events();
  select jobid, jobname, schedule, command, active
  from cron.job
  order by jobname;

  -- Recent runs succeeded (spot-check the morning after any deploy for the
  -- nightly archive run):
  select j.jobname, d.status, d.return_message, d.start_time, d.end_time
  from cron.job_run_details d
  join cron.job j using (jobid)
  order by d.start_time desc
  limit 20;
  ```

---

## Lovable decommission checklist

> **Do NOT decommission Lovable yet.** It no longer serves production traffic but is the current rollback path. Decommission is a deliberate future manual step, only once **all** of the following hold:

- [ ] `zothub.app` (and `www.zothub.app`) has been **stable on Vercel for several consecutive days** (the Stage 1 monitoring window).
- [ ] **No production auth / storage / email / DNS issues** have appeared during that window.
- [ ] A **current database backup/export exists** (Supabase snapshot or `pg_dump`) and has been verified restorable. *(Cadence now set — see the backup policy in **Operational responsibilities**: weekly + before every schema migration, owner Dhruv. This box is checked once the first backup is taken and a restore verified.)*
- [ ] **Vercel environment variables verified** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) point at the owned Supabase project.
- [ ] **Supabase Edge Function secrets verified** (`RESEND_API_KEY` set; `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` injected as expected).
- [ ] **Resend domain still verified** for `zothub.app`, DNS records intact, deliverability confirmed.
- [ ] **No needed assets remain only in Lovable** — all storage objects, edge functions, secrets, and any config exist in the owned Supabase project (nothing referenced solely from the old Lovable Cloud project).
- [ ] The **rollback plan is no longer needed** — confidence is high enough that reverting to Lovable would never be chosen.

Only when every box is checked: decommission Lovable (and note it here as done, with the date).

---
---

# Historical record & detailed inventory (reference only)

> Everything below this line is the **historical/reference record** the active plan above is drawn from: the migration-QA seed list, the Phase 1 audit methodology, the full per-defect **Confirmed bug & risk inventory** (with fixed-vs-open status on each entry), the live-QA rounds, the completed migration-history repair, and the closed phase history. It does **not** drive day-to-day work — the active plan is everything **above** this line. Consult it for defect detail, root-cause notes, and how prior fixes were verified.

---

## Known Issues & Open Items (historical — migration-QA seed list)

> **Resolved/superseded (2026-07-09):** this was the original migration-QA seed list. Current status: Bug #1 **fixed**, Bug #2 **cleaned in prod** (future-safe guidance documented), Infra #3/#4/#5 **done** (see the updated table below and the Bug Inventory). Kept here for historical continuity; the live backlog is in **"Backlog — ranked workstreams."**

### Bugs
| # | Issue | Where | Desired behavior |
|---|---|---|---|
| 1 | Student profile setup fails with raw error `"Expected array, received null. Expected array, received null"` when only name is filled in | `StudentProfileSetup.tsx` / validation schema (likely `src/lib/validation.ts`) | `interests`/`skills` should not be required; `null`/empty should be accepted or normalized to `[]`; validation errors shown to users must be human-readable, never raw schema error text |
| 2 | Orphaned/deleted user (old migrated "Dhruv Mantri" account) still appears as a club team member | `club_team_members` and any other table with a `user_id`-style FK into `auth.users` | Rows referencing an `auth.users` ID that no longer exists should be removed or hidden from UI, not displayed as if the user were real/active. Root cause: `auth.users` was intentionally never migrated from Lovable Cloud (fresh OTP signups were used instead), so old `public.*` rows referencing the old Lovable Cloud auth UUIDs are now orphaned references. |

### Infrastructure / Hardening Gaps
> **Update 2026-07-09 (post-cutover):** items 3–5 below are the *original* migration-QA notes, kept for history. Current status: **#3 DNS cutover is DONE** (`zothub.app` + `www.zothub.app` live on Vercel with valid TLS); **#4 is DONE** (`BEFORE INSERT` trigger on `auth.users`, Phase 2); **#5 is DONE** (Phase 1 audit + Phase 2/2b/2c); **Supabase migration-history repair is DONE** (see the dedicated section). One infra-cleanup item remains open: **Lovable decommission** (no longer serving production traffic; kept as the rollback path during the stability-monitoring window; gated on the "Lovable decommission checklist").

| # | Item | Status |
|---|---|---|
| 3 | `zothub.app` DNS cutover to Vercel | ✅ **Done (2026-07-09).** `zothub.app` and `www.zothub.app` verified serving on Vercel with valid TLS; Resend DNS records preserved. |
| 4 | DB-level `@uci.edu` enforcement | ✅ **Done (Phase 2).** `BEFORE INSERT` trigger on `auth.users` (`enforce_uci_email()`), plus server-side check in `send-otp`. |
| 5 | Full end-to-end QA | ✅ **Done.** Phase 1 audit + Phase 2/2b/2c live-QA fix passes; production smoke test on `zothub.app` passed. |

---

## Phase 1: Full Product Audit & Bug Inventory *(historical — completed 2026-07-08)*

> **Completed.** This describes the one-time audit methodology used to build the inventory below. Retained for provenance; not an active process.

**Goal:** a complete, written, workflow-by-workflow audit of the live product — what works, what's broken, what's incomplete — producing a single prioritized Bug Inventory that the next coding pass works from. No fixing happens during this phase; the entire point is to stop and look before touching code, so the fix pass is coordinated instead of reactive.

### Process
For each workflow below:
1. Walk it end-to-end on the live app (or a Vercel preview) as a real user would, in both the student and club role where applicable.
2. Note: does it work as expected? Any console errors (check browser devtools)? Any broken loading/empty/error states? Any obviously wrong behavior?
3. For anything broken or incomplete, write a Bug Inventory entry (see format below) — **do not fix it yet**, just record it.
4. Only after all workflows are walked and every finding is entered into the Bug Inventory does the next phase (prioritized fixing) begin.

### Workflows to audit

- **Signup → OTP → waitlist → admin approval → dashboard** (`Signup.tsx`, `send-otp`/`verify-otp` edge functions, `Waitlist.tsx`, `WaitlistRejected.tsx`, `AdminDashboard.tsx`, `useWaitlistAdmin.ts`) — both student and club role; rejection path too, not just approval.
- **Student profile setup** (`StudentProfileSetup.tsx`) — including Known Bug #1 above; verify the fix criteria once addressed.
- **Club profile setup** (`ClubProfileSetup.tsx`) — logo/banner upload, social links, category selection.
- **Opportunity creation** (`CreateOpportunity.tsx`, `EditOpportunity.tsx`, `ApplicationQuestionsBuilder.tsx`) — all question types (text, textarea, select, multi-select), the application-count visibility toggle, deadline handling.
- **Application submission/review/status update** (`ApplicationForm.tsx`, `ApplicationReview.tsx`, `OpportunityDetail.tsx`) — resume upload/prefill, duplicate-application blocking, status transitions (pending → reviewed → accepted/rejected), bulk actions, CSV export, notifications firing on status change.
- **Event creation/RSVP/approval/cancellation** (`CreateEvent.tsx`, `EditEvent.tsx`, `EventDetail.tsx`, `RSVPForm.tsx`, `RSVPReview.tsx`, `EventManagement.tsx`) — capacity limits, custom RSVP questions, `requires_approval` flow, cancellation email to attendees, Add-to-Calendar (.ics).
- **Bookmarks/follows/feed** (`useBookmarks.ts`, `StudentFeed.tsx`, `ClubFeed.tsx`, `FollowedClubsList.tsx`) — bookmark toggle persistence, follow/unfollow, feed content accuracy for followed clubs.
- **Messages** (`useMessages.ts`, `StudentMessages.tsx`, `ClubMessages.tsx`) — real-time delivery, read/unread state, both directions (student↔club).
- **Notifications/preferences** (`useNotifications.ts`, `useNavigationCounts.ts`, `NotificationPreferencesDialog.tsx`, `NotificationCard.tsx`) — in-app badge counts update live, preference toggles are actually respected by the sending logic.
- **Storage uploads/downloads** — resume upload (`student-resumes`), club logo/banner/event flyer upload (`club-assets`), verify RLS (a club can't download another club's uploads; a student's resume is only visible to clubs they applied to).
- **Email flows** — all content types sent by `send-email` (application confirmation/status, RSVP confirmation, deadline reminder, event cancelled, new club post, waitlist confirmation/approved/rejected, OTP code): verify each actually arrives, renders correctly, and links work (now pointing at `zothub.app`).
- **Cron/reminder behavior** — confirm `send-reminders-hourly` is firing (`select * from cron.job;`), check `reminder_logs` for actual sent rows, verify idempotency (no duplicate sends), verify the nightly auto-archive (`archive_past_events()`) is scheduled and working.
- **Privacy/support pages** (`Privacy.tsx`, `Unsubscribe.tsx`) — content accuracy, unsubscribe actually updates `notification_preferences`.
- **Mobile/responsive behavior** — pass across all major pages at phone width; note broken layouts, unusable touch targets, overflow issues.
- **Console errors and loading/error states** — a general sweep: open devtools console on every major page, note any errors/warnings; check empty states (no applications yet, no events, etc.), loading states (skeleton/spinner present and not stuck), and error states (network failure, form validation) render sensibly rather than blank/crashing.

### Bug Inventory format

Each finding gets an entry like this (append to a running list — a table or a `## Bug Inventory` section is fine, whichever stays easiest to scan):

```
### [Area] Short description
- **Severity:** Blocker / High / Medium / Low
- **Repro:** exact steps to reproduce
- **Expected vs. actual:** what should happen vs. what happens
- **Suspected location:** file/component if known
- **Status:** Found (not yet fixed)
```

### Exit criteria for Phase 1
Every workflow above has been walked and has either a "no issues found" note or one-or-more Bug Inventory entries. The two known bugs and three open infra items above are folded into the same inventory (don't lose them in the transition). Only once this is complete does prioritized fixing begin.

---

## Confirmed bug & risk inventory (detailed record)

> **Every entry here is confirmed against code and/or schema** (root cause noted per entry) — these are not speculative. Each carries a **Status** (Fixed in Phase 2/2b/2c, or Found/open). The **open** entries are what the active **"Backlog — ranked workstreams"** groups into workstreams; the **fixed** entries are the completion record. Anything genuinely unverified is labelled as such in its entry (e.g. the `archive_past_events` scheduling, which could not be checked against live `cron.job` from this environment).

**Status:** Phase 1 audit complete (2026-07-08). Every workflow listed in Phase 1 has been walked and recorded below.

**Phase 2 update (2026-07-09):** the Blocker/High fix pass is done. All three Blockers, the resume-access High, Known Bug #1, and Known Item #4 (DB-level `@uci.edu` trigger) are **fixed** — each entry below carries a "Fixed in Phase 2" status with what changed. Three new migrations were added (`20260709000100` RSVP status CHECK, `20260709000200` role-on-approval policies + legacy-role cleanup, `20260709000300` UCI email trigger); every fix was re-verified against a local Postgres with all migrations applied (RLS simulated per-role with `SET ROLE authenticated` + JWT claims), plus `tsc`/`vite build` clean and a headless-browser smoke of the touched pages. Deployment requires `supabase db push` + redeploying the `send-otp`/`verify-otp` edge functions — see the Phase 2 deployment notes in the commit/PR description. Out of scope by instruction: DNS cutover, Lovable decommission, UI redesign, and all Medium/Low entries (still open below).

**Live QA follow-up (2026-07-09, Phase 2b):** after deploying the Blocker/High pass, live testing surfaced 8 more issues. Six code/data bugs (#1–#6) are **fixed**; #7–#8 are operational items **documented** (no destructive action taken). Details in the "Live QA follow-up findings" section below. Two more migrations were added (`20260709000400` RSVP-approval notification; the club/student profile-save and notifications fixes are code-only). Verified against a local Postgres with **all migrations applied cleanly**, the RSVP-approval trigger and profile upsert exercised directly in SQL, the notifications-freeze root cause reproduced and fixed in a faithful headless-browser harness, and `tsc`/`vite build` clean.

**How this audit was run:** the app was built (`vite build` ✓), typechecked (`tsc --noEmit` ✓) and linted; a local Postgres 16 was stood up and **all 29 migrations applied cleanly** so schema/RLS/constraints/triggers could be queried directly; the dev server was driven with headless Chromium across every major route at desktop (1280px) and phone (375px) widths to capture console output, render, and responsive behavior. Several findings were **reproduced against the live schema** (noted per entry). Direct calls to the hosted Supabase project and `zothub.app` are blocked by this environment's egress policy, so authenticated end-to-end flows and live `cron.job`/data-dependent behavior were verified by reading source + schema + triggers rather than clicking through a logged-in session; those entries are marked "verification limited to code/schema."

Severity legend: **Blocker** (feature is unusable / blocks launch), **High** (core workflow broken or data/security impact), **Medium** (feature degraded or partially broken), **Low** (polish / minor / non-blocking).

### Folded-in known issues (carried from the Known Issues table above)

#### [Profile] Student profile setup rejects null skills/interests with a raw Zod error — *Known Bug #1*
- **Severity:** High
- **Repro:** Sign in as a student → `/student/profile` → fill in only Full Name, add **no** skills and **no** interests → Save Profile. Toast shows `"Expected array, received null. Expected array, received null"`.
- **Expected vs. actual:** Skills/interests are optional; a name-only save should succeed. Instead it fails, and the error is raw schema text, not human-readable.
- **Root cause (CONFIRMED, reproduced in isolation):** `stringArraySchema` in `src/lib/validation.ts:39-43` is `.optional()` but **not `.nullable()`**. `StudentProfileSetup.handleSave` (`src/pages/StudentProfileSetup.tsx:112-113`) passes `null` for empty skills/interests. Zod rejects `null` for an `.optional()` (undefined-only) array → two `"Expected array, received null"` messages, which `formatValidationErrors` joins with `. `. Empty arrays (`[]`) and `undefined` both pass; only `null` fails. Fix: add `.nullable()` to `stringArraySchema` (and/or normalize `null`→`[]`); also stop surfacing raw Zod messages to users.
- **Suspected location:** `src/lib/validation.ts` (`stringArraySchema`), `src/pages/StudentProfileSetup.tsx`.
- **Status:** **Fixed in Phase 2 (2026-07-09).** Added `.nullable()` to `stringArraySchema`; `null`, `undefined`, `[]`, and populated arrays all verified passing by executing the real compiled schema. The transform still normalizes empties to `null` for storage.

#### [Data] Orphaned migrated user still shows as a club team member — *Known Bug #2*
- **Severity:** Medium
- **Repro:** View a club whose roster was migrated from Lovable Cloud; the deleted "Dhruv Mantri" account still appears as a team member.
- **Expected vs. actual:** Rows referencing an `auth.users` id that no longer exists should not render as real members.
- **Root cause (CONFIRMED via schema):** `public.club_team_members.user_id` is **nullable with no foreign key** (only `club_id` has an FK, to `club_profiles`) — verified with `\d club_team_members`. So rows whose `user_id` points at an old Lovable Cloud auth UUID (never migrated into the new `auth.users`) are perfectly valid and are never cleaned up by a cascade. `useClubTeam` (`src/hooks/useClubTeam.ts:19-20`) fetches `select("*")` and renders every row with no check that the referenced user exists. Team members are keyed by email (`club_team_members_club_id_email_key`), so the roster entry persists regardless of the auth account. Fix: one-off orphan cleanup + UI/query filtering (and/or add an FK with `ON DELETE SET NULL`).
- **Suspected location:** `club_team_members` table; `src/hooks/useClubTeam.ts`.
- **Status:** **Fixed in WS8 (2026-07-14).** Migration `20260714000200` adds a self-guarding `FK (user_id) → auth.users(id) ON DELETE SET NULL`: it first NULLs any `user_id` absent from `auth.users` (dead references only — keeps the roster row's name/email/role), then adds the FK so future auth deletions self-heal. The existing `ClubDetail`/`TeamManagement` UI already hides the "Message" button when `user_id` is null, so a nulled orphan degrades gracefully (no ghost target). Prod orphans were already cleaned during QA; a **read-only orphan check** (in the WS8 completion record) must be run before `db push` to confirm the expected zero-orphan state, though the migration is safe even if any remain. Harness-verified: standalone-user delete nulls the link and keeps the row; a simulated orphan is nulled with the row surviving; idempotent.

#### [Infra] `zothub.app` DNS cut over to Vercel — *Known Item #3*
- **Severity:** High (was blocking launch)
- **Detail:** The `https://zothub.app/...` links hardcoded in `send-email`/`send-reminders`, the `privacy@zothub.app` contact, and the OAuth/site redirects now all resolve, because DNS is live. Sending domain remains verified with Resend and its DNS records were preserved through the cutover.
- **Suspected location:** DNS at Name.com / Vercel; hardcoded URLs in `supabase/functions/send-email`, `supabase/functions/send-reminders`, `src/pages/Privacy.tsx`.
- **Status:** ✅ **Done (2026-07-09).** `zothub.app` + `www.zothub.app` serving on Vercel with valid TLS; production smoke test passed.

#### [Infra/Security] DB-level `@uci.edu` enforcement missing — *Known Item #4*
- **Severity:** High (security / access-control)
- **Detail:** Confirmed client-side only. Newly observed: the **edge functions do not enforce it either** — `send-otp`/`verify-otp` validate `role` but never check the email domain (`supabase/functions/send-otp/index.ts:41-54`, `verify-otp/index.ts:33-38`). So a direct API/edge-function call with any email bypasses the `@uci.edu` gate entirely and creates a real account. Needs a `BEFORE INSERT` trigger on `auth.users` (plus ideally a server-side check in `send-otp`).
- **Suspected location:** `auth.users` trigger (to add); `supabase/functions/send-otp`, `verify-otp`.
- **Status:** **Fixed in Phase 2 (2026-07-09).** Migration `20260709000300` adds a `BEFORE INSERT` trigger on `auth.users` (`enforce_uci_email()`): case-insensitive `@uci.edu` check with `zothub.uci@gmail.com` allowlisted (keep in sync with `ADMIN_ALLOWED_EMAILS`), INSERT-only so existing users are untouched. `send-otp` now also rejects non-UCI emails up front with a friendly message. Verified locally: non-UCI and lookalike domains rejected; mixed-case UCI and the allowlisted admin address accepted.

#### [Process] Full end-to-end QA — *Known Item #5*
- **Severity:** n/a (process)
- **Status:** **Done** — this Bug Inventory is the deliverable. Superseded by the entries below.

### New findings

#### [Auth] Admin approval fails for every email/OTP signup (duplicate role key)
- **Severity:** Blocker
- **Repro:** Create an account via the normal email + OTP flow (not Google) → it lands on the waitlist as `pending`. As admin at `/admin`, click ✓ Approve. Approval fails; a destructive toast shows a duplicate-key error and the entry stays `pending`. The user can never be approved through the UI.
- **Expected vs. actual:** Approving a pending user should grant their role and flip the waitlist to `approved`. Instead it errors and does nothing.
- **Root cause (CONFIRMED, reproduced against live schema):** `verify-otp` already inserts the `user_roles` row at signup time (`supabase/functions/verify-otp/index.ts:150-153`). `useWaitlistAdmin.approveUser` then does a plain `INSERT` into `user_roles` again (`src/hooks/useWaitlist.ts:106-113`), violating `user_roles_user_id_role_key` (unique on `user_id, role`). `approveUser` returns early on that error, so the waitlist status is never updated. Verified by replaying the exact insert sequence in Postgres → `duplicate key value violates unique constraint "user_roles_user_id_role_key"`. (Google-OAuth signups don't hit this because `handleNewOAuthUser` does *not* insert `user_roles` — which is why migration QA, likely done via OAuth/admin, didn't catch it.) Fix: don't insert the role at OTP signup, or make approval idempotent (`upsert`/`ON CONFLICT DO NOTHING`), and only gate access by waitlist status.
- **Suspected location:** `supabase/functions/verify-otp/index.ts`, `src/hooks/useWaitlist.ts` (`approveUser`).
- **Status:** **Fixed in Phase 2 (2026-07-09).** Roles are now granted only at approval: `verify-otp` no longer inserts `user_roles`; `approveUser` uses an idempotent upsert (`ON CONFLICT DO NOTHING`) so re-approval and legacy accounts can't hit the unique key. Migration `20260709000200` adds the missing admin INSERT (and SELECT) RLS policies on `user_roles` — testing revealed UI approval was *also* blocked by the insert-own-role-only policy — and deletes roles prematurely granted to users whose waitlist entry is pending/rejected (matching-role rows only; admin roles untouched). Approve path verified locally under a simulated `authenticated` admin session.

#### [Auth] Pending email/OTP users hit an infinite redirect loop instead of the waitlist screen
- **Severity:** Blocker
- **Repro:** Sign up via email + OTP (creates a `user_roles` row immediately, status `pending`), then log in. The app bounces between `/student/dashboard` (or `/club/dashboard`) and `/waitlist` continuously; the waitlist screen never settles.
- **Expected vs. actual:** A pending user should rest on `/waitlist`. Instead they loop.
- **Root cause (code/schema analysis; shares the root cause of the entry above):** Because `verify-otp` sets `role` at signup, a pending OTP user has a non-null `role`. `ProtectedRoute` sees `waitlistStatus === "pending"` and redirects dashboards → `/waitlist` (`src/components/ProtectedRoute.tsx:29-31`). But `Waitlist.tsx:16-24` assumes a pending user has **no** role and, seeing `role === "student"|"club"`, immediately `navigate()`s back to the dashboard → loop. The waitlist page's "role only gets set on approval" assumption holds for the OAuth path but is false for the OTP path. Fix is the same as above: don't assign the role until approval. (Browser repro of the loop needs a live authenticated session, which egress policy blocked here; derived from routing logic + confirmed premature-role insert.)
- **Suspected location:** `src/pages/Waitlist.tsx`, `src/components/ProtectedRoute.tsx`, `supabase/functions/verify-otp/index.ts`.
- **Status:** **Fixed in Phase 2 (2026-07-09).** Root cause removed (no role while pending — see entry above, incl. legacy-role cleanup migration), and `Waitlist.tsx` now only redirects to a dashboard when the waitlist entry is not pending, so even an account that somehow holds a role while pending stays on the waitlist screen instead of looping.

#### [Events] Approval-required RSVP always fails (status CHECK constraint)
- **Severity:** Blocker (for any event with "requires approval")
- **Repro:** As a club, create an event with `requires_approval = true`. As a student, RSVP → generic "Failed to submit RSVP" error; no RSVP is created, and the club's RSVP approval queue stays empty forever.
- **Expected vs. actual:** An approval-required RSVP should be stored as `pending` and appear in `RSVPReview` for the club to approve/decline. Instead the insert is rejected.
- **Root cause (CONFIRMED, reproduced against live schema):** `RSVPForm` inserts `status = "pending"` when `requires_approval` is set (`src/components/RSVPForm.tsx:97-104`), but `rsvps_status_check` only allows `('confirmed','cancelled')` (verified with `\d rsvps`; inserting `'pending'` → `violates check constraint "rsvps_status_check"`). The error code is `23514`, which `RSVPForm` doesn't special-case, so it shows the generic failure. `RSVPReview` is built for a pending→confirm/decline queue (`pending` filter, counts), but no pending row can ever exist. Fix: extend the CHECK to include `pending` (and align approve/decline to `approved`/`declined` or keep `confirmed`/`cancelled`) — reconcile the app statuses with the DB constraint. Note PRD describes RSVP statuses as pending/approved/declined, but the DB only has confirmed/cancelled.
- **Suspected location:** `rsvps_status_check` (migration); `src/components/RSVPForm.tsx`; `src/components/dashboard/RSVPReview.tsx`.
- **Status:** **Fixed in Phase 2 (2026-07-09).** Migration `20260709000100` extends the CHECK to `('pending','confirmed','cancelled')` — the smallest change that matches what the app already does (RSVPForm/useEventRSVP insert `pending`; RSVPReview approves to `confirmed` / declines to `cancelled`; capacity and reminders already count only `confirmed`). Verified locally: pending insert succeeds and approve-to-confirmed works. The PRD's `approved`/`declined` naming was *not* adopted to keep the change minimal.

#### [Storage] Uploaded resumes are unreadable (public URL for a private bucket)
- **Severity:** High
- **Repro:** As a student, upload a resume in `/student/profile` (goes to the private `student-resumes` bucket). Then, as a club that received this student's application, open the application in review and click "Download/View resume" → the link fails (private object, not publicly accessible). The student's own "View file" link in their profile also fails.
- **Expected vs. actual:** The club should be able to open the applicant's resume (RLS explicitly allows applied-to clubs). Instead the stored URL never resolves.
- **Root cause (CONFIRMED via schema + code):** `student-resumes` is a **private** bucket (`public=false`, verified). `FileUpload` calls `supabase.storage.from(bucket).getPublicUrl(...)` for *all* buckets (`src/components/ui/file-upload.tsx:72-76`) and stores that public URL. A public URL does not resolve for a private bucket; a **signed URL** (`createSignedUrl`) is required — and `createSignedUrl` appears nowhere in the codebase. Consumers open it directly: `ApplicationReview.tsx:559,662` do `window.open(resume_url)`, and the CSV export writes the same dead URL (`:330`). The RLS itself is correct (owner + applied-club SELECT). Note: the application form's separate "Resume URL" free-text field (external Drive/Dropbox links) still works — only the in-app upload path is broken. Fix: generate signed URLs for `student-resumes` at view time.
- **Suspected location:** `src/components/ui/file-upload.tsx`, `src/components/dashboard/ApplicationReview.tsx`.
- **Status:** **Fixed in Phase 2 (2026-07-09).** New `src/lib/storageUrls.ts` parses stored storage URLs and mints a 1-hour signed URL for private buckets (`createSignedUrl`, which still runs through storage RLS — clubs can only sign resumes of students who applied to them); external links and public buckets pass through unchanged. Wired into both resume buttons in `ApplicationReview` and the "View file" link in `FileUpload` (tab opened synchronously to survive popup blockers). Stored URLs/data are unchanged, so no backfill is needed. Known remainder (unchanged severity): the CSV export still contains the raw non-signed URL — documented, deliberately out of minimal scope.

#### [Applications] Clubs are not notified of new applications (no in-app notification, no email)
- **Severity:** Medium
- **Repro:** As a student, submit an application. The club receives nothing — no in-app notification and no email; the application only appears if the club happens to open its dashboard.
- **Expected vs. actual:** PRD Journey 1 specifies "in-app + email notification per application" to the club.
- **Root cause (CONFIRMED via triggers + code):** There is a trigger for application *status change* (`on_application_status_change`, AFTER UPDATE) but **no AFTER INSERT trigger** on `applications` (verified via `information_schema.triggers`), and `ApplicationForm` only sends a confirmation to the *student* (`sendApplicationConfirmation`). `send-email` has no "new application to club" type at all (`supabase/functions/send-email/index.ts:13`), even though PRD Appendix C documents that template. Fix: add an INSERT trigger (in-app) and a club email type + caller.
- **Suspected location:** DB trigger on `applications` (to add); `src/components/ApplicationForm.tsx`; `supabase/functions/send-email/index.ts`.
- **Status:** **Fixed in WS1 (2026-07-10).** Migration `20260710000100` adds the `AFTER INSERT` trigger `on_new_application` (reliable in-app notification to the owning club, gated on `application_updates`). `send-email` gains an `application_notification` type: the client sends only an `applicationId`; the function requires the authenticated caller, verifies they own the application (401/403/404 otherwise), derives club/applicant/opportunity from DB rows, gates on the club's `application_updates`, and de-duplicates via a `reminder_logs` claim before sending (best-effort email). `ApplicationForm` passes the inserted row id after a confirmed insert. Verified on the local harness: exactly one in-app notification to the correct club, none on a duplicate, suppressed when the pref is off; ownership/dedup queries exercised (non-owner rejected, second claim → 23505).

#### [Feed/Notifications] "Follow" writes bookmarks, but follower notifications read `club_followers` (never populated)
- **Severity:** Medium
- **Repro:** As a student, "follow"/bookmark a club. When that club posts a new opportunity/event, you get **no** new-post in-app notification and **no** new-post email — even though the item does appear in your feed.
- **Expected vs. actual:** Following a club should drive both the personalized feed *and* new-post notifications.
- **Root cause (CONFIRMED via code + schema):** Following is implemented as a **bookmark** with `club_id` — the feed reads `bookmarks` (`src/pages/StudentFeed.tsx:36-40, 83, 106`). Nothing in the app ever writes `public.club_followers` (grep: referenced only in generated types). But the new-post in-app trigger `notify_followers_on_new_post()` iterates `club_followers` (migration `20260121010020`), and the new-post **emails** in `send-reminders` also query `club_followers` (`supabase/functions/send-reminders/index.ts:247-250, 344-347`). So both notification paths key off a table the UI never populates → they only ever fire for stale/migrated `club_followers` rows. Fix: unify on one mechanism (either write `club_followers` on follow, or point the trigger/cron at `bookmarks`). Minor sub-issue: the trigger/cron gate new-post notifications on the `deadline_reminders` preference, a semantic mismatch.
- **Suspected location:** `src/pages/StudentFeed.tsx`, `src/hooks/useBookmarks.ts`, `notify_followers_on_new_post()` trigger, `supabase/functions/send-reminders/index.ts`.
- **Status:** **Fixed in WS3 (2026-07-10).** Chose `bookmarks.club_id` as the single source of truth (the store the whole app already uses); migration `20260710000300` repoints `notify_followers_on_new_post()` at `bookmarks` (SELECT DISTINCT user_id) and `send-reminders` reads `bookmarks` for new-post emails. The semantic mismatch is fixed with a new dedicated `new_post_notifications` preference (replacing `deadline_reminders` for new posts), surfaced in the preferences + unsubscribe UI. `club_followers` is left in place but no longer read (non-destructive). Verified on the harness: follower notified once (deduped), non-follower/pref-off/unfollowed get none.

#### [Messages] Real-time messaging and the live unread-message badge don't update
- **Severity:** Medium
- **Repro:** Open a conversation as user A. Have user B send a message. A's thread does not update until A refetches/navigates; the navbar unread-message badge also doesn't change live.
- **Expected vs. actual:** PRD lists real-time messaging and real-time unread-count badges.
- **Root cause (CONFIRMED via publication membership):** `useMessages` (`src/hooks/useMessages.ts:272-329`) and `useNavigationCounts` (`src/hooks/useNavigationCounts.ts:71-85`) subscribe to `postgres_changes` on `messages`, but `messages` is **not in the `supabase_realtime` publication** — only `notifications` and `club_team_members` were ever `ALTER PUBLICATION ... ADD`ed (verified via `pg_publication_tables`). So message subscriptions receive no events. Notifications realtime works (it's published). Fix: `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;` (and set `REPLICA IDENTITY` as needed).
- **Suspected location:** migration (publication membership); `src/hooks/useMessages.ts`, `src/hooks/useNavigationCounts.ts`.
- **Status:** **Fixed in WS2 (2026-07-10).** Migration `20260710000200` idempotently adds `public.messages` to the `supabase_realtime` publication; both subscriptions now receive events. Replica identity left at DEFAULT (filters are on `receiver_id`, present in the new row for INSERT/UPDATE — the flows live chat and the unread badge depend on); `FULL` not set. Verified on the local harness via WAL logical decoding: INSERT/UPDATE stream the new tuple incl. `receiver_id`; the only uncovered edge is a DELETE-of-unread live-decrement (self-heals on refetch). `rsvps` realtime was **not** bundled here (no consumer exists; deferred to WS4).

#### [Discovery/RLS] Logged-out visitors can't browse opportunities or events (but can browse clubs)
- **Severity:** Medium
- **Repro:** While logged out, open `/opportunities` or `/events` (public routes; the landing page has a "Browse Opportunities" CTA) → "Failed to load / No results". `/clubs` works fine logged out.
- **Expected vs. actual:** Inconsistent — either all public discovery pages should work for anon, or none should be public.
- **Root cause (CONFIRMED via `pg_policies`):** `opportunities` and `events` SELECT policies are `TO authenticated` only, while `club_profiles`/`club_followers` are `TO public`. The migration granted `anon` table-level SELECT on opportunities/events, but the RLS policy role (`authenticated`) overrides that, so anon is denied. Fix: add anon-visible SELECT policies for active opportunities/events (or make the routes require auth to match the gated model — but note clubs are already public).
- **Suspected location:** RLS policies on `opportunities`, `events`.
- **Status:** **Fixed in WS5 (2026-07-12) — public discovery.** Migration `20260712000100` sets `opportunities`/`events` SELECT to `TO public USING (is_active = true)` so anon can browse active rows, consistent with `club_profiles`, with **least-privilege per-column anon grants** on all three tables (excludes `email`, `views`, internal timestamps, and the auth-only `application_questions`/`rsvp_questions`; keeps `club_profiles.user_id` because the club-owner RLS subqueries require it). Three detail-page queries adjusted so anon never requests an ungranted column. Verified via direct-API tests (`SET ROLE anon`/`authenticated`): anon `select("*")` and every excluded column denied; allowlisted columns + embeds succeed for active rows only; authenticated + club-owner flows unchanged.

#### [Notifications] Client-side transactional emails ignore notification preferences
- **Severity:** Medium
- **Repro:** Disable "Application Updates" (or "New Messages") in preferences. You still receive application-confirmation / application-status / RSVP-confirmation emails.
- **Expected vs. actual:** Preference toggles should gate the corresponding emails.
- **Root cause (code analysis):** In-app notifications (DB triggers) *do* check `notification_preferences`, and the **cron reminders** (`send-reminders`) *do* check them. But the **client-side** transactional sends bypass preferences entirely: `ApplicationForm` (confirmation), `ApplicationReview.updateApplicationStatus`/`handleBulkStatusUpdate` (status), and `RSVPForm`/`eventNotifications` (RSVP) call `send-email` directly with no preference lookup. Fix: check preferences before sending, or move these sends server-side where the check already exists.
- **Suspected location:** `src/lib/emailService.ts` callers, `src/components/ApplicationForm.tsx`, `src/components/dashboard/ApplicationReview.tsx`, `src/lib/eventNotifications.ts`.
- **Status:** **Fixed (WS1 2026-07-10 + WS4 2026-07-11).** WS1 gated the **application** emails server-side on `application_updates`. WS4 completes it for **RSVP** emails: `rsvp_confirmation` and the new `rsvp_declined` now send only an `rsvpId`, and `send-email` derives the recipient + event data from DB rows, authorizes the caller (RSVP's student or owning club), and gates on the student's `event_reminders` (fail-closed). All client-side transactional application/RSVP emails now respect preferences.

#### [Events/Email] Declining an RSVP emails the student a "You're In! confirmed" message
- **Severity:** Medium
- **Repro:** As a club, decline a pending RSVP (once the RSVP flow works). The student receives an email reading "You're In! 🎉 Your RSVP has been confirmed!"
- **Expected vs. actual:** A declined student should get a decline/waitlist message, not a confirmation.
- **Root cause (code analysis):** `sendRSVPStatusEmail` sends `type: "rsvp_confirmation"` for both approve and decline, passing a `statusUpdate` field the template ignores (`src/lib/eventNotifications.ts:97-124`). The `rsvp_confirmation` template in `send-email` always renders the confirmation copy (`supabase/functions/send-email/index.ts:84-102`) and has no decline branch. Fix: add a decline/rejected email template and branch on status. (Partly shadowed today by the approval-RSVP Blocker, but will surface once that's fixed.)
- **Suspected location:** `src/lib/eventNotifications.ts`, `supabase/functions/send-email/index.ts`.
- **Status:** **Fixed in WS4 (2026-07-11).** Added a dedicated `rsvp_declined` template (decline wording, no "You're In"/"confirmed") and branched `sendRSVPStatusEmail` to send `rsvp_declined` on cancel / `rsvp_confirmation` on confirm. Verified via `deno check` + template review.

#### [Events] Event capacity is enforced only in the client
- **Severity:** Medium
- **Repro:** `EventDetail` disables the RSVP button when `spotsLeft <= 0`, but `RSVPForm.handleSubmit` performs no capacity check before inserting. Concurrent RSVPs near the cap, or a direct API insert, can exceed `capacity`.
- **Expected vs. actual:** PRD calls out correct capacity behavior "under concurrent RSVPs." There is no server/DB guard.
- **Root cause (code/schema):** No capacity check in `RSVPForm` (`src/components/RSVPForm.tsx:99-104`) and no DB trigger/constraint on `rsvps` enforcing count < `events.capacity`. Fix: enforce in a `BEFORE INSERT` trigger (authoritative) in addition to the client gate.
- **Suspected location:** `src/components/RSVPForm.tsx`; `rsvps` (add trigger).
- **Status:** **Fixed in WS4 (2026-07-11).** Migration `20260710000... (20260711000100)` adds a `BEFORE INSERT/UPDATE` `enforce_rsvp_capacity` trigger (SECURITY DEFINER) that locks the event row `FOR UPDATE` and rejects a confirm that would exceed `capacity`; only `confirmed` rows count, NULL capacity = unlimited. Verified: sequential fill/reject, approval-at-capacity reject, and **two concurrent transactions racing the last seat yield exactly one confirmed** (no overbooking). Clients surface a clean "at full capacity" toast instead of a raw error. The client pre-check is kept for UX.

#### [Events] Re-RSVP after cancelling fails with a duplicate-key error *(found during Phase 2 verification)*
- **Severity:** Medium
- **Repro:** RSVP to an event, cancel the RSVP (row becomes `status='cancelled'` — rows are never deleted), then click RSVP again → insert hits `rsvps_event_id_student_id_key` → "Failed to process RSVP".
- **Expected vs. actual:** Cancelling should free the slot *and* allow re-registering. The unique `(event_id, student_id)` key blocks the second insert.
- **Root cause:** `useEventRSVP.handleRSVP` and `RSVPForm.handleSubmit` always `insert` for a non-active RSVP; they should update/upsert the existing cancelled row back to `pending`/`confirmed` instead.
- **Suspected location:** `src/hooks/useEventRSVP.ts`, `src/components/RSVPForm.tsx`.
- **Status:** Found (not yet fixed) — out of Phase 2's Blocker/High scope; queued with the other Medium items.

#### [Cron] `archive_past_events()` is defined but not scheduled
- **Severity:** Medium
- **Repro:** The nightly auto-archive can't be confirmed running; `is_active` is never flipped for past events.
- **Expected vs. actual:** PRD/launch checklist expects a scheduled nightly archive; it's listed 🟡 unconfirmed.
- **Root cause (code/schema):** The function exists (`migration 20251223162738:56`) but there is **no `cron.schedule(...)` for it** anywhere in the migrations or repo (only `send-reminders-hourly` was scheduled, manually, per the migration runbook). Mitigating factor: the Events listing filters `event_date >= now` (`src/pages/Events.tsx:65-66`), so past events are hidden from students regardless — but `is_active` staying `true` can skew club dashboards/analytics and any query keyed on `is_active` alone. Live `cron.job` couldn't be queried from this environment (egress-blocked); flagged for confirmation + scheduling. Fix: schedule the job (and confirm `send-reminders-hourly` via `select * from cron.job;`).
- **Suspected location:** cron scheduling (Supabase); `archive_past_events()`.
- **Status:** ✅ **Fixed & deployed (WS6, 2026-07-13)** — migration `20260713000100_ws6_schedule_archive_past_events.sql` commits the nightly `cron.schedule` (idempotent; only its own job name; verified end-to-end on a local harness with real pg_cron 1.6.2), was pushed to production, and the read-only `cron.job` check confirmed **both** `archive-past-events-nightly` (`0 9 * * *`, active) and `send-reminders-hourly` (`0 * * * *`, active, calls the deployed `send-reminders` Edge Function) live in production.

#### [UI/Copy] Bookmark login-prompt toast says "opportunitys" *(found during WS6)*
- **Severity:** Low
- **Repro:** While logged out, click the bookmark icon on an opportunity (list or detail page) → toast reads "Please log in to bookmark opportunitys".
- **Expected vs. actual:** "…bookmark opportunities". Naive `` `${type}s` `` pluralization in `useBookmarks.toggleBookmark`; "event"/"club" happened to pluralize correctly (and the club branch uses the Follow wording anyway), so only "opportunity" surfaced it.
- **Root cause / fix:** replaced the template-string pluralization with an explicit `TYPE_PLURALS` map in `src/hooks/useBookmarks.ts` (the single source of the broken string). Audited the hook's other toasts ("Opportunity/Event bookmarked", "Bookmark removed", Following/Unfollowed, error toasts) — all correct and unchanged.
- **Status:** **Fixed in WS6 (2026-07-13).**

#### [Auth/Console] `Waitlist` and `WaitlistRejected` call `navigate()` during render
- **Severity:** Medium
- **Repro:** Visit `/waitlist` or `/waitlist-rejected` while logged out. Console throws `Warning: Cannot update a component (BrowserRouter) while rendering a different component (Waitlist)` plus "You should call navigate() in a React.useEffect()". Observed live in the headless-browser sweep.
- **Expected vs. actual:** Redirects should happen in an effect, not the render body.
- **Root cause (CONFIRMED in browser):** Both pages do `if (!user) { navigate("/login"); return null; }` in the render body (`src/pages/Waitlist.tsx:47-50`, `src/pages/WaitlistRejected.tsx:19-22`). It "works" (it redirects) but is a React anti-pattern that logs errors and is fragile. Fix: move the redirect into `useEffect` (or use `<Navigate>`).
- **Suspected location:** `src/pages/Waitlist.tsx`, `src/pages/WaitlistRejected.tsx`.
- **Status:** **Fixed in WS8 (2026-07-14).** Both pages now return `<Navigate to="/login" replace />` instead of calling `navigate()` in the render body. A Playwright smoke test asserts both routes redirect a logged-out visitor to `/login` with no page error.

#### [Privacy] Privacy policy doesn't name Supabase or Vercel as processors
- **Severity:** Medium
- **Repro:** Read `/privacy` → "Service Providers" names **Resend** for email plus generic "authentication, and hosting"; it never names **Supabase** or **Vercel**.
- **Expected vs. actual:** PRD Appendix D and the launch checklist require the policy to accurately list the current processors (Supabase, Vercel, Resend). No stale "Lovable" reference remains (good).
- **Root cause:** `src/pages/Privacy.tsx:85` lists Resend only. Fix: name Supabase (database/auth/storage) and Vercel (hosting) explicitly.
- **Suspected location:** `src/pages/Privacy.tsx`.
- **Status:** **Fixed in WS8 (2026-07-14).** The "Service Providers" line now names Supabase (database/auth/storage), Vercel (hosting), and Resend (email) explicitly.

#### [Auth] Google-OAuth pending users can get stranded on the login page
- **Severity:** Low
- **Repro:** Sign up via "UCI Google" (creates a waitlist row + profile but **no** `user_roles` row) → later log in with Google. Because `Login`'s redirect effect requires `user && role` (`src/pages/Login.tsx:31-41`) and `role` is null for a role-less pending user, nothing routes them anywhere; they sit on the login screen.
- **Expected vs. actual:** A pending user should land on `/waitlist` regardless of signup method.
- **Root cause:** Login/Signup redirect effects key off `role`, which is null for OAuth-pending users. (Note: the Google OAuth path as a whole was not verifiable end-to-end here — provider config on the new project is "assumed working, not re-verified" per the migration doc.)
- **Suspected location:** `src/pages/Login.tsx`, `src/contexts/AuthContext.tsx` (`handleNewOAuthUser`).
- **Status:** **Fixed in WS8 (2026-07-14).** `Login`'s redirect effect now consumes `useWaitlist` and sends a logged-in role-less user to `/waitlist` (pending) or `/waitlist-rejected` (rejected) once waitlist load settles; `null`/`approved` status never triggers a spurious redirect. Not exercisable end-to-end here (no OAuth provider/seeded pending OAuth account in this environment); verified by reading the flow.

#### [Notifications] Unsubscribe-link auto-opt-out can re-enable other preferences
- **Severity:** Low
- **Repro:** Disable some preference in-app. Then click an "Unsubscribe from X" link in any email. The X preference is disabled, but previously-disabled preferences may flip back to `true`.
- **Root cause:** `Unsubscribe.checkAuthAndLoadPreferences` builds `newPrefs` from the **stale initial-default** `preferences` state (all `true`) rather than the freshly loaded values, then saves it (`src/pages/Unsubscribe.tsx:60-66`). Because `setPreferences` is async, the closure still holds defaults. Fix: build `newPrefs` from the loaded row.
- **Suspected location:** `src/pages/Unsubscribe.tsx`.
- **Status:** **Fixed in WS8 (2026-07-14).** The auto-opt-out now builds `newPrefs` from a local `loadedPrefs` (the freshly fetched row, defaults only when no row exists) rather than the stale `preferences` state, so only the email link's `type` is disabled and every other loaded preference is preserved.

#### [Data] `bookmarks` has no uniqueness constraint
- **Severity:** Low
- **Repro:** Rapid/concurrent bookmark toggles can create duplicate `bookmarks` rows for the same `(user_id, opportunity_id)` etc. (no unique constraint — verified via `pg_constraint`).
- **Root cause:** Client-side `isBookmarked` guard only; no DB uniqueness. Fix: add a partial unique index per target column.
- **Suspected location:** `bookmarks` table; `src/hooks/useBookmarks.ts`.
- **Status:** **Fully fixed as of WS8 (2026-07-14).** WS3 (migration `20260710000300`) made club follows DB-unique; WS8 (migration `20260714000100`) adds the two remaining partial unique indexes `bookmarks_user_opportunity_unique (user_id, opportunity_id) WHERE opportunity_id IS NOT NULL` and `bookmarks_user_event_unique (user_id, event_id) WHERE event_id IS NOT NULL`, each preceded by a one-time earliest-wins dedup. `useBookmarks` already treats `23505` on insert as idempotent success for all types. Verified on the harness: duplicate opportunity insert rejected; 3 seeded duplicates deduped to the earliest; idempotent on re-run.

#### [Auth] Admin approval doesn't record `reviewed_by`
- **Severity:** Low
- **Repro:** Approve/reject a waitlist entry; the `waitlist.reviewed_by` column stays null (only `reviewed_at`/`status` are set).
- **Root cause:** `approveUser`/`rejectUser` don't set `reviewed_by` (`src/hooks/useWaitlist.ts:116-127, 148-156`). Fix: set it to the admin's id for audit trail.
- **Suspected location:** `src/hooks/useWaitlist.ts`.
- **Status:** **Fixed in WS8 (2026-07-14).** `approveUser`/`rejectUser` resolve the acting admin via `supabase.auth.getUser()` and write `reviewed_by` (null-safe) alongside `status`/`reviewed_at`.

#### [Cleanup] Dead / duplicated code (non-blocking)
- **Severity:** Low
- **Details:** (a) `AuthContext.signUp` (`src/contexts/AuthContext.tsx:179-252`) is exposed but never called — email signup goes through `send-otp`/`verify-otp`; it also contains a divergent second copy of the waitlist/profile-creation logic (a foot-gun if someone wires it up). (b) `ClubProfileSetup` re-declares `CATEGORY_OPTIONS` locally instead of importing `CLUB_CATEGORIES` from `src/lib/constants.ts`, and uses a bespoke Sparkles+"ZotHub" header instead of the shared `<Logo>` component (visual inconsistency).
- **Status:** **Fixed in WS8 (2026-07-14).** (a) `AuthContext.signUp` removed (function + context-type entry + provider value; confirmed no callers). (b) `ClubProfileSetup` now imports `CLUB_CATEGORIES` (identical list, local copy deleted) and renders the shared `<Logo>` component.

#### [Tooling] ESLint reports 26 errors (build & typecheck are clean)
- **Severity:** Low
- **Details:** `npm run lint` → 26 errors / 31 warnings: mostly `@typescript-eslint/no-explicit-any` (`src/pages/club/ClubFeed.tsx`, `supabase/functions/send-reminders`), `no-case-declarations` in `supabase/functions/send-email/index.ts:53,59`, and a `require()` import in `tailwind.config.ts:150`. None break `vite build` or `tsc --noEmit` (both pass). The repo's Playwright config also references a currently-unavailable package (per PRD roadmap) so there is no runnable e2e suite yet.
- **Status:** **Fixed in WS7 (2026-07-13).** All 26 errors cleared (`npm run lint` → 0 errors; the 31 pre-existing exhaustive-deps/fast-refresh warnings remain, intentionally); the Playwright config is repaired with a runnable 9-test smoke suite (`npm run test:e2e`). Details in the WS7 completion record.

#### [Console] Benign React Router v7 future-flag warnings
- **Severity:** Low
- **Details:** Every route logs two `React Router Future Flag Warning` messages (`v7_startTransition`, `v7_relativeSplatPath`). Cosmetic; opt-in flags silence them. No functional impact.
- **Status:** **Fixed in WS7 (2026-07-13).** Both flags opted in on `BrowserRouter`; verified in-browser that the warnings no longer log and the smoke suite (routing incl. redirects and the 404 splat) passes.

#### [Pre-launch experience] Findings from the 2026-07-13 UX/design exploration (tracked to WS10–WS12)
- **Severity:** Medium (experiential; no correctness impact) — grouped because they're addressed by the Pre-Launch Experience Roadmap.
- **Onboarding dead-ends:** approved users land on a dashboard with no first-run guidance; "complete your profile first" toasts (`ApplicationForm.tsx`, `CreateOpportunity.tsx`, `CreateEvent.tsx`) have **no link** to the profile page; signup bounces to `/login` after OTP instead of auto-signing-in. → **WS11b.**
- **Review-action safety:** bulk "Reject All" and single-click accept/reject in `ApplicationReview.tsx` fire with no confirmation and **no revert**; the `reviewed` status is referenced in badges/analytics but **no control sets it** (unreachable). → **WS11c.**
- **Missing club→applicant message path:** `ApplicationReview.tsx` has no "Message applicant" affordance despite the PRD "message accepted candidates" journey; backend messaging exists. → **WS11c.**
- **Shallow discovery search:** `Opportunities.tsx` filters client-side over **title + club name only** across a `limit(50)` fetch with **no pagination**, despite the "full-text search" claim. → **WS11a / WS12.**
- **Design-system debt:** phantom `font-display` class used 39× (no `display` key in `tailwind.config.ts`); badge type→color map differs between list (`OpportunityCard`) and detail (`OpportunityDetail`); guards render a bespoke `Loader2` instead of `PageLoader`; skeleton/real-card size mismatch on `Opportunities`; two mobile-nav paradigms (hamburger vs bottom bar). → **WS11 foundation.**
- **Dead code:** `src/pages/Index.tsx` ("Welcome to Your Blank App" scaffold, unrouted); `src/components/dashboard/DashboardLayout.tsx` (orphaned second dashboard shell, imported by nothing); `club_followers` table (unread since WS3). → **WS11 foundation (delete).**
- **RSVP email inconsistency:** the no-questions RSVP path (`useEventRSVP.handleRSVP`) never sends a confirmation email while the `RSVPForm` path does. → **WS12.**
- **No in-product support:** no `/help`/`/faq`/`/support` route anywhere. → **WS12 (Support Center, launch-blocking).**
- **Status:** Found (2026-07-13); scheduled into WS10–WS12. Not yet fixed.

### Workflows checked with no material issues
- **Public pages render + responsive:** landing, `/opportunities`, `/events`, `/clubs`, `/login`, `/signup` (+role variants), `/forgot-password`, `/privacy`, `/unsubscribe`, `/404` all render at 1280px and 375px with **no horizontal overflow**; data pages show clean "Failed to load"/empty states (not blank/crash) when the backend is unreachable. `ProtectedRoute`/`AdminRoute` correctly send logged-out users to `/login`.
- **Application questions:** all four question types (short_text, long_text, single_choice, multiple_choice) author and render correctly (`DynamicQuestionForm`), and required-field validation works; the same form is reused by RSVPs.
- **Duplicate blocking:** applications and RSVPs both have real unique constraints (`applications_opportunity_id_student_id_key`, `rsvps_event_id_student_id_key`) and the UI handles `23505`.
- **Application status workflow:** status transitions, bulk accept/reject, CSV export, and the student-facing in-app status notification (trigger, preference-aware) all work. `.ics` calendar export is well-formed (UTC, escaping, line folding).
- **Cron reminders:** `send-reminders` idempotency is solid (`reminder_logs` + `unique_reminder` unique constraint) and it correctly respects `notification_preferences`; deadline reminders correctly key off bookmarks.
- **Storage RLS design:** `club-assets` intentionally public; `student-resumes` private with correct owner + applied-club SELECT policies (the only resume problem is the client using the wrong URL type — see the High finding above).
- **Migrations:** all 29 apply cleanly against a fresh Postgres 16; `build`, `tsc --noEmit` pass.

---

## Live QA follow-up findings (2026-07-09, Phase 2c)

Second live-QA round after the Phase 2b deploy (`main` @ `1760fbe`). Key discovery: several "still broken" symptoms are two different classes — a **stale frontend deploy** and a **real RLS gap** — so they needed opposite responses.

#### [Deploy] "Resume shows raw URL" (#1) and "View My Applications 404" (#2) — and likely the Unread freeze (#3) — are a stale frontend, not code
- **Severity:** High (release/deploy process)
- **Finding:** The Phase 2b fixes for these are present in `main` at the deployed commit `1760fbe` **and in the production build** — verified by grepping `dist/assets/*.js` after `vite build`: it contains `Resume (optional)` (the FileUpload UI) and `/student/dashboard` (the corrected route), and there is only **one** `ApplicationForm` / one "View My Applications" in the tree (no duplicate component). The Unread-filter freeze (#3) shares the exact root cause fixed in 2b (the `useTeamInvitations` render loop — `useCallback` + effect guard are in current source): the loop froze *all* interactions on the page (Preferences and the Unread tab alike), and it only manifested with ≥1 notification.
- **Why the live site still showed the old behavior:** the browser/CDN was serving the pre-2b bundle. No service worker exists, and `vercel.json` is a plain SPA rewrite with no long-cache override, so this is a deployment-propagation / hard-refresh issue rather than a source bug.
- **Action:** no code change (the fixes are already correct and built). **Redeploy this branch on Vercel and confirm the production alias points at the new deployment, then hard-refresh** (see deployment steps in the PR/commit). If it still reproduces on a cache-busted load, capture the served JS filename hash to compare against the built asset.
- **Status:** **Verified fixed in source + build (Phase 2b).** Live requires a fresh deploy / cache bust.

#### [Events/RLS] Club RSVP approval never persisted — missing club UPDATE policy on `rsvps` (#4, #6)
- **Severity:** Blocker (event approval workflow)
- **Repro / live DB evidence:** after a club "approved" an RSVP the row stayed `pending`/`cancelled`; no `confirmed` row ever appeared, yet the club UI showed success and the student got the approval email.
- **Root cause (confirmed against schema + reproduced under RLS):** `rsvps` had UPDATE policies for the **owning student only** ("Students can update their own RSVPs"). There was **no policy letting a club update RSVPs for events it owns** — unlike `applications`, which *does* have "Clubs can update applications to their opportunities" (which is why application accept/reject worked and RSVP approval didn't). So the club's `update(status='confirmed')` was RLS-filtered to **0 rows with no error**; supabase-js reported success, the UI optimistically flipped to confirmed and the email fired, but the DB never changed (reverted to pending on refresh) and the approval-notification trigger never ran. This is the "RLS blocks update while UI shows optimistic success" class.
- **Fix (Phase 2c):**
  - Migration `20260709000500` adds `"Clubs can update RSVPs for their events"` (UPDATE, USING + WITH CHECK = event owned by the club). Idempotent (`DROP POLICY IF EXISTS` first).
  - `RSVPReview.updateRsvpStatus` / `handleBulkStatusUpdate` now `.select()` the updated rows and **only** send email / show success / update local state when a row actually changed; a 0-row result shows a real error ("Could not update this RSVP…"). This prevents false success even if a policy is ever missing again.
  - Verified under simulated RLS: the owning club's approval now persists `pending → confirmed` and fires the `rsvp_update` notification; a **different** club still updates 0 rows (RLS intact).
- **Suspected location:** `rsvps` UPDATE policy (added); `src/components/dashboard/RSVPReview.tsx`.
- **Status:** **Fixed (Phase 2c).**

#### [Events] Re-RSVP after cancellation failed with "Failed to process RSVP" (#7)
- **Severity:** High
- **Root cause:** RSVP rows are never deleted (cancel = `status='cancelled'`), and both RSVP entry points did a plain `insert`, so re-RSVPing hit the `(event_id, student_id)` unique key.
- **Fix (Phase 2c):** `useEventRSVP.handleRSVP` and `RSVPForm.handleSubmit` now `upsert(..., { onConflict: "event_id,student_id" })`, reusing the existing row and flipping it back to `pending`/`confirmed` (per `requires_approval`). Verified under student RLS: cancel → re-RSVP leaves exactly one row, no unique violation.
- **Suspected location:** `src/hooks/useEventRSVP.ts`, `src/components/RSVPForm.tsx`.
- **Status:** **Fixed (Phase 2c).**

#### [Events] Club dashboard had no pending-RSVP badge (#5)
- **Severity:** Medium
- **Fix (Phase 2c):** `ClubHome` now also fetches the pending-RSVP count (rsvps `pending` for the club's events) and passes it to `DashboardTabs`, which renders a badge on the **RSVPs** tab exactly like the Applications tab. Same query shape as the existing application count.
- **Suspected location:** `src/pages/club/ClubHome.tsx`, `src/components/club/DashboardTabs.tsx`.
- **Status:** **Fixed (Phase 2c).**

#### Systemic sweep (Phase 2c)
- **Other silent-update-by-RLS risks:** audited every club-side `.update()`. `applications` already has the club UPDATE policy (works). `waitlist` has admin policies (Phase 2). `club_team_members`, `opportunities`, `events` updates are gated by owner policies. The only missing one was `rsvps` (now fixed). RSVP approval is the one spot hardened with a post-update `.select()` check; the applications path was left as-is because its policy exists and it works.
- **Dead nav targets:** swept all `navigate("…")` / `to="…"` string targets against the routes in `App.tsx` — none dead (the two Phase 2b offenders `/dashboard` and `/club/home` are gone; only `/signup?role=…` query-param variants remain, which are valid).
- **Status vocabulary:** the app consistently uses `rsvps.status ∈ {pending, confirmed, cancelled}` end-to-end (CHECK extended in Phase 2). Approve→`confirmed`, decline→`cancelled`. No approved/declined drift in `rsvps`. (PRD prose still says "approved/declined" — cosmetic doc mismatch, not code.)
- **Remaining (still open, unchanged severity):** `rsvps` is not in the realtime publication, so a student's already-open event page won't flip to "registered" until they refresh (the in-app notification now prompts them); club-decline of an RSVP still isn't notified in-app (indistinguishable from self-cancel at the row level).

---

## Live QA follow-up findings (2026-07-09, Phase 2b)

Found during live testing of the deployed Blocker/High pass. #1–#6 fixed this pass; #7–#8 documented only.

#### [Club] Club profile setup reports success but saves nothing
- **Severity:** High
- **Repro:** As a club, complete profile setup → success toast, but `select * from club_profiles where user_id=…` returns 0 rows; opportunity creation then fails with "Club profile not found."
- **Root cause:** `ClubProfileSetup.handleSave` used `.update().eq("user_id", …)`. If the row was missing (e.g. removed during orphan cleanup, or never created), update affects 0 rows and returns no error → false "success."
- **Fix (Phase 2b):** switched to `.upsert(..., { onConflict: "user_id" })` including the required `user_id`/`email` columns, and the error toast now shows the real message. The same latent bug in `StudentProfileSetup.handleSave` was fixed identically. Verified in SQL: upsert creates the row when missing, updates when present, always leaving exactly one row.
- **Suspected location:** `src/pages/ClubProfileSetup.tsx`, `src/pages/StudentProfileSetup.tsx`.
- **Status:** **Fixed (Phase 2b).**

#### [Applications] Post-submit "View Application" button 404s
- **Severity:** Medium
- **Repro:** Submit an application → success modal → "View My Applications" → 404.
- **Root cause:** `OpportunityDetail` success modal navigated to `/dashboard`, which is not a route.
- **Fix (Phase 2b):** routes to `/student/dashboard` (the existing application-tracking page). Confirmed no other `/dashboard` references remain.
- **Suspected location:** `src/pages/OpportunityDetail.tsx`.
- **Status:** **Fixed (Phase 2b).**

#### [Applications] Resume shown as a raw URL on the application form
- **Severity:** Medium
- **Repro:** With a resume on the student profile, the application form prefilled it into a raw "Resume URL" text box.
- **Desired/Fix (Phase 2b):** replaced the raw URL input with the shared `FileUpload` (variant `file`, `student-resumes` bucket) which renders the resume as an attached file with a "View file" link (opens via the signed-URL helper from Phase 2) and a Replace/Remove control. It defaults to the profile resume with helper text ("Using the resume from your profile…") and lets the student upload/replace a resume for that specific application. The chosen URL is stored on the application as before.
- **Suspected location:** `src/components/ApplicationForm.tsx`.
- **Status:** **Fixed (Phase 2b).**

#### [Notifications] Preferences dialog freezes the page
- **Severity:** High
- **Repro:** On the notifications page (student or club), clicking Preferences appeared to do nothing and then all buttons stopped working until refresh — but only when the user actually had notifications.
- **Root cause (reproduced):** `useTeamInvitations` returned **new function references every render** (no `useCallback`). The Notifications effect that fetches invitation statuses depended on `checkInvitationStatus` and called `setInvitationStatuses(...)`, so with `notifications.length > 0` it re-ran every render → set state → re-render → an update loop that starved the UI (the dialog opened behind the thrash / clicks were dropped). With zero notifications the effect early-returned, which is why it only showed up with real data. Confirmed in a faithful headless-browser harness: empty notifications = clean; one notification = clicks blocked; after the fix = clean.
- **Fix (Phase 2b):** wrapped `useTeamInvitations`'s returned functions in `useCallback` (stable refs), and hardened the Notifications effect to run only when there are actual team-invitation notifications (with a cancellation guard). Re-verified: dialog opens/closes, `pointer-events` restored, other controls keep working, no loop.
- **Suspected location:** `src/hooks/useTeamInvitations.ts`, `src/pages/Notifications.tsx`.
- **Status:** **Fixed (Phase 2b).**

#### [Navigation] Club notifications page loses role-aware navigation
- **Severity:** Medium
- **Repro:** As a club on `/notifications`, the ZotHub logo linked to `/club/home` (404), and the normal club nav/back options were gone.
- **Root cause:** the page rendered a bespoke club header (with a wrong `/club/home` link) instead of the shared club layout.
- **Fix (Phase 2b):** the page now renders inside `RoleBasedLayout`, so clubs get `ClubLayout` and students get `StudentLayout` — full role-aware top/bottom nav, correct logo/dashboard links, on both roles. Removed the bespoke header and the dead `/club/home` link.
- **Suspected location:** `src/pages/Notifications.tsx`.
- **Status:** **Fixed (Phase 2b).**

#### [Events] RSVP approval not reflected to the student in-app
- **Severity:** Medium
- **Repro:** Club approves a pending RSVP; student gets the approval email, but the site didn't show the RSVP as approved and no in-app notification appeared.
- **Root cause:** there was no in-app notification on RSVP approval (unlike application status changes, which have a trigger). `EventDetail` *does* render "You're registered!" once the RSVP is `confirmed`, so the UI reflects it on next load — the missing piece was the notification + a prompt to refresh. (The live auto-refresh gap is the separate, still-open Medium: `rsvps` isn't in the realtime publication.)
- **Fix (Phase 2b):** migration `20260709000400` adds an `AFTER UPDATE` trigger on `rsvps` that, on a `pending → confirmed` transition (only a club approval can do that), inserts an in-app notification for the student, respecting the `event_reminders` preference. Declines (`pending → cancelled`) are intentionally not notified because they're indistinguishable at the row level from a student self-cancel — noted as a follow-up. Verified in SQL: approval creates exactly one `rsvp_update` notification; a self-cancel creates none.
- **Suspected location:** `rsvps` trigger (added); `src/components/dashboard/RSVPReview.tsx` (already emails); `src/pages/EventDetail.tsx` (already renders confirmed state).
- **Status:** **Fixed (Phase 2b).** Follow-up (open, Low): notify on club decline; add `rsvps` to the realtime publication so the student's open page updates without a manual refresh.

#### [Infra] Supabase migration history is unreconciled with the restored prod DB
- **Severity:** High (operational — blocks safe `db push`)
- **Detail:** Production schema was created by `pg_restore`, not by the CLI, so `supabase_migrations.schema_migrations` doesn't record the historical migrations. `npx supabase db push --linked` therefore tries to replay all old migrations. During this QA the three Phase 2 SQL files were applied manually instead.
- **Safest next step (documented, not executed here):** backfill the migration-history table so the CLI treats the pre-existing migrations as already applied, then push only the new ones. Non-destructive, no reset:
  1. `npx supabase migration list --linked` to see local-vs-remote state.
  2. For every migration **already present in prod** (everything up to and including `20260129012302…`), mark it applied without running it:
     `npx supabase migration repair --status applied <version>` (repeat per version, or pass several). `<version>` is the numeric timestamp prefix of each file.
     Equivalent manual form if preferred: `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20251223013805'), … ON CONFLICT DO NOTHING;`
  3. Confirm the only migrations still "pending" are the Phase 2 / 2b ones (`20260709000100`–`20260709000400`), then `npx supabase db push --linked` to apply just those.
  - **Do not** run `supabase db reset` against prod (destructive). If `000100`–`000300` were already applied manually, also `migration repair --status applied` those three so push doesn't re-run them; only `20260709000400` should remain to apply.
- **Status:** ✅ **Done (2026-07-09).** Migration history reconciled via `migration repair`; `db push --linked --dry-run` = "Remote database is up to date." See the dedicated "Supabase migration-history repair — ✅ COMPLETE" section below.

#### [Data] Orphaned migrated users were manually cleaned
- **Severity:** Medium (data hygiene)
- **Detail:** `student_profiles`, `club_profiles`, and `club_team_members` had `user_id` values not present in `auth.users` (old Lovable Cloud UUIDs — `auth.users` was never migrated). These orphan rows were deleted manually during QA. Root cause confirmed earlier: `club_team_members.user_id` has **no FK** (and the profile tables' orphans predate the fresh `auth.users`).
- **Future-safe guidance (documented, not executed — avoids touching active data):**
  - **Detection query (safe, read-only)** to re-check before any cleanup:
    `SELECT 'club_team_members' t, ctm.id FROM club_team_members ctm LEFT JOIN auth.users u ON ctm.user_id = u.id WHERE ctm.user_id IS NOT NULL AND u.id IS NULL;` (repeat for `student_profiles`, `club_profiles`).
  - **Preferred hardening — ✅ done in WS8 (migration `20260714000200`):** the `club_team_members` FK `(user_id) → auth.users(id) ON DELETE SET NULL` is now added. To avoid the "errors if an orphan exists" problem, the migration is self-guarding — it NULLs any dead `user_id` (references absent from `auth.users`; never an active account) *before* adding the FK, so it can't fail on live orphans. The read-only detection query above should still be run pre-`db push` to confirm the expected zero-orphan state. (The profile tables `student_profiles`/`club_profiles` were left as-is — out of WS8's documented scope; their orphans were cleaned in QA.)
  - **Alternative / complementary (UI):** the team roster already hides the "Message" button for a null `user_id`, so a nulled orphan renders as a plain (non-actionable) roster entry rather than a ghost with a broken link.
- **Status:** **Hardened in WS8 (2026-07-14)** — FK added (self-healing); no destructive change to active data. **Superseded by the Auth-orphan cleanup pass (2026-07-13):** `scripts/audit_auth_orphans.sql` now audits *all 15* user-ID columns (not just these three tables), and migrations `20260714000300`/`20260714000400` clean the deterministic-junk classes, restore/add the 11 managed auth.users FKs, and drop the retained `messages` CASCADE FKs (see the cleanup record). See the new inventory entry below and the cleanup record in "▶ Start here".

#### [Data] Production lost the original auth.users FKs in pg_restore; user_roles carries 8 orphaned Lovable-era rows
- **Severity:** Medium (data hygiene / integrity; no user-facing behavior — a dead UUID can never authenticate, so RLS renders these rows inert)
- **Facts (maintainer-confirmed against production, 2026-07-14):** `public.user_roles` has **8 rows** whose `user_id` is absent from `auth.users` and **3 valid rows**. Migration `20251223013805` declares `user_roles.user_id REFERENCES auth.users(id) ON DELETE CASCADE`, so those orphans can only exist because the FK is missing in production.
- **Root cause (strong inference from schema, not a directly-verified restore record):** the most consistent explanation is that production was built by `pg_restore` from the Lovable dump with `auth.users` intentionally not migrated, so most of the 7 declared FKs to `auth.users` (`user_roles`, `student_profiles`, `club_profiles`, `bookmarks`, `notifications`, and `messages`×2) could not validate against the fresh `auth.users` and were dropped/skipped. The production audit (Q1) shows the loss was **partial**: the `messages` FKs (`sender_id`/`receiver_id`, CASCADE) were **retained**, while the others were lost. Six further user-ID columns (`notification_preferences`, `waitlist.user_id`, `waitlist.reviewed_by`, `page_views.user_id`, `club_followers`, `reminder_logs`) never had FKs at all. Only the post-repair FKs (`rsvps.status_updated_by` WS4, `club_team_members.user_id` WS8) are enforced in production.
- **Fix:** the Auth-orphan cleanup pass — read-only audit `scripts/audit_auth_orphans.sql`, deterministic cleanup `20260714000300`, FK restoration `20260714000400` (adds the 11 managed FKs as validated constraints; **drops the retained `messages` CASCADE FKs** without recreating them — CASCADE would erase a surviving user's history — leaving re-adding message integrity to a separate product decision; **fails loud** rather than leaving an unvalidated constraint if an orphaned profile remains). Full classification + verification in the cleanup record in "▶ Start here".
- **Status:** ✅ **Fixed & production-verified (2026-07-13).** Migrations `20260714000300`/`20260714000400` were pushed to production and the post-push audit confirmed zero orphans, `valid_user_roles = 3`, and 13 validated auth.users FKs (`messages` intentionally FK-free). See the Auth-orphan cleanup record in "▶ Start here".

---

## Supabase migration-history repair — ✅ COMPLETE (2026-07-09)

> **Done.** Migration history was reconciled with `supabase migration repair --status applied` for the existing versions. Verified: `npx supabase migration list --linked` shows **all 34 local migrations matching remote**, and `npx supabase db push --linked --dry-run` reports **"Remote database is up to date."** The manual raw-SQL workaround is **no longer needed** — new migration files now deploy through the normal `supabase db push --linked` flow. The audit that follows is retained as the record of how the repair was scoped and verified.

### Why this was needed
Production was built by `pg_restore` (from the Lovable Cloud dump), not by the Supabase CLI, so the CLI's history table `supabase_migrations.schema_migrations` does **not** record the migrations whose objects already exist in the DB. As a result `npx supabase db push --linked` tries to replay every local migration from the beginning and fails on the first already-existing object (observed: `type "public.user_role" already exists`, from the very first migration `20251223013805`). The five 2026-07-09 migrations were then applied **manually as raw SQL**, so they aren't recorded either. Net: the schema is correct and current, but the history table is empty/incomplete, so the CLI's model of "what's applied" is wrong.

### 1. Which local migrations exist (read-only, already verified here)
34 files in `supabase/migrations/`, all named `<version>_<slug>.sql` where `<version>` is the 14-digit timestamp prefix. Two groups:

- **29 historical** (present in prod via `pg_restore`), versions:
  `20251223013805 20251223083053 20251223083142 20251223083413 20251223160240 20251223162738 20251223165608 20251223170908 20251223171146 20251224045225 20251224050002 20251224051950 20260109015222 20260115000013 20260121001924 20260121010020 20260121010216 20260121030837 20260121031036 20260121031500 20260121064141 20260121064212 20260121205820 20260121210558 20260121235823 20260128210854 20260128213952 20260128214112 20260129012302`
- **5 new** (applied manually as SQL on 2026-07-09), versions:
  `20260709000100 20260709000200 20260709000300 20260709000400 20260709000500`

### 2. Which versions production currently thinks are applied (needs a read-only prod check — run this first, it only reads)
Either of these is non-destructive and read-only; run one and share the output before doing any repair:

```bash
# Compare local files against the remote history table (safest, CLI-native):
npx supabase migration list --linked
```
```sql
-- Or query the history table directly (read-only):
select version, name from supabase_migrations.schema_migrations order by version;
```
Expected given the pg_restore history: the remote/history column is **empty or near-empty**, while all 34 show as local. (If some rows *are* already present, only repair the ones that are missing — see risks.)

### 3. Which migrations are effectively already present in production
**All 34.** The 29 historical ones came in with the `pg_restore` schema; the 5 new ones were applied manually. So the correct end state is "all 34 marked applied," and **nothing should actually execute against the schema** during repair — repair only writes rows into the history table, it does not run migration SQL.

### 4. Exact non-destructive repair commands (executed 2026-07-09 — retained as record)
`supabase migration repair --status applied <version…>` inserts history rows **without executing** the migration bodies. All 34 were marked applied (repair is idempotent per version):

```bash
# One command, all 34 versions (CLI accepts multiple versions):
npx supabase migration repair --status applied \
  20251223013805 20251223083053 20251223083142 20251223083413 20251223160240 \
  20251223162738 20251223165608 20251223170908 20251223171146 20251224045225 \
  20251224050002 20251224051950 20260109015222 20260115000013 20260121001924 \
  20260121010020 20260121010216 20260121030837 20260121031036 20260121031500 \
  20260121064141 20260121064212 20260121205820 20260121210558 20260121235823 \
  20260128210854 20260128213952 20260128214112 20260129012302 \
  20260709000100 20260709000200 20260709000300 20260709000400 20260709000500
```
(If the installed CLI rejects multiple versions in one call, run it once per version — same effect. `--status applied` is the only status used here; never `reverted`.)

### 5. Risks & uncertainties (review before running)
- **Confirm the manual SQL actually ran** before marking `20260709000100–000500` applied, otherwise the history would claim an un-applied migration is done. Quick read-only checks (all should return a row / true):
  - `000100`: `select 1 from pg_constraint where conname='rsvps_status_check' and pg_get_constraintdef(oid) ilike '%pending%';`
  - `000200`: `select 1 from pg_policies where tablename='user_roles' and policyname='Admins can insert user roles';`
  - `000300`: `select 1 from pg_trigger where tgname='enforce_uci_email_on_signup';`
  - `000400`: `select 1 from pg_trigger where tgname='on_rsvp_status_change';`
  - `000500`: `select 1 from pg_policies where tablename='rsvps' and policyname='Clubs can update RSVPs for their events';`
- **Version-format match:** repair must use the exact 14-digit filename prefixes (above). A mismatch would leave a migration looking "pending" and get replayed on the next push. Verify with `migration list` afterward.
- **Partial existing history:** if step 2 shows some versions already recorded, including them again is harmless (idempotent), but do not *remove* anything. No `--status reverted`, ever, in this repair.
- **This does not change schema/data** — `repair` only writes to `supabase_migrations.schema_migrations`. It is non-destructive by design. Still, take a routine backup/snapshot beforehand as standard practice.
- **Uncertainty:** the exact contents of the remote history table can't be inspected from this environment (no prod access here); step 2 must be run by someone with linked CLI access, and its output may slightly change the version list in step 4 (only ever shrinking it).

### 6. How to verify afterward that `db push` only applies new work
```bash
npx supabase migration list --linked   # every one of the 34 should show applied both locally and remotely
npx supabase db push --linked --dry-run # should report NOTHING to apply
```
After that, a future genuinely-new migration file is the only thing `db push` will apply. If `db push` ever again tries to replay an old version, the repair for that version didn't take (re-check the version string).

---

## Phase history (done) → current plan

The migration-era phases are complete: **Phase 1** (Full Product Audit) ✅, **Phase 2 / 2b / 2c** (prioritized + live-QA bug fixes) ✅, **Phase 3** (DNS cutover ✅, DB-level `@uci.edu` trigger ✅, Supabase migration-history repair ✅). **Phase 4** (comprehensive UI/UX revision) and the **access-model transition** (gated beta → open `@uci.edu` signup) remain deferred post-launch items.

**The active plan now lives at the top of this document** — see **"▶ Start here"**, **"Backlog — ranked workstreams"**, and the **"Lovable decommission checklist."** This section is retained only to record that the numbered migration phases are closed.

---

## Documentation sources of truth

Now that migration is closed, the active docs and their roles are:

- **`README.md`** — setup & deployment basics (how to run/build/deploy the app, env vars, edge functions).
- **`prd.md`** — product spec and **current product state** (vision, users, access model, feature list, known issues, launch readiness).
- **`plan.md`** (this doc) — the **product-development execution plan**: current stage, next priorities, and the Lovable decommission checklist at the top; the migration-era audit/Bug Inventory retained below as the historical record the backlog draws from.
- **`docs/archive/MIGRATION.md`** and **`docs/archive/lovable-migration-plan.md`** — **historical reference only**; the migration they describe is complete. Not active execution docs.

The project is no longer in migration mode; treat the three top-level docs above as current and the `docs/archive/` files as history.
