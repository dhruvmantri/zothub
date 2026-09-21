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

**NEXT TASK, exactly:** the **CTA sweep**. Every call-to-action in the app has
to be checked in all three auth states — signed out, student, club — because
`/signup` **redirects an authenticated visitor to their dashboard**, so any CTA
pointing there silently bounces a signed-in user instead of doing what its
label promises. Three are already logged with line refs: `UX9` ("Bring your
club to ZotHub" → `/signup?role=club`), `UX10` ("Explore clubs" → same fault),
and `UX12` (a button reading **"Browse clubs"** that links to
`/opportunities` — the label and the target simply disagree). Do not stop at
those three: sweep every CTA label against its target, and file what turns up.
Note the nav and URL renames landed on 2026-09-21, so any CTA still pointing at
an old address is now going through a redirect rather than straight to the page.

Then: **empty states** (`UX17a`: the zero-states make false claims and form a
loop — one tells students to look at events and links them to clubs;
`UX17b`: `Clubs.tsx` breaks the no-stage-copy rule three times). Design these
against the POST-PURGE reality: production today holds 5 seeded roles and — as
a read-only probe on 2026-09-21 confirmed — **zero upcoming events**. After
`D1` the empty state is the default launch experience, not an edge case.

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
# browser — see tests/browser/README.md; 131 checks across 11 scripts, all green
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
