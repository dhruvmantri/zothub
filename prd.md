# ZotHub Product Requirements Document

**Version:** 3.4
**Last Updated:** 2026-07-13
**Status:** **Live in production on owned infrastructure** (Vercel + self-owned Supabase); `zothub.app` DNS cutover complete and Supabase migration history reconciled. The migration/cutover is **fully closed** and the project is in **normal product-development mode** (a short stability-monitoring window is running before Lovable decommission) — see `plan.md` for the active development plan.
**Author:** Claude, reconciled against the live codebase

---

## 📋 Executive Summary

**ZotHub** is a two-sided campus marketplace platform that connects **UC Irvine students** (seeking leadership roles, internships, projects, volunteer positions, and campus events) with **UCI clubs** (posting opportunities, managing applications, and building community). The platform solves the problem of **centralized discovery** — students currently miss opportunities scattered across Facebook groups, Discord servers, email listservs, and personal networks.

### Mission
Create a single, searchable hub where every UCI student has equal access to all campus opportunities, and every club has professional tools to recruit, manage, and engage their community.

### Relationship to `plan.md` and `README.md`
This document (`prd.md`) is the **product spec and product source of truth** — vision, users, journeys, access model, implemented capabilities, product gaps, and launch readiness. `plan.md` is the **engineering execution plan** for normal product development (current state, the recommended next workstream, the ranked backlog). `README.md` is setup/deployment. Read this for *what the product is and where it falls short*; read `plan.md` for *what to build next*.

