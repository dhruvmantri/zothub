/** The posting forms' buttons must all be on screen on a phone (audit G6-03).
 *
 *  Cancel, Save as draft and Publish sat in one non-wrapping row that needs
 *  ~470px. At 390px it overflowed to the LEFT, where a page cannot scroll, so
 *  scrollWidth never noticed: Cancel was simply gone, and Save as draft touched
 *  the screen edge. The assertion is each button's own box, not scrollWidth.
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
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "club@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "club@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };
const soon = new Date(Date.now() + 5 * 864e5).toISOString();
const TABLES = {
  user_roles: [{ role: "club" }],
  club_profiles: [{ id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }],
  opportunities: [{ id: "r1", club_id: "c1", title: "Lead", type: "leadership", description: "Lead the team this year.", requirements: "", deadline: soon, is_active: true, show_application_count: false, application_questions: [] }],
  events: [{ id: "e1", club_id: "c1", title: "Kickoff", description: "Robots.", event_date: soon, location: "ISEB", capacity: 40, banner_url: null, is_active: true, rsvp_questions: [], requires_approval: false }],
};

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

for (const path of ["/postings/new", "/postings/events/new", "/postings/r1/edit", "/postings/events/e1/edit"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-127-auth-token", JSON.stringify(session)]);
  await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
  await page.route("**/rest/v1/**", (r) => {
    const u = new URL(r.request().url());
    const single = r.request().headers()["accept"]?.includes("pgrst.object");
    const rows = TABLES[u.pathname.split("/").pop()] ?? [];
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(single ? rows[0] ?? null : rows) });
  });
  await page.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const boxes = await page.evaluate(() => {
    const wanted = [/^cancel$/i, /save as draft/i, /^(publish|save changes)/i];
    const els = [...document.querySelectorAll("form a, form button")];
    return wanted.map((re) => {
      const el = els.find((e) => re.test((e.textContent ?? "").trim()));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { text: (el.textContent ?? "").trim(), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
    });
  });
  const labels = ["Cancel", "Save as draft", "Publish / Save changes"];
  boxes.forEach((b, i) => {
    check(`${path}: "${labels[i]}" exists`, !!b);
    if (b) check(`${path}: "${labels[i]}" is fully on screen`, b.left >= 0 && b.right <= 390, `left ${b.left}, right ${b.right}`);
  });
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
