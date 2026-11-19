/** CP1 step 3 — external Apply/RSVP buttons, the club's link field, and "Show more".
 *
 *  Maintainer decisions of 2026-11-19 (docs/BACKLOG.md):
 *   - a post with the club's own link shows "Apply Externally" / "RSVP Externally"
 *     IN PLACE OF ZotHub's Apply / RSVP — for signed-out visitors too, with no
 *     sign-in step;
 *   - clubs may add that link themselves on their posting forms;
 *   - in-app counts ("N applied", "N going", "spots left") are not shown on such
 *     a post, because they would only ever count in-app responses.
 *  And the lists, which stopped at 50 with no way to see more, now load 50 at a
 *  time IN THE DATABASE'S ORDER — judged on the requests, because a client-side
 *  sort and a database sort look identical on screen (tests/browser/README.md).
 *
 *  Everything runs in both themes and at phone width, with mocked REST.
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

const FORM = "https://forms.gle/cp1TestForm";
const soon = (d) => new Date(Date.now() + 86400000 * d).toISOString();
const CLUB = { id: "c1", club_name: "AI at UCI", logo_url: null, description: "Machine learning club.", website_url: null };

const ROLE_EXT = { id: "o-ext", title: "Events Committee", type: "committee", description: "Plan our socials.", requirements: null,
  deadline: soon(10), show_application_count: true, applications_count: 7, created_at: soon(-1), club_id: "c1",
  external_url: FORM, application_questions: [{ id: "q1", type: "short_text", question: "Why us?", required: true }], club_profiles: CLUB };
const ROLE_OWN = { ...ROLE_EXT, id: "o-own", title: "Treasurer", external_url: null };
const ROLE_BAD = { ...ROLE_EXT, id: "o-bad", title: "Webmaster", external_url: "javascript:alert(1)" };
const EVENT_EXT = { id: "e-ext", title: "Intro to LLMs Workshop", description: "Bring a laptop.", event_date: soon(5), location: "DBH 6011",
  capacity: 40, banner_url: null, requires_approval: true, confirmed_rsvps_count: 12, external_url: FORM,
  rsvp_questions: [], club_id: "c1", club_profiles: CLUB };
const EVENT_OWN = { ...EVENT_EXT, id: "e-own", title: "Paper Reading Night", external_url: null };

const byId = Object.fromEntries([ROLE_EXT, ROLE_OWN, ROLE_BAD, EVENT_EXT, EVENT_OWN].map((r) => [r.id, r]));
const idOf = (u) => (u.searchParams.get("id") ?? "").replace(/^eq\./, "");

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function open(path, { theme = "light", width = 1280, signedIn = false, rest } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
  if (signedIn) {
    await ctx.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-127-auth-token", JSON.stringify(session)]);
  }
  await ctx.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: signedIn && r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
  await ctx.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.route("**/rest/v1/**", (r) => {
    const req = r.request();
    const u = new URL(req.url());
    const table = u.pathname.split("/").pop();
    const single = req.headers()["accept"]?.includes("pgrst.object");
    const j = (x, headers = {}) => r.fulfill({ status: 200, contentType: "application/json",
      headers: { "access-control-expose-headers": "content-range", "access-control-allow-origin": "*", ...headers }, body: JSON.stringify(x) });
    if (rest) { const handled = rest(r, { req, u, table, single, j }); if (handled) return handled; }
    if (table === "user_roles") return j(single ? { role: "club" } : [{ role: "club" }]);
    if (table === "club_profiles") return j(single ? { ...CLUB, user_id: USER_ID } : [{ ...CLUB, user_id: USER_ID }]);
    if ((table === "opportunities" || table === "events") && idOf(u)) return j(single ? byId[idOf(u)] ?? null : [byId[idOf(u)]]);
    return j(single ? null : []);
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2500);
  const mounted = await page.evaluate(() => (document.getElementById("root")?.children.length ?? 0) > 0);
  return { ctx, page, mounted };
}

// innerText is the RENDERED text — a Tag with text-transform: uppercase reads
// "APPROVAL NEEDED" — so every text check below is case-insensitive.
const text = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Rendered contrast of an element's text against the first opaque background behind it. */
const contrastOf = (locator) => locator.evaluate((el) => {
  const parse = (c) => { const m = (c.match(/[\d.]+/g) || []).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const lum = (rgb) => rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const fg = parse(getComputedStyle(el).color);
  let bg = null;
  for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0.99) { bg = c; break; } }
  bg ??= parse(getComputedStyle(document.body).backgroundColor);
  const [hi, lo] = [lum([fg.r, fg.g, fg.b]), lum([bg.r, bg.g, bg.b])].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
});

