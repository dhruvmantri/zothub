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
bash tests/e2e/run.sh                    # 115/115; warns before wiping local data
```

Run the E2E suite before finishing anything auth-, email-, or claim-related.

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