### Infrastructure note
ZotHub previously ran on Lovable Cloud (a managed Supabase instance) with Lovable hosting. It now runs on a **self-owned Supabase project + Vercel hosting** — schema, data, storage, and all edge functions were migrated, `zothub.app` DNS is cut over to Vercel, and the Supabase migration history is reconciled (future DB changes use normal migration files + `supabase db push`). The migration is **fully closed**; full history is archived at `docs/archive/MIGRATION.md`. Lovable no longer serves production traffic but is retained temporarily as a rollback path (decommission is gated on `plan.md`'s checklist).

### Launch scope
- **Access model:** Gated beta — new users go through a waitlist (signup → email OTP verification → admin approval) rather than fully open signup. See "Access Model" below.
- **Expected initial scale:** 10-30 clubs, 200-500 students in the first 30 days (medium launch; informs the performance posture — query limits + basic pagination, not full virtualization).
- **Launch domain:** `zothub.app` — **live on Vercel.** DNS cutover complete; `zothub.app` and `www.zothub.app` verified serving on Vercel with valid TLS. Resend DNS records were preserved through the cutover.
- **Support model:** Founder-led support via the official support email **`zothub.uci@gmail.com`**, plus the in-app `/admin` approval queue as an ongoing operational responsibility (owner: Dhruv, reviewed twice daily during beta), not just a one-time launch task. Operational ownership detail lives in `plan.md`'s Operational responsibilities section.

### Success criteria
**Primary metric:** Number of opportunities posted (supply-side health).
**Secondary metrics:** Application volume, student retention (DAU/WAU), club satisfaction.

---

## 🎯 Product Vision

### Target Users

#### Primary: UCI Students
- **Profile:** Undergraduates and graduates seeking leadership roles, internships, projects, volunteer opportunities, and campus events.
- **Pain points:** Opportunities scattered across 10+ platforms (Facebook, Discord, Instagram, email); miss opportunities due to lack of centralized discovery; no way to track application status or follow clubs long-term.
- **Goals:** Find relevant opportunities quickly; apply with professional applications; track application status in real time; stay connected to clubs they care about.

#### Secondary: UCI Clubs
- **Profile:** Student organizations (cultural, professional, academic, social) posting opportunities and events.
- **Pain points:** Managing applications via Google Forms + email is messy and unprofessional; no analytics on engagement or application quality; hard to build long-term relationships with interested students.
- **Goals:** Post opportunities with custom application forms; efficiently review and manage applications; reach engaged students who care about their mission; track analytics (views, applications, RSVPs).

### Value Proposition

**For Students:** One searchable platform to discover all UCI opportunities (instead of monitoring 10+ fragmented channels), with real-time application tracking, RSVP management, and personalized club feeds.

**For Clubs:** Professional application management tools (custom forms, status tracking, bulk actions, CSV export, analytics) that replace messy Google Forms + email workflows, plus direct messaging to engage interested students.

### Competitive Landscape

| Platform | Strengths | Weaknesses |
|----------|-----------|------------|
| **Facebook Groups** | High reach, existing user base | Chronological feed (posts buried quickly), no application tracking, poor search |
| **Discord Servers** | Real-time chat, community building | Fragmented (each club has a separate server), poor discoverability, no application tools |
| **Email Listservs** | Direct to inbox | One-way broadcast, no interactivity, inbox overload |
| **Campus Job Boards** | Professional appearance | Limited to paid positions, no events/volunteer/leadership roles |
| **ZotHub** | Centralized discovery + structured applications + status tracking + club relationship management | New platform (needs critical mass) |

---

## 🔐 Access Model — Gated Beta

The platform uses a **waitlist-gated signup flow**:

1. A new user visits `/signup`, selects their role (student or club).
2. They verify their email via a one-time-passcode flow (`send-otp` / `verify-otp` Edge Functions).
3. A `waitlist` row is created with `status = 'pending'`.
4. The user sees a "you're on the waitlist" screen (`/waitlist`) and can check back; the page polls for status changes.
5. An admin reviews pending entries at `/admin` (`AdminDashboard`) and approves or rejects each one, optionally with a rejection reason.
6. Approved users get full access to their role's dashboard. Rejected users land on `/waitlist-rejected`.

**Why this matters operationally:** this is a UI-driven queue applying to **both students and clubs**. The admin queue must be checked regularly — an unapproved user is fully blocked, so a stale queue directly blocks growth. Whoever holds the admin role should treat `/admin` as a standing operational responsibility.

**Discovery vs. interaction (WS5, 2026-07-12):** the *gated beta* applies to **account creation and interaction**, not to **browsing**. Logged-out visitors can publicly browse active clubs, opportunities, and events (and their detail pages); they must sign in (and be approved) to apply, RSVP, follow, bookmark, message, or access any dashboard/private data. Public discovery exposes only active/public rows and never a club's private email.

**Planned evolution:** once the beta has validated core flows, the recommended next step is to relax this to **open `@uci.edu` signup** (keep OTP verification and the DB-level email-domain trigger as the only gates, remove the manual approval requirement) so growth isn't bottlenecked on manual review. Not urgent for initial launch.

---

## 📦 Implemented Features

### Core marketplace
- ✅ UCI-restricted signup — enforced both client-side **and** at the database (`BEFORE INSERT` trigger on `auth.users`, allowlisting the admin address)
- ✅ Waitlist + OTP + admin-approval access gate
- ✅ Student & club profiles (skills, interests, resume/portfolio links; club logo, category, social links)
- ✅ Opportunity posting with custom application-question builder (text, textarea, single-select, multi-select)
- ✅ Event posting with a capacity **field**, enforced server-side (WS4: a DB trigger on `rsvps` prevents exceeding capacity, including under concurrency)
- ✅ Applications with status workflow (pending → reviewed → accepted/rejected), duplicate-application prevention, correct question-label rendering
- ✅ RSVPs with optional custom RSVP-question forms and an optional club approval workflow. *Implementation note:* the `rsvps.status` values are **`pending` / `confirmed` / `cancelled`** (a club approval sets `confirmed`, a decline/cancel sets `cancelled`); product copy elsewhere may say "approved/declined" — treat those as the same states.
- ✅ Bidirectional messaging (student ↔ club) — live delivery wired up in WS2 (`messages` added to the realtime publication)
- ✅ In-app notifications with a preferences UI (note: some client-side transactional **emails** don't yet honor those preferences — see gaps)
- ✅ Bookmarks / following clubs; personalized feed of followed-club activity
- ✅ Club team roster with custom display ordering (up/down reorder)
- ✅ Club analytics dashboard (views, applications, RSVPs)

### Discovery & engagement
- ✅ Full-text keyword search (opportunities, events, clubs)
- ✅ Smart sort (newest / deadline approaching / most popular)
- ✅ Unread-count badges in navigation — the **notifications** and **messages** badges both update in real time (messages realtime enabled in WS2)
- ✅ Club category filtering (true filter, not just sort)
- ✅ Resume prefill from student profile on the application form
- ✅ Success confirmation modals after apply / RSVP / publish
- ✅ Share / copy-link buttons on opportunity, event, and club pages
- ✅ Add-to-Calendar (.ics) button on events
- ✅ Application-count visibility toggle (club-controlled, per opportunity)
- ✅ Bulk application actions (multi-select accept/reject) and CSV export
- ✅ File uploads wired into the application form (resume/portfolio)

### Email & scheduled jobs
- ✅ Four Supabase Edge Functions deployed (`send-email`, `send-otp`, `verify-otp`, `send-reminders`), `RESEND_API_KEY` set, `zothub.app` sending domain verified with Resend, sender address `notifications@zothub.app`.
- ✅ Hourly `send-reminders-hourly` cron job (event reminders, deadline reminders, new-post notifications, all with idempotency via `reminder_logs`) — **confirmed live in production (2026-07-13)** via a read-only `cron.job` query: exists, schedule `0 * * * *`, `active = true`, command calls the deployed `send-reminders` Edge Function. (Scheduled manually out-of-repo; the job itself is not owned by a migration.)
- ✅ Nightly `archive_past_events()` auto-archive: scheduled via migration `20260713000100` (WS6 — idempotent `cron.schedule`, `0 9 * * *` UTC), **pushed to production and confirmed live** (2026-07-13): the `cron.job` query shows `archive-past-events-nightly` active alongside `send-reminders-hourly`.

### Infrastructure
- ✅ Hosting: Vercel (migrated from Lovable).
- ✅ Backend: self-owned Supabase project (migrated from Lovable Cloud).
- ✅ Storage: `club-assets` (public) and `student-resumes` (private) buckets, full RLS, files migrated, stored URLs rewritten.

---

## 🐞 Known Product Gaps & Inconsistent Behavior

These are **confirmed** current gaps between the product spec above and what ships today (each verified against code/schema). They are the substance of the engineering backlog — full per-defect detail, root causes, and the ranked workstreams live in `plan.md`. Grouped by product area:

**Engagement & notifications (highest product impact)**
- ~~**Clubs are not notified when a student applies**~~ — ✅ **Closed (WS1, 2026-07-10).** A new `AFTER INSERT` trigger on `applications` posts a reliable in-app notification to the owning club, and a best-effort, de-duplicated `application_notification` email is sent — the email path verifies the authenticated applicant owns the referenced application and derives the club/applicant/opportunity from DB rows (no client-trusted recipient data). Both are gated on the club's `application_updates` preference. Journey 1's "in-app + email notification per application" now holds (in-app guaranteed, email best-effort).
- ~~**Following a club doesn't deliver new-post notifications**~~ — ✅ **Closed (WS3, 2026-07-10).** `bookmarks.club_id` is now the single source of truth: the new-post in-app trigger and the `send-reminders` new-post emails read `bookmarks` (previously they read the never-written `club_followers`), so followers now receive new-post notifications and emails. Gated on a new dedicated `new_post_notifications` preference (replacing the semantically-wrong `deadline_reminders`).
- **Some transactional emails ignore notification preferences** — in-app notifications and the reminder cron respect preferences. **Application** emails (confirmation/status/new-application) are now preference-gated server-side (WS1). **RSVP** confirmation/status emails still ignore preferences. *(plan.md WS4.)*
- **Live updates** — the notifications badge, **messages** (chat + unread badge, WS2), and **RSVP status** on the EventDetail page (WS4: the student's own RSVP updates live on approval/decline) all update in real time.

**Events / RSVP correctness**
- ~~**Event capacity is not enforced server-side**~~ — ✅ **Closed (WS4, 2026-07-11).** A `BEFORE INSERT/UPDATE` trigger on `rsvps` locks the event row and rejects confirmations beyond `capacity`; verified no overbooking under concurrent requests.
- ~~**Declining an RSVP sends a "confirmed" email**~~ — ✅ **Closed (WS4, 2026-07-11).** Added a dedicated decline email template + status branch; declines now also create an in-app notification (distinguished from a student self-cancel via server-authoritative actor identity). RSVP emails are gated on the `event_reminders` preference.

**Discovery / access**
- ~~**Anonymous browsing is inconsistent**~~ — ✅ **Closed (WS5, 2026-07-12).** Product decision: **public discovery.** Logged-out visitors can now browse active clubs, opportunities, and events consistently (RLS: `opportunities`/`events` SELECT is `TO public USING (is_active = true)`); anon access to the club's private `email` was removed. Writes and private data remain authenticated-only.

**Operational / trust**
- ~~**Nightly `archive_past_events()` job scheduling is unverified**~~ — ✅ **Done (WS6, 2026-07-13):** migration `20260713000100` schedules the nightly archive via `cron.schedule`, was pushed to production, and the `cron.job` query confirmed both `archive-past-events-nightly` and `send-reminders-hourly` active. *(plan.md WS6.)*
- ~~**Launch-ops ownership**~~ — ✅ **Decided (WS6, 2026-07-13):** support contact = **`zothub.uci@gmail.com`**; `/admin` waitlist-queue owner = **Dhruv** (twice daily during beta); DB backup policy = weekly manual export + a backup before every schema migration (owner Dhruv). Recorded in `plan.md`'s **Operational responsibilities** section. *(plan.md WS6.)*
- ~~**`/privacy` doesn't name Supabase or Vercel** as data processors~~ — ✅ **Fixed (WS8, 2026-07-14):** the Service Providers line now names Supabase (database/auth/storage), Vercel (hosting), and Resend (email). *(plan.md WS8.)*
- ~~Assorted **UX/data-hygiene** items~~ — ✅ **Fixed in WS8 (2026-07-14), merged & deployed:** waitlist redirect anti-pattern (now `<Navigate>`), OAuth-pending routing (role-less pending users routed to `/waitlist`), unsubscribe stale-state (auto-opt-out preserves loaded prefs), orphaned team-member rendering (self-healing `ON DELETE SET NULL` FK on `club_team_members.user_id`, migration `20260714000200`), `bookmarks` uniqueness (opportunity/event partial unique indexes, migration `20260714000100`), and admin `reviewed_by` now recorded. Production-verified (maintainer, 2026-07-14): both bookmark unique indexes exist, the `club_team_members.user_id` FK exists with `ON DELETE SET NULL`, and migration history is fully synced. *(plan.md WS8.)*
- ~~**Orphaned auth references**~~ — ✅ **Closed (auth-orphan cleanup, 2026-07-13), production-verified.** Production carried `user_roles` rows pointing at never-migrated auth UUIDs (8 orphaned vs 3 valid); the most likely cause (strong inference, not a proven restore record) is that some originally-declared `auth.users` FKs were lost when production was built by `pg_restore`. Migrations `20260714000300` (deterministic cleanup of inert per-user junk; historical content and any ambiguous row preserved for manual review) and `20260714000400` (restore/validate the 11 application auth FKs; **drop** the retained `messages.sender_id`/`receiver_id` CASCADE FKs without recreating them — CASCADE would destroy a surviving user's history, and the NOT NULL columns rule out SET NULL) were pushed to production; migration history is synchronized. Post-push audit (`scripts/audit_auth_orphans.sql`): **zero orphans across all 15 user-ID columns**, `valid_user_roles = 3`, **13 auth.users FKs all validated**, `messages` intentionally FK-free. *Re-adding `messages` referential integrity is a documented future product decision (nullable columns + SET NULL, or a "deleted user" tombstone) — see the follow-up note in `plan.md`'s Auth-orphan cleanup record.* *(plan.md — Auth-orphan cleanup record.)*

**Experience & launch-readiness (the pre-launch roadmap addresses these — WS10–WS12)**
- **No onboarding / first-run, and dead-end profile prompts** — approved users land on a dashboard with no guidance; "complete your profile first" appears only as an un-linked error when a student tries to apply or a club tries to post; signup bounces to `/login` after OTP. *(→ WS11b.)*
- **Unguarded high-regret review actions** — bulk "Reject All" and single-click accept/reject fire with no confirmation and no revert; the `reviewed` status is shown but unreachable; clubs can't message an applicant from the review screen. *(→ WS11c.)*
- **Shallow discovery search** — despite the "full-text search" capability claim, search is client-side substring over title + club name only, over a 50-row fetch with no pagination. *(→ WS11a / WS12.)*
- **No in-product help/support** — only an email address; no Help/FAQ/Contact/Report-an-Issue surface. *(→ WS12 Support Center, launch-blocking.)*
- **Design-system debt & forced-dark single theme** — no light palette, an unused display-font class, inconsistent badges/loaders/empty-states, and some orphaned/dead code. *(→ WS10 decides theme/brand; WS11 implements.)*

**Resolved this cycle (for reference):** the raw profile-validation error, the OTP-signup admin-approval/redirect-loop blocker, approval-required-RSVP failure, private-resume viewing, club-profile-save-that-saved-nothing, notifications page freeze, RSVP-approval persistence (RLS), re-RSVP-after-cancel, DB-level `@uci.edu` enforcement, DNS cutover, and the Supabase migration-history repair are all **done** (see `plan.md`'s Confirmed bug & risk inventory and phase history).

**Process:** don't fix bugs ad hoc — add any newly found issue to `plan.md`'s Confirmed bug & risk inventory, then address it inside a coherent workstream.

---

## 👥 Core User Journeys

These describe the **intended** end-to-end experience (the product target). Where the current implementation falls short of a step, it's called out inline and tracked in "Known Product Gaps" above.

### Journey 0: Signup → Verification → Approval
1. Visitor lands on `/signup`, picks Student or Club.
2. Enters basic details; requests an OTP; enters the code to verify their email.
3. Lands on `/waitlist` with a "pending" status; the page polls periodically.
4. Admin reviews the entry in `/admin`, approves (or rejects with a reason).
5. Approved: user is redirected to their role's dashboard. Rejected: user sees `/waitlist-rejected` with the stated reason.

**Success criteria:** verification email arrives within ~1 minute; admin approval reliably unblocks the user; rejection reasons are clear enough to act on.

### Journey 1 — Club: Post → Receive Applications → Select Candidate
1. **Signup & approval** (Journey 0) as a club; complete club profile.
2. **Post an opportunity**: title, type, description, requirements, deadline, optional flyer; custom application form; optional application-count visibility; publish.
3. **Receive applications**: in-app + email notification per application *(✅ implemented in WS1 — `on_new_application` trigger for the reliable in-app notification + a best-effort, ownership-verified, de-duplicated `application_notification` email, both gated on the club's `application_updates` preference)*; review — filter by opportunity, read correctly-labeled answers, download resumes, bulk accept/reject, export CSV.
4. **Select candidates**: update statuses; students notified in-app + email; message accepted candidates directly.

**Success criteria:** posting an opportunity takes under 5 minutes; the review UI makes it easy to compare candidates; question/answer pairs always correctly labeled.

### Journey 2 — Student: Discover → Apply → Track
1. **Signup & approval** (Journey 0); optional profile completion.
2. **Discover**: search by keyword, filter by type/category, sort by deadline/popularity/newest; bookmark items of interest.
3. **Apply**: form pre-fills resume where available; submit; success modal; duplicate applications blocked.
4. **Track**: dashboard shows live status; notifications on every status change; message the club; follow for future postings.

**Success criteria:** a relevant opportunity is discoverable within a few clicks; the application form submits without friction; notifications are timely.

### Journey 3 — Student: RSVP → Attend
1. Browse events; view detail (date, time, location, capacity).
2. RSVP — optionally answering a custom RSVP form; if the event `requires_approval`, starts `pending`.
3. Add to personal calendar via .ics download.
4. Receive an automated reminder email ~24 hours before.
5. Cancel anytime before the event to free the capacity slot.

**Success criteria:** RSVPing takes under 10 seconds for the common case; reminders are reliable; capacity/approval logic behaves correctly under concurrent RSVPs.

---

## 🛠️ Technical Overview

### Tech stack
React 18.3 + TypeScript + Vite 5 (SWC) · Tailwind CSS + shadcn/ui (Radix primitives) · react-router-dom v6 (BrowserRouter) · TanStack Query (installed; most fetching is still direct Supabase calls in hooks) · react-hook-form + zod · sonner (toasts) · framer-motion · recharts · Supabase (Postgres, Row Level Security, Storage, Auth, Edge Functions, `pg_cron`/`pg_net`).

### Data model (high-level)
Core tables: `user_roles`, `student_profiles`, `club_profiles`, `opportunities`, `events`, `applications`, `rsvps`, `bookmarks`, `messages`, `notifications`, `notification_preferences`, `club_team_members`, `club_followers`, `waitlist`, `email_verifications`, `page_views`, `reminder_logs`. Row Level Security is enabled on every table. Notable JSONB columns: `opportunities.application_questions`, `applications.answers`, `events.rsvp_questions`, `rsvps.answers`.

### Infrastructure
- **Hosting:** Vercel.
- **Backend:** Self-owned Supabase project (`fguzpscguulkfctipeih`), managed via the Supabase CLI/dashboard.
- **Email:** Resend, invoked from Supabase Edge Functions, sending from a verified `zothub.app` domain.
- **Domain:** `zothub.app` (registered at Name.com; **DNS cutover to Vercel complete** — `zothub.app` and `www.zothub.app` serving on Vercel with valid TLS. Resend DNS records preserved).

---

## 🔒 Security & Privacy

### Current posture
- Row Level Security enforced on all tables.
- UCI email restriction: enforced **both** client-side and at the database (a `BEFORE INSERT` trigger on `auth.users` restricting signups to `@uci.edu`, with the admin address allowlisted).
- File uploads (resumes, logos, flyers) go through Supabase Storage with bucket-level access policies; private `student-resumes` files are served via short-lived signed URLs.
- Secrets: Resend API key and service-role credentials live only in Supabase Edge Function secrets — never in the client bundle or committed to git.

### Data visibility
- When a student applies to an opportunity or RSVPs to an event, their name, email, and relevant profile/application data become visible to that club.
- Clubs cannot see data for opportunities/events they don't own (RLS-enforced).
- Admins (via the `/admin` role) can see waitlist entries for approval purposes.

### Data retention & privacy policy
No self-service account deletion exists yet; deletion requests are handled manually. A privacy policy is live at `/privacy` and (as of WS8, 2026-07-14) names all current processors — **Supabase** (database/auth/storage), **Vercel** (hosting), **Resend** (email); no Lovable reference.

---

## 📊 Analytics & Success Metrics

### Primary metric
**Number of opportunities posted** (supply-side health) — target 50-100 in the first 30 days from 10-30 clubs.

### Secondary metrics
1. **Application volume** — target 200-500 in 30 days.
2. **Applications per opportunity** — target 5-10.
3. **Student weekly retention** — target 30%+ week-over-week return rate.
4. **Club satisfaction** — informal survey after 30 days; target 70%+ positive.

### Instrumentation
No dedicated analytics platform required at this scale — derive metrics from direct Supabase queries (see Appendix B). Consider a lightweight `analytics_events` table only if a unified event stream becomes valuable later.

---

## ✅ Launch Readiness Criteria

- [x] `plan.md` Phase 1 (Full Product Audit) complete, with a full Bug Inventory
- [x] All Blocker/High-severity items from the Bug Inventory fixed and verified (Phase 2 / 2b / 2c)
- [x] Known Issues #1 and #2 resolved (#1 fixed; #2 orphaned auth references fully cleaned and **referential integrity restored in production** — auth-orphan cleanup, 2026-07-13: zero orphans, 13 validated `auth.users` FKs, `messages` intentionally FK-free)
- [x] `zothub.app` DNS cut over to Vercel and confirmed serving correctly with valid TLS (`zothub.app` + `www.zothub.app`)
- [x] DB-level `@uci.edu` enforcement trigger in place
- [x] `/privacy` content verified accurate for the current stack (Vercel, Supabase, Resend)
- [x] Admin identified and committed to checking the `/admin` waitlist queue regularly *(owner: **Dhruv**, twice daily during beta — see `plan.md` Operational responsibilities)*
- [x] Support contact live and documented *(**`zothub.uci@gmail.com`** — the official production support address; recorded in `plan.md` Operational responsibilities)*
- [x] `select * from cron.job;` confirms reminder + archive jobs are scheduled and idempotent *(✅ confirmed live in production 2026-07-13: both `send-reminders-hourly` (`0 * * * *`, calls the deployed `send-reminders` Edge Function) and `archive-past-events-nightly` (`0 9 * * *`, migration `20260713000100`) exist and are active)*
- [x] DB backup/export policy set *(weekly manual Supabase backup/export + a backup before every production schema migration; owner **Dhruv** — see `plan.md` Operational responsibilities. Also a Lovable-decommission prerequisite: box there checks once the first backup is taken and a restore verified.)*

**Post-launch infra cleanup:** Supabase migration-history repair ✅ **done** (future migrations use normal `db push`). Lovable decommission still **open** — a deliberate future manual step gated on the checklist in `plan.md`; Lovable no longer serves production traffic but is kept as the rollback path during the stability-monitoring window.

---

## 🚀 Pre-Launch Experience Roadmap

**Where we are:** the correctness/data-hygiene backbone (WS1–WS8 + auth-orphan cleanup) is complete and production-verified. A 2026-07-13 exploration confirmed the remaining pre-launch weaknesses are **experiential and visual, not correctness** — no onboarding/first-run, dead-end "complete your profile first" prompts with no link, no in-product help/support, unguarded high-regret review actions with no revert, a missing club→applicant message path, an unreachable `reviewed` status, and shallow discovery search — plus design-system debt (forced-dark single theme, an unused display-font class, inconsistent badges/loaders, orphaned/dead code). This roadmap addresses them in three phases before public launch. *(Engineering execution + per-workstream detail: `plan.md` WS10–WS12.)*

**Phase order & rationale:** screen-coupled UX fixes and cleanups ride *inside* the refresh (not a later phase); the app is re-skinned in **vertical slices** (public → student → club → admin) rather than one big-bang; the mockup phase produces a written design spec the refresh implements; accessibility + mobile are acceptance criteria (not deferred); and the correctness backbone is preserved (re-skin, don't rebuild the wiring).

### Phase 1 — Design Direction & Brand (WS10)
A clickable design-direction mockup of the hero screens (Landing, discovery, a detail page, student + club dashboards) plus a committed design spec. **Decisions locked here:** evolve the current indigo/coral-on-dark identity vs. a fresh rebrand; dark-only vs. adding a light mode; typography; a unified navigation model. The mockup + spec are reviewed and approved before implementation.

### Phase 2 — Design System Implementation & UX Refresh (WS11)
Implement the spec and re-skin every surface in slices, folding each screen's UX fix into its slice: onboarding & first-run (auto-sign-in after OTP, profile-completion guidance, inline links replacing dead-end prompts); review-action safety (confirmations + revert, wire the `reviewed` state, club→applicant messaging); discovery search depth + filters + pagination; consistent empty/loading/error states, badges, and motion; accessibility + mobile throughout. The routing/state/data layer is preserved.

### Phase 3 — New Feature Build-out (WS12)
Net-new surfaces and capabilities. **"No skimping" catalog — every item tagged for honest sequencing** ([launch-blocking] must ship before public launch; [post-launch] can follow):

- **In-product Support Center** *[launch-blocking]* — a Help/Support page: **FAQ**, **Contact Support** (to `zothub.uci@gmail.com`), **Report an Issue**, **troubleshooting resources**, and related user-help workflows. (Formerly the "user support experience" Planned Product Area.)
- **Self-service account deletion** *[launch-blocking — privacy/compliance]* (currently manual).
- **`/privacy` contact line** updated to `zothub.uci@gmail.com` *[launch-blocking, tiny]*.
- **Onboarding polish** — profile-completeness indicator + guided checklist; post-login return-to-context *[launch-blocking]*.
- **Weekly email digest** of new opportunities from followed clubs *[post-launch]*.
- **Saved searches / opportunity alerts** — notify students when matching opportunities post *[post-launch]*.
- **Application tracking timeline / history** for students *[post-launch]*.
- **Personalized/matched recommendations** (skills/interests) *[post-launch]*.
- **Club recruiting tools** — applicant notes / rating / shortlisting; templated status-change messaging; saved application filter views *[post-launch]*.
- **Discovery/search** — full-text server-side search + multi-facet filters + pagination (if not fully delivered in Phase 2) *[launch-blocking for basic depth; advanced facets post-launch]*.
- **Access model** — relax gated beta → open `@uci.edu` signup (keep OTP + the DB email-domain trigger as gates) *[post-launch]*.
- **Enhanced analytics** (funnel, cohort retention) *[post-launch]*.
- **Error monitoring** (e.g., Sentry) *[post-launch]*.
- **RSVP confirmation-email consistency** — the no-questions RSVP path currently sends no email *[launch-blocking, small]*.
- **Expanded end-to-end tests** — the Playwright suite (repaired in WS7) grows to cover authenticated apply/RSVP/review journeys against a seeded backend *[post-launch]*.

---

## 📅 Post-Launch Roadmap (after launch)

Parked until after public launch; the pre-launch items above take precedence. Items tagged *[post-launch]* in the WS12 catalog land here in priority order once launched.

### Longer-term (if traction grows: 100+ clubs, 2,000+ students)
- Multi-campus expansion.
- A second design/usage-data-informed UX iteration once real usage data exists (the pre-launch refresh above is the *first* comprehensive pass).

### Monetization (if pursued)
- Premium club features, paid event ticketing, sponsored/promoted opportunities.

---

## 📝 Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| **Opportunity** | A posted position by a club (leadership role, internship, project, volunteer position, committee role, or other) |
| **Application** | A student's submission to an opportunity, including answers to custom form questions and an optional resume upload |
| **RSVP** | A student's registration for an event; may include custom-question answers and may require club approval |
| **Bookmark** | A student's saved opportunity, event, or club for later reference |
| **Follow** | A student's subscription to a club's updates (new opportunities/events appear in their personalized feed) |
| **Waitlist** | The pending-approval state a new signup sits in until an admin approves or rejects it |
| **RLS (Row Level Security)** | A Postgres/Supabase feature restricting data access based on the requesting user's role/identity |
| **Cron Job** | A scheduled task (via `pg_cron`) that runs automatically at a fixed interval — e.g., hourly reminder emails |
| **.ics File** | The iCalendar file format used for the "Add to Calendar" feature |

### B. Key Metrics Dashboard (SQL Queries)

```sql
-- Total signups this week (by role)
SELECT
  COUNT(*) FILTER (WHERE role = 'student') AS students,
  COUNT(*) FILTER (WHERE role = 'club') AS clubs
FROM user_roles
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Opportunities posted this week
SELECT COUNT(*) FROM opportunities
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Applications submitted this week
SELECT COUNT(*) FROM applications
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Event RSVPs this week (rsvps.status is 'pending' | 'confirmed' | 'cancelled')
SELECT COUNT(*) FROM rsvps
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND status = 'confirmed';

-- Top opportunities (most applications, last 30 days)
SELECT o.title, c.club_name AS club, COUNT(a.id) AS applications
FROM opportunities o
JOIN club_profiles c ON o.club_id = c.id
LEFT JOIN applications a ON o.id = a.opportunity_id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY o.id, c.club_name
ORDER BY applications DESC
LIMIT 10;

-- Student weekly retention (returning students)
SELECT COUNT(DISTINCT student_id) AS returning_students
FROM applications
WHERE student_id IN (
  SELECT DISTINCT student_id FROM applications
  WHERE created_at < NOW() - INTERVAL '7 days'
)
AND created_at >= NOW() - INTERVAL '7 days';

-- Waitlist queue health (pending count, oldest pending entry)
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  MIN(requested_at) FILTER (WHERE status = 'pending') AS oldest_pending
FROM waitlist;

-- Orphaned auth references (Known Issue #2) — the full audit covering all 15
-- user-ID columns lives in scripts/audit_auth_orphans.sql (read-only).
-- Single-table spot check:
SELECT ctm.* FROM club_team_members ctm
LEFT JOIN auth.users u ON ctm.user_id = u.id
WHERE ctm.user_id IS NOT NULL AND u.id IS NULL;
```

### C. Email Templates (content reference for the Edge Functions)

#### Event Reminder Email
**Subject:** Reminder: [Event Name] is tomorrow!
```
Hi [Student Name],

This is a reminder that you're registered for:

**[Event Name]**
📅 [Day, Month Date] at [Time]
📍 [Location]

Can't make it? [Cancel RSVP link]
Add to your calendar: [.ics download link]

See you there!
—The [Club Name] Team

---
You're receiving this email because you RSVP'd to this event on ZotHub.
[Unsubscribe from event reminders](unsubscribe link)
```

#### Application Status Update Email
**Subject:** Your application for [Opportunity Title] has been updated
```
Hi [Student Name],

Your application status for **[Opportunity Title]** has been updated:
**New Status:** [Accepted / Rejected]

[If accepted:] Congratulations! [Club Name] wants to move forward with you. Check your ZotHub messages for next steps.
[If rejected:] Thank you for your interest in [Club Name]. We encourage you to apply to other opportunities on ZotHub.

[View your application](link)

---
[Unsubscribe from application updates](unsubscribe link)
```

#### New Application Notification (to Club)
**Subject:** New application for [Opportunity Title]
```
Hi [Club Name],

You received a new application for **[Opportunity Title]**.
**Applicant:** [Student Name] · **Major:** [Major] · **Year:** [Year]

[View application & review answers](link)

---
[Manage email preferences](settings link)
```

#### Waitlist Approved Email
**Subject:** You're approved on ZotHub!
```
Hi [Name],

Your ZotHub account has been approved. Log back in to get started:
[Log in](link)

Welcome aboard!
```

### D. Privacy Policy (Outline — verify against the live `/privacy` page)

**1. Introduction** — ZotHub is a student-run platform connecting UC Irvine students with club opportunities.

**2. Data We Collect** — Account data (name, UCI email, role); profile data (major, year, skills, interests, resume — optional); activity data (applications, RSVPs, bookmarks, messages); technical data (IP, browser, device via logs).

**3. How We Use Your Data** — Matching students with opportunities; sending notifications and reminders; understanding usage to improve the product; security/fraud prevention.

**4. Data Sharing** — Clubs see your name, email, profile, and application/RSVP answers when you apply/RSVP. Third-party processors: **Supabase** (database/auth/storage), **Vercel** (hosting), **Resend** (transactional email). ZotHub does not sell data to advertisers or other third parties.

**5. Your Rights** — View/edit your data in profile settings; request deletion via the support contact (manual process); unsubscribe via email links or notification preferences.

**6. Data Retention** — Retained indefinitely to preserve platform history unless deletion is requested.

**7. Security** — HTTPS, database encryption, Row Level Security; no system is 100% secure — use strong passwords and report suspicious activity.

**8. Cookies** — Essential auth/session cookies only; no third-party tracking/advertising cookies.

**9. Children's Privacy** — Intended for college students (18+); no knowing collection from minors.

**10. Contact** — `zothub.uci@gmail.com` (official support address). *Note: the live `/privacy` page's contact line still needs to be updated to this address in a future code change — not done in this documentation pass.*

---

## Document Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-20 | Initial PRD based on stakeholder interview | Claude |
| 1.1 | 2026-01-20 | Added 8 UX features from manual testing feedback | Claude |
| 1.2 | 2026-01-21 | Added 14 more features from codebase analysis (22 total); framed as a 1-week crunch launch | Claude |
| 2.0 | 2026-07-08 | Full reconciliation against the live codebase; removed crunch/timeline framing; documented waitlist/OTP/admin-approval access model | Claude |
| **3.0** | **2026-07-08** | **Post-migration cleanup rewrite.** Migration status condensed to a single infrastructure note (full history moved to `docs/archive/MIGRATION.md`). Added a dedicated Known Issues / QA Gaps section and a Launch Readiness Criteria checklist. Reframed the roadmap around `plan.md`'s new Full Product Audit & Bug Inventory phase rather than deploy-migration tasks. Removed all remaining stale migration-status phrasing. | Claude |
| 3.1 | 2026-07-09 | Marked DNS cutover, migration-history repair, and DB-level `@uci.edu` enforcement complete; recorded live-production status and Lovable-as-fallback. | Claude |
| **3.2** | **2026-07-09** | **Product-spec reset for normal development.** Replaced the migration-era Known Issues table with a **Known Product Gaps & Inconsistent Behavior** section (confirmed current gaps grouped by product area, cross-referenced to `plan.md` workstreams). Corrected stale claims: DB-level UCI enforcement is done (not "open"); clarified `rsvps` status vocabulary (pending/confirmed/cancelled); noted messages badge/live-delivery gap; flagged capacity-not-server-enforced, `/privacy` processors, and the club-application-notification gap inline in the relevant journey/feature. Fixed an RSVP metrics query using a non-existent `approved` status. | Claude |
| **3.3** | **2026-07-13** | **Backlog-complete reconciliation.** Marked every ranked workstream closed: WS1–WS5 (notifications/realtime/follow-semantics/RSVP-integrity/public-discovery), WS6 (scheduler + launch-ops), WS7 (test/lint/type), WS8 (UX & data hygiene), and the auth-orphan cleanup (production-verified: zero orphans, 13 validated `auth.users` FKs, `messages` intentionally FK-free, `valid_user_roles = 3`). Recorded the operational ownership decisions — official support contact `zothub.uci@gmail.com`, `/admin` waitlist owner Dhruv (twice daily during beta), backup policy (weekly + pre-migration, owner Dhruv) — and checked the corresponding Launch Readiness criteria. Captured a **user support experience** as a pre-launch Planned Product Area (to be scoped into a workstream after the current roadmap). | Claude |
| **3.4** | **2026-07-13** | **Pre-Launch Experience Roadmap added.** After a UX/design code exploration confirmed the remaining pre-launch weaknesses are experiential/visual (not correctness), added a three-phase **Pre-Launch Experience Roadmap** (WS10 design-direction mockup + spec → WS11 design-system + UX refresh in vertical slices → WS12 new-feature build-out with a launch-blocking/post-launch-tagged catalog). Graduated the "user support experience" Planned Product Area into WS12 as launch-blocking; folded the former post-launch near-term features into the WS12 catalog; added an "Experience & launch-readiness" group to Known Product Gaps (onboarding dead-ends, review-action safety, shallow search, no in-product support, design-system debt / forced-dark theme). Engineering detail: `plan.md` WS10–WS12. | Claude |
