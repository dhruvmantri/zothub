/**
 * UX8 — the URL rename.
 *
 * Two things have to hold, and neither is visible by reading the diff:
 *   1. every OLD address still lands on its new home, so nothing already sent
 *      in an email or pasted in a chat breaks;
 *   2. every NEW address actually renders the right thing.
 *
 * (2) matters more than it sounds. Several club paths render ONE component
 * that picks its section by reading the pathname, and the old paths were flat
 * siblings while the new ones nest — so `"/postings/events".startsWith("/postings")`
 * quietly made every sub-tab render the wrong section. A mechanical rename
 * produced exactly that here; this script is what caught it staying fixed.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
// Unset on a normal machine — Playwright finds its own browser. Set it in a
// cloud session, where the pre-installed build may not match the npm version.
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
  await page.addInitScript(([k, v]) => { window.localStorage.setItem(k, v); },
    ["sb-127-auth-token", JSON.stringify(session)]);
  await page.route("**/auth/v1/**", (r) => {
    const json = (b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    return r.request().url().includes("/user") ? json(user) : json({});
  });
  await page.route("**/rest/v1/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    const single = route.request().headers()["accept"]?.includes("pgrst.object");
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p.endsWith("/user_roles")) return json(single ? { role } : [{ role }]);
    if (p.endsWith("/club_profiles"))
      return json(single ? { id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }
                         : [{ id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }]);
    if (p.endsWith("/student_profiles"))
      return json(single ? { id: "sp1", full_name: "Sam Okafor", avatar_url: null, user_id: USER_ID } : [{ id: "sp1" }]);
    return json([]);
  });
}

/** [old address, where it must end up, which role can see it] */
const REDIRECTS = [
  ["/club/dashboard",                    "/applicants",                 "club"],
  ["/club/dashboard/applications",       "/applicants",                 "club"],
  ["/club/dashboard/rsvps",              "/applicants/events",          "club"],
  ["/club/dashboard/opportunities",      "/postings",                   "club"],
  ["/club/dashboard/events",             "/postings/events",            "club"],
  ["/club/dashboard/overview",           "/my-club",                    "club"],
  ["/club/dashboard/team",               "/my-club/team",               "club"],
  ["/club/dashboard/analytics",          "/my-club/analytics",          "club"],
  ["/club/opportunities/new",            "/postings/new",               "club"],
  ["/club/opportunities/abc123/edit",    "/postings/abc123/edit",       "club"],
  ["/club/events/new",                   "/postings/events/new",        "club"],
  ["/club/events/abc123/edit",           "/postings/events/abc123/edit","club"],
  ["/club/profile",                      "/my-club/edit",               "club"],
  ["/club/messages",                     "/messages",                   "club"],
  ["/student/dashboard",                 "/activity",                   "student"],
  ["/student/profile",                   "/profile",                    "student"],
  ["/student/profile/edit",              "/profile/edit",               "student"],
  ["/student/messages",                  "/messages",                   "student"],
];

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

for (const [from, to, role] of REDIRECTS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await install(page, role);
  await page.goto(`${BASE}${from}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(1200);
  const landed = new URL(page.url()).pathname;
  check(`${from}  ->  ${to}`, landed === to, landed === to ? "" : `landed on ${landed}`);
  await ctx.close();
}

// The club section pages all render ONE component that reads the pathname.
// Each must show ITS OWN section, which is what the nesting broke.
const SECTIONS = [
  ["/postings",            /Postings|Opportunities|Roles/i],
  ["/postings/events",     /Events/i],
  ["/applicants",          /Applicant|Application/i],
  ["/applicants/events",   /RSVP/i],
  ["/my-club",             /Overview|My Club/i],
  ["/my-club/team",        /Team/i],
  ["/my-club/analytics",   /Analytics/i],
];
for (const [path, expect] of SECTIONS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await install(page, "club");
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(1400);
  const landed = new URL(page.url()).pathname;
  const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
  const stayed = landed === path;
  const rendered = expect.test(text);
  check(`${path} stays put and renders its own section`,
    stayed && rendered,
    stayed && rendered ? "" : !stayed ? `redirected to ${landed}` : `page never mentions ${expect}`);
  await ctx.close();
}

// One address, two inboxes.
for (const role of ["student", "club"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await install(page, role);
  await page.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(1400);
  const landed = new URL(page.url()).pathname;
  check(`/messages works for a ${role}`, landed === "/messages", `landed on ${landed}`);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
