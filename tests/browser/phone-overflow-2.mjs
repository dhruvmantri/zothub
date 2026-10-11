/** No page may scroll sideways on a phone — the three found 2026-10-10.
 *
 *  Measured from the audit's full-page phone screenshots (a 390px viewport
 *  producing a wider PNG IS sideways scroll): the public club page once a club
 *  has a role or event (447px), Postings → Events (428px), and Notifications
 *  once anything is unread (451px). The first two are the UX27 grid trap again
 *  (a bare `grid` sizes its implicit track to the longest truncated title);
 *  the third is two rows that could not wrap. My Club carried the same bare
 *  grid and overflowed to 840px with a long event title — found by this test.
 *
 *  The role and event pages carried it too, but did NOT overflow on the old
 *  code even with a long club name (the audit predicted they would). Their
 *  checks are regression guards, not proof of a fix.
 *
 *  The assertion is the symptom — document scrollWidth against the viewport —
 *  and the titles are longer than any real one so it keeps biting.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const LONG = "Interdisciplinary Undergraduate Robotics Consortium Fall Kickoff and Hardware Demonstration Night";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "club@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "club@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };

const soon = new Date(Date.now() + 5 * 864e5).toISOString();
// A long CLUB name too: the role and event pages truncate it in their sidebar,
// which is what sized their grid track.
const CLUB = {
  id: "c1", club_name: "Associated Students Interdisciplinary Undergraduate Robotics and Autonomous Systems Consortium", category: "Engineering", user_id: USER_ID,
  description: "We build competition robots.", logo_url: null, banner_url: null, website_url: "https://example.org",
  linkedin_url: null, instagram_url: null, discord_url: null, source: "self", source_url: null, imported_at: null,
  claimed_at: null, published: true,
};
const TABLES = {
  user_roles: [{ role: "club" }],
  club_profiles: [CLUB],
  opportunities: [{ id: "o1", club_id: "c1", title: LONG, type: "leadership", description: "Lead it.", deadline: soon, is_active: true, created_at: soon, views: 3 }],
  events: [{ id: "e1", club_id: "c1", title: LONG, description: "Robots.", event_date: soon, location: "Interdisciplinary Science and Engineering Building, Room 1010", capacity: 40, is_active: true, views: 5, created_at: soon }],
  notifications: [1, 2, 3].map((n) => ({ id: `n${n}`, user_id: USER_ID, type: "new_application", title: `New application for ${LONG}`, message: "Someone applied.", is_read: false, related_id: "o1", created_at: soon })),
  notification_preferences: [],
  club_team_members: [],
};

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function measure(path, signedIn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  if (signedIn) {
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-127-auth-token", JSON.stringify(session)]);
    await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
      body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
  }
  await page.route("**/rest/v1/**", (r) => {
    const u = new URL(r.request().url());
    const single = r.request().headers()["accept"]?.includes("pgrst.object");
    const rows = TABLES[u.pathname.split("/").pop()] ?? [];
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(single ? rows[0] ?? null : rows) });
  });
  await page.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2800);
  const out = await page.evaluate((long) => ({
    mounted: (document.getElementById("root")?.children.length ?? 0) > 0,
    scrollWidth: document.documentElement.scrollWidth,
    // Guard: the long title must actually be on screen, or the page is not
    // exercising the case that used to overflow and a pass would mean nothing.
    hasLong: document.body.innerText.includes(long.slice(0, 40)),
  }), LONG).catch(() => ({ mounted: false, scrollWidth: -1, hasLong: false }));
  await ctx.close();
  return out;
}

for (const [label, path, signedIn] of [
  ["public club page with a role and an event", "/clubs/c1", false],
  ["club Postings → Events", "/postings/events", true],
  ["Notifications with three unread", "/notifications", true],
  ["role page with a long club name", "/opportunities/o1", false],
  ["event page with a long club name", "/events/e1", false],
  ["My Club with a long event title", "/my-club", true],
]) {
  const r = await measure(path, signedIn);
  check(`${label}: rendered`, r.mounted);
  check(`${label}: shows the long title (guard)`, r.hasLong);
  check(`${label}: no sideways scroll at 390px`, r.scrollWidth <= 390, `scrollWidth ${r.scrollWidth}`);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
