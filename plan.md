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

## Bug Inventory

**Status:** Phase 1 audit complete (2026-07-08). Every workflow listed in Phase 1 has been walked and recorded below.

**Phase 2 update (2026-07-09):** the Blocker/High fix pass is done. All three Blockers, the resume-access High, Known Bug #1, and Known Item #4 (DB-level `@uci.edu` trigger) are **fixed** — each entry below carries a "Fixed in Phase 2" status with what changed. Three new migrations were added (`20260709000100` RSVP status CHECK, `20260709000200` role-on-approval policies + legacy-role cleanup, `20260709000300` UCI email trigger); every fix was re-verified against a local Postgres with all migrations applied (RLS simulated per-role with `SET ROLE authenticated` + JWT claims), plus `tsc`/`vite build` clean and a headless-browser smoke of the touched pages. Deployment requires `supabase db push` + redeploying the `send-otp`/`verify-otp` edge functions — see the Phase 2 deployment notes in the commit/PR description. Out of scope by instruction: DNS cutover, Lovable decommission, UI redesign, and all Medium/Low entries (still open below).

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
- **Status:** Found (not yet fixed). Root cause confirmed this pass.

#### [Infra] `zothub.app` DNS not cut over to Vercel — *Known Item #3*
- **Severity:** High (blocks launch; also breaks all outbound email links today)
- **Detail:** Still not done. Newly observed impact: **every** email (`send-email` + `send-reminders`) hardcodes `https://zothub.app/...` links, the privacy contact is `privacy@zothub.app`, and OAuth/site redirects target `zothub.app`. Until DNS + the `zothub.app` mail/domain are live and serving, all email CTAs, unsubscribe links, and the support address are dead. (Sending domain is already verified with Resend per migration notes, but the site/links resolve nowhere yet.)
- **Suspected location:** DNS at Name.com / Vercel; hardcoded URLs in `supabase/functions/send-email`, `supabase/functions/send-reminders`, `src/pages/Privacy.tsx`.
- **Status:** Found (not yet fixed). Execution item, no further audit needed.

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
- **Status:** Found (not yet fixed).

#### [Feed/Notifications] "Follow" writes bookmarks, but follower notifications read `club_followers` (never populated)
- **Severity:** Medium
- **Repro:** As a student, "follow"/bookmark a club. When that club posts a new opportunity/event, you get **no** new-post in-app notification and **no** new-post email — even though the item does appear in your feed.
- **Expected vs. actual:** Following a club should drive both the personalized feed *and* new-post notifications.
- **Root cause (CONFIRMED via code + schema):** Following is implemented as a **bookmark** with `club_id` — the feed reads `bookmarks` (`src/pages/StudentFeed.tsx:36-40, 83, 106`). Nothing in the app ever writes `public.club_followers` (grep: referenced only in generated types). But the new-post in-app trigger `notify_followers_on_new_post()` iterates `club_followers` (migration `20260121010020`), and the new-post **emails** in `send-reminders` also query `club_followers` (`supabase/functions/send-reminders/index.ts:247-250, 344-347`). So both notification paths key off a table the UI never populates → they only ever fire for stale/migrated `club_followers` rows. Fix: unify on one mechanism (either write `club_followers` on follow, or point the trigger/cron at `bookmarks`). Minor sub-issue: the trigger/cron gate new-post notifications on the `deadline_reminders` preference, a semantic mismatch.
- **Suspected location:** `src/pages/StudentFeed.tsx`, `src/hooks/useBookmarks.ts`, `notify_followers_on_new_post()` trigger, `supabase/functions/send-reminders/index.ts`.
- **Status:** Found (not yet fixed).

