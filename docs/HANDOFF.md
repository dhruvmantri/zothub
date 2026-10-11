# ZotHub — continuation brief

Rewritten 2026-10-10. **Read `docs/BACKLOG.md` next — if it disagrees with this
file, the backlog wins.** Its *Now / next* section is the work order.

## 1. Where things are

**ZotHub is live** at zothub.app, and the maintainer is doing in-person club
outreach (it started at the Anteater Involvement Fair): officers are asked to find
their club in `/clubs` and claim it. Every pre-launch step is done — the design +
journey pass (`UX16`), email hardening, the test-data purge (`D1`).

**Production, measured read-only on 2026-10-10:** 722 clubs, **0 public roles,
0 public events**. Both discovery lists are still empty; the club directory is
full. Design and prioritise against that.

**This phase is: make the first five minutes work for the people outreach brings**
— a club officer claiming a listing, and the students they bring — then bring the
rest of the product up to the landing page's bar.

## 2. What the 2026-10-10 session found and did

A post-launch audit: 196 screenshots (production signed-out, read-only; a local
sandbox signed in as a club and a student), both themes, phone and desktop; eight
design critics judged every page against the landing page, an adversarial
verifier re-checked each finding, and a launch-risk sweep ran alongside. **110
page findings and 15 launch risks survived**; all are rows in the backlog's
*Post-launch audit* section with impact, effort and a proposal.

**Shipped the same day (all live, each with a browser test proved in reverse):**
footer social links; `E3` (the button in every new-application email opened a
404); `C2` (editing a role or event moved its date 7–8 hours on every save);
`C3` (Edit profile could overwrite a profile it failed to load with blanks);
`UX41`/`UX42` (six phone-width layout breaks, including the public club page and
the posting forms' Cancel off-screen); `UX43` (four AA contrast failures); and a
safety net for `A7` so the Google button no longer drops students on a raw
Supabase error page.

**Found and NOT fixable by the agent:** `A7` — the Google provider has never
been switched on in the self-owned Supabase project (it came from Lovable
Cloud's managed credentials). The fix is dashboard configuration, and it is
gated on `A7b` (a first Google sign-in from Login leaves the account with no
role), which needs a maintainer decision first.

## 3. Root causes in play — check these before you trust a screen

- **Measure, don't look.** Sideways scroll, contrast, and "it saved" were all
  invisible to eyes and obvious to a measurement. A full-page phone screenshot
  wider than 390px *is* sideways scroll; that one check found four pages.
- **The bare-grid trap** (`UX27`, again in `UX41`): a `grid` with no base
  `grid-cols-1` sizes its track to the longest `truncate`d title. Every grid gets
  a base column.
- **Dimming with opacity fails AA** where the tokens pass on paper; and `ink-3`
  is not for `accent-wash` in dark mode. Now rules in `design-system.md`.
- **UTC vs local.** `datetime-local` is local wall-clock; the database is an
  instant. Use `src/lib/datetimeLocal.ts`. In UTC the bug is invisible — test in
  `America/Los_Angeles`.
- **A failed read is not "nothing".** Pages that collapse an error into an empty
  state mislead (`G4-05`), and a form that does so can destroy data (`C3`).
- **Links inside emails are routes too.** `tests/browser/email-links.mjs` reads
  every `zothub.app` link out of the email functions and opens each one.
- **Legacy JWT keys still carry the site and the reminder cron** (`CLAUDE.md`).

## 4. Constraints that shape future work

- **Query keys are rooted on the TABLE** (`src/lib/queryKeys.ts`); read
  `docs/ux15-migration-contract.md` before touching a cached read. Several
  student pages still bypass it (`G4-05`) — finishing `UX15` there is the fix.
- **A sort that decides WHICH rows come back is server-side and in the key.**
- **`DiscoverToolbar` is the one composition** behind the three lists.
- **The route guard honours known states first and decides entitlement last**
  (`A5`).
- **A 200 is not proof of email delivery** — `_shared/email-result.ts`.
- **Empty states describe the query, never the product's stage.**
- **The agent pushes tested frontend work unasked; it stops and asks for
  migrations, data deletion, maintainer commands and edge-function deploys.**

## 5. Verify before declaring done

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run build
node --experimental-strip-types --test src/lib/*.test.ts    # 37 across 6 files
bash tests/browser/run.sh                                    # 533 across 33 scripts
```

**The E2E security suite cannot fully run in a cloud session** (`T14`): a fresh
local database fails on the `R2` migration (set it aside locally — never commit
that), and past that the edge functions fail to boot because the session's proxy
re-signs HTTPS and the runtime rejects it. The database-level checks still run.
The function-level ones need the maintainer's machine.

## 6. Open, and who decides

The maintainer's pending decisions are the backlog's *Decisions needed* table
(`A7b`, claim alerts, backups, RSVP confirmation, publish controls, the apply
panel's privacy sentence, the independence statement, search ranking). The
maintainer's own actions: `A7` (Google dashboard steps, after `A7b`), `LR2`
(check SMTP for password-reset mail), `LR5` (check the Resend plan).
