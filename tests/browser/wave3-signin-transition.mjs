/**
 * The sign-IN cache reset (review finding 2).
 *
 * Browse /opportunities logged out, sign in for real through the login form,
 * come back. The cached anon-shaped rows must NOT be served to the now-
 * authenticated viewer.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
// Unset on a normal machine — Playwright finds its own browser. Set it in a
// cloud session, where the pre-installed build may not match the npm version.
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const USER_ID = "11111111-1111-1111-1111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "s@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "s@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };

// The fixture deliberately returns a DIFFERENT count by auth state, purely so
// the cache clearing is observable. That is no longer how the real column
// behaves: since the O5-counts migration the count is viewer-independent, and a
// logged-out visitor sees the true number. This script is about A4 — that
// signing in does not serve the previous, logged-out copy — and it just needs
// some field that differs to watch.
let authed = false;
const opps = () => [{
  id: "o1", title: "Marketing Lead", type: "leadership", description: "Run the socials.",
  deadline: new Date(Date.now() + 86400000 * 14).toISOString(), club_id: "c1",
  club_profiles: { club_name: "Hack at UCI", logo_url: null },
  applications_count: authed ? 3 : 0,
  show_application_count: true,
}];

const counts = { opportunities: 0 };
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
  const p = new URL(route.request().url()).pathname;
  const single = route.request().headers()["accept"]?.includes("pgrst.object");
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (p.endsWith("/user_roles")) return json(single ? { role: "student" } : [{ role: "student" }]);
  if (p.endsWith("/student_profiles")) return json(single ? { id: "sp1" } : [{ id: "sp1" }]);
  if (p.endsWith("/applications")) return json([]);
  if (p.endsWith("/opportunities")) { counts.opportunities++; return json(opps()); }
  return json([]);
});

await page.goto(`${BASE}/opportunities`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Marketing Lead" }).first().waitFor({ timeout: 15000 });
// Zero is now HIDDEN rather than rendered as "0 applied" (maintainer decision,
// 2026-09-20): a brand-new posting should look new, not ignored.
check("logged out, a zero count is hidden entirely",
  (await page.getByText(/applied/).count()) === 0,
  `applicants text: ${(await page.getByText(/applied/).allInnerTexts()).join(" | ") || "(none — correct)"}`);
const beforeLogin = counts.opportunities;

// Sign in for real, through the form — this fires supabase's SIGNED_IN event.
await page.getByRole("link", { name: /Log in/ }).first().click();
await page.waitForURL("**/login");
await page.getByLabel(/email/i).first().fill("s@uci.edu");
await page.getByLabel(/password/i).first().fill("hunter2hunter2");
await page.getByRole("button", { name: /^(Log in|Sign in)$/i }).first().click();
await page.waitForTimeout(2500);

// Back to the roles list by CLICKING — a page.goto() here would be a full
// document reload, which wipes an in-memory cache by definition and would make
// this test pass whether or not the fix exists.
await page.getByRole("link", { name: /^(Discover|Opportunities)$/ }).first().click({ timeout: 15000 });
await page.waitForURL("**/opportunities");
await page.getByRole("heading", { name: "Marketing Lead" }).first().waitFor({ timeout: 15000 });
await page.waitForTimeout(1200);

check("signing in forced a refetch of the roles list", counts.opportunities > beforeLogin,
  `${counts.opportunities - beforeLogin} new request(s)`);
check("the authenticated count replaced the anon one",
  (await page.getByText(/3 applied/).count()) > 0,
  `applicants text: ${(await page.getByText(/applied/).allInnerTexts()).join(" | ")}`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
