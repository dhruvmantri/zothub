/** G6-07 — declining an RSVP must ask first (maintainer decision 2026-10-11).
 *
 *  The applications side got this in UX18; RSVPs did not. The row's X, the
 *  phone card's button, the detail dialog's button and the bulk button all
 *  wrote status=cancelled and emailed the student on the first tap — and the
 *  bulk button acted on every selected row, confirmed attendees included.
 *
 *  As in UX18, the point is not "a dialog appears" but "NO write was sent while
 *  it was up", and that Cancel leaves everything alone.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const USER_ID = "22222222-2222-2222-2222-222222222222";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "club@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "club@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };

const soon = new Date(Date.now() + 3 * 864e5).toISOString();
const EVENT = { id: "e1", title: "Fall Kickoff", event_date: soon, location: "ISEB", rsvp_questions: [], requires_approval: true, club_id: "c1", club_profiles: { club_name: "Anteater Robotics" } };
const rsvp = (id, name, status) => ({ id, status, created_at: soon, answers: [], event: EVENT,
  student: { id: `s-${id}`, full_name: name, email: `${id}@uci.edu`, major: "CS", year: "Junior" } });
const RSVPS = [rsvp("r1", "Ada Lovelace", "pending"), rsvp("r2", "Grace Hopper", "pending"), rsvp("r3", "Alan Turing", "confirmed")];

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function open(viewport) {
  const ctx = await browser.newContext({ viewport });
  const writes = [];
  await ctx.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-127-auth-token", JSON.stringify(session)]);
  await ctx.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
  await ctx.route("**/functions/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }));
  await ctx.route("**/rest/v1/**", (r) => {
    const req = r.request();
    const u = new URL(req.url());
    const table = u.pathname.split("/").pop();
    const single = req.headers()["accept"]?.includes("pgrst.object");
    const j = (x) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(x) });
    if (req.method() === "HEAD") return r.fulfill({ status: 200, headers: { "content-range": "0-1/2", "access-control-expose-headers": "content-range", "access-control-allow-origin": "*" }, body: "" });
    if (req.method() === "PATCH") {
      writes.push({ table, body: req.postData(), query: u.search });
      const ids = (decodeURIComponent(u.search).match(/r\d/g) ?? []);
      return j(ids.map((id) => ({ id })));
    }
    if (table === "user_roles") return j(single ? { role: "club" } : [{ role: "club" }]);
    if (table === "club_profiles") return j(single ? { id: "c1", club_name: "Anteater Robotics", logo_url: null, user_id: USER_ID } : [{ id: "c1" }]);
    if (table === "events") return j([{ id: "e1", title: "Fall Kickoff" }]);
    if (table === "rsvps") return j(RSVPS);
    return j(single ? null : []);
  });
  await ctx.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/applicants/events`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2800);
  return { ctx, page, writes };
}

const dialog = (page) => page.getByRole("alertdialog");
// Either label, so a run against the old code (which said "Cancel RSVP") shows
// the real symptom — an immediate write — instead of failing to find a button.
const DECLINE_ROW = /^(Decline|Cancel) RSVP$/;
const DECLINE_BULK = /^(Decline|Cancel)$/;
const tryClick = (loc) => loc.click({ timeout: 3000 }).then(() => true, () => false);

// ---- desktop: the row's X ---------------------------------------------------
{
  const { ctx, page, writes } = await open({ width: 1280, height: 900 });
  const x = page.getByRole("button", { name: DECLINE_ROW }).first();
  check("desktop: the row's decline button is there (guard)", (await x.count()) > 0);
  await tryClick(x);
  await page.waitForTimeout(500);
  check("desktop row X: a confirmation opens", (await dialog(page).count()) === 1);
  check("desktop row X: it names the student", (await dialog(page).getByText(/Ada Lovelace/).count()) > 0);
  check("desktop row X: NOTHING was written while it is up", writes.length === 0, JSON.stringify(writes));
  if (await dialog(page).count()) {
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(400);
    check("desktop row X: Cancel writes nothing", writes.length === 0);
    await x.click();
    await tryClick(dialog(page).getByRole("button", { name: "Decline" }));
    await page.waitForTimeout(800);
  }
  check("desktop row X: Decline writes exactly that one RSVP as cancelled",
    writes.length === 1 && writes[0].body.includes("cancelled") && writes[0].query.includes("r1"), JSON.stringify(writes));
  await ctx.close();
}

// ---- desktop: bulk, with a confirmed attendee in the selection ---------------
{
  const { ctx, page, writes } = await open({ width: 1280, height: 900 });
  const boxes = page.getByRole("checkbox");
  const n = await boxes.count();
  if (n > 0) await boxes.first().click(); // select all
  await page.waitForTimeout(300);
  await tryClick(page.getByRole("button", { name: DECLINE_BULK }).first());
  await page.waitForTimeout(500);
  check("bulk: a confirmation opens", (await dialog(page).count()) === 1);
  check("bulk: it says how many", (await dialog(page).getByText(/Decline 3 RSVPs\?/).count()) > 0);
  check("bulk: it warns a confirmed attendee loses their spot", (await dialog(page).getByText(/already confirmed/).count()) > 0);
  check("bulk: NOTHING was written while it is up", writes.length === 0, JSON.stringify(writes));
  await ctx.close();
}

// ---- phone: the card button says Decline and asks first ----------------------
{
  const { ctx, page, writes } = await open({ width: 390, height: 844 });
  const btn = page.getByRole("button", { name: DECLINE_ROW }).first();
  const label = (await btn.textContent().catch(() => "")).trim();
  check("phone: the card's button says Decline, not Cancel", label === "Decline", `"${label}"`);
  await tryClick(btn);
  await page.waitForTimeout(500);
  check("phone: a confirmation opens", (await dialog(page).count()) === 1);
  check("phone: NOTHING was written while it is up", writes.length === 0, JSON.stringify(writes));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
