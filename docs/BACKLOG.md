# ZotHub — Backlog

**The single log** of everything to implement, fix, remove, or decide. If another
document disagrees with this file, **this file wins**.

- **Last updated:** 2026-08-11
- **Replaces:** `docs/LAUNCH-BACKLOG.md`, plus the scattered "still open" sections in
  `00-handoff.md` §6, `implementation-audit.md`, `plan.md` (WS10–12), the design and
  strategy docs, and the untracked `[launch-blocking]` tags in `prd.md`. See
  [Where the old docs went](#where-the-old-docs-went).
- **Status:** ⬜ open · 🔄 in progress · ⏸️ deferred by decision · ✅ done
- **Impact** is the column that decides *do / defer / skip*:
  **UX** users feel it · **Security** exploitable · **Trust** credibility, privacy, legal ·
  **Reliability** silent failure later · **Housekeeping** nobody notices

---

## Now / next

1. ✅ **Phase 0 — verify the live site. COMPLETE.** All public-side checks, all six
   `verify_prod_state.sql` queries, and the `S2` admin audit are done. Results in the
   findings table below. **No security abuse; no wrongly-hidden clubs; `MB1` and `S2`
   closed.** One action fell out of it: `D1` is wider than thought (3 test clubs).
2. ✅ **Phase 1 — tracking consolidated.** This file is now the only tracker; superseded
   planning docs are archived; stale docs corrected.
3. ⏭️ **Phase 2 — UI/UX + pre-launch fix-up. THE NEXT PHASE.** Defects are logged in
   [Phase 2 — UI/UX defect log](#phase-2--uiux-defect-log) (`UX1`–`UX17`) and **not yet
   implemented**. Read [`HANDOFF.md`](./HANDOFF.md) before starting.
4. Everything else waits and is logged below. Nothing has been dropped.

---

## Phase 0 findings — live production state (2026-08-11)

Read-only, from the anonymous (public) side — i.e. **exactly what a visitor sees**.

| Finding | Detail |
|---|---|
| ✅ **Seed healthy** | 725 clubs publicly visible: 724 with a `source` + 1 organic. ⚠️ **Two of the 724 are test rows** (the "Crewmate" clubs below), so the real ZotSpot population is likely **722**. |
| 🔴 **Every club shows grey initials** | **725 of 725** have `logo_url IS NULL` — no club in the directory has a logo. Of those, 589 can be re-hosted and 136 cannot. Most visible quality problem on the site. → `MB5-logo` |
| 🔴 **Test Club is live and public** | "Test Club" owns 5 junk opportunities — `opp 1`, `opp 2`, `opp 3`, `opp 3`, `opp 5` (two share the title `opp 3`, which is what the old "duplicate applications" report actually was). These are the **only** opportunities on the entire site. → `D1` |
| ⚪ **No events visible** | Zero active/public events, though Test Club holds **6** event rows (inactive or past) that the purge must account for. |
| ⚪ **No claims yet** | Zero clubs have `claimed_at` set. |
| ✅ **Backfill was a no-op — nothing wrongly hidden** | Q1 returned **0 rows**; Q2 confirms `hidden_organic = 0`, `hidden_seeded = 0`, `published_total = all_clubs = 725`. No club was hidden by migration `…000400`. **Concern closed.** |
| ✅ **MB1 constraint survived** | Q3: `applications_opportunity_id_student_id_key UNIQUE (opportunity_id, student_id)` **and** `rsvps_event_id_student_id_key` both exist in prod. Duplicate applications are impossible. **`MB1` closed** — see the correction below. |
| 🔴 **Three test clubs live, not one** | Q5: **Test Club** (5 opportunities, **6 events**, 5 applications, 5 RSVPs attached) plus **"Test: Purple Crewmate"** and **"Test: Blue Crewmate"** (both empty). The two Crewmates are *not* counted as organic (Q2 shows only 1 published organic), so they sit **inside the 724 "seeded" figure** — i.e. the real ZotSpot count is likely **722**. → widens `D1` |
| ✅ **Cron inventory** | Q4: `send-reminders-hourly` (`0 * * * *`, active) and `archive-past-events-nightly` (`0 9 * * *`, active). Both live. → unblocks `R2`; also surfaced `S6` |
| ✅ **Logo split confirmed** | Q6: 725 clubs · **0** hosted logos · **589** re-hostable from `source_logo_url` · **136** with no source logo at all. → `MB5-logo` |
| ✅ **S2 admin audit clean** | Exactly **one** admin row: `zothub.uci@gmail.com` (`df22c590-…`), flagged `is_expected_admin = true`, holds no other role, granted `2026-07-09 04:05:56` — ~5 min after the account was created at `04:00:30`, consistent with founder setup. **No self-granted or rogue admins.** The privilege-escalation window was never exploited. |

> **Note on method:** a read-only remote schema dump was attempted and authenticated, but
> the CLI reported "Initialising login role…", which may create a role on the remote. Since
> access this round is strictly read-only, that path was abandoned in favour of SQL the
> maintainer runs. Nothing was written to production.

---

## Open items

### Launch blockers

| ID | Impact | Item |
|---|---|---|
| ⏸️ **D1** | UX · Trust | **Purge test data — DEFERRED BY DECISION to the final pre-launch step (2026-08-11).** Test Club is the only club with real data attached, so it is needed to verify `N1`–`N7`. Delete it **last**, immediately before launch. Targets: Test Club `57ea4a11-…` (5 opportunities, 6 events, 5 applications, 5 RSVPs) + `Test: Purple Crewmate` `d689c87c-…` + `Test: Blue Crewmate` `56d45091-…` (both empty, both carry a non-null `source` so they sit inside the 724 seeded count → real total ~722). Runbook ready: **`scripts/purge_test_data.sql`** (review steps, transactional delete with rollback guard, auth cleanup, post-state check). Back up before STEP 3. **See `D1a` for the interim.** |
| ⬜ **D1a** | Trust | **Interim: hide the junk from the public site without deleting it.** Test Club's 5 opportunities (`opp 1/2/3/3/5`) are the **entire** public opportunity inventory of zothub.app today. Setting `is_active = false` on those 5 rows removes them from public discovery immediately (RLS is `USING (is_active = true)`), is a one-line reversible `UPDATE`, and **keeps the club and all its data intact for testing**. Its 6 events are already inactive. Do this if the site is reachable by anyone before launch; skip it if traffic is genuinely zero. |
| ⬜ **MB4** | UX · Trust | **Help / Support / Contact surface.** No `/help`, `/faq`, `/support`, `/contact` or `/report` route exists. `prd.md` tags launch-blocking. Compounding: the claim emails and the no-self-service-removal policy both route people "through Help/Contact" — a promise pointing nowhere. |
| ⬜ **MB6** | Trust | **Self-service account deletion.** Users cannot delete their own account. Privacy/compliance. From `prd.md:283-303`, previously untracked. |
| ⬜ **MB7** | Trust | **`/privacy` contact line** → `zothub.uci@gmail.com`. Tiny; ship with MB4. Previously untracked. |
| ✅ **MB1** | — | **CLOSED 2026-08-11 — was a false alarm.** The unique constraint exists in production (verified). The `implementation-audit.md:815` "two applications to opp 3" observation was a misreading: **Test Club has two *different* opportunities both titled `opp 3`** (see Phase 0 Q5 / the `opp 1/2/3/3/5` list), so one student applying to each looked like a duplicate. No work needed. |
| ⬜ **D2** | Reliability | **README is stale in three ways:** says signup needs manual admin approval (students auto-approve since S3); says "the 4 Edge Functions" (there are **6** — add `submit-club-claim`, `review-club-claim`); documents none of `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` / `CAPTCHA_DISABLED`. **A fresh deploy missing the Turnstile site key hard-blocks signup** — this nearly happened on 2026-07-27. |
| ⬜ **P1-license** | Trust | **Hero photo licensing** must be settled before public launch (`public/images/hero-campus.jpg`). |

### UI/UX (Phase 2 — being scoped)

| ID | Impact | Item |
|---|---|---|
| 🔄 **UX0** | UX | **Usability + consistency pass — the next phase.** Maintainer's defect list is logged in full below (`UX1`–`UX11`), plus siblings found by generalising each fault (`UX12`–`UX17`). **Goal: bring every page to the quality bar the landing page already meets.** See [Phase 2 — UI/UX defect log](#phase-2--uiux-defect-log). |
| ⬜ **MB5-logo** | UX | **Re-host club logos — split now confirmed.** 725 clubs, **0** with a hosted logo. **589 are re-hostable** from `source_logo_url`; **136 have no source logo** and will keep initials permanently (so design the initials fallback to look deliberate, not broken). Re-host into a storage bucket and set `logo_url`. Highest-visibility single fix on the site. |
| ⬜ **MB2** | UX | **Student avatars are read but never written.** Messaging and profiles display `avatar_url`; no upload surface exists, so it is permanently blank. Needs a bucket + RLS. |
| ⬜ **MB8** | UX | **Onboarding polish** — profile-completeness indicator, guided checklist, post-login return-to-context. From `prd.md`, previously untracked. |

### Security

| ID | Impact | Item |
|---|---|---|
| ✅ **S2** | — | **CLOSED 2026-08-11 — audit run, no abuse found.** One admin only (`zothub.uci@gmail.com`), expected, no secondary role, granted minutes after account creation. The self-grant loophole (closed by `S1`) was never used. Phase 0 security posture is now fully clear. |
| ⬜ **S5** | Security | **`send-reminders` emails are not HTML-escaped.** It interpolates club names, event/opportunity titles and `full_name` raw into `html` (lines 81-113, 181-206, 292-317, 388-414). 724 club names were **scraped from ZotSpot** — third-party text we never sanitised — and go out from the verified `zothub.app` domain. Fix = route through `send-email`, which already escapes. |
| ⬜ **S6** | Security | **A bearer token is stored in plaintext inside the cron job definition.** Q4 shows the `send-reminders-hourly` command embeds `'Authorization', 'Bearer eyJhbGciOi…'` directly in the SQL. Anyone who can read `cron.job` can read that token — and if it is the **service-role** key, that is full database authority sitting in a readable table. **Confirm which key it is**, then move to `vault`/a DB setting and rotate if it was the service role. Handle as part of `R2`, since that migration rewrites the job. |
| ⬜ **S4** | Security | **Unsalted SHA-256 password** held in `email_verifications.password_hash` during the ~10-minute OTP window (`send-otp/index.ts`). Transient, and the real credential lives in Supabase auth. Fix = salt + slow KDF, or stop storing it. |

### Reliability

| ID | Impact | Item |
|---|---|---|
| ⬜ **R1** | Reliability · UX | **`send-reminders` marks failed sends as delivered.** It only catches thrown exceptions, so a Resend `{ error }` response still writes the `reminder_logs` row — and the `unique_reminder` constraint then makes that reminder **permanently unsendable**. Students silently never get it. Fix = claim-before-send + `checkEmailResult` + release the claim on failure. |
| ⬜ **R2** | Reliability | **Reminder cron schedule is unversioned.** No `send-reminders` entry in `config.toml`, no `cron.schedule` in any migration — it exists only as prod state ("scheduled manually, out-of-repo", per `20260713000100…sql:5-18`). If lost, *all* reminder email stops silently. Pass 3 also hard-codes a 1-hour lookback, so any pause skips posts permanently rather than delaying them. Fix = commit the schedule. **Live job identified: `send-reminders-hourly`, schedule `0 * * * *`, active (jobid 1)** — the migration must `cron.unschedule('send-reminders-hourly')` before re-scheduling, or it will double-send. |
| ⬜ **MB3** | Reliability · UX | **Hard `.limit(50)` and client-side substring search** (`Opportunities.tsx:113`, `Events.tsx:104`, `Clubs.tsx`). Beyond 50 rows the rest are simply invisible. Fine at current volume. |

### Verification — code exists, never exercised with real data

Needs test accounts: a student with applications/RSVPs/saves/follows, an admin, a second
student (capacity tests), ≥1 club team member. **Several are blocked by D1.**

| ID | Item |
|---|---|
| ⬜ N1 | Populated club Team row — `TeamManagement.tsx`, `ClubDetail.tsx` (blocked by D1) |
| ⬜ N2 | Messages MEMBER chip — `useMessages.ts:108-119`, `ConversationList.tsx:75-77` (depends on N1) |
| ⬜ N3 | Student Messages + Activity with real apps/RSVPs/saves/follows |
| ⬜ N4 | Waitlist pending (+30s poll) and rejected-with-reason screens |
| ⬜ N5 | Admin dashboard — approve / reject-with-reason / delete, stats, search, filter |
| ⬜ N6 | Event at-capacity guard — 2nd student RSVPing a capacity-1 event |
| ⬜ N7 | Profile "still missing" nudge on a fresh/incomplete profile |
| ⬜ N8 | **Decision, not a check** — RSVP emails preference-gated or not? `prd.md:134` contradicts `prd.md:139`. |

### Research — unvalidated assumptions

| ID | Impact | Item |
|---|---|---|
| ⬜ **RS1** | UX | **Club recruiting walkthrough + artifacts.** Never obtained. Blocks confident design of the review pipeline and the application-review screen — currently built on assumption. Source: `docs/strategy/02-research.md` §4. |
| ⬜ **RS2** | UX | **Student interviews / assumption A5** — do students already discover clubs via ZotSpot? Decides the student-side headline ("finally, one place" vs "the same clubs, without the friction"), i.e. the landing page. Interview guide is written and ready to run. Source: `docs/strategy/02-research.md` §3. |

### Polish / housekeeping — nobody notices these

| ID | Impact | Item |
|---|---|---|
| ⬜ **P1** | UX | Hero → WebP/AVIF (LCP element, ~233 KB). Blocked on `cwebp`/`avifenc`. Separate from `P1-license`. |
| ⬜ **DP3** | Housekeeping | Delete dead asset `src/assets/hero-bg.jpg` (172 KB, zero importers) |
| ⬜ **DP4** | Housekeeping | Delete dead code: `dashboard/DashboardLayout.tsx`, `NavLink.tsx`, `pages/Index.tsx` |
| ⬜ **DP5** | Housekeeping | Drop `@deprecated` aliases with no consumers — `src/types/index.ts:23,26,38,41` |
| ⬜ **H1** | Housekeeping | Dead `club_followers` table — declared in `types.ts:114`, never queried (following uses `bookmarks`) |
| ⬜ **H2** | Housekeeping | Lovable decommission — 8 unchecked boxes, `plan.md:411-428`. No longer serves traffic. |
| ⏸️ **DP6** | — | `verify-otp` writes a club_name placeholder (`email.split("@")[0]`). Deferred by decision. |
| ⏸️ **DP7** | — | RSVP-journey realtime enhancement. Deferred. |
| ⏸️ **DP8** | — | Accent-coloured sent message bubbles — cosmetic, "toneable on request". Deferred. |
| ⏸️ **DP9** | — | Maintainer's pending UI tweaks + design-archive housekeeping. Likely absorbed by UX0. |

---

---

## Phase 2 — UI/UX defect log

**Status: LOGGED, NOT IMPLEMENTED.** Captured 2026-08-11 from the maintainer's review pass,
each item verified in code with a root cause, then generalised to find the same fault
elsewhere. **Nothing here has been changed yet.**

The organising goal: **the landing page is the quality bar.** Every other page should match
it for polish, consistency and honesty. Most items below are not isolated bugs — they are
one inconsistency repeated across pages, which is why they are grouped by root cause.

### Reported — bugs

| ID | Impact | Item, root cause, and scope |
|---|---|---|
| ⬜ **UX1** | UX | **Navigation feels like the old page never left.** Clicking a link keeps the current shell mounted while the new page's components and data stream in, so it reads as slow. **Root cause:** every page hand-rolls `useEffect` + `useState` + its own `isLoading` skeleton; there is no route-level data gate. Wanted: navigate → resolve → show the finished page. **Scope: 17 pages** (`ClubDetail`, `Clubs`, `Events`, `Opportunities`, `EventDetail`, `OpportunityDetail`, `StudentDashboard`, `StudentProfile`, `club/ClubHome`, `Landing`, …). See also `UX15`, `UX14`. |
| ⬜ **UX2** | UX | **Events is unreachable from Discover.** The navbar has a single "Discover" item → `/opportunities`, whose `match` *also* highlights on `/events` — so Events looks like part of Discover but there is no link to it (`Navbar.tsx:12`). Only routes in from the landing-page footer or a typed URL. There is **no `/discover` route at all**. Decide: a real `/discover` hub, or a segmented Roles/Events switcher inside the discovery surface. |
| ⬜ **UX3** | UX | **No back affordance on entry pages.** `Login.tsx` has none. **Generalised — also dead-ends:** `Waitlist.tsx` and `WaitlistRejected.tsx` have none either. (`Signup`, `ForgotPassword`, `ResetPassword`, `Privacy`, `Unsubscribe`, `NotFound` already do.) Add a consistent top-left back control. |
| ⬜ **UX4** | Trust | **Unreachable email published.** `Privacy.tsx:145` advertises `privacy@zothub.app`, a mailbox that does not exist → change to `zothub.uci@gmail.com`. Audited the whole app: this is the **only** unreachable address (`notifications@zothub.app` is the legitimate Resend sending domain). Overlaps `MB7`. |
| ⬜ **UX5** | UX | **Remove the homepage live counts** ("x open roles · y upcoming events · z clubs") — `Landing.tsx:153-158` + the `useLiveCounts` hook at `:21-57`. Note the counts are currently *honest but unflattering*: 5 opportunities (all Test Club junk) and 0 events. Removing them also removes 3 queries from the landing critical path. |
| ⬜ **UX6** | UX | **Messages belongs in the top-right icon row**, between notifications and profile, for **both** roles. Today Messages is a tab in `TabBar` (`navConfig.ts:55,82`) and **notifications is not an icon at all** — it is a dropdown row inside `AccountMenu` (`AccountMenu.tsx:66`). So this is a small nav restructure: notifications + messages as sibling icons, profile menu third. |
| ⬜ **UX7** | UX | **Avatar initials flash the wrong initials on every navigation** (`mantrid@uci.edu` → "MA", then "DM" once loaded). **Root cause:** `useAccountIdentity` deliberately exposes `isLoading` and its own comment says prominent surfaces should skeleton — but `ClubTopNav.tsx:14` and `StudentTopNav.tsx:12` destructure only `{ displayName, subtitle, avatarUrl }` and **drop `isLoading`**, rendering the email-derived fallback. `club/ClubHome.tsx:97` *does* honour it — so the codebase is inconsistent. It repeats on every route because the state is component-local and the nav remounts per page. |
| ⬜ **UX8** | UX | **URLs are legacy and contradict their labels.** Nav says "Activity" but the URL is `/student/dashboard`; "Messages" is `/student/messages`. Needs one canonical scheme decision (e.g. `/activity`, `/messages`) with redirects from the old paths — note `/club/feed` and `/student/feed` already have redirect precedent (`App.tsx:109,221`). Audit every role-scoped path together, not one at a time. |

### Reported — design

| ID | Impact | Item, root cause, and scope |
|---|---|---|
| ⬜ **UX9** | UX | **"Bring your club to ZotHub" sends signed-in users to the wrong place.** `Landing.tsx:185` → `/signup?role=club`, and `Signup.tsx:57-63` bounces any authenticated user to `/club/dashboard` (Responses) or `/student/dashboard` (Activity). Wanted: signed-in → clubs view; signed-out → signup. |
| ⬜ **UX10** | UX | **"Explore clubs" has the same fault.** `Landing.tsx:201` → `/signup?role=student`, same bounce. Wanted: **always** → the clubs page, regardless of auth state. |
| ⬜ **UX11** | UX | **Unify the list-page toolbar.** Clubs / Events / Opportunities should each present **search · filter · sort · card-list toggle on one line**, in the same order, with **filter as a collapsible multi-select** like sort — instead of today's chip row spilling below. Shared pieces already exist to build on (`components/discover/`: `FilterChip`, `ViewToggle`, `DiscoverList`, `EmptyState`) but there is **no shared toolbar component**, which is why the three drifted. |

### Found by generalising the above

| ID | Impact | Item |
|---|---|---|
| ⬜ **UX12** | UX | **Another mislabelled CTA:** `Landing.tsx:149` renders a button reading **"Browse clubs"** that links to **`/opportunities`**. Same class as `UX9`/`UX10`. Sweep every CTA label against its target. |
| ⬜ **UX13** | UX | **Toolbar feature gaps, measured:** Opportunities has search+sort+view+filter; **Events has no sort at all**; **Clubs has no card/list toggle**. Fixing `UX11` must close these, not just restyle. |
| ⬜ **UX14** | UX | **No scroll restoration.** Nothing in `src/` resets scroll on route change, so navigating from halfway down a list lands you halfway down the next page — a direct contributor to the "page never changed" feeling in `UX1`. |
| ⬜ **UX15** | Reliability · UX | **TanStack Query is installed and wired but completely unused — 0 `useQuery`/`useMutation` calls in `src/`.** `App.tsx` creates a `QueryClient` and wraps the tree (`:54,64`), then every page refetches by hand with no cache, no dedupe, no shared loading state. This is the architectural root cause behind `UX1` and `UX7`. Decide: adopt it properly, or drop the dependency — but stop paying for both. |
| ⬜ **UX16** | UX | **Landing-page copy/behaviour is the reference; other pages have not been re-checked against it** since the redesign. Phase 2 should walk both journeys (student: signup → discover → apply → messages; club: signup → post → review → team) in **light and dark** and at **mobile widths**, and file what it finds here. Overlaps the never-exercised screens `N1`–`N7`. |
| ⬜ **UX17** | UX | **Empty states will read as broken, not empty.** ⚠️ **Design against the post-purge reality, not today's screen.** `D1` is deferred to the final pre-launch step, so the site *currently* shows 5 junk opportunities — but on launch day, once they are removed, discovery is **0 opportunities and 0 events**. The empty state is therefore the *default* launch experience and must be deliberate. Do **not** wait for `D1` to design it. Interacts with `UX5`. |

---

## Decisions needed (no work until answered)

| # | Question |
|---|---|
| 1 | **N8** — should RSVP confirmation emails respect notification preferences? The PRD contradicts itself. |
| 2 | **MB9** — RSVP confirmation-email consistency, tagged `[launch-blocking, small]` in `prd.md` but never specified. Same area as N8; resolve together. |
| 3 | **MB6** — how far does account deletion go: soft-delete, hard-delete, or export-then-delete? |
| 4 | `/admin` review cadence during club outreach (from the superseded 10-day plan, never settled). |
| 5 | **MB2** — storage bucket policy for student avatars (Bucket B decision was deferred). |

---

## Done

**Shipped to production**
- **MB5 seed** — 724 ZotSpot clubs seeded, published, with unclaimed-profile treatment.
- **MB5 claim flow** — logged-out-only admin-reviewed claiming; edge functions
  `submit-club-claim` / `review-club-claim`; `/admin` claims panel; migrations
  `20260727000200`/`00300`/`00400`/`00500`; Turnstile live both sides. Deployed 2026-07-27.
  Design: `docs/design/mb5-claim-flow.md`. Tests: `tests/e2e` (**115/115**).
- **Signup/email hardening** — DB `@uci.edu` gate kept authoritative with one-time
  authorizations; `email_verifications` RLS locked down; `send-email` strict allowlist +
  service-role / authoritative-derive tiers + HTML escaping; one shared delivery check
  (HTTP 200 + `{error}` = failure); atomic email-keyed rate limits; pending clubs
  `published=false` until admin approval.
- **S1** `user_roles` self-insert privilege escalation — migration applied to prod.
- **S3** Day-0 auth, students auto-approved — `verify-otp` deployed (v3 ACTIVE).
- **DP1** favicon / og:image / apple-touch / manifest / theme-color.
- **DP2** outlined-glyph brand SVGs + in-app wordmark aligned to spec.
- **N9** prod apply/deploy state — resolved.

**Verified closed — do not re-plan**
- Broken routes (`/reset-password`, `/student/messages?to=`, NotificationCard target).
- `normalizeOpportunityType()` coercion removed; Clubs category filter data-derived;
  `reviewed` status settable; chart colours tokenised.
- Accessibility sweep — labelled controls, 44px targets, AA contrast. No open a11y items.
- Route-level code splitting; recharts out of the eager bundle.

---

## Where the old docs went

| Doc | Status |
|---|---|
| `docs/LAUNCH-BACKLOG.md` | **Replaced by this file.** |
| `docs/archive/00-handoff.md`, `docs/archive/implementation-audit.md` | Archived — were self-marked superseded. Open items extracted here. |
| `docs/archive/notes-superseded-10-day-plan.md` | Archived. **Still holds the Test Club purge runbook for D1** (`:100-108`). |
| `plan.md` | Kept as engineering history. WS10–12 and the Lovable checklist are tracked here (`H2`, `MB4`, `MB8`). |
| `prd.md` | Kept — product definition, not a tracker. Its untracked `[launch-blocking]` tags are now `MB6`–`MB9`. |
| `docs/design/*`, `docs/strategy/*` | Kept as reference. Their "Open / Still open" sections point here. |
| `docs/design/mb5-claim-flow.md` | Kept — as-built design record. §11 rollout is **done**. |