// ============================================================ 1. detail pages, signed out
for (const theme of ["light", "dark"]) {
  for (const width of [1280, 390]) {
    const tag = `${theme}/${width}px`;

    // --- a role with the club's own form
    let { ctx, page, mounted } = await open("/opportunities/o-ext", { theme, width });
    check(`${tag} role: the app mounted (guard)`, mounted);
    const applyLinks = page.getByRole("link", { name: /Apply Externally/ });
    const nApply = await applyLinks.count();
    check(`${tag} role: "Apply Externally" is offered to a signed-out visitor`, nApply >= 1, `${nApply} found`);
    if (nApply) {
      const a = applyLinks.first();
      check(`${tag} role: it goes to the club's form`, (await a.getAttribute("href")) === FORM, await a.getAttribute("href"));
      check(`${tag} role: it opens in a new tab, safely`,
        (await a.getAttribute("target")) === "_blank" && /noopener/.test((await a.getAttribute("rel")) ?? ""));
      check(`${tag} role: its name says it opens a new tab`, /new tab/.test((await a.getAttribute("aria-label")) ?? ""));
      const ratio = await contrastOf(a);
      check(`${tag} role: the button text is AA (≥ 4.5:1)`, ratio >= 4.5, ratio.toFixed(2));
    }
    let t = await text(page);
    check(`${tag} role: no "Log in to apply" (nothing to sign in for)`, !/Log in to apply/i.test(t));
    check(`${tag} role: no in-app applicant count`, !/have applied|has applied|\d+ applied/i.test(t));
    check(`${tag} role: ZotHub's application questions are not advertised`, !/What you'll be asked/i.test(t));
    check(`${tag} role: no sideways scroll`, await noSideways(page));
    if (theme === "light" && width === 390) await page.screenshot({ path: "/tmp/claude-0/cp1-role-ext-phone.png", fullPage: true });
    if (theme === "dark" && width === 1280) await page.screenshot({ path: "/tmp/claude-0/cp1-role-ext-dark.png", fullPage: true });
    await ctx.close();

    // --- an event with the club's own form
    ({ ctx, page, mounted } = await open("/events/e-ext", { theme, width }));
    check(`${tag} event: the app mounted (guard)`, mounted);
    const rsvpLinks = page.getByRole("link", { name: /RSVP Externally/ });
    const nRsvp = await rsvpLinks.count();
    check(`${tag} event: "RSVP Externally" is offered to a signed-out visitor`, nRsvp >= 1, `${nRsvp} found`);
    if (nRsvp) {
      const a = rsvpLinks.first();
      check(`${tag} event: it goes to the club's form`, (await a.getAttribute("href")) === FORM);
      check(`${tag} event: it opens in a new tab, safely`,
        (await a.getAttribute("target")) === "_blank" && /noopener/.test((await a.getAttribute("rel")) ?? ""));
      const ratio = await contrastOf(a);
      check(`${tag} event: the button text is AA (≥ 4.5:1)`, ratio >= 4.5, ratio.toFixed(2));
    }
    t = await text(page);
    check(`${tag} event: no "Log in to RSVP"`, !/Log in to RSVP/i.test(t));
    check(`${tag} event: no "Approval needed" (ZotHub's approval step doesn't apply)`, !/Approval needed/i.test(t));
    check(`${tag} event: no in-app head-count or spots left`, !/\d+ going|spots left/i.test(t), (t.match(/\d+ going|\d+ spots left/g) ?? []).join(", "));
    check(`${tag} event: no sideways scroll`, await noSideways(page));
    if (theme === "light" && width === 390) await page.screenshot({ path: "/tmp/claude-0/cp1-event-ext-phone.png", fullPage: true });
    if (theme === "dark" && width === 390) await page.screenshot({ path: "/tmp/claude-0/cp1-event-ext-phone-dark.png", fullPage: true });
    await ctx.close();
  }
}

// ============================================================ 2. ordinary posts are unchanged
{
  let { ctx, page } = await open("/opportunities/o-own");
  let t = await text(page);
  check("own-form role: still says \"Log in to apply\" to a visitor", /Log in to apply/.test(t));
  check("own-form role: no external button", (await page.getByRole("link", { name: /Apply Externally/ }).count()) === 0);
  check("own-form role: still shows its applicant count", /7 people have applied/.test(t));
  await ctx.close();

  ({ ctx, page } = await open("/events/e-own"));
  t = await text(page);
  check("own-form event: still says \"Log in to RSVP\"", /Log in to RSVP/.test(t));
  check("own-form event: still shows its head-count", /12 going/.test(t));
  check("own-form event: still shows \"Approval needed\"", /Approval needed/i.test(t));
  await ctx.close();

  // A stored link that is not plain https never becomes an href.
  ({ ctx, page } = await open("/opportunities/o-bad"));
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("a non-https stored link is never rendered as a link", !hrefs.some((h) => /^javascript:/i.test(h ?? "")));
  check("…and the role falls back to ZotHub's own Apply", /Log in to apply/.test(await text(page)));
  await ctx.close();
}

// ============================================================ 3. lists: no counts on external posts
{
  const listRole = (r) => ({ id: r.id, title: r.title, type: r.type, description: r.description, deadline: r.deadline,
    club_id: "c1", applications_count: r.applications_count, show_application_count: true, external_url: r.external_url,
    club_profiles: { club_name: "AI at UCI", logo_url: null } });
  let { ctx, page } = await open("/opportunities", {
    rest: (r, { table, j }) => table === "opportunities" ? j([listRole(ROLE_EXT), { ...listRole(ROLE_OWN), applications_count: 9 }]) : null,
  });
  await page.getByRole("heading", { name: "Treasurer" }).first().waitFor({ timeout: 15000 }).catch(() => {});
  let t = await text(page);
  check("roles list: the ordinary role still shows \"9 applied\"", /9 applied/.test(t));
  check("roles list: the external role shows no count", !/7 applied/.test(t));
  await ctx.close();

  const listEvent = (e) => ({ id: e.id, title: e.title, description: null, event_date: e.event_date, location: e.location,
    capacity: e.capacity, banner_url: null, club_id: "c1", confirmed_rsvps_count: e.confirmed_rsvps_count, external_url: e.external_url,
    club_profiles: { club_name: "AI at UCI", logo_url: null } });
  ({ ctx, page } = await open("/events", {
    rest: (r, { table, j }) => table === "events" ? j([listEvent(EVENT_EXT), { ...listEvent(EVENT_OWN), confirmed_rsvps_count: 30 }]) : null,
  }));
  await page.getByRole("heading", { name: "Paper Reading Night" }).first().waitFor({ timeout: 15000 }).catch(() => {});
  t = await text(page);
  check("events list: the ordinary event still shows spots left", /10 left/.test(t), (t.match(/\d+ left/g) ?? []).join(", "));
  check("events list: the external event shows no spots left", !/28 left/.test(t));
  await ctx.close();
}

// ============================================================ 4. "Show more", judged on the requests
for (const kind of ["events", "opportunities"]) {
  const TOTAL = 120;
  const rows = Array.from({ length: TOTAL }, (_, i) => kind === "events"
    ? { id: `ev${String(i).padStart(3, "0")}`, title: `Event number ${i}`, description: null, event_date: soon(1 + i / 10), location: null,
        capacity: null, banner_url: null, club_id: "c1", confirmed_rsvps_count: 0, external_url: null, club_profiles: { club_name: "AI at UCI", logo_url: null } }
    : { id: `ro${String(i).padStart(3, "0")}`, title: `Role number ${i}`, type: "committee", description: null, deadline: null,
        club_id: "c1", applications_count: 0, show_application_count: false, external_url: null, club_profiles: { club_name: "AI at UCI", logo_url: null } });
  const listReqs = [];
  const { ctx, page } = await open(`/${kind}`, {
    width: 390,
    rest: (r, { req, u, table, j }) => {
      if (table !== kind || u.searchParams.get("id")) return null;
      if (!/count=exact/.test(req.headers()["prefer"] ?? "")) return null; // a decorating count read, not the list
      listReqs.push(u.search);
      const offset = Number(u.searchParams.get("offset") ?? 0);
      const limit = Number(u.searchParams.get("limit") ?? 50);
      const slice = rows.slice(offset, offset + limit);
      return j(slice, { "content-range": `${offset}-${offset + slice.length - 1}/${TOTAL}` });
    },
  });
  const noun = kind === "events" ? "events" : "roles";
  const first = kind === "events" ? "Event number 0" : "Role number 0";
  await page.getByRole("heading", { name: first, exact: true }).first().waitFor({ timeout: 15000 }).catch(() => {});
  const r0 = listReqs[0] ?? "";
  check(`${kind}: the first page asks the database for 50, from the top`, /offset=0/.test(r0) && /limit=50/.test(r0), r0.slice(0, 160));
  check(`${kind}: the order has a unique last key (id), so pages never overlap`, /order=[^&]*id\.asc/.test(decodeURIComponent(r0)), decodeURIComponent(r0).match(/order=[^&]*/)?.[0]);
  let t = await text(page);
  check(`${kind}: it says how much is loaded out of how much exists`, new RegExp(`Showing 50 of 120 ${noun}`).test(t));
  const more = page.getByRole("button", { name: new RegExp(`Show more ${noun}`) });
  check(`${kind}: a "Show more" button is there`, (await more.count()) === 1);
  check(`${kind}: no sideways scroll on a phone`, await noSideways(page));
  if (kind === "events") await page.screenshot({ path: "/tmp/claude-0/cp1-show-more-phone.png", fullPage: false, clip: undefined });
  await more.click().catch(() => {});
  await page.getByRole("heading", { name: kind === "events" ? "Event number 99" : "Role number 99", exact: true }).first().waitFor({ timeout: 10000 }).catch(() => {});
  const r1 = listReqs[1] ?? "";
  check(`${kind}: "Show more" asks for the NEXT 50 in the same order`, /offset=50/.test(r1) && /limit=50/.test(r1)
    && decodeURIComponent(r1).match(/order=[^&]*/)?.[0] === decodeURIComponent(r0).match(/order=[^&]*/)?.[0], r1.slice(0, 160));
  t = await text(page);
  check(`${kind}: page two is on screen`, new RegExp(`${kind === "events" ? "Event" : "Role"} number 99`).test(t));
  check(`${kind}: …after page one, not instead of it`, new RegExp(`${kind === "events" ? "Event" : "Role"} number 0 `).test(t + " "));
  await more.click().catch(() => {});
  await page.waitForTimeout(1500);
  t = await text(page);
  check(`${kind}: the last 20 arrive and the button goes away`, /number 119/.test(t) && (await more.count()) === 0);

  if (kind === "events") {
    // Switching the sort starts again from page one, in the new order.
    const before = listReqs.length;
    const sortBox = page.getByRole("combobox", { name: "Sort events" });
    check("events: the sort control is there (guard)", (await sortBox.count()) === 1);
    await sortBox.click().catch(() => {});
    await page.getByRole("option", { name: "Most popular" }).click().catch(() => {});
    await page.waitForTimeout(1500);
    const rs = listReqs.slice(before);
    check("events: a new sort starts again from the first 50 — ordered by the database",
      rs.some((r) => /offset=0/.test(r) && /order=confirmed_rsvps_count\.desc/.test(decodeURIComponent(r))), rs.map((r) => decodeURIComponent(r).match(/order=[^&]*/)?.[0]).join(" | ") || "no request");
  }
  await ctx.close();
}

// ============================================================ 5. the club's forms carry the link
// Each scenario opens a FRESH form: a successful save navigates away to the
// postings list, so steps chained on one page would run against a page that no
// longer has the form.
const openEdit = async (c, theme = "light", width = 1280) => {
  const writes = [];
  const opened = await open(c.path, {
    theme, width, signedIn: true,
    rest: (r, { req, table }) => {
      if (req.method() === "PATCH") {
        try { writes.push({ table, body: JSON.parse(req.postData() ?? "{}") }); } catch { writes.push({ table, body: null }); }
        return r.fulfill({ status: 204, body: "" });
      }
      return null;
    },
  });
  return { ...opened, writes, field: opened.page.locator("#externalUrl") };
};
const save = async (page) => {
  const btn = page.getByRole("button", { name: /Save Changes/i });
  if (!(await btn.count())) return false;
  await btn.click().catch(() => {});
  await page.waitForTimeout(1500);
  return true;
};

for (const c of [
  // The section's exact title — the field's own hint mentions "application
  // questions" in a sentence, so a text search would find that instead.
  { kind: "event", path: "/postings/events/e-ext/edit", table: "events", questions: "RSVP Form" },
  { kind: "role", path: "/postings/o-ext/edit", table: "opportunities", questions: "Application Questions" },
]) {
  for (const theme of ["light", "dark"]) {
    const { ctx, page, mounted, field } = await openEdit(c, theme);
    check(`${theme} ${c.kind} edit: the app mounted (guard)`, mounted);
    const shown = (await field.count()) ? await field.inputValue() : "(no field)";
    check(`${theme} ${c.kind} edit: the form loads the existing link`, shown === FORM, shown);
    check(`${theme} ${c.kind} edit: ZotHub's own questions are hidden while a link is set`,
      (await page.getByText(c.questions, { exact: true }).count()) === 0);
    const hint = page.locator("#externalUrl-hint");
    if (await hint.count()) {
      const ratio = await contrastOf(hint);
      check(`${theme} ${c.kind} edit: the field's hint text is AA`, ratio >= 4.5, ratio.toFixed(2));
    } else check(`${theme} ${c.kind} edit: the field's hint is on screen`, false);
    await ctx.close();
  }

  // An untouched save keeps the link (the C3 shape: a form must not drop what it loaded).
  {
    const { ctx, page, writes } = await openEdit(c);
    check(`${c.kind} edit: the Save button is there (guard)`, await save(page));
    const w = writes.find((x) => x.table === c.table);
    check(`${c.kind} edit: an untouched save keeps the link`, w?.body?.external_url === FORM, JSON.stringify(w?.body ?? null).slice(0, 140));
    await ctx.close();
  }
  // http:// is refused with a sentence, and nothing is saved.
  {
    const { ctx, page, writes, field } = await openEdit(c);
    await field.fill("http://forms.gle/insecure").catch(() => {});
    await save(page);
    const t = await text(page);
    check(`${c.kind} edit: an http:// link is refused, with a sentence`, /starts with https:\/\//i.test(t));
    check(`${c.kind} edit: …and nothing is saved`, writes.length === 0, `${writes.length} write(s)`);
    const errorRatio = (await page.locator("#externalUrl-error").count()) ? await contrastOf(page.locator("#externalUrl-error")) : 0;
    check(`${c.kind} edit: the error under the field is AA`, errorRatio >= 4.5, errorRatio.toFixed(2));
    await ctx.close();
  }
  // Clearing it brings ZotHub's own questions back, and saves "no link".
  {
    const { ctx, page, writes, field } = await openEdit(c, "light", 390);
    await field.fill("").catch(() => {});
    await page.waitForTimeout(300);
    check(`${c.kind} edit: clearing the link brings ZotHub's own questions back`,
      (await page.getByText(c.questions, { exact: true }).count()) === 1);
    check(`${c.kind} edit: no sideways scroll on a phone`, await noSideways(page));
    await save(page);
    const w = writes.find((x) => x.table === c.table);
    check(`${c.kind} edit: clearing the link saves "no link"`, !!w && w.body?.external_url === null, JSON.stringify(w?.body ?? null).slice(0, 140));
    await ctx.close();
  }
}

// A brand-new post with a link pasted without https:// is saved as a full https link.
{
  const inserts = [];
  const { ctx, page } = await open("/postings/events/new", {
    signedIn: true,
    rest: (r, { req, table, j }) => {
      if (req.method() === "POST" && table === "events") {
        try { inserts.push(JSON.parse(req.postData() ?? "{}")); } catch { inserts.push(null); }
        return j({ id: "new1" });
      }
      return null;
    },
  });
  const field = page.locator("#externalUrl");
  check("create event: the link field is on the form", (await field.count()) === 1);
  await page.locator("#title").fill("Hack Night").catch(() => {});
  const local = new Date(Date.now() + 7 * 864e5);
  const pad = (n) => String(n).padStart(2, "0");
  await page.locator("#eventDate").fill(`${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T18:30`).catch(() => {});
  await field.fill("forms.gle/hackNight").catch(() => {});
  await page.getByRole("button", { name: /^Publish/ }).first().click().catch(() => {});
  await page.waitForTimeout(1800);
  const body = Array.isArray(inserts[0]) ? inserts[0][0] : inserts[0];
  check("create event: a link pasted without https:// is saved as https", body?.external_url === "https://forms.gle/hackNight", JSON.stringify(body ?? null).slice(0, 160));
  await ctx.close();
}

// ============================================================ 6. the club's own dashboard
// An external post must not read "0 RSVPs" / "0 applications" to the club that owns it.
for (const theme of ["light", "dark"]) {
  const dashRows = {
    opportunities: [{ ...ROLE_EXT, views: 31, is_active: true }, { ...ROLE_OWN, views: 4, is_active: true }],
    events: [{ ...EVENT_EXT, views: 52, is_active: true }],
  };
  const rest = (r, { u, table, single, j }) => {
    if ((table === "opportunities" || table === "events") && !u.searchParams.get("id")) {
      const rows = dashRows[table];
      return j(single ? rows[0] : rows);
    }
    return null;
  };
  let { ctx, page, mounted } = await open("/postings", { theme, signedIn: true, rest });
  check(`${theme} dashboard roles: the app mounted (guard)`, mounted);
  await page.getByText("Events Committee").first().waitFor({ timeout: 10000 }).catch(() => {});
  const onLink = page.getByText("On your link", { exact: true });
  check(`${theme} dashboard roles: the external role says applications are on the club's link`, (await onLink.count()) === 1, `${await onLink.count()} found`);
  if (await onLink.count()) {
    const ratio = await contrastOf(onLink.first());
    check(`${theme} dashboard roles: that label is AA`, ratio >= 4.5, ratio.toFixed(2));
  }
  await ctx.close();

  ({ ctx, page, mounted } = await open("/postings/events", { theme, signedIn: true, rest }));
  await page.getByText("Intro to LLMs Workshop").first().waitFor({ timeout: 10000 }).catch(() => {});
  const rsvpLink = page.getByRole("link", { name: /RSVPs on your link/ });
  check(`${theme} dashboard events: the external event links to the club's form instead of an RSVP count`, (await rsvpLink.count()) === 1);
  if (await rsvpLink.count()) {
    check(`${theme} dashboard events: …which is the club's own link`, (await rsvpLink.first().getAttribute("href")) === FORM);
    const ratio = await contrastOf(rsvpLink.first());
    check(`${theme} dashboard events: that link is AA`, ratio >= 4.5, ratio.toFixed(2));
  }
  const tiles = (await page.getByText("RSVPs", { exact: true }).count()) + (await page.getByText("Capacity", { exact: true }).count());
  check(`${theme} dashboard events: no "RSVPs" / "Capacity" tiles or capacity bar for it`, tiles === 0, `${tiles} found`);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(400);
  check(`${theme} dashboard events: no sideways scroll on a phone`, await noSideways(page));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
