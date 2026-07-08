# ZotHub Product Requirements Document

**Version:** 2.0
**Last Updated:** 2026-07-08
**Status:** Pre-launch — deploy migration + final QA in progress (see `plan.md` for the engineering execution plan)
**Author:** Claude, reconciled against the live `main` branch after a full codebase audit

---

## 📋 Executive Summary

**ZotHub** is a two-sided campus marketplace platform that connects **UC Irvine students** (seeking leadership roles, internships, projects, volunteer positions, and campus events) with **UCI clubs** (posting opportunities, managing applications, and building community). The platform solves the problem of **centralized discovery** — students currently miss opportunities scattered across Facebook groups, Discord servers, email listservs, and personal networks.

### Mission
Create a single, searchable hub where every UCI student has equal access to all campus opportunities, and every club has professional tools to recruit, manage, and engage their community.

### Relationship to `plan.md`
This document (`prd.md`) is the **product spec** — vision, users, journeys, success metrics, and launch operations. `plan.md` is the **engineering execution plan** — the concrete remaining build/deploy work, file paths, and verification steps. Read this for *why* and *what "done" looks like*; read `plan.md` for *what's left and how to finish it*.

### Where the product stands today
The core platform is **built and feature-complete** relative to the original MVP feature set (see "Feature Implementation Status" below). What remains is **deployment migration** (off Lovable, onto Vercel with the `zothub.app` domain), **wiring the email scheduler** (the sending infrastructure exists; nothing currently triggers it automatically), a **DB-level security hardening pass**, and a **final end-to-end QA walkthrough**. This is meaningfully further along than a typical "MVP kickoff" — treat this launch as *finishing and shipping* an already-substantial product, not building one from scratch.

### Launch scope
- **Access model:** Gated beta — new users go through a waitlist (signup → email OTP verification → admin approval) rather than fully open signup. See "Access Model" below.
- **Timeline:** No longer a "crunch" launch — remaining work is deploy migration + scheduler wiring + QA, scoped in `plan.md`.
- **Expected initial scale:** 10-30 clubs, 200-500 students in the first 30 days (medium launch; informs the performance posture — query limits + basic pagination, not full virtualization).
- **Launch domain:** `zothub.app` (already owned; DNS re-point required as part of the Lovable → Vercel migration).
- **Support model:** Founder-led support via a designated support/admin email, plus the in-app `/admin` approval queue (see below) as an ongoing operational responsibility, not just a one-time launch task.

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

The platform now uses a **waitlist-gated signup flow**, a deliberate evolution beyond the original MVP's "manual club approval via SQL" plan:

1. A new user visits `/signup`, selects their role (student or club).
2. They verify their email via a one-time-passcode flow (`send-otp` / `verify-otp` Edge Functions) — this replaces relying solely on Supabase's default auth email and gives an extra identity-verification step.
3. A `waitlist` row is created with `status = 'pending'`.
4. The user sees a "you're on the waitlist" screen (`/waitlist`) and can check back; the page polls for status changes.
5. An admin reviews pending entries at `/admin` (`AdminDashboard`) and approves or rejects each one, optionally with a rejection reason.
6. Approved users get full access to their role's dashboard. Rejected users land on `/waitlist-rejected`.

**Why this matters operationally:** unlike the old plan (spot-check clubs against the UCI directory via raw SQL), this is now a proper UI-driven queue that applies to **both students and clubs**. But it also means **the admin queue must be checked regularly** post-launch — an unapproved user is fully blocked, so a stale queue directly blocks growth. Whoever holds the admin role should treat `/admin` as a standing operational responsibility, not a one-time setup step.

**Planned evolution:** once the beta has validated core flows (see `plan.md`), the recommended next step is to relax this to **open `@uci.edu` signup** (keep OTP verification and the DB-level email-domain trigger as the only gates, remove the manual approval requirement) so growth isn't bottlenecked on manual review. This is a deliberate, documented future toggle — not urgent for initial launch.

---

## 📦 Feature Implementation Status

The platform has grown substantially past the original MVP feature list through iterative development. As of the latest audit (28 database migrations, 4 Supabase Edge Functions), the following are **implemented and wired end-to-end** in the live codebase:

