# ZotHub — Backlog

**The single log** of everything to implement, fix, remove, or decide. If another
document disagrees with this file, **this file wins**.

- **Last updated:** 2026-08-23 — maintainer decisions recorded; see [Decisions made](#decisions-made).
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
3. 🔄 **Phase 2 — UI/UX + pre-launch fix-up. IN PROGRESS.** Defects are logged in
   [Phase 2 — UI/UX defect log](#phase-2--uiux-defect-log) (`UX1`–`UX17`). Read
   [`HANDOFF.md`](./HANDOFF.md) before starting. **Scope decision 2026-08-23: everything —
   no date pressure, the app is finished before launch strategy is planned.**
4. **Order is fixed by dependency, not by size:** `UX15` (adopt TanStack Query) lands
   **first**, because every per-page `UX*` fix touches the same data-fetching code and would
   otherwise be written twice. Then the nav restructure (`UX2`+`UX6`), then the shared
   toolbar (`UX11`/`UX13`), then per-page polish.
5. Everything else waits and is logged below. Nothing has been dropped.

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

### Audit findings — 2026-08-23 (untracked until now)

A 7-way code audit of every claim in this file. **These items were in no document.** Verdicts
were cross-checked between auditors and the contested ones re-verified by hand; `file:line`
references are to HEAD `f82866f`.

| ID | Impact | Item |
|---|---|---|
| ⬜ **A1** | **Security · Trust · UX** | 🔴 **"Sign in with UCI Google" is broken and fails silently — the worst defect on the site.** `AuthContext.tsx:144-163` inserts the new user's `student_profiles` / `club_profiles` row, but the INSERT policies require `has_role(auth.uid(),'student'|'club')` (`20251223013805:73`, `:108`) and the same function deliberately leaves the user role-less (`:175` "Don't set role since they're on waitlist"). **The insert is rejected by RLS and the result is never destructured, so nothing surfaces.** Net: a Google signup gets a `waitlist` row and *no profile*. Compounding: it hard-codes `status: "pending"` (`:135`), so a **student** who signs up with Google is queued for a manual approval that OTP students have not needed since `S3`. One of the two visible signup paths strands the user. **Verified by hand, not just by audit.** **DECIDED 2026-08-23: fix properly now** — server-side profile creation + student auto-approval + check the result. Do not loosen the RLS policies; they are correct. |
| ⬜ **S7** | **Security** | 🔴 **Any anon-key holder can permanently mute any user's reminder emails.** `reminder_logs` INSERT is `WITH CHECK (true)` with no `TO` clause and was never revoked (`20260121001924:37-40`). Combined with the `unique_reminder` constraint (`:30`) and the pre-send dedup, forging a log row makes that reminder **unsendable forever**. Weaponises `R1`. **Note the cron stays ON by decision 2026-08-23**, so `S7` and `R1` are the pair that must land before the first real user is onboarded. |
| ⬜ **S8** | **Security · Trust** | 🔴 **Any authenticated user can forge an in-app notification for anyone**, with arbitrary title and body — `notifications` INSERT is the same open shape (`20251223160240:176-178`). Load-bearing by design: the browser inserts directly (`eventNotifications.ts:39-45`) and a migration depends on it (`20260710000100:12-13`), so the fix needs an RPC/trigger **before** the policy narrows. |
| ⬜ **S9** | **Security** | 🔴 **The `club-assets` bucket is free public file hosting for anyone with an `@uci.edu` account.** Created `public=true` with no mime allowlist, no size limit, and an INSERT policy with no role check (`20251223165608:2-15`), plus unconditional public SELECT (`:31-33`). The client-side `accept` / `maxSizeMB` guards are trivially bypassed. Runs on the project's quota. |
| ⬜ **S10** | **Reliability · UX** | 🔴 **A green build is not a shippable build.** `npm run build` **succeeds with `VITE_TURNSTILE_SITE_KEY` absent** — and `.env.example` never mentions the variable. Per `CLAUDE.md` that artifact renders a visible error and **blocks signup and club claims**. So the documented failure mode is not just possible, it is the *default* for a fresh deploy, and nothing catches it. Fix = assert the var in the build and add it to `.env.example`. |
| ⬜ **T1** | **Reliability** | 🔴 **There is no CI at all** — no `.github/`, no hooks — while Vercel auto-deploys every push to `main`. Nothing prevents shipping a red build to production. `playwright.config.ts:17-18` and `tests/e2e/run.sh:27` already branch on `process.env.CI`, so the suite was written expecting a CI that was never built. |
| ⬜ **T2** | **Reliability · Trust** | 🔴 **The E2E suite reports `ALL GREEN` while skipping 24 of its 115 assertions**, and exits 0 — so "115/115" in `CLAUDE.md` and `HANDOFF.md:145` is unverified. Without a Docker daemon it runs 91; the skipped set includes transactional approval rollback and fail-closed rate limiting. `run.sh:18` hardcodes a macOS Docker path, so it has demonstrably never run elsewhere. **Also a production footgun:** no hostname guard, and `claim-and-signup.e2e.mjs:468` renames `rate_limit_hit` — a maintainer following `tests/e2e/README.md:27-31` with prod keys exported would write heavily to production and leave that rename in place if the run died mid-way. |
| ⬜ **UX18** | **Trust · UX** | 🔴 **"Reject All" and single accept/reject fire instantly on named students with no confirmation and no undo** — zero `AlertDialog` / `confirm(` anywhere in `ApplicationReview.tsx` — and the rejection email is already sent. One misclick permanently rejects a queue of real people. Logged in `prd.md:173` and rated severity 4 in research; **the tracker dropped it.** |
| ⬜ **D3** | **Trust** | 🔴 **The live privacy policy promises a data export that does not exist.** `Privacy.tsx:114`: "you can view and export your personal data from your profile settings". There is no export anywhere in the app. With `MB6` deferred, `Privacy.tsx:116` also routes deletion requests to the unreachable address in `UX4`. **DECIDED 2026-08-23: delete the sentence outright** — no reword, no export build. |
| ⬜ **UX19** | **UX** | **A signed-in club has no way to reach any discovery page.** `CLUB_NAV` (`navConfig.ts:63-101`) contains no `/clubs`, `/opportunities` or `/events` destination — clubs cannot see the directory they are listed in. Also `navConfig.ts:59,86` match a `/messages` prefix that **has no route**. Fold into the `UX2`+`UX6` nav work. |
| ⬜ **E1** | **Reliability** | **Three more email paths bypass the shared delivery checker** — `CLAUDE.md` says `send-reminders` is "the one". It is the only path bypassing `send-email`, but `checkEmailResult` is also skipped by `verify-otp/index.ts:271-287` (never reads the response), `eventNotifications.ts:70-82` (returns `success: true` on a 200 carrying `{error}` — while the *same file* uses the checker correctly at `:25`; callers `RSVPReview.tsx:231,290`), and `AuthContext.tsx:168-173` (discards the result). Correct the `CLAUDE.md` wording too. |
| ⬜ **H3** | **Security · Housekeeping** | **17 npm vulnerabilities (6 moderate, 11 high)** reported by `npm ci`, never audited or tracked. |
| ⬜ **DP10** | **Housekeeping · Reliability** | **Migration `20251223165608` is not idempotent** — bare `INSERT INTO storage.buckets` and nine bare `CREATE POLICY` — so `README.md:85`'s "run the migrations" instruction **fails** on any project that already has the buckets. |
| ⬜ **D4** | **Reliability · Trust** | **`README.md` advertises features that do not exist.** `:41` and `:155-159` describe "efficient server state caching with TanStack Query", "optimistic UI updates" and "automatic data refetching and invalidation" — there are **zero** `useQuery`/`useMutation` calls in `src/` (`UX15`). This is the single most misleading passage for a new contributor and it was **not** part of `D2`. Also `prd.md:136` still says "Four Edge Functions" (there are six — `f82866f` fixed the README and missed the identical error in the PRD), `README.md:176`/`:20` and `prd.md:230` list the dead `club_followers` table (`H1`), and `prd.md:306-309` says "the **four** launch-blocking items" then names five with six in the catalog. |
| ⬜ **P2** | **UX** | **`ClubAnalytics` is a 422 kB / 114 kB-gzip chunk**, the largest asset by 2.5×. Confirm it is genuinely lazy-loaded before launch traffic. |

---

### Launch blockers

| ID | Impact | Item |
|---|---|---|
| ⏸️ **D1** | UX · Trust | **Purge test data — DEFERRED BY DECISION to the final pre-launch step (2026-08-11).** Test Club is the only club with real data attached, so it is needed to verify `N1`–`N7`. Delete it **last**, immediately before launch. Targets: Test Club `57ea4a11-…` (5 opportunities, 6 events, 5 applications, 5 RSVPs) + `Test: Purple Crewmate` `d689c87c-…` + `Test: Blue Crewmate` `56d45091-…` (both empty, both carry a non-null `source` so they sit inside the 724 seeded count → real total ~722). Runbook ready: **`scripts/purge_test_data.sql`** (review steps, transactional delete with rollback guard, auth cleanup, post-state check). Back up before STEP 3. **See `D1a` for the interim.** |
| ⏸️ **D1a** | Trust | **NOT NEEDED — deferred by decision 2026-08-23.** The maintainer confirmed **nobody has the link**, so there is no public audience to protect from the junk data, and Test Club is needed intact for `N1`–`N7`. Re-open this the moment anyone outside the team gets the URL before `D1` runs. Original plan: hide the junk from the public site without deleting it. Test Club's 5 opportunities (`opp 1/2/3/3/5`) are the **entire** public opportunity inventory of zothub.app today. Setting `is_active = false` on those 5 rows removes them from public discovery immediately (RLS is `USING (is_active = true)`), is a one-line reversible `UPDATE`, and **keeps the club and all its data intact for testing**. Its 6 events are already inactive. Do this if the site is reachable by anyone before launch; skip it if traffic is genuinely zero. |
| ⬜ **MB4** | UX · Trust | **Help / Support / Contact surface.** No `/help`, `/faq`, `/support`, `/contact` or `/report` route exists. `prd.md` tags launch-blocking. Compounding: the claim emails and the no-self-service-removal policy both route people "through Help/Contact" — a promise pointing nowhere, and with `MB6` now post-launch the privacy policy's manual-deletion route lands there too. **SCOPE DECIDED 2026-08-23: one static `/help` page** — FAQ (students / clubs / accounts & privacy) + Contact block + "Report a problem" mailto. No ticket table, no new email path. |
| ⏸️ **MB6** | Trust | **POST-LAUNCH by decision 2026-08-23.** Self-service account deletion — users cannot delete their own account. Not a launch blocker. **Consequence: `/privacy` must keep stating deletion is a manual request to the support address, which makes `MB7`/`UX4` (a support address that actually receives mail) more important, not less.** From `prd.md:283-303`. |
| ⬜ **MB7** | Trust | **`/privacy` contact line** → `zothub.uci@gmail.com`. Tiny; ship with MB4. Previously untracked. |
| ✅ **MB1** | — | **CLOSED 2026-08-11 — was a false alarm.** The unique constraint exists in production (verified). The `implementation-audit.md:815` "two applications to opp 3" observation was a misreading: **Test Club has two *different* opportunities both titled `opp 3`** (see Phase 0 Q5 / the `opp 1/2/3/3/5` list), so one student applying to each looked like a duplicate. No work needed. |
| ✅ **D2** | — | **CLOSED 2026-08-23 — already fixed by commit `f82866f`, the same commit that wrote this item.** Verified: `README.md:87` says "the 6 Edge Functions", `:96` states student auto-approval, and the Turnstile vars are documented at `:91`, `:228`, `:235`, `:237`. **But a different README lie was found and is NOT closed — see `D4`.** Original text: **README was stale in three ways:** says signup needs manual admin approval (students auto-approve since S3); says "the 4 Edge Functions" (there are **6** — add `submit-club-claim`, `review-club-claim`); documents none of `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` / `CAPTCHA_DISABLED`. **A fresh deploy missing the Turnstile site key hard-blocks signup** — this nearly happened on 2026-07-27. |
| ✅ **P1-license** | — | **CLOSED 2026-08-23 — the maintainer took the photo and owns it.** `public/images/hero-campus.jpg` requires no licence work and no replacement. (`P1`, the WebP/AVIF conversion, is a separate open item.) |

### UI/UX (Phase 2 — being scoped)

| ID | Impact | Item |
|---|---|---|
| 🔄 **UX0** | UX | **Usability + consistency pass — the next phase.** Maintainer's defect list is logged in full below (`UX1`–`UX11`), plus siblings found by generalising each fault (`UX12`–`UX17`). **Goal: bring every page to the quality bar the landing page already meets.** See [Phase 2 — UI/UX defect log](#phase-2--uiux-defect-log). |
| ⬜ **MB5-logo** | UX | **Re-host club logos — split now confirmed.** 725 clubs, **0** with a hosted logo. **589 are re-hostable** from `source_logo_url`; **136 have no source logo** and will keep initials permanently (so design the initials fallback to look deliberate, not broken). Re-host into a storage bucket and set `logo_url`. Highest-visibility single fix on the site. **APPROVED 2026-08-23** — see [Decisions made](#decisions-made). ⚠️ **Rescoped: club logo upload already ships** (`ClubProfileSetup.tsx:271-282`). The two real gaps are (a) the bulk re-host script, never written — `seed_clubs.mjs:65` explicitly defers it — and (b) **a service-role write path for seeded clubs, whose `user_id` is NULL** (`20260727000100:29`), so the existing `auth.uid() = foldername[1]` storage policies cannot authorise the write. Fix (b) before writing the script. Also depends on `S9` (the bucket has no mime/size limits). |
| ⬜ **MB2** | UX | **Student avatars are read but never written.** ⚠️ **Rescoped 2026-08-23: "needs a bucket + RLS" is false** — buckets and 9 RLS policies already ship (`20251223165608:2-77`) and a working uploader exists (`src/components/ui/file-upload.tsx`). What is actually missing: an avatar field on the edit form, one line in the upsert at `StudentProfileEdit.tsx:137`, and the deferred public-vs-private bucket decision. Note `A1` means OAuth users have no profile row at all, so avatars are doubly blank for them. |
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
| ⬜ **MB3** | Reliability · UX | **Hard `.limit(50)` and client-side substring search.** ⚠️ **Corrected 2026-08-23 — this item had the facts backwards.** Real limits are at `Opportunities.tsx:113`, `Events.tsx:104`, and an unlogged fourth at `useNotifications.ts:47`. **`Clubs.tsx:38` has NO limit** — it calls `rpc("get_all_clubs_public")` unbounded, pulling **~725 rows on every visit** and re-filtering them on every keystroke with no debounce; `Landing.tsx` calls the same RPC just to read `.length` on the LCP page. So "fine at current volume" is inverted: the *capped* pages hold ~5 rows, the *uncapped* one holds 725. Also: PostgREST `max-rows` is a dashboard setting with no in-repo override, so the Clubs companion count queries may already be silently truncating. |

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
| ⬜ **UX1** | UX | **Navigation feels like the old page never left.** Clicking a link keeps the current shell mounted while the new page's components and data stream in, so it reads as slow. **Root cause:** every page hand-rolls `useEffect` + `useState` + its own `isLoading` skeleton; there is no route-level data gate. Wanted: navigate → resolve → show the finished page. **Scope: 21 of 31 page files** (corrected 2026-08-23 from "17"). ⚠️ **The proximate cause was also missing from every doc:** `App.tsx:77` sets `future={{ v7_startTransition: true }}`, which keeps the *outgoing* page painted and bypasses `RouteFallback` — that flag is the switch most directly controlling the symptom. `Landing.tsx:21-38` has no loading gate at all. See also `UX15`, `UX14`. |
| ⬜ **UX2** | UX | **Events is unreachable from Discover.** The navbar has a single "Discover" item → `/opportunities`, whose `match` *also* highlights on `/events` — so Events looks like part of Discover but there is no link to it (`Navbar.tsx:12`). Only routes in from the landing-page footer or a typed URL. There is **no `/discover` route at all**. **DECIDED 2026-08-23: neither — Opportunities and Events become two separate top-level nav items.** No `/discover` hub, no segmented switcher. Implement together with `UX6`, which frees the slot. |
| ⬜ **UX3** | UX | **No back affordance on entry pages.** `Login.tsx` has none. **Generalised — also dead-ends:** `Waitlist.tsx` and `WaitlistRejected.tsx` have none either. ⚠️ **Corrected 2026-08-23: `Signup` does NOT already have one.** `Signup.tsx:329-335` is an in-page `setStep("role")` button; the `step==="role"` first screen (`:253-306`) has no back control at all. Also `Waitlist`/`WaitlistRejected` have no exit except **Sign Out**, which destroys the session. (`ForgotPassword`, `ResetPassword`, `Privacy`, `Unsubscribe`, `NotFound` do have one.) Add a consistent top-left back control. |
| ⬜ **UX4** | Trust | **Unreachable email published.** `Privacy.tsx:145` advertises `privacy@zothub.app`, a mailbox that does not exist → change to `zothub.uci@gmail.com`. Audited the whole app: this is the **only** unreachable address (`notifications@zothub.app` is the legitimate Resend sending domain). Overlaps `MB7`. |
| ⬜ **UX5** | UX | **Remove the homepage live counts** ("x open roles · y upcoming events · z clubs") — `Landing.tsx:153-158` + the `useLiveCounts` hook at `:21-57`. Note the counts are currently *honest but unflattering*: 5 opportunities (all Test Club junk) and 0 events. Removing them also removes 3 queries from the landing critical path. |
| ⬜ **UX6** | UX | **Messages belongs in the top-right icon row**, between notifications and profile, for **both** roles. Today Messages is a tab in `TabBar` (`navConfig.ts:55,82`). ⚠️ **Corrected 2026-08-23: "notifications is not an icon at all" is WRONG.** `TopNav.tsx:78-99` already renders a bell with an unread dot and a counted `aria-label` — *in addition to* the `AccountMenu.tsx:65-70` dropdown row. So the real work is **de-duplicating** the two notification entry points and moving Messages in beside the bell, not building an icon from scratch. (`design-system.md:118` is the accurate doc here; this item was the wrong one.) So this is a small nav restructure: notifications + messages as sibling icons, profile menu third. **DECIDED 2026-08-23 — confirmed, and paired with `UX2`:** Messages leaving the nav row is exactly what frees the slot Events needs, so the row becomes **Opportunities · Events · Clubs · Activity** and the design system's four-destinations rule still holds. Icon order, left→right: notifications, messages, profile initials. |
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
| ⬜ **UX15** | Reliability · UX | **TanStack Query is installed and wired but completely unused — 0 `useQuery`/`useMutation` calls in `src/`.** `App.tsx` creates a `QueryClient` and wraps the tree (`:54,64`), then every page refetches by hand with no cache, no dedupe, no shared loading state. This is the architectural root cause behind `UX1` and `UX7`. **DECIDED 2026-08-23: adopt it properly, across all pages.** ⚠️ **Critical implementation note:** `App.tsx:54` is a bare `new QueryClient()`. Adopting TanStack Query **without setting `defaultOptions.staleTime` inherits v5's `staleTime: 0` and will NOT fix the symptom** — pages will still refetch on every mount. That one line is step zero. Partial adoption was explicitly rejected — an inconsistent codebase is what produced this defect log. **This lands first**, before any per-page `UX*` work, so pages are not rewritten twice. |
| ⬜ **UX16** | UX | **Landing-page copy/behaviour is the reference; other pages have not been re-checked against it** since the redesign. Phase 2 should walk both journeys (student: signup → discover → apply → messages; club: signup → post → review → team) in **light and dark** and at **mobile widths**, and file what it finds here. Overlaps the never-exercised screens `N1`–`N7`. |
| ⬜ **UX17** | UX | ⚠️ **Rescoped 2026-08-23 — the original framing was wrong.** `EmptyState` *is* used consistently with branch-aware copy on all three pages (`Clubs.tsx:229-256`, `Events.tsx:286-327`, `Opportunities.tsx:354-395`), so "undesigned empty states" is false. The three real defects are: **17a — the zero-states make false claims and form a loop** (`Opportunities.tsx:367` promises events; its CTA at `:391` goes to `/clubs`; "roles are open though" links to an empty page). **17b — `Clubs.tsx:231-236` breaks the design system's no-stage-copy rule three times.** **17c — NO page has an error state at all:** a failed fetch renders byte-identically to an empty result, because the `catch` blocks only `console.error` (`Clubs.tsx:40-44`, `Events.tsx:106-110`, `Opportunities.tsx:115-119`). **A broken database will look exactly like an empty one on launch day.** Original framing: **Empty states will read as broken, not empty.** ⚠️ **Design against the post-purge reality, not today's screen.** `D1` is deferred to the final pre-launch step, so the site *currently* shows 5 junk opportunities — but on launch day, once they are removed, discovery is **0 opportunities and 0 events**. The empty state is therefore the *default* launch experience and must be deliberate. Do **not** wait for `D1` to design it. Interacts with `UX5`. |

---

> ⚠️ **Doc corrections still owed after the 2026-08-23 audit** (per `CLAUDE.md` § Documentation
> discipline — "if two docs disagree, the backlog wins, then immediately correct the loser"):
> `HANDOFF.md` §1 still lists `MB6` as a launch blocker, §1/§2 still treat `D1a` as live, §3(a)
> still poses `UX15` as an open question, §6 still says "No `CLAUDE.md` exists" and "clean at
> `6c69a8d` plus unstaged changes", and §2/§5 still assert 115/115. `CLAUDE.md` still says
> `send-reminders` is "the one email path" that bypasses the checker (see `E1`) and repeats the
> 115/115 claim (see `T2`). `prd.md` still tags `MB6` launch-blocking (`:312`) and says four
> Edge Functions (`:136`). `docs/strategy/03-structure-decisions.md` §2/§3 and
> `design-system.md:118` still state the `/discover` hub and "Discover · Clubs · Activity ·
> Messages" as agreed — **and `StudentTopNav.tsx`/`ClubTopNav.tsx` docstrings cite that
> superseded doc**, which will point the next implementer at the wrong decision.
> `docs/strategy/02-research.md` §5 lists heuristic findings the redesign already closed and
> carries no ARCHIVED banner.

## Decisions made

Recorded as the maintainer answers them. **Write the answer and the date here before building
anything on it** (`CLAUDE.md` § Documentation discipline).

| Date | # | Decision | Consequence |
|---|---|---|---|
| 2026-08-23 | **Scope** | **Full quality bar before launch.** Everything logged here — `UX1`–`UX17`, all launch blockers, plus whatever a fresh audit turns up. No date pressure; the app is finished first, *then* launch strategy is planned. | Nothing in this file is skipped on scope grounds. New audit findings are added, not triaged away. |
| 2026-08-23 | **D1 / D1a** | **No public traffic today** — nobody has the link. `D1a` (hiding Test Club's 5 junk opportunities) is therefore **not needed**; test data stays for `N1`–`N7` verification. `D1` still runs as the final pre-launch step. | `D1a` → ⏸️ deferred, not open. Test Club retained deliberately. |
| 2026-08-23 | **MB5-logo** | **Approved: re-host the 589 club logos** from `source_logo_url` into our own storage bucket. Rationale accepted — these are the clubs' own logos, publicly posted on the university's own club directory, shown on a UCI student platform to represent that same club. The 136 with no source logo keep initials permanently, so the initials fallback must look deliberate. | Unblocks the highest-visibility fix on the site. Needs a bucket + a re-host script + a prod write (see the access question below). |
| 2026-08-23 | **UX15** | **Adopt TanStack Query properly across all pages** — do not drop it, do not do a partial adoption. Partial adoption was explicitly rejected as "the exact thing that created this mess the first time." | Largest single workstream. Root-cause fix for `UX1` (slow-feeling navigation) and `UX7` (avatar initials flash). Must land before per-page UX work so pages are not rewritten twice. |
| 2026-08-23 | **UX2 + UX6** | **Nav shape decided.** **Opportunities** and **Events** become two separate top-level nav items (no `/discover` hub, no segmented switcher). **Messages moves out of the nav row into the top-right icon row**, between the notifications icon and the profile-initials icon. | Resolves `UX2` (Events was unreachable) *and* `UX6` together, and keeps the design system's four-destinations rule intact: Messages vacating the row is exactly what frees the slot Events needs → **Opportunities · Events · Clubs · Activity**. `UX6` also requires promoting notifications from an `AccountMenu` row to a real icon. |
| 2026-08-23 | **Club nav names** | **`Postings · Applicants · My Club`** (3 items; Messages moves to the icon row). "Applicants" is kept deliberately: **an event RSVP is treated as applying to the event**, so the word covers both. The page carries **two sections** — applicants for opportunities, and applicants via event RSVPs. | Corrects an earlier bad suggestion: a separate club Events nav item was **rejected** as duplication — `navConfig.ts:64` shows `Postings` already matches both `/club/dashboard/opportunities` **and** `/club/dashboard/events`. `UX19` (clubs have no discovery destination at all) still needs solving inside this nav work. |
| 2026-08-23 | **Reminder emails** | **Leave the `send-reminders-hourly` cron ON.** Do not touch production to disable it; fix `S5` (escaping) and `R1` (failed sends recorded as delivered) soon. | Accepted risk, and it is currently theoretical: with 0 RSVPs and 0 followers there is nobody to remind and no club text to inject. **Must be fixed before any real club or student is onboarded** — after that the failure is permanent per-student (`unique_reminder` makes a mis-logged reminder unsendable forever). |
| 2026-08-23 | **D3 / privacy copy** | **Delete the data-export sentence outright** (`Privacy.tsx:114`) rather than rewording it or building an export. | Removes a promise the product cannot keep. `MB7`/`UX4` (a support address that actually receives mail) still ships, so the manual route survives. Revisit an export when `MB6` is built post-launch. |
| 2026-08-23 | **A1 / Google signup** | **Fix it properly now** — do not hide the button, do not drop Google signup. Create the profile server-side, auto-approve students the way OTP already does (`S3`), and stop discarding the insert result. | Highest-priority code change in the phase. Touches `AuthContext.tsx:144-175` and needs either a service-role edge function or a role-grant-before-insert ordering; the RLS policies at `20251223013805:73`/`:108` are correct and should NOT be loosened. |
| 2026-08-23 | **Prod access** | **Mode B: read-only database access for the agent; every write runs through the maintainer.** The agent may verify live state itself; it may not change a row, upload a file, or delete anything. Writes are prepared as a tested script/SQL the maintainer runs. | Removes most verification round-trips without putting a write credential in the agent's hands. `CLAUDE.md`'s "never write to production" stands unchanged. |
| 2026-08-23 | **P1-license** | **CLOSED — the maintainer took the hero photo and owns it.** | `public/images/hero-campus.jpg` needs no replacement. Record the ownership in the repo so this is never re-litigated. `P1` (WebP/AVIF conversion) is unaffected and still open. |
| 2026-08-23 | **MB4** | **One solid `/help` page**, no support backend: FAQ sections (students / clubs / accounts & privacy), a Contact block with `zothub.uci@gmail.com`, and a "Report a problem" link that opens a pre-filled email. An in-app ticket form was considered and rejected as more than a campus beta needs. | Closes every "go through Help/Contact" promise the app already makes (claim emails, the no-self-service-removal policy, and — now that `MB6` is post-launch — the privacy policy's manual-deletion route). No new table, no new email path, no spam surface. |
| 2026-08-23 | **UX8** | **Rename the routes** so addresses match their labels, with redirects from the old paths. Now is the cheapest moment — nothing is bookmarked or linked yet. **The specific names are a separate decision, being taken with the maintainer.** | Do not implement until the naming table below is filled in. |
| 2026-08-23 | **MB6** | **Account deletion is POST-LAUNCH.** Not a launch blocker. | `MB6` moves out of Launch blockers. `/privacy` must therefore keep stating that deletion is a manual request to the support address — and `MB7`/`UX4` (making that address reachable) becomes *more* important, not less. |

---

## Decisions needed (no work until answered)

| # | Question |
|---|---|
| 1 | **N8** — should RSVP confirmation emails respect notification preferences? The PRD contradicts itself. |
| 2 | **MB9** — RSVP confirmation-email consistency, tagged `[launch-blocking, small]` in `prd.md` but never specified. Same area as N8; resolve together. |
| ~~3~~ | ~~**MB6** — how far does account deletion go?~~ **ANSWERED 2026-08-23: moot for launch — deletion is post-launch.** Revisit when it is built. |
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
