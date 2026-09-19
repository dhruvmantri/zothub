/**
 * Wave 4b — OpportunityDetail, and UX21 specifically.
 *
 * UX21 is a data-loss bug, not a performance one. `application_questions` is
 * selected ONLY for a signed-in viewer, because anon holds no column grant for
 * it. If the page's cache entry is keyed by the role id alone, then
 * "browse logged out -> log in -> open the same role" serves the ANON-shaped
 * row, the application form is handed `questions={[]}`, and the student submits
 * an application with zero answers to a role whose club requires them. The club
 * receives a blank application and the student cannot tell.
 *
 * Two mechanisms now prevent that, and this script exercises the outcome both
 * cover: the viewer id is part of the key (the structural guarantee), and
 * signing in clears the cache (A4).
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
// Unset on a normal machine — Playwright finds its own browser. Set it in a
// cloud session, where the pre-installed build may not match the npm version.
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const OPP_ID = "o1";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const QUESTION = "Why do you want this role?";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "s@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "s@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };

const CLUB = { id: "c1", club_name: "Hack at UCI", logo_url: null, description: null, website_url: null };
const BASE_ROW = {
  id: OPP_ID, title: "Marketing Lead", type: "leadership",
  description: "Run the socials.", requirements: null, deadline: null,
  show_application_count: true, created_at: new Date().toISOString(),
  club_id: "c1", club_profiles: CLUB, applications: [],
};
const QUESTIONS = [{ id: "q1", type: "short_text", question: QUESTION, required: true }];

let authed = false;
/** Every `select=` the detail read asked for, in order. */
const detailSelects = [];

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage();

await page.route("**/auth/v1/**", (route) => {
  const u = route.request().url();
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (u.includes("/token")) { authed = true; return json(session); }
  if (u.includes("/user")) return authed ? json(user) : route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  return json({});
});

await page.route("**/rest/v1/**", (route) => {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const single = route.request().headers()["accept"]?.includes("pgrst.object");
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });

  if (p.endsWith("/user_roles")) return json(single ? { role: "student" } : [{ role: "student" }]);
  if (p.endsWith("/student_profiles")) return json(single ? { id: "sp1", full_name: "Sam", avatar_url: null, user_id: USER_ID } : [{ id: "sp1" }]);
  if (p.endsWith("/applications")) return json([]);

  if (p.endsWith("/opportunities")) {
    const select = url.searchParams.get("select") ?? "";
    // Only the single-row detail read; the list read has a different shape.
    if (url.searchParams.get("id") === `eq.${OPP_ID}`) {
      detailSelects.push(select);
      // The server honours exactly what was asked for. An anon-shaped request
      // must NOT come back with the questions, or the test proves nothing.
      const row = select.includes("application_questions")
        ? { ...BASE_ROW, application_questions: QUESTIONS }
        : { ...BASE_ROW };
      return single ? json(row) : json([row]);
    }
    // The LIST read. Needed only so the test can click through to the detail
    // page the way a student would, rather than with page.goto().
    return json([BASE_ROW]);
  }
  return json([]);
});

// 1. Browse the role logged out. This caches the anon-shaped row.
await page.goto(`${BASE}/opportunities/${OPP_ID}`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Marketing Lead", level: 1 }).waitFor({ timeout: 15000 });
check("logged out, the read does NOT request application_questions",
  detailSelects.length === 1 && !detailSelects[0].includes("application_questions"),
  `selects so far: ${detailSelects.length}`);
check("logged out, there is no Apply button", (await page.getByRole("button", { name: /^Apply$/ }).count()) === 0);

// 2. Sign in for real, through the login form.
await page.getByRole("link", { name: /Log in/ }).first().click();
await page.waitForURL("**/login");
await page.getByLabel(/email/i).first().fill("s@uci.edu");
await page.getByLabel(/password/i).first().fill("hunter2hunter2");
await page.getByRole("button", { name: /^(Log in|Sign in)$/i }).first().click();
await page.waitForTimeout(2500);

// 3. Back to the SAME role — by clicking, never page.goto(), which would wipe
//    the cache and make the whole test meaningless.
await page.getByRole("link", { name: /^(Discover|Opportunities)$/ }).first().click();
await page.waitForURL("**/opportunities");
await page.getByRole("link", { name: "Marketing Lead" }).first().click({ timeout: 15000 });
await page.waitForURL(`**/opportunities/${OPP_ID}`);
await page.getByRole("heading", { name: "Marketing Lead", level: 1 }).waitFor({ timeout: 15000 });
await page.waitForTimeout(800);

check("signed in, the role was re-read with application_questions",
  detailSelects.length > 1 && detailSelects[detailSelects.length - 1].includes("application_questions"),
  `${detailSelects.length} detail reads; last asked for questions: ${detailSelects[detailSelects.length - 1]?.includes("application_questions")}`);
check("the anon-shaped entry was NOT reused for the signed-in viewer",
  detailSelects.length >= 2);

// 4. The payoff: the application form must carry the club's question.
const apply = page.getByRole("button", { name: /^Apply$/ }).first();
await apply.waitFor({ timeout: 10000 }).catch(() => {});
check("signed in, the Apply button is there", await apply.isVisible().catch(() => false));
await apply.click();
// Scoped to the dialog on purpose: the page ALSO previews the questions above
// the fold ("1 question, so..."), so an unscoped locator matches twice and
// Playwright's strict mode throws — which reads as a failure of the feature
// rather than of the locator. It did, once.
const dialog = page.getByRole("dialog");
await dialog.waitFor({ timeout: 10000 }).catch(() => {});
const dialogText = await dialog.innerText().catch(() => "");

check("the page previews that this role asks questions",
  (await page.getByText(/question, so/).count()) > 0);
check("UX21: the application form carries the club's required question",
  dialogText.includes(QUESTION),
  dialogText.includes(QUESTION)
    ? "the question reached the form"
    : `EMPTY FORM — this is the data-loss bug. Dialog text: ${dialogText.slice(0, 200)}`);
check("the required marker survived the round trip",
  /Why do you want this role\?\*/.test(dialogText.replace(/\s+/g, " ")));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