### Core marketplace
- ✅ UCI-restricted signup (client-side check; DB-level enforcement is a remaining hardening item — see `plan.md`)
- ✅ Waitlist + OTP + admin-approval access gate (described above)
- ✅ Student & club profiles (skills, interests, resume/portfolio links; club logo, category, social links)
- ✅ Opportunity posting with custom application-question builder (text, textarea, single-select, multi-select)
- ✅ Event posting with capacity limits
- ✅ Applications with status workflow (pending → reviewed → accepted/rejected), duplicate-application prevention (unique constraint), and **correct question-label rendering** (the historical "Unknown question" bug is fixed)
- ✅ RSVPs with optional custom RSVP-question forms and an optional club approval workflow (`requires_approval`, pending/approved/declined)
- ✅ Bidirectional messaging (student ↔ club)
- ✅ In-app notifications with a preferences UI
- ✅ Bookmarks / following clubs; personalized feed of followed-club activity
- ✅ Club team roster with custom display ordering (up/down reorder)
- ✅ Club analytics dashboard (views, applications, RSVPs)

### Discovery & engagement (originally tracked as the "22 features")
- ✅ Full-text keyword search (opportunities, events, clubs)
- ✅ Smart sort (newest / deadline approaching / most popular)
- ✅ Unread-count badges in navigation (messages, notifications), real-time
- ✅ Club category filtering (true filter, not just sort)
- ✅ Resume prefill from student profile on the application form
- ✅ Success confirmation modals after apply / RSVP / publish
- ✅ Share / copy-link buttons on opportunity, event, and club pages
- ✅ Add-to-Calendar (.ics) button on events
- ✅ Application-count visibility toggle (club-controlled, per opportunity)
- ✅ Bulk application actions (multi-select accept/reject) and CSV export
- ✅ File uploads wired into the application form (resume/portfolio)

### Email & scheduled jobs
- 🟡 **Infrastructure exists, not yet scheduled.** Four Supabase Edge Functions are implemented (`send-email`, `send-otp`, `verify-otp`, `send-reminders`), and the `pg_cron`/`pg_net` Postgres extensions are enabled — but **no cron job currently invokes them**. This is the single largest functional gap left (see `plan.md`, item B). Until this is wired, event reminders, deadline-approaching notifications, and the nightly auto-archive job will not run automatically.

### What's genuinely left (all detailed in `plan.md`)
1. **Migrate hosting off Lovable to Vercel** and re-point `zothub.app` (Lovable subscription has ended).
2. **Wire the `pg_cron` scheduler** to actually invoke `send-reminders` (hourly) and `archive_past_events()` (nightly) — the code exists, it's just never triggered.
3. **Add a DB-level trigger enforcing `@uci.edu`** on `auth.users` (currently client-side only, bypassable via direct API calls).
4. **Deploy hardening**: SPA rewrite config for Vercel, remove `lovable-tagger`, consolidate to one lockfile, verify `.env` isn't committed.
5. **A full end-to-end QA pass** against a live Vercel preview deploy — the app builds cleanly and compiles without errors, but a fresh runtime walkthrough of every flow hasn't been done since the most recent burst of feature work landed.
6. **Minor code-quality cleanup** (ESLint errors — no runtime impact).

**No new product features are required before launch.** The remaining work is deployment, operational wiring, security hardening, and verification — not net-new feature development.

---

## 👥 Core User Journeys

These describe the target experience end-to-end; use them as acceptance criteria during the final QA pass.

### Journey 0 (new): Signup → Verification → Approval
1. Visitor lands on `/signup`, picks Student or Club.
2. Enters basic details; requests an OTP; enters the code to verify their email.
3. Lands on `/waitlist` with a "pending" status; the page polls periodically.
4. Admin reviews the entry in `/admin`, approves (or rejects with a reason).
5. Approved: user is redirected to their role's dashboard on next visit/poll. Rejected: user sees `/waitlist-rejected` with the stated reason.

**Success criteria:** verification email arrives within ~1 minute; admin approval reliably unblocks the user without requiring them to re-signup; rejection reasons are clear enough to act on (e.g., resubmit with corrected info) if applicable.

### Journey 1 — Club: Post → Receive Applications → Select Candidate
1. **Signup & approval** (Journey 0) as a club; complete club profile (name, description, logo, category, social links).
2. **Post an opportunity**: title, type, description, requirements, deadline, optional flyer image; build a custom application form (text/textarea/select/multi-select questions); optionally toggle "show application count to students"; publish.
3. **Receive applications**: in-app + email notification per new application; review in the applications dashboard — filter by opportunity, read answers against correctly-labeled questions, download resumes, use bulk accept/reject for high-volume opportunities, export to CSV for offline review.
4. **Select candidates**: update statuses (reviewed → accepted/rejected); students are notified in-app + email; message accepted candidates directly to coordinate next steps.

**Success criteria:** posting an opportunity takes under 5 minutes; the review UI makes it easy to compare candidates at a glance; question/answer pairs are always correctly labeled.

