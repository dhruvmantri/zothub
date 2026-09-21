/**
 * UX24 — a follow notification must be reachable.
 *
 * Following is the reason a student comes back: follow a club, get told when
 * it posts. The telling worked; the getting-there did not. The trigger writes
 * `type = 'new_post'`, `getNotificationLink` had no case for it and returned
 * null for anything unrecognised, so the card rendered as PLAIN TEXT — the
 * student is told "Hack at UCI just posted: Marketing Lead" with no way to
 * open it. And because mark-as-read hangs off that same link, it never fired,
 * so the unread badge stayed lit after reading.
 *
 * The check is that the card is a LINK and that it points at the right one of
 * the two surfaces — `new_post` alone does not say whether `related_id` is an
 * opportunity or an event, so getting the destination right is the actual
 * work, not the anchor tag.
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

// Exactly what notify_followers_on_new_post() writes (20260710000300:46-53).
const NOTIFS = [
  { id: "n1", user_id: USER_ID, type: "new_post", is_read: false,
    title: "New opportunity from Hack at UCI",
    message: "Hack at UCI just posted: Marketing Lead",
    related_id: "opp-1", created_at: new Date().toISOString() },
  { id: "n2", user_id: USER_ID, type: "new_post", is_read: false,
    title: "New event from Hack at UCI",
    message: "Hack at UCI just posted: Kickoff Night",
    related_id: "evt-1", created_at: new Date().toISOString() },
];

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
  ["sb-127-auth-token", JSON.stringify(session)]);
await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
  body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
await page.route("**/rest/v1/**", (r) => {
  const u = new URL(r.request().url());
  const single = r.request().headers()["accept"]?.includes("pgrst.object");
  const j = (x) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(x) });
  if (u.pathname.endsWith("/user_roles")) return j(single ? { role: "student" } : [{ role: "student" }]);
  if (u.pathname.endsWith("/student_profiles"))
    return j(single ? { id: "sp1", full_name: "Sam Okafor", avatar_url: null, user_id: USER_ID } : [{ id: "sp1" }]);
  if (u.pathname.endsWith("/notifications")) return j(NOTIFS);
  if (u.pathname.endsWith("/waitlist")) return j(single ? null : []);
  return j([]);
});
await page.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

await page.goto(`${BASE}/notifications`, { waitUntil: "domcontentloaded" }).catch(() => {});
await page.waitForTimeout(2500);

const mounted = await page.evaluate(() => {
  const r = document.getElementById("root");
  return !!r && r.children.length > 0;
}).catch(() => false);
check("the notifications page mounted", mounted, mounted ? "" : "server down — everything below is meaningless");

const roleCard = page.getByText("New opportunity from Hack at UCI").first();
const eventCard = page.getByText("New event from Hack at UCI").first();
check("the role notification is shown at all", await roleCard.isVisible().catch(() => false));

// The defect: rendered, but not a link.
const roleHref = await roleCard.evaluate((el) => el.closest("a")?.getAttribute("href") ?? null).catch(() => null);
const eventHref = await eventCard.evaluate((el) => el.closest("a")?.getAttribute("href") ?? null).catch(() => null);

check("a new-role notification is a LINK, not dead text",
  roleHref !== null, "rendered as plain text — nothing to click");
check("it opens the role it is telling you about",
  roleHref === "/opportunities/opp-1", `href = ${roleHref}`);
check("a new-event notification is a LINK, not dead text",
  eventHref !== null, "rendered as plain text — nothing to click");
check("it opens the event, not the roles list",
  eventHref === "/events/evt-1", `href = ${eventHref}`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
