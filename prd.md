# ZotHub Product Requirements Document

**Version:** 3.2
**Last Updated:** 2026-07-09
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
- **Support model:** Founder-led support via a designated support/admin email, plus the in-app `/admin` approval queue as an ongoing operational responsibility, not just a one-time launch task.

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

**Planned evolution:** once the beta has validated core flows, the recommended next step is to relax this to **open `@uci.edu` signup** (keep OTP verification and the DB-level email-domain trigger as the only gates, remove the manual approval requirement) so growth isn't bottlenecked on manual review. Not urgent for initial launch.

---

## 📦 Implemented Features

### Core marketplace
- ✅ UCI-restricted signup — enforced both client-side **and** at the database (`BEFORE INSERT` trigger on `auth.users`, allowlisting the admin address)
- ✅ Waitlist + OTP + admin-approval access gate
- ✅ Student & club profiles (skills, interests, resume/portfolio links; club logo, category, social links)
- ✅ Opportunity posting with custom application-question builder (text, textarea, single-select, multi-select)
- ✅ Event posting with a capacity **field** (note: capacity is currently enforced only in the UI, not server-side — see Known Product Gaps)
- ✅ Applications with status workflow (pending → reviewed → accepted/rejected), duplicate-application prevention, correct question-label rendering
- ✅ RSVPs with optional custom RSVP-question forms and an optional club approval workflow. *Implementation note:* the `rsvps.status` values are **`pending` / `confirmed` / `cancelled`** (a club approval sets `confirmed`, a decline/cancel sets `cancelled`); product copy elsewhere may say "approved/declined" — treat those as the same states.
- ✅ Bidirectional messaging (student ↔ club) — *see gap: live delivery is not wired up (messages aren't in the realtime publication)*
- ✅ In-app notifications with a preferences UI (note: some client-side transactional **emails** don't yet honor those preferences — see gaps)
- ✅ Bookmarks / following clubs; personalized feed of followed-club activity
- ✅ Club team roster with custom display ordering (up/down reorder)
- ✅ Club analytics dashboard (views, applications, RSVPs)

### Discovery & engagement
- ✅ Full-text keyword search (opportunities, events, clubs)
- ✅ Smart sort (newest / deadline approaching / most popular)
- ✅ Unread-count badges in navigation — the **notifications** badge updates in real time; the **messages** badge does **not** yet (messages aren't in the realtime publication — see gaps)
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
- ✅ Hourly `send-reminders-hourly` cron job active (event reminders, deadline reminders, new-post notifications, all with idempotency via `reminder_logs`).
- 🟡 Not yet explicitly re-confirmed: the nightly `archive_past_events()` auto-archive job.

### Infrastructure
- ✅ Hosting: Vercel (migrated from Lovable).
- ✅ Backend: self-owned Supabase project (migrated from Lovable Cloud).
- ✅ Storage: `club-assets` (public) and `student-resumes` (private) buckets, full RLS, files migrated, stored URLs rewritten.

---

## 🐞 Known Product Gaps & Inconsistent Behavior

These are **confirmed** current gaps between the product spec above and what ships today (each verified against code/schema). They are the substance of the engineering backlog — full per-defect detail, root causes, and the ranked workstreams live in `plan.md`. Grouped by product area:

**Engagement & notifications (highest product impact)**
- ~~**Clubs are not notified when a student applies**~~ — ✅ **Closed (WS1, 2026-07-10).** A new `AFTER INSERT` trigger on `applications` posts a reliable in-app notification to the owning club, and a best-effort, de-duplicated `application_notification` email is sent — the email path verifies the authenticated applicant owns the referenced application and derives the club/applicant/opportunity from DB rows (no client-trusted recipient data). Both are gated on the club's `application_updates` preference. Journey 1's "in-app + email notification per application" now holds (in-app guaranteed, email best-effort).
- **Following a club doesn't deliver new-post notifications** — "follow" is stored as a bookmark, but the new-post notification/email path reads a separate `club_followers` table the app never populates, so followers get nothing when a club posts. *(plan.md WS3.)*
- **Some transactional emails ignore notification preferences** — in-app notifications and the reminder cron respect preferences. **Application** emails (confirmation/status/new-application) are now preference-gated server-side (WS1). **RSVP** confirmation/status emails still ignore preferences. *(plan.md WS4.)*
- **Live updates are incomplete** — the notifications badge is realtime, but **messages** (chat + unread badge) and **RSVP status** aren't in the realtime publication, so they update only on refresh. *(plan.md WS2.)*

**Events / RSVP correctness**
- **Event capacity is not enforced server-side** — the UI hides "RSVP" when full, but nothing prevents exceeding `capacity` under concurrency or a direct API call. *(plan.md WS4.)*
- **Declining an RSVP sends a "confirmed" email** — the decline path reuses the confirmation template. *(plan.md WS4.)*

**Discovery / access**
- **Anonymous browsing is inconsistent** — logged-out visitors can view clubs but not opportunities/events, while the landing page invites public browsing. Needs a product decision (gated vs. public) and consistent RLS. *(plan.md WS5.)*

**Operational / trust**
- **Nightly `archive_past_events()` job scheduling is unverified** — the function exists but no schedule is defined in the repo (user-facing impact is limited because listings filter by date). *(plan.md WS6.)*
- **Launch-ops ownership** — a support contact/mailbox, a committed `/admin` waitlist-queue owner, and a routine DB backup cadence still need to be established (outside code; also a Lovable-decommission prerequisite). *(plan.md WS6.)*
- **`/privacy` doesn't name Supabase or Vercel** as data processors (it names Resend and generic "hosting/auth"). *(plan.md WS8.)*
- Assorted **UX/data-hygiene** items (waitlist redirect anti-pattern, OAuth-pending routing, unsubscribe stale-state, orphaned team-member rendering, missing `bookmarks` uniqueness, admin `reviewed_by` not recorded). *(plan.md WS8.)*

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
No self-service account deletion exists yet; deletion requests are handled manually. A privacy policy is live at `/privacy`. **Known gap:** it names Resend but not Supabase or Vercel as processors — update it to list all current processors (Supabase, Vercel, Resend; no longer Lovable). Tracked in `plan.md` WS8.

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
- [x] Known Issues #1 and #2 resolved (#1 fixed; #2 orphan rows cleaned in prod, future-safe guidance documented)
- [x] `zothub.app` DNS cut over to Vercel and confirmed serving correctly with valid TLS (`zothub.app` + `www.zothub.app`)
- [x] DB-level `@uci.edu` enforcement trigger in place
- [x] `/privacy` content verified accurate for the current stack (Vercel, Supabase, Resend)
- [ ] Admin identified and committed to checking the `/admin` waitlist queue regularly *(operational owner assignment — outside code)*
- [ ] Support contact live and documented *(depends on `@zothub.app` mailbox now that DNS is live)*
- [ ] `select * from cron.job;` confirms reminder + archive jobs are scheduled and idempotent *(reminder job confirmed active; `archive_past_events` scheduling still to confirm — see `plan.md`)*

**Post-launch infra cleanup:** Supabase migration-history repair ✅ **done** (future migrations use normal `db push`). Lovable decommission still **open** — a deliberate future manual step gated on the checklist in `plan.md`; Lovable no longer serves production traffic but is kept as the rollback path during the stability-monitoring window.

---

## 📅 Post-Launch Roadmap

### Near-term (after validating initial usage)
- Relax the access model from gated-approval to open `@uci.edu` signup.
- Self-service account deletion (privacy/compliance).
- Email digest (weekly summary of new opportunities from followed clubs).
- Enhanced analytics (funnel analysis, cohort retention).
- Automated end-to-end tests (a Playwright config exists in the repo but currently references an unavailable package — needs repair before it's usable; expand coverage once fixed).

### Medium-term (if traction grows meaningfully: 100+ clubs, 2,000+ students)
- **Comprehensive UI/UX revision** — design-system consistency audit, full empty/loading/error-state pass, mobile-specific optimization, accessibility audit, possible visual refresh. Deliberately scoped for *after* launch, informed by real usage data.
- Error monitoring (e.g., Sentry) for proactive bug detection.
- Personalized/matched recommendations.
- Multi-campus expansion.

### Long-term (if monetization is pursued)
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

-- Orphaned auth references (Known Issue #2) -- check other tables too
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

**10. Contact** — [support contact].

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
