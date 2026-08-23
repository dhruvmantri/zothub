# ZotHub — working agreement

ZotHub is a two-sided campus platform (UCI students ↔ UCI clubs), **live in production** at
zothub.app on Vercel + a self-owned Supabase project.

## Read these, in this order

1. **`docs/HANDOFF.md`** — the current phase brief. Start here.
2. **`docs/BACKLOG.md`** — the single log of everything open. **If any other doc disagrees
   with it, the backlog wins.** Log new issues here with an impact tag; never start a second
   tracker file.
3. `prd.md` — product spec. `docs/design/design-system.md` — tokens and design rules.
4. `plan.md` and `docs/archive/*` — **history only.** Never take forward direction from them.

## Documentation discipline — which file owns what

**Every session updates the docs as it works, not at the end.** A change that is not written
down did not happen. Update the owning file in the same session as the change — as many times
as needed.

| File | Owns | Never put here |
|---|---|---|
| **`docs/BACKLOG.md`** | Every open item, its status, its impact tag. **And every decision the maintainer has made** — in the *Decisions made* section, with the date. The single tracker. | Product rationale, setup steps, history. |
| **`docs/HANDOFF.md`** | The current phase brief only: what this phase is, where the product actually is, the root causes in play. Rewritten at each phase change. | Per-item tracking (that is the backlog). |
| **`CLAUDE.md`** | The working agreement: how to work in this repo, non-negotiables, architectural traps. | Anything time-bound or phase-specific. |
| **`prd.md`** | What the product *is* — users, journeys, access model, spec. Product source of truth. | Delivery status, tracking, task lists. |
| **`README.md`** | Setup, environment variables, deploy, migrations. Written for a stranger cloning the repo. | Roadmap, defects, opinions. |
| **`docs/design/design-system.md`** | Tokens, type, spacing, the operating rules. **AA contrast is a merge gate.** | Page-level defects. |
| **`plan.md`, `docs/archive/*`** | Frozen history. Read-only. | Anything new. |

**Rules of the road**
- **Never start a second tracker.** New issue → `docs/BACKLOG.md` with an impact tag.
- **Record decisions, not just work.** When the maintainer answers a question, write the answer
  and the date into the backlog's *Decisions made* section before building anything on it.
- **Close the loop.** When an item ships, mark it ✅ in the backlog *and* fix any other doc that
  still describes the old behaviour. Stale docs have already caused wasted work here.
- **If two docs disagree, the backlog wins** — then immediately correct the loser.

## Git identity in this repo — read before your first commit

**Every commit is authored by the maintainer, never by the agent** (maintainer instruction,
2026-08-23). This takes deliberate effort, because the environment fights it:

- A **SessionStart hook** (`~/.claude/session-start-git-identity.sh`) runs
  `git config --global user.email noreply@anthropic.com` and `user.name Claude` at the start of
  **every** session. So the global identity is always wrong for this repo, and re-running
  `git config user.email` once is not a durable fix.
- Therefore **override per commit**, every time:

  ```bash
  git -c user.name='dhruvmantri' -c user.email='mantrid@uci.edu' \
      commit --author='dhruvmantri <mantrid@uci.edu>' -m "..."
  ```

- **No `Co-Authored-By` trailer, and no model name anywhere** in a commit message, PR body, or
  any other pushed artifact.
- `commit.gpgsign` is set to **false in this repo's `.git/config`** (global stays `true`). That is
  deliberate: it is the gate on the Stop hook's "Unverified commit" check, which otherwise
  demands the author be reset to Claude — a direct conflict with the rule above. The signed-commit
  badge was judged near-worthless here (solo private repo; the entire existing history is
  unsigned). The hook's other checks — uncommitted changes, untracked files, unpushed commits —
  still run, and are useful. Undo with `git config --unset commit.gpgsign`.

**Deploy order still governs pushing.** Vercel auto-deploys on push to `main`, so a commit that
adds or changes an edge function must have that function deployed *first*. Committing locally and
holding the push is the correct state to be in while waiting — the Stop hook will report an
unpushed commit, and that is the hook working, not a problem to fix.

## Working with the maintainer

The maintainer is the decision maker and is **non-technical**. Treat every session as
collaborative: you do the engineering, they make the calls.

