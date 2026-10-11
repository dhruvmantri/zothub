/** Editing a role or event must not move its date (audit G6-02, 2026-10-10).
 *
 *  The edit forms filled their datetime-local input with the UTC wall-clock,
 *  which the input shows — and the save reads back — as LOCAL time. In
 *  California every save, even one that only fixed a typo, moved the event or
 *  the application deadline 7 hours later (8 in winter), and the reminder
 *  emails moved with it.
 *
 *  Run in America/Los_Angeles on purpose: in UTC this bug is invisible, which
 *  is presumably how it shipped. Judged by the value the club SEES and by the
 *  instant actually sent to the database on save — not by reading code.
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

const CLUB = { id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID };
const CASES = [
  // 6:00pm PDT on Oct 20 = 01:00Z Oct 21 — the evening event that lands on the wrong DAY when shifted.
  { kind: "event", path: "/postings/events/e1/edit", table: "events", field: "event_date", input: "#eventDate",
    stored: "2026-10-21T01:00:00+00:00", shows: "2026-10-20T18:00",
    row: { id: "e1", club_id: "c1", title: "Fall Kickoff", description: "Robots.", location: "ISEB 1010",
           capacity: 40, banner_url: null, is_active: true, rsvp_questions: [], requires_approval: false } },
  // 11:59pm PST on Dec 4 = 07:59Z Dec 5 — a winter deadline, so the 8-hour offset is covered too.
  { kind: "role", path: "/postings/r1/edit", table: "opportunities", field: "deadline", input: "#deadline",
    stored: "2026-12-05T07:59:00+00:00", shows: "2026-12-04T23:59",
    row: { id: "r1", club_id: "c1", title: "Competition Team Lead", type: "leadership", description: "Lead the build team for the regional competition.",
           requirements: "", is_active: true, show_application_count: false, application_questions: [] } },
];

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Los_Angeles" });
  const page = await ctx.newPage();
  const writes = [];
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-127-auth-token", JSON.stringify(session)]);
  await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
  await page.route("**/rest/v1/**", (r) => {
    const req = r.request();
    const u = new URL(req.url());
    const single = req.headers()["accept"]?.includes("pgrst.object");
    const j = (x) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(x) });
    if (req.method() === "PATCH") {
      try { writes.push({ table: u.pathname.split("/").pop(), body: JSON.parse(req.postData() ?? "{}") }); } catch { writes.push({ body: null }); }
      return r.fulfill({ status: 204, body: "" });
    }
    if (u.pathname.endsWith("/user_roles")) return j(single ? { role: "club" } : [{ role: "club" }]);
    if (u.pathname.endsWith("/club_profiles")) return j(single ? CLUB : [CLUB]);
    if (u.pathname.endsWith(`/${c.table}`)) {
      const row = { ...c.row, [c.field]: c.stored };
      return j(single ? row : [row]);
    }
    return j(single ? null : []);
  });
  await page.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  await page.goto(`${BASE}${c.path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  check(`${c.kind}: the page runs in California (guard: UTC hides this bug)`, zone === "America/Los_Angeles", zone);

  const shown = await page.locator(c.input).inputValue().catch(() => "(no input)");
  check(`${c.kind}: the form shows the club's local time`, shown === c.shows, `shows ${shown}, expected ${c.shows}`);

  // Change nothing; just save.
  await page.getByRole("button", { name: /Save Changes/i }).click();
  await page.waitForTimeout(1500);
  const w = writes.find((x) => x.table === c.table);
  check(`${c.kind}: saving sends an update`, !!w, JSON.stringify(writes).slice(0, 120));
  const sent = w?.body?.[c.field];
  const drift = sent ? (Date.parse(sent) - Date.parse(c.stored)) / 3_600_000 : NaN;
  check(`${c.kind}: an untouched save keeps the same instant`, drift === 0, `sent ${sent} (moved ${drift}h)`);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