### Journey 2 — Student: Discover → Apply → Track
1. **Signup & approval** (Journey 0) as a student; optional profile completion (major, year, skills, interests, resume).
2. **Discover**: search by keyword, filter by type/category, sort by deadline/popularity/newest; bookmark items of interest.
3. **Apply**: custom application form pre-fills the student's resume where available; submit; see a success confirmation modal; cannot submit a duplicate application to the same opportunity.
4. **Track**: dashboard shows live status; in-app + email notifications on every status change; message the club directly; follow the club to get notified of future postings.

**Success criteria:** a relevant opportunity is discoverable within a few clicks; the application form is clear and submits without friction; notifications are timely (ideally within the hour, once the scheduler is wired).

### Journey 3 — Student: RSVP → Attend
1. Browse events; view detail (date, time, location, capacity).
2. RSVP — optionally answering a custom RSVP form (e.g., dietary restrictions) if the club configured one; if the event `requires_approval`, the RSVP starts `pending` until the club approves it.
3. Add the event to a personal calendar via the .ics download.
4. Receive an automated reminder email ~24 hours before the event (**depends on the scheduler being wired — see remaining work**).
5. Cancel anytime before the event to free the capacity slot for others.

**Success criteria:** RSVPing takes under 10 seconds for the common (no-approval) case; reminders are reliable once scheduled; capacity/approval logic behaves correctly under concurrent RSVPs.

---

## 🛠️ Technical Overview

### Tech stack
React 18.3 + TypeScript + Vite 5 (SWC) · Tailwind CSS + shadcn/ui (Radix primitives) · react-router-dom v6 (BrowserRouter) · TanStack Query (installed; not yet the primary data-fetching pattern — most fetching is direct Supabase calls in hooks) · react-hook-form + zod · sonner (toasts) · framer-motion · recharts · Supabase (Postgres, Row Level Security, Storage, Auth, Edge Functions, `pg_cron`/`pg_net`).

### Data model (high-level)
Core tables: `user_roles`, `student_profiles`, `club_profiles`, `opportunities`, `events`, `applications`, `rsvps`, `bookmarks`, `messages`, `notifications`, `notification_preferences`, `club_team_members`, `waitlist`. Row Level Security is enabled on every table. Notable JSONB columns: `opportunities.application_questions`, `applications.answers`, `events.rsvp_questions`, `rsvps.answers`. See `plan.md` for the specific columns added in recent work (`show_application_count`, `requires_approval`, `display_order`, etc.) and any outstanding RLS review items.

### Infrastructure
- **Hosting:** migrating from Lovable to Vercel (see `plan.md`, Phase A) — this is the top-priority remaining step, since the Lovable subscription has lapsed.
- **Backend:** Supabase, managed going forward via the Supabase CLI (not the Lovable-integrated workflow).
- **Email:** Resend, invoked from Supabase Edge Functions.
- **Domain:** `zothub.app`.

---

## 🔒 Security & Privacy

### Current posture
- Row Level Security enforced on all tables.
- UCI email restriction: enforced client-side today; a DB-level trigger is planned (see `plan.md`) to close the gap where a user could bypass the client check via a direct API call.
- File uploads (resumes, logos, flyers) go through Supabase Storage with bucket-level access policies.
- Secrets: Resend API key and any service-role credentials belong only in Supabase Edge Function secrets — never in the client bundle or committed to git. Verify `.env` is not tracked in git (flagged previously; re-check as part of the deploy migration).

### Data visibility
- When a student applies to an opportunity or RSVPs to an event, their name, email, and relevant profile/application data become visible to that club — this should be disclosed at the point of application/RSVP.
- Clubs cannot see data for opportunities/events they don't own (RLS-enforced).
- Admins (via the `/admin` role) can see waitlist entries for approval purposes.

### Data retention & privacy policy
No self-service account deletion exists yet; deletion requests are handled manually (email the admin/support address). A privacy policy is expected to be live at `/privacy` — verify its content matches (or update it to match) the outline in Appendix D, and that it accurately describes the current data flows (waitlist, OTP, Resend as an email processor, Vercel + Supabase as infrastructure processors — no longer Lovable).

---

## 📊 Analytics & Success Metrics

### Primary metric
**Number of opportunities posted** (supply-side health) — target 50-100 in the first 30 days from 10-30 clubs. Supply drives the marketplace; without opportunities, students have no reason to return.