#### [Messages] Real-time messaging and the live unread-message badge don't update
- **Severity:** Medium
- **Repro:** Open a conversation as user A. Have user B send a message. A's thread does not update until A refetches/navigates; the navbar unread-message badge also doesn't change live.
- **Expected vs. actual:** PRD lists real-time messaging and real-time unread-count badges.
- **Root cause (CONFIRMED via publication membership):** `useMessages` (`src/hooks/useMessages.ts:272-329`) and `useNavigationCounts` (`src/hooks/useNavigationCounts.ts:71-85`) subscribe to `postgres_changes` on `messages`, but `messages` is **not in the `supabase_realtime` publication** — only `notifications` and `club_team_members` were ever `ALTER PUBLICATION ... ADD`ed (verified via `pg_publication_tables`). So message subscriptions receive no events. Notifications realtime works (it's published). Fix: `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;` (and set `REPLICA IDENTITY` as needed).
- **Suspected location:** migration (publication membership); `src/hooks/useMessages.ts`, `src/hooks/useNavigationCounts.ts`.
- **Status:** Found (not yet fixed).

#### [Discovery/RLS] Logged-out visitors can't browse opportunities or events (but can browse clubs)
- **Severity:** Medium
- **Repro:** While logged out, open `/opportunities` or `/events` (public routes; the landing page has a "Browse Opportunities" CTA) → "Failed to load / No results". `/clubs` works fine logged out.
- **Expected vs. actual:** Inconsistent — either all public discovery pages should work for anon, or none should be public.
- **Root cause (CONFIRMED via `pg_policies`):** `opportunities` and `events` SELECT policies are `TO authenticated` only, while `club_profiles`/`club_followers` are `TO public`. The migration granted `anon` table-level SELECT on opportunities/events, but the RLS policy role (`authenticated`) overrides that, so anon is denied. Fix: add anon-visible SELECT policies for active opportunities/events (or make the routes require auth to match the gated model — but note clubs are already public).
- **Suspected location:** RLS policies on `opportunities`, `events`.
- **Status:** Found (not yet fixed).

#### [Notifications] Client-side transactional emails ignore notification preferences
- **Severity:** Medium
- **Repro:** Disable "Application Updates" (or "New Messages") in preferences. You still receive application-confirmation / application-status / RSVP-confirmation emails.
- **Expected vs. actual:** Preference toggles should gate the corresponding emails.
- **Root cause (code analysis):** In-app notifications (DB triggers) *do* check `notification_preferences`, and the **cron reminders** (`send-reminders`) *do* check them. But the **client-side** transactional sends bypass preferences entirely: `ApplicationForm` (confirmation), `ApplicationReview.updateApplicationStatus`/`handleBulkStatusUpdate` (status), and `RSVPForm`/`eventNotifications` (RSVP) call `send-email` directly with no preference lookup. Fix: check preferences before sending, or move these sends server-side where the check already exists.
- **Suspected location:** `src/lib/emailService.ts` callers, `src/components/ApplicationForm.tsx`, `src/components/dashboard/ApplicationReview.tsx`, `src/lib/eventNotifications.ts`.
- **Status:** Found (not yet fixed).

#### [Events/Email] Declining an RSVP emails the student a "You're In! confirmed" message
- **Severity:** Medium
- **Repro:** As a club, decline a pending RSVP (once the RSVP flow works). The student receives an email reading "You're In! 🎉 Your RSVP has been confirmed!"
- **Expected vs. actual:** A declined student should get a decline/waitlist message, not a confirmation.
- **Root cause (code analysis):** `sendRSVPStatusEmail` sends `type: "rsvp_confirmation"` for both approve and decline, passing a `statusUpdate` field the template ignores (`src/lib/eventNotifications.ts:97-124`). The `rsvp_confirmation` template in `send-email` always renders the confirmation copy (`supabase/functions/send-email/index.ts:84-102`) and has no decline branch. Fix: add a decline/rejected email template and branch on status. (Partly shadowed today by the approval-RSVP Blocker, but will surface once that's fixed.)
- **Suspected location:** `src/lib/eventNotifications.ts`, `supabase/functions/send-email/index.ts`.
- **Status:** Found (not yet fixed).

#### [Events] Event capacity is enforced only in the client
- **Severity:** Medium
- **Repro:** `EventDetail` disables the RSVP button when `spotsLeft <= 0`, but `RSVPForm.handleSubmit` performs no capacity check before inserting. Concurrent RSVPs near the cap, or a direct API insert, can exceed `capacity`.
- **Expected vs. actual:** PRD calls out correct capacity behavior "under concurrent RSVPs." There is no server/DB guard.
- **Root cause (code/schema):** No capacity check in `RSVPForm` (`src/components/RSVPForm.tsx:99-104`) and no DB trigger/constraint on `rsvps` enforcing count < `events.capacity`. Fix: enforce in a `BEFORE INSERT` trigger (authoritative) in addition to the client gate.
- **Suspected location:** `src/components/RSVPForm.tsx`; `rsvps` (add trigger).
- **Status:** Found (not yet fixed).

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
- **Status:** Found (not yet fixed).

#### [Auth/Console] `Waitlist` and `WaitlistRejected` call `navigate()` during render
- **Severity:** Medium
- **Repro:** Visit `/waitlist` or `/waitlist-rejected` while logged out. Console throws `Warning: Cannot update a component (BrowserRouter) while rendering a different component (Waitlist)` plus "You should call navigate() in a React.useEffect()". Observed live in the headless-browser sweep.
- **Expected vs. actual:** Redirects should happen in an effect, not the render body.
- **Root cause (CONFIRMED in browser):** Both pages do `if (!user) { navigate("/login"); return null; }` in the render body (`src/pages/Waitlist.tsx:47-50`, `src/pages/WaitlistRejected.tsx:19-22`). It "works" (it redirects) but is a React anti-pattern that logs errors and is fragile. Fix: move the redirect into `useEffect` (or use `<Navigate>`).
- **Suspected location:** `src/pages/Waitlist.tsx`, `src/pages/WaitlistRejected.tsx`.
- **Status:** Found (not yet fixed).

#### [Privacy] Privacy policy doesn't name Supabase or Vercel as processors
- **Severity:** Medium
- **Repro:** Read `/privacy` → "Service Providers" names **Resend** for email plus generic "authentication, and hosting"; it never names **Supabase** or **Vercel**.
- **Expected vs. actual:** PRD Appendix D and the launch checklist require the policy to accurately list the current processors (Supabase, Vercel, Resend). No stale "Lovable" reference remains (good).
- **Root cause:** `src/pages/Privacy.tsx:85` lists Resend only. Fix: name Supabase (database/auth/storage) and Vercel (hosting) explicitly.
- **Suspected location:** `src/pages/Privacy.tsx`.
- **Status:** Found (not yet fixed).

#### [Auth] Google-OAuth pending users can get stranded on the login page
- **Severity:** Low
- **Repro:** Sign up via "UCI Google" (creates a waitlist row + profile but **no** `user_roles` row) → later log in with Google. Because `Login`'s redirect effect requires `user && role` (`src/pages/Login.tsx:31-41`) and `role` is null for a role-less pending user, nothing routes them anywhere; they sit on the login screen.
- **Expected vs. actual:** A pending user should land on `/waitlist` regardless of signup method.
- **Root cause:** Login/Signup redirect effects key off `role`, which is null for OAuth-pending users. (Note: the Google OAuth path as a whole was not verifiable end-to-end here — provider config on the new project is "assumed working, not re-verified" per the migration doc.)
- **Suspected location:** `src/pages/Login.tsx`, `src/contexts/AuthContext.tsx` (`handleNewOAuthUser`).
- **Status:** Found (not yet fixed).

#### [Notifications] Unsubscribe-link auto-opt-out can re-enable other preferences
- **Severity:** Low
- **Repro:** Disable some preference in-app. Then click an "Unsubscribe from X" link in any email. The X preference is disabled, but previously-disabled preferences may flip back to `true`.
- **Root cause:** `Unsubscribe.checkAuthAndLoadPreferences` builds `newPrefs` from the **stale initial-default** `preferences` state (all `true`) rather than the freshly loaded values, then saves it (`src/pages/Unsubscribe.tsx:60-66`). Because `setPreferences` is async, the closure still holds defaults. Fix: build `newPrefs` from the loaded row.
- **Suspected location:** `src/pages/Unsubscribe.tsx`.
- **Status:** Found (not yet fixed).

#### [Data] `bookmarks` has no uniqueness constraint
- **Severity:** Low
- **Repro:** Rapid/concurrent bookmark toggles can create duplicate `bookmarks` rows for the same `(user_id, opportunity_id)` etc. (no unique constraint — verified via `pg_constraint`).
- **Root cause:** Client-side `isBookmarked` guard only; no DB uniqueness. Fix: add a partial unique index per target column.
- **Suspected location:** `bookmarks` table; `src/hooks/useBookmarks.ts`.
- **Status:** Found (not yet fixed).

#### [Auth] Admin approval doesn't record `reviewed_by`
- **Severity:** Low
- **Repro:** Approve/reject a waitlist entry; the `waitlist.reviewed_by` column stays null (only `reviewed_at`/`status` are set).
- **Root cause:** `approveUser`/`rejectUser` don't set `reviewed_by` (`src/hooks/useWaitlist.ts:116-127, 148-156`). Fix: set it to the admin's id for audit trail.
- **Suspected location:** `src/hooks/useWaitlist.ts`.
- **Status:** Found (not yet fixed).

#### [Cleanup] Dead / duplicated code (non-blocking)
- **Severity:** Low
- **Details:** (a) `AuthContext.signUp` (`src/contexts/AuthContext.tsx:179-252`) is exposed but never called — email signup goes through `send-otp`/`verify-otp`; it also contains a divergent second copy of the waitlist/profile-creation logic (a foot-gun if someone wires it up). (b) `ClubProfileSetup` re-declares `CATEGORY_OPTIONS` locally instead of importing `CLUB_CATEGORIES` from `src/lib/constants.ts`, and uses a bespoke Sparkles+"ZotHub" header instead of the shared `<Logo>` component (visual inconsistency).
- **Status:** Found (not yet fixed). Do not fix ad hoc — for a later cleanup pass.

#### [Tooling] ESLint reports 26 errors (build & typecheck are clean)
- **Severity:** Low
- **Details:** `npm run lint` → 26 errors / 31 warnings: mostly `@typescript-eslint/no-explicit-any` (`src/pages/club/ClubFeed.tsx`, `supabase/functions/send-reminders`), `no-case-declarations` in `supabase/functions/send-email/index.ts:53,59`, and a `require()` import in `tailwind.config.ts:150`. None break `vite build` or `tsc --noEmit` (both pass). The repo's Playwright config also references a currently-unavailable package (per PRD roadmap) so there is no runnable e2e suite yet.
- **Status:** Found (not yet fixed).

#### [Console] Benign React Router v7 future-flag warnings
- **Severity:** Low
- **Details:** Every route logs two `React Router Future Flag Warning` messages (`v7_startTransition`, `v7_relativeSplatPath`). Cosmetic; opt-in flags silence them. No functional impact.
- **Status:** Found (not yet fixed).

### Workflows checked with no material issues
- **Public pages render + responsive:** landing, `/opportunities`, `/events`, `/clubs`, `/login`, `/signup` (+role variants), `/forgot-password`, `/privacy`, `/unsubscribe`, `/404` all render at 1280px and 375px with **no horizontal overflow**; data pages show clean "Failed to load"/empty states (not blank/crash) when the backend is unreachable. `ProtectedRoute`/`AdminRoute` correctly send logged-out users to `/login`.
- **Application questions:** all four question types (short_text, long_text, single_choice, multiple_choice) author and render correctly (`DynamicQuestionForm`), and required-field validation works; the same form is reused by RSVPs.
- **Duplicate blocking:** applications and RSVPs both have real unique constraints (`applications_opportunity_id_student_id_key`, `rsvps_event_id_student_id_key`) and the UI handles `23505`.
- **Application status workflow:** status transitions, bulk accept/reject, CSV export, and the student-facing in-app status notification (trigger, preference-aware) all work. `.ics` calendar export is well-formed (UTC, escaping, line folding).
- **Cron reminders:** `send-reminders` idempotency is solid (`reminder_logs` + `unique_reminder` unique constraint) and it correctly respects `notification_preferences`; deadline reminders correctly key off bookmarks.
- **Storage RLS design:** `club-assets` intentionally public; `student-resumes` private with correct owner + applied-club SELECT policies (the only resume problem is the client using the wrong URL type — see the High finding above).
- **Migrations:** all 29 apply cleanly against a fresh Postgres 16; `build`, `tsc --noEmit` pass.

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
