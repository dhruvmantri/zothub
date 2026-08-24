# ZotHub — Handoff: pre-launch fix-up phase

**Read this first**, then [`BACKLOG.md`](./BACKLOG.md). Rewritten **2026-08-23**, replacing the
2026-08-11 version, which had gone stale in six specific ways (it listed `MB6` as a launch
blocker, treated `D1a` as live, posed `UX15` as an open question, claimed no `CLAUDE.md` existed,
described the repo as clean at a commit two commits back, and asserted a 115/115 test pass that
was not true).

| File | What it is |
|---|---|
| **[`BACKLOG.md`](./BACKLOG.md)** | **The single log of everything open, and every decision made.** If any other doc disagrees, this one wins. |
| [`../CLAUDE.md`](../CLAUDE.md) | The working agreement: doc ownership, git identity, non-negotiables, architectural traps. |
| [`../prd.md`](../prd.md) | Product definition. Spec, not a tracker. |
| [`design/design-system.md`](./design/design-system.md) | Tokens, type, spacing, the 6 operating rules. **AA contrast is a merge gate.** |
| [`archive/`](./archive/), `../plan.md` | Frozen history. Never take direction from them. |

---

## 1. What this phase is

**Finish the app, then plan the launch.** Maintainer decision, 2026-08-23: **full quality bar, no
date pressure** — everything in the backlog, plus whatever a fresh audit turns up. Test data is
purged immediately before launch (`D1`), and go-to-market is deliberately not being designed yet.

The organising goal is unchanged: **the landing page is the quality bar.** Every other surface
should match it for polish, consistency and honesty.

## 2. Where the product actually is

Live at [zothub.app](https://zothub.app) on Vercel + self-owned Supabase. **725 clubs, 0 with a
logo, 5 opportunities (all test junk), 0 active events, 0 claimed clubs, 3 real accounts.**

**Read that again before designing anything:** those 5 opportunities are test data deleted right
before launch, so **discovery ships EMPTY.** Design the empty state as the default launch
experience (`UX17a/b/c`).

### Shipped this phase (2026-08-23)

- **`A1` — Google OAuth signup was broken and silent.** It created an account with no profile,
  because the browser's profile INSERT was rejected by RLS and the result was never checked.
  Fixed by a new `provision-oauth-user` edge function. ⚠️ **The function still needs deploying**
  (`supabase functions deploy provision-oauth-user`) — the frontend is live but inert until then.
- **`MB4`** — `/help` ships, and the three surfaces that promised "contact support" with nowhere
  to go now link to it. **`D3`/`MB7`/`UX4`** — the privacy policy no longer promises a data export
  that does not exist, and its contact address is real and clickable.
- **`UX20`** — a dark-mode device was being served the light theme.
- **`T1`/`S10`** — a deploy gate exists, and a production build now refuses to complete without
  the env vars that are inlined into it.
- **`S7`/`S8`/`S9`** — migration `20260824000100` written and locally verified. ⚠️ **Not applied.**

## 3. The root causes still in play

Fix these and a dozen symptoms go with them. **Do not fix the symptoms one page at a time.**

**(a) There is no data layer.** TanStack Query is wired and **0 `useQuery`/`useMutation` calls
exist**; 21 of 31 pages hand-roll `useEffect` + `isLoading`. **Decided: adopt it properly**
(`UX15`). ⚠️ **Step zero is `App.tsx:54` — a bare `new QueryClient()`. Without
`defaultOptions.staleTime`, adoption inherits v5's `staleTime: 0` and fixes nothing.** Also
undocumented until now: `App.tsx:77` sets `v7_startTransition`, which keeps the outgoing page
painted and is the switch most directly controlling the "page never changed" feel.

**(b) Auth-state CTAs silently bounce.** `Signup.tsx:56-64` redirects authenticated visitors to
their dashboard, so every marketing CTA pointing at `/signup` misroutes signed-in users. Sweep
every CTA label against its target in **all four** auth states — there is a fourth: signed-in
with no role.

**(c) Shared components exist, but no shared compositions.** `components/discover/` has the
parts and **no toolbar**, which is why Clubs / Events / Opportunities drifted. Build it once.

**(d) Hooks expose the right signal; consumers ignore it.** `useAccountIdentity` exposes
`isLoading` precisely so nav can skeleton; both TopNavs drop it. Worse, `useProfileLookup` holds
its "cache" in component-local state, so a single club-dashboard navigation fires ≥4
`club_profiles` lookups.

## 4. Order of work — fixed by dependency, not by size

```
1. Trust & legal            ✅ done
2. Security migrations      🔄 written + verified, awaiting `db push`
3. Deploy gate              ✅ done
4. Data layer (UX15)        ← NEXT. staleTime first, then identity, then pages,
                              then realtime→invalidateQueries, AuthContext LAST
5. nav (UX2+UX6) → canonical URLs (UX8) → shared toolbar (UX11/13)
     → CTA sweep (UX9/10/12) → empty + error states (UX17a/b/c, UX5)
6. D1 purge test data       ← LAST, because it makes step 5's screens the default
```
**CTAs must come after the URL rename, or every CTA is rewritten twice. Empty states must come
before the purge.**

## 5. Rules that carry over

Full detail in [`../CLAUDE.md`](../CLAUDE.md). The ones that have already cost time here:

- **Deploy order is migrations → functions → frontend**, because Vercel auto-deploys on push to
  `main`. One reasoned exception is recorded in the backlog; the rule stands for anything with
  live users.
- **Every commit is authored by the maintainer.** A SessionStart hook resets the git identity
  every session, so override per commit.
- **Verify by running.** `UX20` and the 207 phantom lint errors were both found by running
  things, not reading them. UI is checked in a browser, both themes, at mobile widths.
- **A 200 is not proof of email delivery.** Use the one shared checker.

## 6. How to verify

```bash
npm run verify                  # typecheck + lint + 14 unit tests
npm run build                   # fails if VITE_* env vars are missing — by design
bash tests/e2e/run.sh           # EXECUTED 115/115; needs a Docker daemon
```
**The E2E suite needs Docker** — without it 24 of 115 assertions never run. It used to print
`ALL GREEN` anyway; it now prints `EXECUTED n/115` and exits 1 if any assertion was skipped. In a
cloud session: `sudo dockerd`. Two sandbox accommodations are required there and are not in the
repo: a `nofile` clamp on the docker invocation, and a pre-warmed Deno module cache (without them
`supabase start` fails and every function returns `503 BOOT_ERROR`).

## 7. Useful state

- `scripts/grant_readonly_role.sql` — **maintainer-run**, creates a SELECT-only role so live-state
  questions can be settled without a write credential. Carries its own revoke block.
- `scripts/purge_test_data.sql` — the `D1` runbook. Transactional, with a rollback guard.
- `scripts/verify_prod_state.sql` — SELECT-only. Q4 settles `S6` (is a service-role JWT sitting in
  plaintext in the cron job definition?), which is **still unanswered and still a launch blocker**.
- `/dev/clubs-preview` — DEV-only fixture harness, stripped from production builds.
