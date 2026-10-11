/** AA contrast on five small-text spots the 2026-10-10 audit computed as failing.
 *
 *  AA is a merge gate here. Each was below 4.5:1 for small text:
 *   - Activity tab counts and the club's Applicants sub-tab counts: ink-3 at
 *     opacity-70 over the tab rail — 2.7:1 light, 3.0:1 dark;
 *   - sent-message timestamps: accent-ink/70 on the accent bubble, at 10px —
 *     4.1:1 light, 3.9:1 dark;
 *   - the claim banner's "Imported from…" line: ink-3 on the dark accent
 *     wash — 4.49:1.
 *  The audit also listed the "Clubs can't RSVP" note; measured, it was already
 *  5.4:1 (it does not sit on the wash), so it is kept only as a guard.
 *
 *  Measured as RENDERED: the element's colour and alpha, times every ancestor's
 *  opacity, composited over the first opaque background behind it. A class-name
 *  check would have passed the opacity-70 cases, which is how they shipped.
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
const PARTNER = "22222222-2222-2222-2222-222222222222";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const sessionFor = (email) => {
  const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email })}.sig`;
  const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  return { user, session: { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user } };
};

const soon = new Date(Date.now() + 5 * 864e5).toISOString();
const SEEDED = { id: "c9", club_name: "Anteater Chess Club", category: "Recreation", description: "We play chess.", logo_url: null, banner_url: null,
  website_url: null, linkedin_url: null, instagram_url: null, discord_url: null, user_id: null, source: "zotspot",
  source_url: "https://example.org/chess", imported_at: "2026-07-27T00:00:00Z", claimed_at: null };
const OWN_CLUB = { id: "c1", club_name: "Anteater Robotics", logo_url: null, user_id: USER_ID };

function tables(role) {
  return {
    user_roles: [{ role }],
    club_profiles: role === "club" ? [OWN_CLUB] : [{ ...OWN_CLUB, user_id: PARTNER }],
    student_profiles: [{ id: "sp1", user_id: USER_ID, full_name: "Priya R" }],
    events: [{ id: "e1", club_id: "c1", title: "Fall Kickoff", description: "Robots.", event_date: soon, location: "ISEB", capacity: 40, is_active: true,
               club_profiles: { club_name: "Anteater Robotics", logo_url: null, user_id: USER_ID }, rsvp_questions: [], requires_approval: false }],
    applications: [{ id: "a1", status: "pending", created_at: soon,
      opportunity: { id: "o1", title: "Competition Team Lead", club: { club_name: "Anteater Robotics", logo_url: null } } }],
    rsvps: [{ id: "r1", status: "confirmed", event: { id: "e1", title: "Fall Kickoff", event_date: soon, location: "ISEB", club: { club_name: "Anteater Robotics", logo_url: null } } }],
    messages: [{ id: "m1", sender_id: USER_ID, receiver_id: PARTNER, content: "Hi! Is the kickoff open to first-years?", is_read: true, created_at: new Date().toISOString() }],
  };
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function open(theme, { role, path, special }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
  const T = tables(role ?? "student");
  if (role) {
    const { user, session } = sessionFor(role === "club" ? "club@uci.edu" : "student@uci.edu");
    await ctx.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-127-auth-token", JSON.stringify(session)]);
    await ctx.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
      body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
  }
  await ctx.route("**/rest/v1/**", (r) => {
    const req = r.request();
    const u = new URL(req.url());
    const table = u.pathname.split("/").pop();
    const single = req.headers()["accept"]?.includes("pgrst.object");
    if (req.method() === "HEAD") {
      // count=exact reads: the pending counts behind the Applicants sub-tabs.
      // Cross-origin, so the header must be exposed or the browser hides it
      // and the count reads as zero (and the tab shows no number to measure).
      return r.fulfill({ status: 200, headers: { "content-range": "0-2/3", "access-control-expose-headers": "content-range", "access-control-allow-origin": "*" }, body: "" });
    }
    if (special && table === "club_profiles" && u.search.includes("c9")) {
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(single ? SEEDED : [SEEDED]) });
    }
    if (table === "bookmarks") return r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    const rows = T[table] ?? [];
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(single ? rows[0] ?? null : rows) });
  });
  await ctx.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2800);
  return { ctx, page };
}

/** Rendered contrast of the elements matched by `pick` (a function run in the page). */
const measure = (page, pickSrc) => page.evaluate((src) => {
  const pick = new Function(`return (${src})`)();
  const parse = (c) => { const m = (c.match(/[\d.]+/g) || []).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const lum = (rgb) => rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  return pick().map((el) => {
    const fg = parse(getComputedStyle(el).color);
    let opacity = 1;
    for (let e = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity);
    let bg = null;
    for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0.99) { bg = c; break; } }
    bg ??= parse(getComputedStyle(document.body).backgroundColor);
    const a = fg.a * opacity;
    const mixed = [fg.r * a + bg.r * (1 - a), fg.g * a + bg.g * (1 - a), fg.b * a + bg.b * (1 - a)];
    const [hi, lo] = [lum(mixed), lum([bg.r, bg.g, bg.b])].sort((x, y) => y - x);
    return { text: el.textContent.trim().slice(0, 30), ratio: (hi + 0.05) / (lo + 0.05) };
  });
}, pickSrc.toString());

const SPOTS = [
  { name: "Activity tab counts", open: { role: "student", path: "/activity" },
    pick: () => [...document.querySelectorAll('[role="tablist"] [role="tab"] span.font-data')] },
  { name: "Applicants sub-tab count (inactive tab)", open: { role: "club", path: "/applicants/events" },
    pick: () => [...document.querySelectorAll("a span.font-data")].filter((s) => s.closest("a")?.textContent?.includes("Applications")) },
  { name: "sent-message timestamp", open: { role: "student", path: `/messages?to=${PARTNER}` },
    pick: () => [...document.querySelectorAll("p.font-data")].filter((p) => p.className.includes("accent-ink")) },
  { name: "claim banner 'Imported from' line", open: { path: "/clubs/c9", special: true },
    pick: () => [...document.querySelectorAll("p")].filter((p) => p.textContent.includes("Imported from") && p.children.length < 6) },
  { name: "'Clubs can't RSVP' note", open: { role: "club", path: "/events/e1" },
    pick: () => [...document.querySelectorAll("p")].filter((p) => p.textContent.includes("Clubs can't RSVP")) },
];

for (const theme of ["light", "dark"]) {
  for (const spot of SPOTS) {
    const { ctx, page } = await open(theme, spot.open);
    const found = await measure(page, spot.pick).catch((e) => { console.log("  measure error:", String(e).slice(0, 120)); return []; });
    check(`${theme}: ${spot.name} is on screen (guard)`, found.length > 0, `${found.length} found`);
    for (const f of found) {
      check(`${theme}: ${spot.name} "${f.text}" ≥ 4.5:1`, f.ratio >= 4.5, f.ratio.toFixed(2));
    }
    await ctx.close();
  }
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
