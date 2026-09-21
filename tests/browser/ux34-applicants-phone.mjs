/** UX34 — a club must be able to decide an applicant from a phone.
 *
 *  The queue was a 760px table inside a 356px scroller, so on a 390px phone the
 *  Accept and Decline buttons sat around x=694–761 — roughly 300px past the
 *  right edge, with no scrollbar and no hint they existed. Measured on
 *  production with the real club account. Deciding applicants is the club's
 *  entire job on ZotHub, and club officers are phone-first.
 *
 *  The assertion is geometric on purpose: not "a card exists", but "the button
 *  a club has to press is inside the screen". A layout that looks stacked and
 *  still overflows would pass the easier check.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const USER_ID = "55555555-5555-5555-5555-555555555555";

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

const LONG_NAME = "Konstantina Papadopoulou-Andersson";
const APPS = [
  { id: "a1", name: LONG_NAME, email: "kpa@uci.edu" },
  { id: "a2", name: "Grace Hopper", email: "grace@uci.edu" },
  { id: "a3", name: "Alan Turing", email: "alan@uci.edu" },
].map(({ id, name, email }) => ({
  id, status: "pending", created_at: new Date().toISOString(),
  resume_url: "https://example.test/cv.pdf", answers: [],
  opportunity: { id: "o1", title: "Marketing Lead", application_questions: [], club_id: "cp1" },
  student: { id: `s-${id}`, full_name: name, email, major: "Informatics", year: "Junior" },
}));

const RSVPS = [
  { id: "r1", name: LONG_NAME, email: "kpa@uci.edu" },
  { id: "r2", name: "Grace Hopper", email: "grace@uci.edu" },
].map(({ id, name, email }) => ({
  id, status: "pending", created_at: new Date().toISOString(), answers: [],
  event: { id: "e1", title: "Fall Kickoff", event_date: new Date(Date.now() + 864e5).toISOString(),
           club_id: "cp1", rsvp_questions: [] },
  student: { id: `s-${id}`, full_name: name, email, major: "Informatics", year: "Junior" },
}));

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function openAt(width, height, path = "/applicants") {
  const ctx = await browser.newContext({ viewport: { width, height } });
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
    if (route.request().method() === "PATCH") return json([]);
    if (p.endsWith("/user_roles")) return json(single ? { role: "club" } : [{ role: "club" }]);
    if (p.endsWith("/club_profiles")) return json(single ? { id: "cp1", club_name: "Test Club" } : [{ id: "cp1", club_name: "Test Club" }]);
    if (p.endsWith("/applications")) return json(APPS);
    if (p.endsWith("/rsvps")) return json(RSVPS);
    if (p.endsWith("/events")) return json([{ id: "e1", title: "Fall Kickoff" }]);
    if (p.endsWith("/opportunities")) return json([{ id: "o1", title: "Marketing Lead" }]);
    return json([]);
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  return { ctx, page };
}

// ---- phone -----------------------------------------------------------------
{
  const { ctx, page } = await openAt(390, 844);
  const mounted = await page.evaluate(() => {
    const r = document.getElementById("root");
    return !!r && r.children.length > 0;
  }).catch(() => false);
  check("the queue mounted on a phone", mounted, mounted ? "" : "server down — rest is meaningless");

  const decline = page.getByRole("button", { name: "Decline application" });
  check("every applicant offers a decline control", (await decline.count()) === 3,
    `${await decline.count()} control(s)`);

  const boxes = await decline.evaluateAll((els) =>
    els.map((el) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right) }; }));
  const offscreen = boxes.filter((b) => b.right > 390 || b.left < 0);
  check("every decline control is inside the screen", offscreen.length === 0,
    offscreen.length ? `${offscreen.length} off screen, e.g. right=${offscreen[0].right}` : `rightmost ${Math.max(...boxes.map((b) => b.right))}px`);

  const accept = page.getByRole("button", { name: "Accept application" });
  const aBoxes = await accept.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().right)));
  check("every accept control is inside the screen", aBoxes.every((r) => r <= 390),
    `rightmost ${Math.max(...aBoxes)}px`);

  check("the buttons say what they do, not just an icon",
    /Decline/.test((await page.textContent("body")) ?? "") && /Accept/.test((await page.textContent("body")) ?? ""));

  const geom = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
  check("the page itself does not scroll sideways", geom.scroll <= geom.view + 1,
    `${geom.scroll}px in ${geom.view}px`);

  // Deliberately NOT `body text contains the name`: `truncate` clips visually
  // while textContent keeps the whole string, so that check would pass on the
  // very layout this file exists to replace. Measure the room the name gets.
  const nameWidth = await page.evaluate((name) => {
    const el = [...document.querySelectorAll("p")].find((e) => e.textContent.trim() === name);
    return el ? Math.round(el.clientWidth) : 0;
  }, LONG_NAME);
  check("a long applicant name gets real room, not an 89px column",
    nameWidth >= 180, `${nameWidth}px (the table gave it 89px)`);

  // The control has to work, not merely be reachable.
  await decline.first().click().catch(() => {});
  await page.waitForTimeout(500);
  check("pressing it opens the confirmation", (await page.getByRole("alertdialog").count()) === 1);

  await ctx.close();
}

// ---- desktop keeps the table ------------------------------------------------
{
  const { ctx, page } = await openAt(1280, 900);
  check("the desktop table is still what renders",
    (await page.getByText("Applicant", { exact: true }).count()) >= 1);
  check("the phone cards do not double up the controls on desktop",
    (await page.getByRole("button", { name: "Decline application" }).count()) === 3,
    `${await page.getByRole("button", { name: "Decline application" }).count()} control(s)`);
  await ctx.close();
}

// ---- the RSVP queue, which was the worse of the two ------------------------
// Its container is overflow-hidden with fixed columns, so the row did not
// scroll — it clipped. The controls were not merely awkward to reach, they
// were unreachable.
{
  const { ctx, page } = await openAt(390, 844, "/applicants/events");
  const cancel = page.getByRole("button", { name: "Cancel RSVP" });
  const confirm = page.getByRole("button", { name: "Confirm RSVP" });
  check("the RSVP queue offers its controls on a phone",
    (await cancel.count()) === 2 && (await confirm.count()) === 2,
    `${await confirm.count()} confirm / ${await cancel.count()} cancel`);

  const rights = await cancel.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
  const cRights = await confirm.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().right)));
  check("every RSVP control is inside the screen",
    [...rights, ...cRights].every((r) => r <= 390),
    `rightmost ${Math.max(...rights, ...cRights)}px`);

  const geom = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
  check("the RSVP page does not scroll sideways", geom.scroll <= geom.view + 1,
    `${geom.scroll}px in ${geom.view}px`);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