- **Ask, don't assume.** Any real ambiguity — product, design, copy, policy, scope, ordering —
  goes to them via `AskUserQuestion`, as many rounds as it takes. Asking too often is the
  intended failure mode here; guessing is not.
- **If `AskUserQuestion` fails, glitches, or is blocked, ASK AGAIN.** Never fall back to your own
  assumption because the tool misbehaved (maintainer instruction, 2026-08-23). Keep asking until
  you have a real answer.
- **Frame questions for a non-technical reader**: what changes for a user, or what the security
  or trust consequence is. Give the tradeoff in a sentence, recommend one option, and put the
  recommended one first. Never make them decode jargon to answer.
- **Record every answer** in the backlog's *Decisions made* section, dated, before building on it.
- **Report in plain language.** Every stopping point states: what got done, what you are waiting
  on (and exactly what they must do to unblock it), and what comes next. Say what you actually
  verified, and how. Never imply a check you did not run.
- **Ask for what you need, explicitly.** Name the thing, why you want it, and the exact action
  they must take. Do not merely state that you are "blocked on access".

## Non-negotiables

**Production belongs to the maintainer.** Do not commit, stage, push, or deploy without
explicit approval, and never write to production. Read-only checks are fine when authorised —
prepare SQL for the maintainer to run when they aren't. (`supabase db dump` prints
"Initialising login role…" and may create a role on the remote — don't use it read-only.)

**Deploy order is migrations → functions → frontend.** Vercel **auto-deploys on push to
`main`**, so a push ships the frontend first. Deploy the backend before pushing, or you strand
the frontend on an incompatible backend.

**`VITE_TURNSTILE_SITE_KEY` is inlined at build time.** A production build without it renders
an error and **blocks signup and club claims** by design. `TURNSTILE_SECRET_KEY` is required
server-side or `send-otp` / `submit-club-claim` return 503. `CAPTCHA_DISABLED=true` is
local-only — never production.

**Email: a 200 is not proof of delivery.** Resend signals failure in the body. Everything must
judge delivery via the one shared checker, `supabase/functions/_shared/email-result.ts`
(used by both edge functions and the client). Never show "sent"/"notified" without it. All
templates live in `send-email` behind a strict allowlist and are HTML-escaped.

**AA contrast is a merge gate.** Every surface ships designed light *and* dark palettes —
never a naive inversion.

**Verify by running, not by reading.** Several open defects exist because a screen was only
ever code-verified. UI work is checked in the browser, in both themes, at mobile widths.

## Verify before declaring done

```bash
npx tsc -p tsconfig.app.json --noEmit   # 0 errors
npm run build                            # must succeed
node --experimental-strip-types --test src/lib/captchaToken.test.ts src/lib/emailResult.test.ts
bash tests/e2e/run.sh                    # EXECUTED 115/115; warns before wiping local data
```

Run the E2E suite before finishing anything auth-, email-, or claim-related.

**It needs a Docker daemon.** Without one, 24 of the 115 assertions never execute (the
`sqlReady()`-gated blocks: approval rollback, rate-limit fail-closed, pending-club backfill). The
suite used to print `ALL GREEN` anyway — it now prints `EXECUTED n/115` and **exits 1 if any
assertion did not run**, because a partial run of a security suite is an unknown, not a pass. In a
cloud session start the daemon with `sudo dockerd`.

## Known architectural traps

- **TanStack Query is wired but unused** (0 `useQuery` calls). Every page hand-rolls
  `useEffect` + `isLoading`. Root cause of the sluggish navigation and the avatar-initials
  flash. See `UX15`.
- **`/signup` redirects authenticated users to their dashboard**, so any CTA pointing there
  silently bounces signed-in visitors. Check CTA targets in all three auth states.
- **Shared primitives exist without shared compositions** (`components/discover/` has parts
  but no toolbar), which is why the three list pages drifted apart.
- **`send-reminders` is the one email path that bypasses `send-email`** — unescaped, and it
  marks failed sends as delivered. Logged as `S5`/`R1`/`R2`, deferred by decision.

## Reporting

Say what you actually did and what you verified. If tests fail, show the output. If something
is skipped or unverifiable, say so plainly rather than implying success.