### Secondary metrics
1. **Application volume** — target 200-500 in 30 days.
2. **Applications per opportunity** — target 5-10; low signals a discovery problem, high signals healthy demand.
3. **Student weekly retention** — target 30%+ week-over-week return rate among students who took any action (apply, RSVP, bookmark, search).
4. **Club satisfaction** — informal survey after 30 days ("Did ZotHub help you find quality candidates?"); target 70%+ positive.

### Instrumentation
No dedicated analytics platform is required for this scale — derive metrics from direct Supabase queries (see Appendix B for ready-to-run SQL). If a unified event stream becomes valuable later, consider adding a lightweight `analytics_events` table, but this is not needed for launch.

---

## 🚀 Launch Operations

### Pre-launch (owner: you / admin)
- Complete the deploy migration and remaining engineering items in `plan.md`.
- Confirm `/privacy` is live and accurate.
- Decide who holds the `admin` role and commit to a check-in cadence for the `/admin` waitlist queue (daily, at minimum, during the first weeks).
- Set up a support contact (email or a designated inbox) for user-facing issues.

### Launch day
- Cut DNS over to Vercel; confirm `zothub.app` resolves correctly with valid TLS.
- Do a final smoke test of Journeys 0-3 against production.
- Monitor Supabase logs and the `/admin` queue closely for the first 24-48 hours.

### Ongoing operations
- **Waitlist queue:** check `/admin` regularly; approvals unblock users, so a stale queue directly throttles growth.
- **Weekly metrics report:** run the Appendix B queries to track the success metrics above.
- **Support:** respond to user issues via the designated contact; common early scenarios (can't sign up, didn't receive OTP/reminder email, application stuck) should have quick, templated responses — see Appendix for prior response templates as a starting point, updated for the new waitlist/OTP flow.
- **Scheduler health:** once wired (per `plan.md`), periodically confirm `select * from cron.job;` shows active jobs and that reminder emails are actually being delivered (check Resend's dashboard for delivery/bounce rates).

---

## 📅 Post-Launch Roadmap

### Near-term (after validating initial usage)
- Relax the access model from gated-approval to open `@uci.edu` signup (keep OTP + DB-level domain enforcement as the sole gates) once the beta has validated core flows and abuse risk is well understood.
- Self-service account deletion (privacy/compliance).
- Email digest (weekly summary of new opportunities from followed clubs).
- Enhanced analytics (funnel analysis, cohort retention).
- Automated end-to-end tests (Playwright config already exists in the repo — expand coverage).

### Medium-term (if traction grows meaningfully: 100+ clubs, 2,000+ students)
- **Comprehensive UI/UX revision** (see `plan.md`'s deferred Phase 5) — design-system consistency audit, full empty/loading/error-state pass, mobile-specific optimization, accessibility audit, and a possible visual refresh. Deliberately scoped for *after* launch, informed by real usage data rather than planned blind.
- Error monitoring (e.g., Sentry) for proactive bug detection.
- Personalized/matched recommendations.
- Multi-campus expansion.

### Long-term (if monetization is pursued)
- Premium club features, paid event ticketing, sponsored/promoted opportunities.

---

## ✅ Launch Readiness Checklist

- [ ] All `plan.md` remaining-work items complete (deploy migration, scheduler wiring, DB-level UCI trigger, deploy hardening)
- [ ] Full QA walkthrough of Journeys 0-3 against a live Vercel deploy, with no console errors and correct DB state
- [ ] `/privacy` content verified accurate for the current stack (Vercel, Supabase, Resend)
- [ ] Admin identified and committed to checking the `/admin` waitlist queue regularly
- [ ] Support contact live and documented
- [ ] `select * from cron.job;` confirms reminder + archive jobs are scheduled and idempotent

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
| **.ics File** | The iCalendar file format used for the "Add to Calendar" feature (Google Calendar, Outlook, Apple Calendar) |

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

-- Event RSVPs this week
SELECT COUNT(*) FROM rsvps
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND status IN ('confirmed', 'approved');

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
| **2.0** | **2026-07-08** | **Full reconciliation against the live codebase after a fresh audit.** Nearly all 22 tracked features confirmed implemented and wired; the "Unknown question" blocker confirmed fixed. Removed stale crunch/timeline framing and the exhaustive build checklist (moved to `plan.md`). Added the newly-built waitlist/OTP/admin-approval access model as a first-class section. Reframed remaining work around deploy migration (Lovable → Vercel), scheduler wiring, and DB-level security hardening — not new feature development. Updated domain references from `zothub.lovable.app` to `zothub.app` throughout. Added a UI/UX revision item to the post-launch roadmap, deliberately deferred past launch per product decision. | Claude |
