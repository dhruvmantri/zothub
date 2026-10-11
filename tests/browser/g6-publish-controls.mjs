/** G6-06 — one publish control per form (maintainer decision 2026-10-11).
 *
 *  Create forms carried a "Publish immediately" switch AND "Save as Draft" AND
 *  "Publish": switch off + Publish saved a draft while the popup said "now live
 *  and students can start applying". Edit forms carried a "Published" switch AND
 *  "Save as Draft", which unpublished a live posting while the switch still
 *  read Published.
 *
 *  Judged by what is SENT (is_active) and what the officer is told.
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
const ROLE = { id: "r1", club_id: "c1", title: "Lead", type: "leadership", description: "Lead the build team this year.", requirements: "", deadline: soon, is_active: true, show_application_count: false, application_questions: [], created_at: soon, views: 0 };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function open(path) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const writes = [];
  await ctx.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-127-auth-token", JSON.stringify(session)]);
  await ctx.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
  await ctx.route("**/rest/v1/**", (r) => {
    const req = r.request();
    const u = new URL(req.url());
    const t = u.pathname.split("/").pop();
    const single = req.headers()["accept"]?.includes("pgrst.object");
    const j = (x, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(x) });
    if (["POST", "PATCH"].includes(req.method())) {
      let body = null; try { body = JSON.parse(req.postData() ?? "null"); } catch {}
      writes.push({ t, method: req.method(), body: Array.isArray(body) ? body[0] : body });
      return j(single ? { id: "new1" } : [{ id: "new1" }], 201);
    }
    if (t === "user_roles") return j(single ? { role: "club" } : [{ role: "club" }]);
    if (t === "club_profiles") return j(single ? { id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID } : [{ id: "c1" }]);
    if (t === "opportunities") return j(single ? ROLE : [ROLE]);
    return j(single ? null : []);
  });
  await ctx.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  return { ctx, page, writes };
}

async function fillRole(page) {
  await page.locator("#title").fill("Competition Team Lead");
  await page.locator("#description").fill("Lead our entry into the regional robotics competition this year.");
  // Radix select for the role type
  await page.getByRole("combobox").first().click();
  await page.getByRole("option").first().click();
}

// ---- Create: no switch, two choices, each does what it says --------------------
{
  const { ctx, page, writes } = await open("/postings/new");
  check("create: there is no 'Publish immediately' switch", (await page.getByRole("switch", { name: /publish immediately/i }).count()) === 0);
  check("create: a 'Save as draft' button", (await page.getByRole("button", { name: /^save as draft$/i }).count()) === 1);
  check("create: a 'Publish' button", (await page.getByRole("button", { name: /^publish$/i }).count()) === 1);
  await fillRole(page);
  await page.getByRole("button", { name: /^publish$/i }).click();
  await page.waitForTimeout(1500);
  const w = writes.find((x) => x.t === "opportunities");
  check("create → Publish sends is_active: true", w?.body?.is_active === true, JSON.stringify(w?.body ?? null).slice(0, 80));
  check("create → Publish says it is live (true now)", (await page.getByText(/is now live|published/i).count()) > 0);
  await ctx.close();
}
{
  const { ctx, page, writes } = await open("/postings/new");
  await fillRole(page);
  await page.getByRole("button", { name: /^save as draft$/i }).click();
  await page.waitForTimeout(1500);
  const w = writes.find((x) => x.t === "opportunities");
  check("create → Save as draft sends is_active: false", w?.body?.is_active === false, JSON.stringify(w?.body ?? null).slice(0, 80));
  check("create → Save as draft never says 'now live'", (await page.getByText(/now live/i).count()) === 0);
  await ctx.close();
}

// ---- Edit: one switch, Save changes honours it ----------------------------------
{
  const { ctx, page, writes } = await open("/postings/r1/edit");
  check("edit: no 'Save as draft' button beside the switch", (await page.getByRole("button", { name: /save as draft/i }).count()) === 0);
  const sw = page.getByRole("switch", { name: "Published" });
  check("edit: the Published switch is the visibility control", (await sw.count()) === 1);
  await sw.click(); // turn it OFF
  await page.getByRole("button", { name: /^save changes$/i }).click();
  await page.waitForTimeout(1500);
  const w = writes.find((x) => x.t === "opportunities");
  check("edit → switch off + Save changes sends is_active: false", w?.body?.is_active === false, JSON.stringify(w?.body ?? null).slice(0, 80));
  check("edit → it says students can't see it", (await page.getByText(/unpublished, so students can't see it/i).count()) > 0);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
