/**
 * A5 — the route guard must not fail open, and must not fail closed either.
 *
 * The original defect: `allowedRoles && role && !allowedRoles.includes(role)`
 * is FALSE when `role` is null, so execution fell through to `return children`
 * and an account with no role rendered every protected page — including the
 * club dashboard. Two things produced that state: provisioning that never
 * finished, and the waitlist read simply failing (a failed read set the status
 * to null, which the code treats as "approved").
 *
 * The fix has a second failure mode of its own, and half these cases exist to
 * catch it: failing closed would eject a legitimately approved student over
 * one flaky request. So "we could not check" must be its own screen, and the
 * approved cases must keep working.
 *
 * Every case asserts the app MOUNTED before judging the result. A dead dev
 * server makes every route look like a redirect, which is exactly how the
 * first run of this reproduction produced a confident and entirely false
 * answer.
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

/**
 * @param roles    "none" | "student" | "club" | "error"
 * @param waitlist "empty" | "pending" | "rejected" | "error"
 */
async function visit(browser, { roles, waitlist, route }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
    ["sb-127-auth-token", JSON.stringify(session)]);
  await page.route("**/auth/v1/**", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}",
  }));
  await page.route("**/rest/v1/**", (r) => {
    const u = new URL(r.request().url());
    const single = r.request().headers()["accept"]?.includes("pgrst.object");
    const j = (x) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(x) });
    const boom = () => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "PGRST500", message: "boom" }) });
    if (u.pathname.endsWith("/user_roles")) {
      if (roles === "error") return boom();
      if (roles === "none") return j(single ? null : []);
      return j(single ? { role: roles } : [{ role: roles }]);
    }
    if (u.pathname.endsWith("/waitlist")) {
      if (waitlist === "error") return boom();
      if (waitlist === "empty") return j(single ? null : []);
      const row = { user_id: USER_ID, status: waitlist, role: "club", requested_at: new Date().toISOString() };
      return j(single ? row : [row]);
    }
    if (u.pathname.endsWith("/club_profiles"))
      return j(single ? { id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }
                      : [{ id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }]);
    if (u.pathname.endsWith("/student_profiles"))
      return j(single ? { id: "sp1", full_name: "Sam Okafor", avatar_url: null, user_id: USER_ID } : [{ id: "sp1" }]);
    return j([]);
  });
  await page.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2200);
  const mounted = await page.evaluate(() => {
    const r = document.getElementById("root");
    return !!r && r.children.length > 0;
  }).catch(() => false);
  const landed = new URL(page.url()).pathname;
  const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
  await ctx.close();
  return { mounted, landed, text };
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

// ---------------------------------------- the hole: no role must not get in
for (const route of ["/activity", "/applicants", "/profile", "/messages"]) {
  const r = await visit(browser, { roles: "none", waitlist: "empty", route });
  check(`no role, no waitlist row: ${route} does NOT render`,
    r.mounted && r.landed === "/account-setup",
    !r.mounted ? "APP DID NOT MOUNT — result meaningless" : `landed on ${r.landed}`);
}

// ------------------------------- an unknown is neither a pass nor a lock-out
for (const [name, cfg] of [
  ["the waitlist read fails", { roles: "none", waitlist: "error" }],
  ["the role read fails", { roles: "error", waitlist: "empty" }],
]) {
  const r = await visit(browser, { ...cfg, route: "/activity" });
  check(`${name}: shows the retry screen, not the page`,
    r.mounted && /couldn't check your account/i.test(r.text),
    !r.mounted ? "APP DID NOT MOUNT" : `landed ${r.landed}: ${r.text.slice(0, 70)}`);
  check(`${name}: stays on the requested URL so a retry can return to it`,
    r.landed === "/activity", `landed on ${r.landed}`);
}

// --------------------------------- known states still win over an unknown
{
  const r = await visit(browser, { roles: "error", waitlist: "pending", route: "/activity" });
  check("role read fails but the waitlist says pending: still the waitlist page",
    r.mounted && r.landed === "/waitlist",
    !r.mounted ? "APP DID NOT MOUNT" : `landed on ${r.landed}`);
}
{
  const r = await visit(browser, { roles: "none", waitlist: "rejected", route: "/activity" });
  check("a rejected account still reaches the rejected page",
    r.mounted && r.landed === "/waitlist-rejected", `landed on ${r.landed}`);
}

// ------------------- THE REGRESSION RISK: real users must still get through
{
  const r = await visit(browser, { roles: "student", waitlist: "empty", route: "/activity" });
  check("an approved STUDENT still reaches Activity",
    r.mounted && r.landed === "/activity", `landed on ${r.landed}`);
}
{
  const r = await visit(browser, { roles: "club", waitlist: "approved", route: "/applicants" });
  check("an approved CLUB still reaches Applicants",
    r.mounted && r.landed === "/applicants", `landed on ${r.landed}`);
}
{
  const r = await visit(browser, { roles: "student", waitlist: "empty", route: "/applicants" });
  check("a student asking for a CLUB page is still sent to Activity",
    r.mounted && r.landed === "/activity", `landed on ${r.landed}`);
}
{
  const r = await visit(browser, { roles: "club", waitlist: "empty", route: "/activity" });
  check("a club asking for a STUDENT page is still sent to Applicants",
    r.mounted && r.landed === "/applicants", `landed on ${r.landed}`);
}

// ------------------------------------------- the setup page behaves itself
{
  const r = await visit(browser, { roles: "none", waitlist: "empty", route: "/account-setup" });
  check("the setup page explains itself and offers a way out",
    r.mounted && /finishing your setup/i.test(r.text) && /Get help/i.test(r.text),
    r.text.slice(0, 90));
}
{
  const r = await visit(browser, { roles: "student", waitlist: "empty", route: "/account-setup" });
  check("an account that HAS a role never sits on the setup page",
    r.mounted && r.landed === "/activity", `landed on ${r.landed}`);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
