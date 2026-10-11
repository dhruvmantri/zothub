/** A7b — a FIRST Google sign-in from the Login page must end up a working
 *  student account (maintainer decision 2026-10-11).
 *
 *  Before: Login called signInWithGoogle() with no role, so nothing was stored
 *  in zothub_intended_role. Google creates the account on first sign-in; back
 *  on ZotHub, AuthContext found no role and no intended role, never called
 *  provision-oauth-user, and left the account role-less — looking signed out,
 *  with every dashboard dead-ending on /account-setup.
 *
 *  Phase 1 is the fix (Login records "student" before leaving for Google).
 *  Phase 2 is what that buys (the return trip provisions the account and the
 *  student gets in). Phase 3 guards the opposite mistake: an account that
 *  already HAS a role is never re-provisioned by the stored value.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const USER_ID = "11111111-1111-1111-1111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "new@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "new@uci.edu", app_metadata: { provider: "google" }, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

// ---- Phase 1: the Login button records the role before leaving ---------------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/auth/v1/settings", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"external":{"google":true}}' }));
  let authorize = null;
  await ctx.route("**/auth/v1/authorize**", (r) => { authorize = r.request().url(); return r.fulfill({ status: 200, contentType: "text/html", body: "stub google" }); });
  await ctx.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Sign in with UCI Google/i }).click();
  await page.waitForTimeout(2000);
  check("phase 1: Login went on to Google", !!authorize && /provider=google/.test(authorize), authorize ?? "no /authorize");
  // localStorage is per origin: read it back from ZotHub's origin in the same context.
  const back = await ctx.newPage();
  await back.goto(`${BASE}/help`, { waitUntil: "domcontentloaded" });
  const stored = await back.evaluate(() => window.localStorage.getItem("zothub_intended_role"));
  check("phase 1: Login stored the intended role 'student' before leaving", stored === "student", `stored ${JSON.stringify(stored)}`);
  await ctx.close();
}

// ---- Phase 2/3: Google sends them back ---------------------------------------
async function returnTrip({ existingRole }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([k, v]) => {
    window.localStorage.setItem(k, v);
    if (!window.sessionStorage.getItem("seeded")) {
      window.localStorage.setItem("zothub_intended_role", "student");
      window.sessionStorage.setItem("seeded", "1");
    }
  }, ["sb-127-auth-token", JSON.stringify(session)]);
  await ctx.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
  const provisioned = [];
  // Stateful, like the real database: once provisioning grants the role, later
  // reads see it. A static "no role" stub sends every reload to /account-setup.
  let role = existingRole;
  await ctx.route("**/functions/v1/provision-oauth-user", (r) => {
    try { provisioned.push(JSON.parse(r.request().postData() ?? "{}")); } catch { provisioned.push(null); }
    role = role ?? "student";
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, role: "student", autoApproved: true }) });
  });
  await ctx.route("**/rest/v1/**", (r) => {
    const u = new URL(r.request().url());
    const single = r.request().headers()["accept"]?.includes("pgrst.object");
    const j = (x) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(x) });
    if (u.pathname.endsWith("/user_roles")) return j(role ? (single ? { role } : [{ role }]) : (single ? null : []));
    if (u.pathname.endsWith("/student_profiles")) return j(single ? { id: "sp1", full_name: "New Student", avatar_url: null } : [{ id: "sp1" }]);
    return j(single ? null : []);
  });
  await ctx.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/activity`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const landed = new URL(page.url()).pathname;
  const left = await page.evaluate(() => window.localStorage.getItem("zothub_intended_role"));
  await ctx.close();
  return { provisioned, landed, left };
}

{
  const r = await returnTrip({ existingRole: null });
  check("phase 2: the new account is provisioned as a student", r.provisioned.length >= 1 && r.provisioned[0]?.role === "student", JSON.stringify(r.provisioned));
  check("phase 2: the student reaches Activity, not the setup dead end", r.landed === "/activity", `landed ${r.landed}`);
  check("phase 2: the stored role is cleared once used", r.left === null, `left ${JSON.stringify(r.left)}`);
}
{
  const r = await returnTrip({ existingRole: "club" });
  check("phase 3: an account that already has a role is NOT re-provisioned", r.provisioned.length === 0, JSON.stringify(r.provisioned));
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
