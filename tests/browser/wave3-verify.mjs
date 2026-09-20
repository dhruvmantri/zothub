/**
 * Wave 3 browser verification.
 *
 * Lessons already paid for and encoded here:
 *  - NEVER use page.goto() to test an in-memory cache. A full document load
 *    wipes it by definition, so the test would "fail" for a reason that has
 *    nothing to do with the code. Navigate by clicking links / history only.
 *  - Mock the REST responses. A failing query is not cached and DOES retry, so
 *    a down database produces request counts that look like a cache miss.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
// Unset on a normal machine — Playwright finds its own browser. Set it in a
// cloud session, where the pre-installed build may not match the npm version.
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const EVENTS = [
  {
    id: "e1",
    title: "Hack at UCI Kickoff",
    description: "Opening night.",
    event_date: new Date(Date.now() + 86400000 * 3).toISOString(),
    location: "DBH 6011",
    capacity: 120,
    banner_url: null,
    club_id: "c1",
    club_profiles: { club_name: "Hack at UCI", logo_url: null },
    confirmed_rsvps_count: 1,
  },
  {
    id: "e2",
    title: "Design Club Social",
    description: null,
    event_date: new Date(Date.now() + 86400000 * 9).toISOString(),
    location: null,
    capacity: null,
    banner_url: null,
    club_id: "c2",
    club_profiles: { club_name: "Design at UCI", logo_url: null },
    confirmed_rsvps_count: 0,
  },
];

const OPPS = [
  {
    id: "o1",
    title: "Marketing Lead",
    type: "leadership",
    description: "Run the socials.",
    deadline: new Date(Date.now() + 86400000 * 14).toISOString(),
    club_id: "c1",
    club_profiles: { club_name: "Hack at UCI", logo_url: null },
    applications_count: 2,
    show_application_count: true,
  },
];

const counts = { events: 0, opportunities: 0 };
let failEvents = false;

async function install(page) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    const path = new URL(url).pathname;

    if (path.endsWith("/rest/v1/events")) {
      counts.events += 1;
      if (failEvents) {
        return route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(EVENTS) });
    }
    if (path.endsWith("/rest/v1/opportunities")) {
      counts.opportunities += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(OPPS) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  // No live auth session in this harness; let the auth calls resolve as signed out.
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

// ---------------------------------------------------------------- caching
{
  const page = await browser.newPage();
  await install(page);

  await page.goto(`${BASE}/events`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Hack at UCI Kickoff" }).first().waitFor({ timeout: 10000 });
  const coldEvents = counts.events;
  check("cold /events issues exactly 1 events request", coldEvents === 1, `got ${coldEvents}`);

  // Client-side navigation via the navbar link (NOT page.goto). The item was
  // called "Discover" before the 2026-09-20 nav restructure.
  await page.getByRole("link", { name: "Opportunities", exact: true }).first().click();
  await page.waitForURL("**/opportunities");
  await page.getByRole("heading", { name: "Marketing Lead" }).first().waitFor({ timeout: 10000 });
  const coldOpps = counts.opportunities;
  check("cold /opportunities issues exactly 1 opportunities request", coldOpps === 1, `got ${coldOpps}`);

  // Back to /events through history — a real client-side navigation.
  await page.goBack();
  await page.waitForURL("**/events");

  // The skeleton must NEVER appear on a warm cache. Probe immediately, before
  // any awaits that would let it come and go unobserved.
  const skeletonVisible = await page.locator(".animate-pulse").first().isVisible().catch(() => false);
  await page.getByRole("heading", { name: "Hack at UCI Kickoff" }).first().waitFor({ timeout: 10000 });
  check("returning to /events shows NO skeleton", skeletonVisible === false, `skeleton visible: ${skeletonVisible}`);

  await page.waitForTimeout(1500);
  check(
    "returning to /events issues 0 additional requests",
    counts.events === coldEvents,
    `${counts.events - coldEvents} extra`,
  );

  await page.goForward();
  await page.waitForURL("**/opportunities");
  await page.getByRole("heading", { name: "Marketing Lead" }).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(1500);
  check(
    "returning to /opportunities issues 0 additional requests",
    counts.opportunities === coldOpps,
    `${counts.opportunities - coldOpps} extra`,
  );

  await page.close();
}

// ------------------------------------------- signed-out "Saved" filter chip
{
  const page = await browser.newPage();
  await install(page);
  await page.goto(`${BASE}/events`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Saved$/ }).first().click();

  const prompt = page.getByText("Saving needs an account");
  await prompt.waitFor({ timeout: 5000 }).catch(() => {});
  check("signed-out Saved chip shows the sign-in prompt", await prompt.isVisible().catch(() => false));
  check(
    "sign-in prompt offers Create account",
    await page.getByRole("link", { name: "Create account" }).isVisible().catch(() => false),
  );
  check(
    "sign-in prompt offers Log in",
    await page.getByRole("link", { name: "Log in" }).first().isVisible().catch(() => false),
  );
  check(
    "the old dead-end copy is gone",
    (await page.getByText("You haven't saved any events yet").count()) === 0,
  );

  // Not a trap: the visitor can still get back out.
  await page.getByRole("button", { name: /^All$/ }).first().click();
  await page.getByRole("heading", { name: "Hack at UCI Kickoff" }).first().waitFor({ timeout: 5000 });
  check("visitor can leave the Saved filter again", true);

  await page.goto(`${BASE}/opportunities`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Saved$/ }).first().click();
  const prompt2 = page.getByText("Saving needs an account");
  await prompt2.waitFor({ timeout: 5000 }).catch(() => {});
  check("same prompt on /opportunities", await prompt2.isVisible().catch(() => false));
  check(
    "/opportunities prompt says 'roles', not 'events'",
    await page.getByText(/the roles you save stay here/).isVisible().catch(() => false),
  );
  await page.close();
}

// ------------------------------------------------------------- error state
{
  failEvents = true;
  const page = await browser.newPage();
  await install(page);
  await page.goto(`${BASE}/events`, { waitUntil: "networkidle" });

  const err = page.getByText("We couldn't load");
  await err.waitFor({ timeout: 10000 }).catch(() => {});
  check("a failed events load shows the error state", await err.isVisible().catch(() => false));
  check(
    "the error state is NOT the empty state",
    (await page.getByText("No events coming up").count()) === 0,
  );
  check(
    "the error state offers Try again",
    await page.getByRole("button", { name: /Try again/ }).isVisible().catch(() => false),
  );

  // Retry must actually re-issue the request and recover.
  failEvents = false;
  const before = counts.events;
  await page.getByRole("button", { name: /Try again/ }).click();
  await page.getByRole("heading", { name: "Hack at UCI Kickoff" }).first().waitFor({ timeout: 10000 });
  check("Try again recovers the page", counts.events > before, `${counts.events - before} new request(s)`);
  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length === 0 ? 0 : 1);
