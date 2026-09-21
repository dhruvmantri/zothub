# ZotHub — continuation brief

Cold-start brief for the next session. Read `CLAUDE.md` first (working agreement,
non-negotiables, git identity), then this, then `docs/BACKLOG.md` (the single
tracker — **if any doc disagrees with it, the backlog wins**).

## 1. State

`main` @ pushed, working tree clean, CI green. **Production is live** at
zothub.app (Vercel + self-owned Supabase) and every change below is deployed.
Nobody is visiting yet — that is why invasive changes are cheap right now.

```
1. Trust & legal        ✅ live
2. Security (S7/S8/S9)  ✅ live · S6 closed (cron token is the ANON key, no action)
3. CI gate              ✅ live & green
4. Speed (UX15)         ✅ COMPLETE — all five waves
5. Card counts (O5)     ✅ live & verified against production
6. Nav ✅ · URLs ✅ · toolbar ⬜ · CTAs ⬜ · empty states ⬜   ← HERE
7. Logos, avatars, onboarding polish
8. Verify N1–N7 with real accounts
9. S5/R1/R2 email hardening   ← BEFORE the first real user, not before launch
10. D1 purge test data        ← LAST, immediately before launch
```

**NEXT TASK, exactly:** **step 7 — logos, avatars, onboarding polish**
(`MB5`, 589 logos approved), then **step 8 — walk `N1`–`N7` with real
accounts** (the maintainer has club test credentials; ask for them, they are
never committed). Then **step 9, `S5`/`R1`/`R2` email hardening — due before
the first real user, not before launch**: `send-reminders` is the one email
path that bypasses `send-email`, it is unescaped, and it **marks failed sends
as delivered**, after which the database refuses to resend forever. Step 10,
`D1`, purges the test data and goes last.

**Launch-day reality, measured on production 2026-09-21 as an anonymous
visitor** — design against this, not against what the screen shows today:
**725 clubs** (~722 after `D1`), **4 test roles** (0 after it), and **0
publicly visible events, ever**. Both discovery lists are empty on day one
and the club directory is full.

**Also finished 2026-09-21: `A5`, an access guard that failed open.**
`ProtectedRoute`'s last check was `allowedRoles && role && !allowedRoles…`,
which is false when `role` is null — so an account with **no role** rendered
every protected page, including the club dashboard. Reproduced in a browser,
not inferred. Nothing leaked (RLS is the real gate; creating either profile
requires the matching role), but it was a guard doing nothing for a whole
class of account. The rule now, and it is worth keeping: **known states win,
an unknown is never guessed, entitlement is decided last.** A failed read is
its own screen with a retry — the `O6` principle extended from "no data" to
"no answer". Covered by `tests/browser/a5-role-guard.mjs`, half of whose
checks guard the *opposite* mistake: an approved user must still get in.

**Just finished (2026-09-21): the CTA sweep, `UX9` + `UX10` + `UX12`.**
Every link in `src/` was inventoried against its label and checked in all
three auth states. The home page's four big CTAs now land somewhere real for
everyone; two labels our own 2026-09-20 rename had left reading "Discover"
were corrected. Three findings were logged rather than fixed, as out of
scope: `DP12` (dead code carrying broken `?tab=` links), `A5` (a signed-in
user with **no role** passes every `ProtectedRoute` check and reaches a
student page — read from the guards, not reproduced), `A6` (Signup has no
waitlist branch where Login does).

**Just finished (2026-09-21): the shared toolbar, `UX11` + `UX13`.**
`DiscoverToolbar` is now the single composition behind Clubs, Opportunities and
Events — search · viewer-scope chips (Saved / Following) · a `Filter` menu ·
sort · card-list toggle. Add a control there, never to one page. Two structural
consequences worth knowing before touching these pages:

- **Both list sorts are now server-side and in the query key**
  (`opportunityKeys.listSorted`, `eventKeys.upcomingSorted`), because the
  queries cap at 50 rows and the ORDER therefore decides which 50 come back.
  The prefix keys (`list()`, `upcoming()`) still exist purely so existing
  invalidations reach every sort variant. Filtering stays client-side — it can
  only narrow rows already in hand.
- **Saved and Following are independent toggles**, not members of a
  single-select chip row, and the `All` chip is gone: the way out of a filter
  is the same control you came in by. Any test clicking `All` is stale.

## 2. Architectural decisions that constrain future work

