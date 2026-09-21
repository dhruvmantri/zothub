/**
 * UX9 / UX10 / UX12 — the CTA sweep on the front door.
 *
 * The defect these cover is invisible in a code review of the link itself:
 * the `to` was a real route, the route existed, and the page rendered. The
 * failure lived one hop away — `/signup` REDIRECTS an authenticated visitor
 * to their dashboard, so the site's most prominent buttons quietly did
 * nothing at all for anyone already signed in.
 *
 * So this script does not check hrefs. It CLICKS each CTA in each of the
 * three auth states and asserts where the browser actually came to rest.
 * A test that only read the href would have passed against the broken code.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const USER_ID = "11111111-1111-1111-1111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "u@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "u@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

async function install(page, role) {
  if (role) {
    await page.addInitScript(([k, v]) => { window.localStorage.setItem(k, v); },
      ["sb-127-auth-token", JSON.stringify(session)]);
  }
  await page.route("**/auth/v1/**", (r) => {
    const json = (b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (!role) {
      return r.request().url().includes("/user")
        ? r.fulfill({ status: 401, contentType: "application/json", body: "{}" })
        : json({});
    }
    return r.request().url().includes("/user") ? json(user) : json({});
  });
  await page.route("**/rest/v1/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    const single = route.request().headers()["accept"]?.includes("pgrst.object");
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p.endsWith("/user_roles")) return json(role ? (single ? { role } : [{ role }]) : []);
    // No waitlist row => approved, so ProtectedRoute lets the club through.
    if (p.endsWith("/waitlist")) return json(single ? null : []);
    if (p.endsWith("/club_profiles"))
      return json(single ? { id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }
                         : [{ id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }]);
    if (p.endsWith("/student_profiles"))
      return json(single ? { id: "sp1", full_name: "Sam Okafor", avatar_url: null, user_id: USER_ID } : [{ id: "sp1" }]);
    return json([]);
  });
  await page.route("**/rpc/get_all_clubs_public", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
}

/** [auth state, role sent by the API, where each of the four CTAs must LAND] */
const CASES = [
  ["a logged-out visitor", null, {
    "Start exploring": "/opportunities",
    "Browse clubs": "/clubs",
    "Explore clubs": "/signup",
    "Bring your club to ZotHub": "/signup",
  }],
  ["a signed-in student", "student", {
    "Start exploring": "/opportunities",
    "Browse clubs": "/clubs",
    "Explore clubs": "/clubs",
    // A student cannot bring a club — claiming is a signed-out flow — so the
    // directory is the honest destination, not a form they cannot complete.
    "Bring your club to ZotHub": "/clubs",
  }],
  ["a signed-in club", "club", {
    "Start exploring": "/opportunities",
    "Browse clubs": "/clubs",
    "Explore clubs": "/clubs",
    "Bring your club to ZotHub": "/my-club",
  }],
];

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

for (const [who, role, expected] of CASES) {
  for (const [label, target] of Object.entries(expected)) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await ctx.newPage();
    await install(page, role);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1200);

    const link = page.getByRole("link", { name: label, exact: true }).first();
    // Report a missing link as its OWN failure. Swallowing the click error
    // and asserting on the URL turns "the button is gone" into "the button
    // goes to the wrong place", and a 30s click timeout per case on top —
    // which is exactly how this script wasted a run against a dev server
    // that had quietly died.
    const found = await link.count().catch(() => 0);
    if (!found) {
      check(`${who}: "${label}" lands on ${target}`, false,
        `no link named "${label}" on the page at all`);
      await ctx.close();
      continue;
    }
    await link.scrollIntoViewIfNeeded().catch(() => {});
    await link.click({ timeout: 5000 }).catch(() => {});
    // Long enough for a redirect to fire and settle — the whole point is to
    // catch a SECOND hop, so asserting too early would hide the bug.
    await page.waitForTimeout(1800);

    const landed = new URL(page.url()).pathname;
    check(`${who}: "${label}" lands on ${target}`, landed === target,
      landed === target ? "" : `landed on ${landed}`);
    await ctx.close();
  }
}

// ------------------------------------------------- labels left by the rename
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  await install(page, null);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1000);
  check('the footer says "Opportunities", not the old page name "Discover"',
    (await page.getByRole("link", { name: "Opportunities", exact: true }).count()) > 0 &&
    (await page.getByRole("link", { name: "Discover", exact: true }).count()) === 0);
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  await install(page, null);
  await page.route("**/rest/v1/opportunities**", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ id: "o1", title: "Marketing Lead", type: "leadership", description: "d",
      deadline: null, club_id: "c1", applications_count: 0, show_application_count: false,
      requires_resume: false, application_questions: [], is_active: true, created_at: new Date().toISOString(),
      club_profiles: { id: "c1", club_name: "Hack at UCI", logo_url: null, description: null, website_url: null } }),
  }));
  await page.goto(`${BASE}/opportunities/o1`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  const backNames = await page.getByRole("link").allInnerTexts();
  check('a role page\'s back link says "Opportunities", not "Discover"',
    !backNames.some((t) => t.trim() === "Discover"),
    `links read: ${backNames.map((t) => t.trim()).filter(Boolean).slice(0, 6).join(" | ")}`);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
