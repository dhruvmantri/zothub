# ZotHub — continuation brief

Rewritten 2026-09-21. **Read `docs/BACKLOG.md` next — if it disagrees with this
file, the backlog wins.**

## 1. State

`main` clean, everything pushed, production healthy. Steps 1–7 and 9 of the
launch plan are done; **8 and 10 remain.**

```
1. Trust & legal        ✅      6. Nav ✅ URLs ✅ toolbar ✅ CTAs ✅ empty states ✅
2. Security             ✅      7. Logos ✅ · avatars deferred · onboarding (MB8) ⬜
3. CI gate              ✅      8. DESIGN + JOURNEY PASS  ← NEXT, and it is the redesign
4. Speed (UX15)         ✅      9. Email hardening ✅ (done early, deployed)
5. Card counts (O5)     ✅     10. D1 purge test data  ← LAST, immediately before launch
```

**Production, measured 2026-09-21 as an anonymous visitor:** 725 clubs (**589
now show a real logo**, 136 keep initials), 4 test roles, **0 publicly visible
events, ever**. After `D1` that is ~722 clubs, 0 roles, 0 events — so both
discovery lists are empty on launch day and the club directory is full. Design
against that, not against today's screen.

**One unverified thing:** the rewritten `send-reminders` is deployed but has
never executed in production. Check the **Edge Function logs** for it after any
hour turns over. `cron.job_run_details` saying "succeeded" is NOT proof — that
only means pg_net queued the request.

## 2. THE NEXT TASK — step 8, the design + journey pass

This is what the maintainer means by "the redesign": **bring every page to the
quality bar the landing page already meets** (`UX16`), found by walking the
product rather than by reading it.

Walk both journeys **in light and dark, at mobile and desktop widths**, with
**real accounts** (ask the maintainer for the club test login — it is never
committed):

- **Student:** signup → discover → club page → apply → activity → messages
- **Club:** signup/claim → post a role → post an event → review applicants →
  RSVPs → team → analytics → my club

File everything found in `docs/BACKLOG.md`. Expect it to overlap `N1`–`N7`
(screens never exercised with real data) and `MB8` (onboarding polish).
**Known open UI items to fold in:** `UX1` (navigation still feels stale on
click), `UX3` (no back affordance on Login/Waitlist/WaitlistRejected),
`UX18` 🔴 (Reject All fires instantly on named students, no confirm, no undo).

Then **step 10, `D1`**: `scripts/purge_test_data.sql` deletes Test Club and two
empty test clubs. Back up first. It is last because Test Club is the only club
with real data attached and is needed for step 8.

## 3. Architectural decisions that constrain future work

- **Query keys are rooted on the TABLE, never the page** (`src/lib/queryKeys.ts`).
  Full contract: `docs/ux15-migration-contract.md` — read before touching any
  cached read.
- **A sort that decides WHICH rows come back is server-side and in the key.**
  The list queries cap at 50 rows. Filtering client-side is fine; sorting is not.
- **`DiscoverToolbar` is the one composition** behind Clubs/Opportunities/Events.
  Add a control there, never to one page.
- **The route guard honours known states first, never guesses an unknown, and
  decides entitlement last** (`A5`). A failed read gets a retry screen, not a
  pass and not a lock-out.
- **A 200 is not proof of email delivery** — everything goes through
  `_shared/email-result.ts`. Reminders are claim-before-send
  (`_shared/reminder-delivery.ts`, unit-tested from Node).
- **Empty states describe the QUERY, never the product's stage.** Live counts
  only.
- **The agent pushes frontend work unasked; it stops and asks for migrations,
  data deletion, anything needing a maintainer command, and edge-function
  deploys.** It never writes to production itself.

## 4. Verify before declaring done

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run build
node --experimental-strip-types --test src/lib/*.test.ts     # 22
bash tests/browser/run.sh                                     # 182 across 15 scripts
bash scripts/test_r2_cron_migration.sh                        # 11, needs Docker
```

`tests/browser/run.sh` owns its dev server — a separately started `npx vite`
does not survive between commands here, and when it dies every assertion fails
in a way that reads exactly like a code regression.

## 5. How this session avoided its own mistakes — keep doing these

- **Prove fixes in reverse.** Every non-trivial fix was re-broken to confirm the
  test fails with the real symptom. A test that cannot fail proves nothing.
- **Verify, don't infer.** A placeholder (`<paste your service_role key>`) was
  found sitting in the vault; it would have passed a length check and silently
  killed every reminder email. The unsubscribe link in one template switched
  off the wrong preference — and the code being replaced had it right, so the
  "fix" would have regressed it.
- **Stale docs cost real time here.** Three backlog items were closed on
  2026-09-21 having been fixed weeks earlier. Close the loop when something ships.
- **Give the maintainer numbered, copy-pasteable steps in order.** They are
  non-technical; "I need three things" without an order is not actionable.

## 6. Open, and who decides

Maintainer decisions pending: none. Everything handed over is done.
Still logged and unowned: `MB8` onboarding, `UX1`, `UX3`, `UX18` 🔴, `A6`,
`T4`/`MB3` (50-row cap), `T13` (time drift), `DP12` follow-ups, plus the
housekeeping `DP*` rows. **The backlog is the list — this file is not.**
