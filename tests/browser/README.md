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
node tests/browser/o5-counts.mjs
node tests/browser/nav-club-discover-menu.mjs
node tests/browser/ux8-url-renames.mjs
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

**A rename breaks the tests too.** Scripts that navigate by URL or click a nav
item by name go stale the moment either changes, and a stale assertion reads
exactly like a regression. When a check fails right after a rename, confirm
which of the two is wrong before "fixing" the code.

**Fail gracefully, or a caught bug looks like a crashed script.** When a
regression removes an element, an unguarded `fill()` or `click()` throws and
aborts the run — hiding the FAIL lines that explain what broke. Guard the
interaction steps with `.catch(() => {})` and let the checks do the reporting.

**A silently-swallowed locator error looks like a wrong answer.** The rule
above — guard interactions with `.catch(() => {})` — has a second half: if the
element is *missing*, say so as its own failure. A swallowed click plus a URL
assertion reports "the button goes to the wrong place" when the truth is "the
button is not there", and pays a 30s click timeout per case for the privilege.
That is how a run was wasted here against a dev server that had quietly died:
twelve identical failures, all of them lying about the cause. Check `count()`
first.

**Let the run own the dev server.** `bash tests/browser/run.sh [name…]`
starts vite, waits for it, runs the scripts and kills it. A separately-started
server does not reliably survive between commands in a cloud session, and when
it dies EVERY assertion fails in a way that reads exactly like a code
regression — which has now happened twice, once producing a confident and
completely false conclusion about an access-control bug.

**Assert that the app mounted before judging anything.** One line
(`#root` has children) turns "12 routes all redirect" into "the app did not
mount, this result is meaningless". Cheap, and it is the difference between
debugging your code and debugging your harness.

**Assert on the request when the screen cannot tell you.** Some correctness
lives entirely off-screen. A client-side sort and a database sort render
byte-identically on a short list and only diverge past a row cap — i.e. in
production, months later. Where that is true, route-record the REST calls and
assert on the URL. The same trick catches "it reshuffled the cache instead of
refetching", which is invisible by definition.

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
| `o5-counts.mjs` | `O5-counts`: a logged-out visitor sees the real applicant count rather than 0, a club's "show applicant count" switch is honoured on the LIST (it was ignored there), zero is hidden rather than rendered, and "spots left" comes from confirmed RSVPs — so a sold-out event no longer advertises every seat as free. |
| `nav-club-discover-menu.mjs` | The club `Discover` nav menu: it must open on hover WITHOUT navigating anywhere itself, survive the pointer moving onto it, open from the keyboard and close on Escape, and open by tap on a phone where hover does not exist. |
| `ux8-url-renames.mjs` | `UX8`: every OLD address still lands on its new home (params, query and hash intact), every NEW address stays put and renders its own section, and `/messages` serves both roles. The section checks exist because several club paths share one component that reads the pathname — and the new paths nest where the old ones did not. |
| `a5-role-guard.mjs` | `A5`: an account with **no role** must not render protected pages — it used to render all of them, on both sides. Also that an UNKNOWN (the role or waitlist read failing) is neither a pass nor a lock-out. **Half the checks guard the opposite mistake**: an approved student and club must still get in, cross-role redirects must still work, and pending/rejected must still reach their pages. Restoring the original fall-through fails 6 of 16 with the real symptom. |
| `ux9-cta-sweep.mjs` | `UX9`/`UX10`/`UX12`: the four home-page CTAs **clicked** in all three auth states, asserting where the browser comes to rest. Deliberately not an href check — the hrefs were always real routes and the fault was one hop later, in `/signup`'s redirect, so an href test would have passed against the broken code. Restoring the original targets makes it fail with the real symptom: "landed on /activity", "landed on /applicants". Also guards the two labels the 2026-09-20 rename left reading "Discover". |
| `ux11-toolbar.mjs` | `UX11`/`UX13`, the shared toolbar: every control is present on all three pages, the `Filter` menu is genuinely multi-select (it must STAY OPEN across two ticks — Radix closes on activation by default, which silently reverts the one capability the redesign was for), the date windows are one-at-a-time, and the sort is asserted **on the wire**, not on the screen. That last one matters: a client sort and a server sort look identical on a list of three rows and only diverge past the 50-row cap, so the check is that choosing a sort issues a NEW request carrying `order=…&limit=50`. |
| `wave3-signin-transition.mjs` | `A4`: browse logged out, sign in through the real login form, navigate back by link click — the anon-shaped rows must not survive the sign-in. Temporarily disabling the guard in `AuthContext` must make this script fail; that is how it was proven. |
