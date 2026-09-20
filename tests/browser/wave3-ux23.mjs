/**
 * UX23 — the Apply button must not be live while we still do not know whether
 * this student has already applied.
 *
 * Slows the applications read so the window is observable, then checks the
 * button before and after it resolves.
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

// o1 is already applied to. Without the fix it renders a live "Apply" until the
// applications read lands, and tapping it fails with a 23505.
const OPPS = [{
  id: "o1", title: "Marketing Lead", type: "leadership", description: "Run the socials.",
  deadline: new Date(Date.now() + 86400000 * 14).toISOString(), club_id: "c1",
  club_profiles: { club_name: "Hack at UCI", logo_url: null }, applications_count: 1, show_application_count: true,
}];

const APPLICATIONS_DELAY_MS = 2500;
const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage();
await page.addInitScript(([k, s]) => { window.localStorage.setItem(k, s); },
  ["sb-127-auth-token", JSON.stringify(session)]);

await page.route("**/auth/v1/**", (route) => {
  const u = route.request().url();
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (u.includes("/user")) return json(user);
  if (u.includes("/token")) return json(session);
  return json({});
});
await page.route("**/rest/v1/**", async (route) => {
  const p = new URL(route.request().url()).pathname;
  const single = route.request().headers()["accept"]?.includes("pgrst.object");
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (p.endsWith("/user_roles")) return json(single ? { role: "student" } : [{ role: "student" }]);
  if (p.endsWith("/student_profiles")) return json(single ? { id: "sp1" } : [{ id: "sp1" }]);
  if (p.endsWith("/applications")) {
    await new Promise((r) => setTimeout(r, APPLICATIONS_DELAY_MS));
    return json([{ opportunity_id: "o1" }]);
  }
  if (p.endsWith("/opportunities")) return json(OPPS);
  return json([]);
});

await page.goto(`${BASE}/opportunities`, { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Marketing Lead" }).first().waitFor({ timeout: 15000 });

// The applications read is still in flight here.
//
// Matched by TEXT, not by role, on purpose: without the fix the same "Apply"
// renders as a <Link> rather than a disabled <button>, and a role-scoped
// locator would time out and crash instead of reporting a clean failure.
const apply = page.locator('a,button').filter({ hasText: /^Apply$/ }).first();
await apply.waitFor({ timeout: 8000 }).catch(() => {});
const tag = await apply.evaluate((el) => el.tagName.toLowerCase()).catch(() => "<none>");
const disabled = tag === "button" ? await apply.isDisabled().catch(() => false) : false;

check("while the answer is unknown, Apply is not clickable", tag === "button" && disabled,
  `rendered as <${tag}>${tag === "button" ? `, disabled: ${disabled}` : " — a live link, so a student can tap it"}`);
check("the button still reads 'Apply' (no layout shift, no new word)",
  (await apply.innerText().catch(() => "")).trim() === "Apply");

// Now let it land.
await page.getByRole("button", { name: /^Applied$/ }).first().waitFor({ timeout: 15000 });
check("once the answer lands, the button reads 'Applied'", true);
check("no live Apply survives on an already-applied role",
  (await page.locator('a,button').filter({ hasText: /^Apply$/ }).count()) === 0);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
