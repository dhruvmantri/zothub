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
node tests/browser/wave4a-clubdetail.mjs
node tests/browser/wave4b-ux21.mjs
node tests/browser/wave4c-event-rsvp.mjs
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

**Count the query, not the endpoint.** Two different pages can read the same
table for different reasons — `/clubs` decorates its cards with per-club counts
from the same `/opportunities` and `/events` endpoints a club's page uses. A
counter keyed on the endpoint alone attributes one page's queries to another and
reports a cache miss that never happened. Discriminate on the query string.

**Fail gracefully, or a caught bug looks like a crashed script.** When a
regression removes an element, an unguarded `fill()` or `click()` throws and
aborts the run — hiding the FAIL lines that explain what broke. Guard the
interaction steps with `.catch(() => {})` and let the checks do the reporting.

**Scope the locator, or strict mode looks like a broken feature.** A detail page
often shows the same text twice — once in a preview, once in a dialog. An
unscoped `getByText` matches both, Playwright's strict mode throws, and the
`.catch(() => false)` around it turns a locator problem into a confident FAIL on
working code. Scope to the container you mean.

## What each one covers

| Script | Covers |
|---|---|
| `wave3-verify.mjs` | Signed out: cold-load request counts, away-and-back is 0 requests and no skeleton, the `UX22` sign-in prompt on both pages, and the `ErrorState` including that **Try again** actually recovers. |
| `wave3-signedin.mjs` | As a student (injected session): the Applied badge is right, the applications read fires once, nothing refetches on a round trip, and the sign-in prompt correctly does **not** appear. |
| `wave3-ux23.mjs` | `UX23`: with the applications read artificially slowed, the Apply button must be a **disabled `<button>`**, not a live `<a>`, until we know whether this student already applied. Removing the guard in `Opportunities.tsx` must make this fail; that is how it was proven. |
| `wave4a-clubdetail.mjs` | Wave 4a: the four club reads fire once each and zero on return; not-found, whole-page failure and a single failed section are three visibly different screens; a failed roles read must never render "Not recruiting right now". |
| `wave4b-ux21.mjs` | `UX21`, the data-loss bug: browse a role logged out, sign in, come back — the application form must carry the club's required question. An empty form here means a student submits a blank application the club cannot tell apart. |
| `wave4c-event-rsvp.mjs` | `UX21` on the event side, plus the RSVP mutation cluster: the form hands its answers up, the hook writes them once with the right status, and the write invalidates the event so the attendee count refetches. Its negative run writes `answers: []` — a blank RSVP recorded as a confirmed attendance. |
| `wave3-signin-transition.mjs` | `A4`: browse logged out, sign in through the real login form, navigate back by link click — the anon-shaped rows must not survive the sign-in. Temporarily disabling the guard in `AuthContext` must make this script fail; that is how it was proven. |
