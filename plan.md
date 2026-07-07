# ZotHub — Full Working & Deployable Website Plan

> This is the **authoritative build roadmap** for finishing and shipping ZotHub. It is written to be executed by an AI coding model (Claude Code / Fable 5) phase by phase. Each phase has concrete files, schema changes, and verification steps.
>
> **Relationship to `prd.md`:** `prd.md` is the *product* spec (vision, users, value prop, competitive landscape, launch/marketing, support ops) and remains useful as background/reference. `plan.md` (this file) is the *engineering execution* spec and is what should drive the build. Where the two overlapped, this plan is the source of truth; the still-valuable product context and concrete assets from the PRD (user journeys, success metrics, email-template copy, privacy-policy outline) are summarized or referenced below so nothing is lost. Note the PRD contains **stale launch framing** ("1-week crunch", "zothub.lovable.app", "launch tonight") that this plan supersedes.

---

## Context

**What ZotHub is:** A two-sided UCI campus marketplace connecting students (seeking leadership roles, internships, projects, volunteer positions, events) with UCI clubs (posting opportunities, managing applications, building community). Stack: React 18.3 + Vite 5 + TypeScript + Tailwind/shadcn + react-router-dom v6 (BrowserRouter) + Supabase (Postgres, RLS, Storage, Auth) + react-hook-form/zod + sonner + framer-motion + recharts.

**Why this plan exists / where we left off:** The app's backend and core UI were built on Lovable in a Dec 23–24, 2025 sprint (12 of 14 migrations, full schema, RLS, storage, in-app notifications, team roster, analytics). Work then stopped. A PRD (v1.2) promised **22 "must-have" UX features**, but only **3 shipped** (keyword search, club category filtering, real-time unread nav badges). The remaining **19 were never built**, several backend jobs are defined-but-unwired, there is a launch-blocking bug in application review, and the Lovable subscription has ended — so hosting must move. This plan takes the app from "partially built, Lovable-hosted" to "fully working, self-hosted, production-ready."

**Intended outcome:** All remaining features implemented, all critical bugs fixed, real transactional email + scheduled jobs live, app migrated off Lovable to Vercel with custom domain `zothub.app`, and performance/security hardened for a medium launch (10–30 clubs, 200–500 students).

**Decisions locked in:**
1. **Scope = Everything** — all remaining features + all bug/perf/security fixes.
2. **Email = Real transactional email** — Resend + Supabase edge functions + pg_cron. Custom SMTP for auth emails.
3. **Deploy = Migrate off Lovable → Vercel**, re-point `zothub.app`, backend via Supabase CLI.
4. **Scale = Medium** — query limits + pagination + `useMemo` + DB indexes. No virtualization.

