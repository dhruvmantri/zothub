/** UX33 — exactly one club tab may read as selected.
 *
 *  The sibling tabs live under their group's own path (/my-club/team under
 *  /my-club, /applicants/events under /applicants), so a bare prefix match
 *  marked the first tab current on every sibling page. Two tabs were drawn as
 *  selected AND two links carried aria-current="page", which is wrong for a
 *  screen reader, not merely untidy. The Postings group always had the
 *  exclusion; the other two never got it — so this walks all three, and would
 *  catch the same omission in a fourth.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const USER_ID = "44444444-4444-4444-4444-444444444444";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
  sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "club@uci.edu",
})}.sig`;
const user = {
  id: USER_ID, aud: "authenticated", role: "authenticated", email: "club@uci.edu",
  app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString(),
};
const session = {
  access_token: jwt, token_type: "bearer", expires_in: 3600,
  expires_at: exp, refresh_token: "r", user,
};

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(([k, s]) => window.localStorage.setItem(k, s),
  ["sb-127-auth-token", JSON.stringify(session)]);
await ctx.route("**/auth/v1/**", (route) => {
  const u = route.request().url();
  if (u.includes("/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
  if (u.includes("/token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});
await ctx.route("**/rest/v1/**", (route) => {
  const p = new URL(route.request().url()).pathname;
  const single = route.request().headers()["accept"]?.includes("pgrst.object");
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (p.endsWith("/user_roles")) return json(single ? { role: "club" } : [{ role: "club" }]);
  if (p.endsWith("/club_profiles")) return json(single ? { id: "cp1", club_name: "Test Club" } : [{ id: "cp1", club_name: "Test Club" }]);
  return json([]);
});
const page = await ctx.newPage();

const CASES = [
  { path: "/my-club", expect: "Overview" },
  { path: "/my-club/team", expect: "Team" },
  { path: "/my-club/analytics", expect: "Analytics" },
  { path: "/postings", expect: "Opportunities" },
  { path: "/postings/events", expect: "Events" },
  { path: "/applicants", expect: "Applications" },
  { path: "/applicants/events", expect: "RSVPs" },
];

for (const { path, expect } of CASES) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const state = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    return {
      total: tabs.length,
      selected: tabs.filter((t) => t.getAttribute("aria-selected") === "true").map((t) => t.textContent.trim()),
      current: tabs.filter((t) => t.getAttribute("aria-current") === "page").length,
    };
  }).catch(() => null);

  check(`${path} renders its tab group`, !!state && state.total >= 2, state ? `${state.total} tab(s)` : "no page");
  check(`${path} marks exactly one tab selected`,
    !!state && state.selected.length === 1, state ? `selected: [${state.selected.join(", ")}]` : "");
  check(`${path} selects ${expect}`,
    !!state && state.selected.length === 1 && state.selected[0].startsWith(expect),
    state ? state.selected.join(", ") : "");
  // aria-current is the half a sighted reviewer cannot see at all.
  check(`${path} exposes one current link to a screen reader`,
    !!state && state.current === 1, state ? `${state.current} with aria-current` : "");
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
