/**
 * Wave 4a — ClubDetail.
 *
 * See README: never page.goto() to test a cache, and always mock the REST
 * responses. Both rules were learned from false failures.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
// Unset on a normal machine — Playwright finds its own browser. Set it in a
// cloud session, where the pre-installed build may not match the npm version.
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const CLUB_ID = "c1";
const CLUB = {
  id: CLUB_ID, club_name: "Hack at UCI", category: "Technology",
  description: "We build things.", logo_url: null, banner_url: null,
  website_url: null, linkedin_url: null, instagram_url: null, discord_url: null,
  user_id: "u1", source: null, source_url: null, imported_at: null, claimed_at: null,
};
const OPPS = [{ id: "o1", title: "Marketing Lead", type: "leadership", description: null, deadline: null }];
const EVENTS = [{ id: "e1", title: "Kickoff", description: null, event_date: new Date(Date.now() + 86400000 * 4).toISOString(), location: "DBH" }];
const TEAM = [{ id: "t1", name: "Alex", role: "president", display_order: 1, user_id: null }];

const counts = { club: 0, opps: 0, events: 0, team: 0, directory: 0 };
let clubResult = "ok";   // "ok" | "missing" | "fail"
let oppsFail = false;

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

async function install(page) {
  await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/rest/v1/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    const single = route.request().headers()["accept"]?.includes("pgrst.object");
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });

    if (p.endsWith("/club_profiles")) {
      counts.club += 1;
      if (clubResult === "fail") return route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' });
      // maybeSingle() sends the object Accept header and takes null for "no row".
      if (clubResult === "missing") return single ? json(null) : json([]);
      return single ? json(CLUB) : json([CLUB]);
    }
    // Count only THIS club's reads. The /clubs directory decorates its cards
    // with per-club counts from the same two endpoints, so counting by endpoint
    // alone attributes the directory's queries to this page and reports a cache
    // miss that never happened. (It did, once, before this comment existed.)
    const forThisClub = new URL(route.request().url()).search.includes(`club_id=eq.${CLUB_ID}`);

    if (p.endsWith("/opportunities")) {
      if (forThisClub) counts.opps += 1;
      if (oppsFail && forThisClub) return route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"boom"}' });
      return json(forThisClub ? OPPS : []);
    }
    if (p.endsWith("/events")) {
      if (forThisClub) counts.events += 1;
      return json(forThisClub ? EVENTS : []);
    }
    if (p.endsWith("/club_team_members")) { counts.team += 1; return json(TEAM); }
    if (p.includes("/rpc/get_all_clubs_public")) {
      counts.directory += 1;
      return json([{ ...CLUB, opportunity_count: 1, event_count: 1 }]);
    }
    return json([]);
  });
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

// ------------------------------------------------- the happy path + caching
{
  const page = await browser.newPage();
  await install(page);
  await page.goto(`${BASE}/clubs/${CLUB_ID}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Hack at UCI", level: 1 }).waitFor({ timeout: 15000 });

  check("the four reads each fire exactly once",
    counts.club === 1 && counts.opps === 1 && counts.events === 1 && counts.team === 1,
    `club ${counts.club}, roles ${counts.opps}, events ${counts.events}, team ${counts.team}`);
  check("the roles section rendered", (await page.getByText("Marketing Lead").count()) > 0);
  check("the events section rendered", (await page.getByText("Kickoff").count()) > 0);
  check("the members aside rendered", (await page.getByText("Alex").count()) > 0);
  check("'Recruiting now' shows, derived from real open roles",
    (await page.getByText("Recruiting now").count()) > 0);

  const before = { ...counts };
  // Client-side navigation out and back — never page.goto().
  await page.getByRole("link", { name: "Clubs", exact: true }).first().click();
  await page.waitForURL(/\/clubs$/);
  await page.getByRole("heading", { name: "Clubs", level: 1 }).waitFor({ timeout: 10000 });
  await page.goBack();
  await page.waitForURL(`**/clubs/${CLUB_ID}`);

  const skeleton = await page.locator(".animate-pulse").first().isVisible().catch(() => false);
  await page.getByRole("heading", { name: "Hack at UCI", level: 1 }).waitFor({ timeout: 10000 });
  check("returning shows NO skeleton", skeleton === false, `skeleton visible: ${skeleton}`);
  await page.waitForTimeout(1500);
  check("returning issues 0 additional reads",
    counts.club === before.club && counts.opps === before.opps &&
    counts.events === before.events && counts.team === before.team,
    `club +${counts.club - before.club}, roles +${counts.opps - before.opps}, events +${counts.events - before.events}, team +${counts.team - before.team}`);
  await page.close();
}

// ------------------------------------------------------------- not found
{
  clubResult = "missing";
  const page = await browser.newPage();
  await install(page);
  await page.goto(`${BASE}/clubs/nope`, { waitUntil: "networkidle" });
  const nf = page.getByText("That club isn't here");
  await nf.waitFor({ timeout: 15000 }).catch(() => {});
  check("a club that does not exist shows the not-found screen",
    await nf.isVisible().catch(() => false));
  check("not-found is NOT the error state",
    (await page.getByText("We couldn't load").count()) === 0);
  await page.close();
}

// ------------------------------------------------------- whole-page failure
{
  clubResult = "fail";
  const page = await browser.newPage();
  await install(page);
  await page.goto(`${BASE}/clubs/${CLUB_ID}`, { waitUntil: "networkidle" });
  const err = page.getByText("We couldn't load");
  await err.waitFor({ timeout: 15000 }).catch(() => {});
  check("a failed club read shows the error state", await err.isVisible().catch(() => false));
  check("a failed read does NOT claim the club was removed",
    (await page.getByText("That club isn't here").count()) === 0);
  await page.close();
}

// ------------------------- one section fails, the rest of the page survives
{
  clubResult = "ok";
  oppsFail = true;
  const page = await browser.newPage();
  await install(page);
  await page.goto(`${BASE}/clubs/${CLUB_ID}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Hack at UCI", level: 1 }).waitFor({ timeout: 15000 });

  check("the club still renders when only the roles read fails",
    (await page.getByText("We build things.").count()) > 0);
  check("the roles section says it failed",
    (await page.getByText("We couldn't load").count()) > 0);
  check("it does NOT claim the club is not recruiting",
    (await page.getByText("Not recruiting right now").count()) === 0);
  check("the events section still rendered", (await page.getByText("Kickoff").count()) > 0);
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
