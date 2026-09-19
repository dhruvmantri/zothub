# Browser checks for the UX15 query migration

Each wave of the `UX15` caching migration has to be proven in a real browser,
not read (`CLAUDE.md` § Verify before declaring done). These are those proofs,
kept because the next wave needs the same harness and rebuilding it costs more
than maintaining it.

```bash
npx vite --host 127.0.0.1 --port 8080          # in one shell
node tests/browser/wave3-verify.mjs            # in another
node tests/browser/wave3-signedin.mjs
node tests/browser/wave3-signin-transition.mjs
node tests/browser/wave3-ux23.mjs
```

Each script prints `PASS`/`FAIL` per check and exits non-zero if any failed.
`ZOTHUB_BASE_URL` overrides the target. `PLAYWRIGHT_CHROMIUM_PATH` overrides the
browser binary — needed only in a cloud session, where the pre-installed
Chromium build may not match the version npm expects.

## Two rules these scripts exist to enforce

**Never navigate with `page.goto()` when testing the cache.** A full document
load wipes an in-memory cache by definition, so the test passes or fails for a
reason that has nothing to do with the code. Navigate by clicking links or by
history. This produced two false failures before it was written down.

**Mock the REST responses.** A *failing* query is not cached and does retry, so
a database that happens to be down produces request counts that look exactly
like a broken cache.

## What each one covers

| Script | Covers |
|---|---|
| `wave3-verify.mjs` | Signed out: cold-load request counts, away-and-back is 0 requests and no skeleton, the `UX22` sign-in prompt on both pages, and the `ErrorState` including that **Try again** actually recovers. |
| `wave3-signedin.mjs` | As a student (injected session): the Applied badge is right, the applications read fires once, nothing refetches on a round trip, and the sign-in prompt correctly does **not** appear. |
| `wave3-ux23.mjs` | `UX23`: with the applications read artificially slowed, the Apply button must be a **disabled `<button>`**, not a live `<a>`, until we know whether this student already applied. Removing the guard in `Opportunities.tsx` must make this fail; that is how it was proven. |
| `wave3-signin-transition.mjs` | `A4`: browse logged out, sign in through the real login form, navigate back by link click — the anon-shaped rows must not survive the sign-in. Temporarily disabling the guard in `AuthContext` must make this script fail; that is how it was proven. |
