# ZotHub — Next-Stage Engineering Plan

> **Engineering execution doc.** This is the active source of truth for the next development stage of ZotHub. `prd.md` is the companion product spec (vision, users, access model, known issues, launch readiness) — read it for *what the product is and what's known to be wrong*; read this for *what to do next and how*.

---

## Context

**Why this rewrite exists:** `plan.md` previously tracked the migration from Lovable Cloud to a self-owned Supabase project + Vercel hosting. That migration is now functionally complete (full history in `docs/archive/MIGRATION.md`). This document no longer needs to be a migration plan — it now exists to drive the **next development stage**: finding out, comprehensively and in one coordinated pass, everything that's actually broken or incomplete across the live product, before writing a single line of fix code.

**Where things stand:** ZotHub runs on Vercel with a self-owned Supabase project (`fguzpscguulkfctipeih`). Schema, data, storage, and all 4 edge functions (`send-email`, `send-otp`, `verify-otp`, `send-reminders`) are migrated and live; the hourly reminder cron job is active. Core flows (OTP signup, account creation, login, manual waitlist approval) are confirmed working. Two bugs and three infrastructure/hardening gaps are already known (see **Known Issues & Open Items** below) — surfaced during migration QA, not yet fixed.

**The core principle for this stage:** *audit before you fix.* Bugs discovered during Phase 1 below must be added to this document's Bug Inventory **before** any fixing begins, so the next coding pass is coordinated and prioritized — not a random walk through whatever's noticed first.

---

## Known Issues & Open Items (carried forward — seed the Bug Inventory with these)

These were found during migration QA and are not yet fixed. They should be the first entries in the Bug Inventory once Phase 1 begins, not forgotten in the transition.

### Bugs
| # | Issue | Where | Desired behavior |
|---|---|---|---|
| 1 | Student profile setup fails with raw error `"Expected array, received null. Expected array, received null"` when only name is filled in | `StudentProfileSetup.tsx` / validation schema (likely `src/lib/validation.ts`) | `interests`/`skills` should not be required; `null`/empty should be accepted or normalized to `[]`; validation errors shown to users must be human-readable, never raw schema error text |
| 2 | Orphaned/deleted user (old migrated "Dhruv Mantri" account) still appears as a club team member | `club_team_members` and any other table with a `user_id`-style FK into `auth.users` | Rows referencing an `auth.users` ID that no longer exists should be removed or hidden from UI, not displayed as if the user were real/active. Root cause: `auth.users` was intentionally never migrated from Lovable Cloud (fresh OTP signups were used instead), so old `public.*` rows referencing the old Lovable Cloud auth UUIDs are now orphaned references. |

### Infrastructure / Hardening Gaps
| # | Item | Status |
|---|---|---|
| 3 | `zothub.app` DNS cutover to Vercel | **Not done.** Every migration step deliberately excluded DNS changes. Domain registration is held at Name.com (not Lovable), so this isn't blocked — just not yet executed. |
| 4 | DB-level `@uci.edu` enforcement | **Not done.** Signup restriction is currently client-side only, bypassable via a direct API call. Needs a `BEFORE INSERT` trigger on `auth.users`. |
| 5 | Full end-to-end QA | **Partially done.** Core auth/waitlist flows confirmed working; everything else (applications, events/RSVP, messaging, notifications, storage, email content, mobile) has not been systematically walked. **This is exactly what Phase 1 below exists to complete.** |

---

## Phase 1: Full Product Audit & Bug Inventory

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

## Anticipated Next Phases (provisional — to be finalized from Phase 1's findings)

These are *not* fully scoped yet on purpose — real priorities should come from what Phase 1 actually finds, not be guessed in advance.

- **Phase 2: Prioritized bug-fix pass.** Work the Bug Inventory in severity order. Blockers first, then High, then Medium/Low as time allows.
- **Phase 3: Close remaining infra/hardening gaps.** DNS cutover, DB-level `@uci.edu` trigger — these are well-understood and don't need further audit, just execution, whenever prioritized.
- **Phase 4 (deferred, post-launch): Comprehensive UI/UX revision.** Design-system consistency audit, full empty/loading/error-state pass beyond bug-level fixes, mobile-specific optimization, accessibility audit, possible visual refresh. Deliberately scoped for after real usage data exists — not planned blind.
- **Access model transition:** once the beta has run for a while and core flows are validated, consider relaxing from gated waitlist-approval to open `@uci.edu` signup (keep OTP + the DB-level domain trigger as the sole gates).

---

## Reference / Historical Docs

- **`docs/archive/MIGRATION.md`** — the full Lovable Cloud → Supabase/Vercel migration runbook, with a step-by-step completion status. Kept for historical reference; no longer an active execution doc.
- **`docs/archive/lovable-migration-plan.md`** — Lovable's own AI-generated planning doc for the same migration (superseded by the above, kept for reference only).
- **`prd.md`** — current product spec, feature list, known issues, launch readiness criteria.

---

## Suggested execution order

**Phase 1** (Full Product Audit & Bug Inventory — do this first, in full, before fixing anything) → **Phase 2** (prioritized fixes from the inventory) → **Phase 3** (DNS + DB-trigger hardening, can run in parallel with Phase 2) → **Phase 4** (UI/UX revision, deferred, post-launch, separately scoped).