- **Query keys are rooted on the TABLE, never the page** (`src/lib/queryKeys.ts`,
  dependency-free by design). A write is table-shaped, so invalidating a root
  must reach every cached read of it wherever rendered. Full contract:
  `docs/ux15-migration-contract.md` — **read it before touching any cached read.**
- **Detail pages carry the viewer in their key** (`authScope(user?.id)`), because
  `application_questions` / `rsvp_questions` are selected only when signed in.
  This is `UX21`; without it a student submits a BLANK application or RSVP.
- **Sign-in clears the cache** (`A4`, `AuthContext`), gated on the user id
  changing — not on the `SIGNED_IN` event, which supabase re-emits on tab focus.
- **Counts are trigger-maintained columns**, not embedded arrays: `applications_count`
  and `confirmed_rsvps_count`. The arrays are RLS-filtered, so the old counts were
  wrong for everyone but the owning club.
- **`anon` grants on `opportunities`/`events`/`club_profiles` are COLUMN-LEVEL.**
  Any new column must be `GRANT`ed to anon explicitly or it is invisible to
  logged-out visitors. RLS — not the privilege bits — is what blocks writes.
- **Nav config is data** (`components/nav/navConfig.ts`). An item with `children`
  renders as a menu (`NavMenu`), otherwise a link. Four destinations per role.
- **`useEventRSVP` owns every student-side write to `rsvps`.** `RSVPForm` is
  presentational and hands answers up. Never split a write from its invalidation.

## 3. Traps that have already bitten, in this repo

- **Nested paths and `startsWith`.** `"/postings/events".startsWith("/postings")`
  is true. Match most-specific-first (`ClubHome.getSection`, `ClubSectionNav`).
- **`<Navigate to="/x/:id">` navigates to the literal `:id`**, and drops the query
  string. Use `LegacyRedirect` in `App.tsx`.
- **`page.goto()` wipes an in-memory cache**, so it makes a caching test pass on
  broken code. Navigate by clicking or history. This produced two false passes.
- **Mock the REST responses.** A *failing* query is not cached and does retry, so
  a down database looks exactly like a broken cache.
- **A rename breaks its own tests.** A stale assertion reads like a regression.
- Full list: `tests/browser/README.md` and the contract's TRAPS section.

## 4. Verification

```bash
npx tsc -p tsconfig.app.json --noEmit     # 0 errors
npm run build                              # must succeed
npm run lint                               # 28 warnings is the baseline; 0 errors
node --experimental-strip-types --test src/lib/captchaToken.test.ts src/lib/emailResult.test.ts
bash tests/browser/run.sh   # 182 checks across 15 scripts, all green; the run owns the dev server
npx vite --host 127.0.0.1 --port 8080 &
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node tests/browser/<script>.mjs
```
E2E (`bash tests/e2e/run.sh`) needs a Docker daemon — `sudo dockerd` in a cloud
session — and is required only for auth-, email- or claim-related work.

## 5. Open, and who must decide

- **`UX23`** — `appliedQuery.isError` is surfaced nowhere; a failed applications
  read leaves the Applied badges quietly wrong. Parity with before, still open.
- **`T4`/`MB3`** — both list pages load only 50 rows, so "Saved"/"Following"
  only search those 50. Invisible at ~5 rows; decided: fix after launch.
- **`T13`** — cached lists can outlive a time boundary by up to 60s. Accepted.
- **`S5`/`R1`/`R2`** — `send-reminders` bypasses the shared email checker, is
  unescaped, and records failed sends as delivered. **Deadline is the first real
  user, not launch day**: `unique_reminder` makes a mis-logged reminder
  unsendable forever.
- **Club test login exists** (maintainer supplied it in chat; deliberately NOT in
  the repo). Use it to verify the real club experience and for step 8.

## 6. Working agreement reminders

The maintainer is **non-technical and is the decision maker**. Ask via
`AskUserQuestion` on any real ambiguity, as many rounds as it takes; if the tool
fails, **ask again — never fall back to an assumption**. Record every answer in
the backlog's *Decisions made* section, dated, **before** building on it. Commit
as `dhruvmantri <mantrid@uci.edu>` (per-commit override; a SessionStart hook
resets the global identity). **Never push without explicit approval** — holding a
commit while waiting is the correct state, and the Stop hook flagging it is the
hook working. Design work gets mockups from the real app, not descriptions.