**Open decision (needs your call — see Phase 1.4):** Whether new clubs require **manual approval** before they can post (PRD's original intent) or are **auto-approved** on signup (current live behavior). This plan defaults to a lightweight approval gate but flags it.

**Key backend facts (audited):**
- `notify_deadline_approaching()` has a real body but is **never attached to a trigger** (migration `20251223160240`).
- `archive_past_events()` exists but is **never scheduled** (no pg_cron) (migration `20251223162738`).
- "Following a club" = a row in `bookmarks` with `club_id` set (no separate follows table).
- `.env` is **committed to git**; the key is the publishable/anon key (RLS-protected, safe) — untrack it, no forced rotation.
- Supabase project ref: `alpmifyiwwrkolixwyvz` (from `supabase/config.toml`).

**Pre-work while Lovable is still accessible:** (a) confirm the Supabase project is under your own Supabase account (full dashboard access); (b) run `supabase db pull` to capture any schema drift Lovable applied via its UI before building on top.

---

## Feature status (22 tracked + gaps recovered from PRD)

**Done (3):** keyword search · club category filtering · unread nav badges.

**Remaining (19):** (1) team messaging · (2) application-count visibility toggle · (3) auto-archive expired content · (4) event RSVP custom forms · (5) RSVP approval workflow · (6) application question-label fix *(BLOCKER BUG)* · (7) application filtering by opportunity · (8) team display-order sorting · (10) smart sort dropdown · (13) event reminder emails · (14) deadline-approaching notifications · (15) new-opportunity notifications · (16) resume prefill · (17) success confirmation modals · (18) post-publication confirmation · (19) auto-archive scheduler · (20) share/copy-link · (21) bulk application actions · (22) CSV export. Plus **file uploads in the application form**.

**Recovered from PRD (were missing from the 22-list — now in scope):**
- (R1) **Add to Calendar (.ics)** on events + in reminder emails.
- (R2) **Event cancellation → email all RSVP'd students** when a club cancels/deletes an event.
- (R3) **Club approval gate** (`club_profiles.status` pending/active) — *see Phase 1.4 decision*.
- (R4) **Duplicate-application prevention** — verify it's enforced (unique constraint on `applications(opportunity_id, student_id)`); add if missing.

---

## Core user journeys (target UX — build to these)

Condensed from the PRD; use these as the acceptance narrative for the build.

- **Club: post → receive → hire.** Signup (@uci.edu) → [approval gate] → create profile → post opportunity with a custom application form → receive in-app+email on each application → review answers + download resume → mark Reviewed → Accept/Reject (student notified in-app+email) → message accepted candidates. *Target: post an opportunity in <5 min; review UI makes candidates easy to compare.*
- **Student: discover → apply → track.** Signup (@uci.edu) → optional profile → search + filter + sort opportunities → view detail → apply (custom form, resume prefilled/uploaded, duplicate blocked) → success modal + confirmation → track status changes (in-app+email) → follow club → get new-opportunity notifications. *Target: relevant opportunity within 3 clicks; notifications < ~1h.*
- **Student: RSVP → attend.** Browse events → RSVP (optional custom RSVP form; approval if required) → appears in dashboard → **Add to Calendar (.ics)** → **email reminder 24h before** → attend. Cancel frees capacity + stops reminders; **club cancellation emails all attendees**. *Target: RSVP < 10s; reminders reliable.*

---

## PHASE 0 — Migrate off Lovable, harden deploy, reconcile backend (DO FIRST)

Own the repo + backend and get a verifiable production deploy before touching features.

### 0.1 Repo / build hygiene
- Remove Lovable coupling: delete `import { componentTagger } from "lovable-tagger"` in `vite.config.ts:4` and remove it from `plugins` (`vite.config.ts:12`) → `plugins: [react()]`. Remove `lovable-tagger` from `package.json`. Regenerate lockfile.
- Standardize on **npm** (matches `package-lock.json`, Vercel default). Delete `bun.lockb` (dual lockfiles cause inconsistent installs).
- Untrack secrets: `git rm --cached .env` (keep local copy; `.gitignore` already lists it). `service_role` key must NEVER be in `.env` or the client bundle — only in edge-function secrets (Phase 2).
- Env-var validation: `src/integrations/supabase/client.ts` reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` with no guard → silent white screen if unset on the new host. Add a fail-fast `throw` with a clear message if either is missing.

### 0.2 Host = Vercel
Zero-config Vite preset, first-class SPA rewrites, per-branch preview deploys, simple env UI, auto-TLS custom domains. (Netlify is an equivalent fallback.)
- Build settings: framework preset **Vite**, build `npm run build`, output `dist`, install `npm install`.
- **SPA rewrite** (BrowserRouter deep links 404 without it) — add `vercel.json`:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
  (Netlify equivalent: `public/_redirects` → `/*  /index.html  200`.)
- Env vars (Production + Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. Build-time (Vite inlines them) → redeploy after any change.

### 0.3 DNS re-point for zothub.app
Add `zothub.app` + `www` in Vercel; set the apex A/ALIAS to Vercel's target and `www` CNAME to `cname.vercel-dns.com` (exact values Vercel shows). Remove old Lovable DNS records. Add Resend DKIM/SPF/DMARC records (Phase 2.2) at the same time to absorb propagation lag. **Keep Lovable reachable until `zothub.app` resolves to Vercel with valid TLS, then flip.**

### 0.4 Supabase CLI linking + migration reconciliation
`supabase login` → `supabase link --project-ref alpmifyiwwrkolixwyvz`. Then reconcile drift: `supabase db pull` (captures any remote-only schema into a new migration), `supabase migration list` (compare local vs remote). **Local must equal remote before writing any new migration in later phases.** Workflow: `supabase migration new <name>` → `supabase db push`.

### 0.5 Supabase Auth config for new domain
Auth → URL config: Site URL `https://zothub.app`; redirect allow-list `https://zothub.app/**` + the Vercel preview pattern. Update Google OAuth authorized redirect URIs in Google Cloud to the Supabase callback + new domain.

### Verification
- Local: clean `npm install` (no lovable-tagger), `npm run build` + `npm run dev` succeed; Supabase reads work.
- Prod: `https://zothub.app` loads; hard-refresh `/opportunities` → no 404 (SPA rewrite works); email/password AND Google login both land on zothub.app. `git ls-files | grep .env` returns nothing.
- Backend: `supabase migration list` shows local == remote.

### Risk
**Migration drift is the single highest risk of the project.** If `db pull` surfaces remote-only objects, capture them into a migration first; do not push new migrations until reconciled.

---

## PHASE 1 — Critical bug fixes (blockers) + security + gating

### 1.1 (Feat 6) "Unknown question" blocker
Root cause: `ApplicationForm.tsx:124-130` writes answers as `{question_id, question, answer}`; `ApplicationReview.tsx:445` reads `response.questionId` (undefined) → `getQuestionText` (line 207) returns `"Unknown question"`. Correct text is already stored in `response.question`.
**Fix in `ApplicationReview.tsx`:** render `response.question` directly, with fallback `response.question ?? getQuestionText(response.question_id, questions) ?? "Question"`. Update the answer interface (`~line 47`) to `{ question?: string; question_id?: string; answer: ... }`. Repairs legacy rows too.

### 1.2 UCI @uci.edu enforcement at DB layer
Today only client-side and only on OAuth; email/password signup accepts any domain. Add a `BEFORE INSERT` trigger on `auth.users` (SECURITY DEFINER) that raises unless `NEW.email ILIKE '%@uci.edu'` (optionally allow-list admin exceptions). Keep the client-side check in `Signup.tsx`/`Login.tsx` for fast UX; DB is source of truth.

### 1.3 (R4) Duplicate-application prevention
Verify a unique constraint exists on `applications(opportunity_id, student_id)`; if not, add it (migration) and surface a friendly "You've already applied" message in `ApplicationForm.tsx`.

### 1.4 (R3) Club approval gate — **DECISION REQUIRED**
Current live behavior: clubs can post immediately (no gate). PRD intent: manual approval. **Recommended default:** add `club_profiles.status` (`pending` | `active` | `rejected`, default `pending`); block posting opportunities/events while `pending`; show a "Pending approval" banner; approve via an admin action (SQL or a minimal admin screen). If you prefer frictionless growth, set default `active` (auto-approve) and treat moderation as reactive. *Confirm which before building; the schema column is cheap to add either way.*

### 1.5 Perf quick wins (no schema)
Add `.limit()` + explicit ordering to unbounded fetches in `Opportunities.tsx` (~line 48), `Events.tsx` (~line 45), `useMessages.ts` (~line 43). Full pagination + `useMemo` in Phase 4.

### Verification
Club opens an application → sees real question text + answers (new AND pre-existing). Non-`@uci.edu` signup rejected by DB. Re-applying blocked. If approval gate on: `pending` club cannot post; `active` can.

---

## PHASE 2 — Email + scheduled-job infrastructure

### 2.1 Extensions (migration)
`create extension if not exists pg_cron;` and `create extension if not exists pg_net;` (pg_net lets SQL invoke edge functions over HTTP; pg_cron jobs live in `cron.job`).

### 2.2 Resend
Create account; verify the `zothub.app` sending domain (DKIM/SPF/DMARC, added with Phase 0.3 DNS). Senders: `noreply@zothub.app`, `team@zothub.app`. Store the key as an edge-function secret only: `supabase secrets set RESEND_API_KEY=...`.

### 2.3 Edge functions (`supabase/functions/`)
Deno + supabase-js (service role) + `fetch` POST to `https://api.resend.com/emails`. **Email copy:** use the PRD Appendix C templates (event reminder, application status, new application, etc.) as the starting HTML content.
1. **`send-email`** — shared core (`_shared/resend.ts`): `{ to, subject, html, from? }`; single Resend call + one HTML layout helper.
2. **`send-event-reminders`** (cron; feat 13, R1) — `events` with `event_date` in the next 24–25h and `is_active=true`; confirmed-RSVP emails; include **Add-to-Calendar (.ics)** link; idempotency row (2.5).
3. **`send-deadline-reminders`** (cron; feat 14) — `opportunities` with `deadline` within 24h and `is_active=true`; notify followers/bookmarkers (in-app + email); idempotent per (opportunity, user, day).
4. **`notify-new-opportunity`** (event-driven; feat 15) — fan out to followers (`bookmarks` where `club_id` = that club) → in-app + email. Invoke via a DB `AFTER INSERT` trigger on `opportunities` using pg_net.
5. **`send-team-invite`** (team email invites) — called from `TeamManagement.tsx` after inserting a pending `club_team_members` row; emails invitee a signup/accept link. Fixes today's gap where inviting a not-yet-registered user sends nothing.
6. **`notify-event-cancelled`** (R2) — called when a club cancels/deletes an event; emails all confirmed RSVPs. (Client-invoked from `EventManagement.tsx`, or DB trigger on status change.)
7. Auto-archive stays pure SQL in pg_cron (2.4).

Deploy with `supabase functions deploy <name>`. `verify_jwt=false` for cron-invoked functions (service-role/shared-secret header); keep JWT on for client-invoked ones.

### 2.4 pg_cron schedules (migration)
- **Nightly archive** (feats 3/19): existing `archive_past_events()` + new `archive_expired_opportunities()` (sets `opportunities.is_active=false` where `deadline < now()`) → `cron.schedule('nightly-archive','0 8 * * *', ...)` (08:00 UTC ≈ midnight PT).
- **Event reminders**: hourly `cron.schedule('event-reminders','0 * * * *', ...)` via `net.http_post(...)` to `send-event-reminders` with auth header.
- **Deadline reminders**: hourly/daily → `send-deadline-reminders`.
- Store the function URL + bearer via Supabase `vault` or a small `private.app_config` table so cron SQL isn't hardcoded.

### 2.5 Idempotency via `notifications` table
Reuse `notifications` (`id,user_id,type,title,message,is_read,related_id,created_at`) as a send-ledger. Before sending, check for a matching row (`type`,`related_id`,`user_id`); skip if present; insert atomically with the send. Types: `event_reminder_24h`, `deadline_reminder` (per opportunity+user+day), `new_opportunity`. Doubles as the in-app notification feeding `useNavigationCounts`.

### 2.6 Custom SMTP for Supabase Auth emails
Auth → SMTP: point confirm-signup / magic-link / password-reset (`ForgotPassword.tsx`) at `smtp.resend.com` (port 465/587, user `resend`, password = `RESEND_API_KEY`, sender `noreply@zothub.app`). Removes default rate limits + unbranded sender.

### Verification
Invoke `send-event-reminders` twice → second run sends nothing (idempotency). `select * from cron.job;` shows schedules. Event 24h out + RSVP → reminder arrives once with a working .ics. Live password reset → email via Resend (DKIM pass). Publish opportunity a student follows → follower gets in-app + email. Cancel an event → all attendees emailed.

### Risk
cron→edge auth (pg_net bearer) is a silent-failure hotspot — verify `net.http_post` manually first. Resend DKIM propagation can take hours — start DNS early.

---

## PHASE 3 — Feature batches (grouped by shared surface area)

### Batch A — Application review & content mgmt (feats 2, 7, 21, 22 + app file uploads)
Surface: `ApplicationReview.tsx`, `OpportunityManagement.tsx`, `ApplicationForm.tsx`, `opportunities`.
- **(7) Filter by opportunity:** `Select` dropdown in `ApplicationReview.tsx` listing the club's opportunities; filter loaded list client-side. No schema.
- **(21) Bulk actions:** row checkboxes + action bar (Accept / Reject / Mark reviewed); batch `.update(...).in('id', ids)`. Existing `notify_application_status_change` trigger fires per row. No schema.
- **(22) CSV export:** client-side Blob download of filtered applications (name/email/major/year/status/answers). No schema.
- **(2) Application-count visibility:** migration `opportunities + show_application_count boolean DEFAULT true`; respect in public renders (`OpportunityCard.tsx`, `Opportunities.tsx`, `OpportunityDetail.tsx`); club always sees counts. Toggle in `CreateOpportunity.tsx`/`EditOpportunity.tsx`.
- **App file uploads:** wire existing `src/components/ui/file-upload.tsx` into `ApplicationForm.tsx` (~lines 277-290); upload to student-resumes bucket; store URL in `resume_url` (already flows to `applications.resume_url`). Reuse profile-upload pattern.

### Batch B — Events: RSVP forms, approval, calendar, cancellation (feats 4, 5, R1, R2)
Surface: `events`, `rsvps`, `EventDetail.tsx`, `EventManagement.tsx`, `CreateEvent.tsx`/`EditEvent.tsx`.
- Migration: `events + rsvp_questions jsonb DEFAULT '[]'`, `+ rsvp_requires_approval boolean DEFAULT false`; `rsvps + answers jsonb DEFAULT '{}'`; widen `rsvps.status` CHECK to add `pending`/`approved`/`declined` (**drop-and-recreate constraint — the only non-additive change; snapshot + test existing rows**).
- **(4) Custom forms:** reuse `ApplicationQuestionsBuilder.tsx` to author `rsvp_questions`; extract a shared `<QuestionRenderer>` from `ApplicationForm.tsx` and use it in an RSVP dialog on `EventDetail.tsx`; store answers on `rsvps.answers`.
- **(5) Approval:** when required, new RSVPs `status='pending'`; club approves/declines in `EventManagement.tsx` (reuse ApplicationReview approve/reject UI). New trigger `notify_rsvp_status_change` (model on `notify_application_status_change`) + optional email. Respect `events.capacity` on approval.
- **(R1) Add to Calendar (.ics):** client-side .ics generation + download button on `EventDetail.tsx` and in reminder emails. No schema.
- **(R2) Cancellation emails:** on club cancel/delete of an event with RSVPs, call `notify-event-cancelled` to email all confirmed attendees.

### Batch C — Team collaboration (feats 1, 8; email invite built in Phase 2.3)
Surface: `club_team_members`, `TeamManagement.tsx`, messaging stack.
- **(8) Display-order sort:** migration `club_team_members + display_order integer DEFAULT 0`; up/down arrows in `TeamManagement.tsx` **reusing the `moveQuestion` swap pattern from `ApplicationQuestionsBuilder.tsx:161-181`**; order by `display_order`.
- **(1) Team messaging:** reuse `useMessages.ts`, `MessageThread`, `MessageComposer`, `messages` table. Club opens a thread with an accepted member (`club_team_members.status='accepted'` has `user_id`). Verify/extend `messages` RLS for club↔member. Entry point: "Message" button in `TeamManagement.tsx`.

### Batch D — Search/discovery & engagement (feats 10, 16, 17, 18, 20)
- **(10) Smart sort dropdown** (deadline / popularity / newest): `Select` on `Opportunities.tsx` + `Events.tsx`; sort inside the Phase 4 `useMemo`. Popularity = count of already-fetched `applications`/`rsvps`. No schema.
- **(16) Resume prefill:** in `ApplicationForm.tsx`, fetch `student_profiles` on open (already queried at submit ~lines 112-116) and prefill `resume_url`. Combine with Batch A upload.
- **(17) Success modals:** reusable `<SuccessModal>` (shadcn Dialog) after apply / RSVP / publish, augmenting the bare `toast.success`.
- **(18) Post-publication confirmation:** success modal after `CreateOpportunity.tsx`/`CreateEvent.tsx` + optional club confirmation email; publish also triggers `notify-new-opportunity` fan-out.
- **(20) Share/copy-link:** `<ShareButton>` copying the canonical `https://zothub.app/...` URL via `navigator.clipboard` + sonner toast, on `OpportunityDetail.tsx`, `EventDetail.tsx`, `ClubDetail.tsx`, and cards. No schema.

### Verification (per batch)
- **A:** filter narrows list; bulk-accept updates N rows + notifies; CSV opens; count toggle hides public counts only; resume upload attaches + is club-downloadable.
- **B:** custom RSVP form saves; approval pending→approve→student notified; capacity respected; .ics imports correctly into Google/Apple Calendar; cancel emails all attendees.
- **C:** reorder persists across reload; club messages an accepted member.
- **D:** each sort reorders; resume prefilled; modals appear; copy-link yields a working deep link (re-validates the Phase 0 SPA rewrite).

---

## PHASE 4 — Performance / scale (Medium; no virtualization)

- **`useMemo` filtering/sorting:** apply the existing memoized pattern from `Clubs.tsx` to `Opportunities.tsx` and `Events.tsx`.
- **Pagination:** reuse `src/components/ui/pagination.tsx` on `Opportunities.tsx`, `Events.tsx`, `Clubs.tsx`, backed by `.range(from,to)` + a count query; keep the Phase 1.5 `.limit()` as page size.
- **Messages:** `.limit()` + load-more in `useMessages.ts`.
- **Indexes (migration):** `opportunities(is_active, created_at desc)`, `opportunities(deadline)`, `opportunities(club_id)`; `events(is_active, event_date)`, `events(club_id)`; `applications(opportunity_id)`, `applications(student_id)`; `rsvps(event_id)`, `rsvps(student_id)`; `bookmarks(club_id)`; `notifications(user_id, is_read)`; a `messages` conversation key.
- **Optional (do LAST, if at all):** adopt `@tanstack/react-query` (installed + provider mounted, currently zero usage) for browse fetches.

### Verification
Pages paginate; network shows bounded row counts; Supabase advisor / `explain analyze` shows index usage; no filter/sort regressions.

---

## PHASE 5 — QA, hardening, launch

- **End-to-end on LIVE zothub.app** — walk the three Core User Journeys above (club post→hire; student discover→apply→track; student RSVP→attend), including emails and notifications.
- **Scheduled jobs:** `cron.job` fires (check logs); reminder arrives exactly once (idempotency); nightly archive flips past events + expired opportunities.
- **Security:** `.env` untracked; `service_role` only in function secrets; RLS spot-checks for new columns (RSVP answers, app counts, club status); DB @uci.edu block confirmed.
- Review Supabase security + performance advisors; confirm migrations == remote.
- **Rollback:** Vercel instant deploy rollback; DB changes additive/defaulted (low risk); snapshot before the Batch B `rsvps.status` constraint change.

---

## Analytics & success metrics (from PRD — track post-launch)

**Events worth capturing** (already derivable from tables; add an `analytics_events` table only if you want a unified funnel): application submitted, event RSVP, bookmark/save.

**Primary metric:** # of opportunities posted (supply-side health) — target 50–100 in first 30 days.
**Secondary:** application volume (200–500/mo), applications per opportunity (5–10), weekly returning students (30%+), club satisfaction survey (70%+ "yes").

**Weekly report:** run the SQL in `prd.md` Appendix B (signups, opportunities, applications, RSVPs, top opportunities, retention) against Supabase.

---

## Launch deliverables (non-code)

- **Privacy Policy** — publish before launch (student PII/FERPA-adjacent). Use `prd.md` Appendix D outline; link in footer + signup. Update processor list to reflect Vercel + Resend + Supabase.
- **Email template copy** — `prd.md` Appendix C (event reminder, application status, new application, etc.) is the content source for the Phase 2 edge functions; every notification email needs an unsubscribe link (CAN-SPAM).
- **Support** — designate a support email (e.g. `support@zothub.app` via Resend/forwarding); keep the PRD's common-scenario response templates.
- **Club approval SOP** (if approval gate enabled in 1.4) — verification checklist + approve/reject SQL (see `prd.md` "Club Approval Process").

---

## Consolidated DB schema changes

| Change | Feature |
|---|---|
| `auth.users` BEFORE INSERT trigger enforcing `email ILIKE '%@uci.edu'` | 1.2 |
| Unique constraint `applications(opportunity_id, student_id)` (if missing) | 1.3 / R4 |
| `club_profiles + status` (`pending`/`active`/`rejected`, default per 1.4 decision) | R3 |
| `opportunities + show_application_count boolean DEFAULT true` | 2 |
| new fn `archive_expired_opportunities()` (`is_active=false` where `deadline < now()`) | 3/19 |
| `events + rsvp_questions jsonb DEFAULT '[]'`, `+ rsvp_requires_approval boolean DEFAULT false` | 4/5 |
| `rsvps + answers jsonb DEFAULT '{}'`; widen `status` CHECK → `pending/approved/declined`; trigger `notify_rsvp_status_change` | 5 |
| `club_team_members + display_order integer DEFAULT 0` + index `(club_id, display_order)` | 8 |
| `opportunities` AFTER INSERT trigger → pg_net → `notify-new-opportunity` | 15 |
| Drive deadline reminders via `send-deadline-reminders` cron (preferred over wiring the existing fn) | 14 |
| Schedule `archive_past_events()` + `archive_expired_opportunities()` via pg_cron | 3/19 |
| Extensions `pg_cron`, `pg_net`; Phase 4 indexes | infra/perf |

No new columns for feats 1, 6, 7, 10, 16, 17, 18, 20, 21, 22, R1, R2 (logic/UI/reuse only; R2 reuses `send-email`, R1 is client-side .ics).

---

## Highest-risk items & ordering constraints

1. **Phase 0 `db pull` reconciliation MUST precede any new migration** — else pushes conflict with untracked remote drift. *(Highest risk.)*
2. **Phase 2 email infra MUST precede feats 13/14/15/18, R2, + team invites.** Custom SMTP (2.6) live before relying on auth emails.
3. **DNS + Resend domain verification (0.3 / 2.2) has propagation lag — start early.**
4. **RSVP `status` CHECK change (Batch B) is the only non-additive schema edit** — drop-and-recreate, test existing rows, snapshot first.
5. **cron→edge pg_net auth is a silent-failure hotspot** — verify `net.http_post` manually first.
6. **Bug fix 1.1 (application labels) is a launch blocker** — before any club-facing QA.
7. **Confirm the Phase 1.4 club-approval decision** before building the gate.
8. **Optional react-query refactor LAST**, if at all.

---

## Critical files

- `src/components/dashboard/ApplicationReview.tsx` — bug 6, feats 7/21/22/2
- `src/components/ApplicationForm.tsx` — bug 6 source, file upload, feat 16, shared `<QuestionRenderer>`
- `src/components/dashboard/ApplicationQuestionsBuilder.tsx` — reusable `moveQuestion` (feat 8) + RSVP form authoring (feat 4)
- `src/components/dashboard/TeamManagement.tsx` — feats 1, 8, team invite entry point
- `src/pages/EventDetail.tsx`, `src/components/dashboard/EventManagement.tsx` — Batch B (RSVP forms/approval/.ics/cancellation)
- `src/pages/Opportunities.tsx`, `src/pages/Events.tsx` — sort (10), limits (1.5), useMemo + pagination (Phase 4)
- `src/integrations/supabase/client.ts` — env validation (Phase 0)
- `vite.config.ts` + `package.json` — remove lovable-tagger, lockfile (Phase 0)
- `supabase/migrations/` — schema + pg_cron + triggers; **new** `supabase/functions/` — edge functions (Phase 2)
- **new** `vercel.json` — SPA rewrite (Phase 0)

---

## Suggested execution order (for the Fable 5 build prompt)

Phase 0 → Phase 1 → Phase 2 → Phase 3 (Batch A → B → C → D) → Phase 4 → Phase 5. Ship a Vercel preview deploy after each phase for incremental verification. **Do not batch multiple phases into one prompt** — each phase has its own verification gate. When generating the Fable 5 prompt, target one phase at a time (start with Phase 0), or produce a master prompt that explicitly instructs stopping to verify between phases.
