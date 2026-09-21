/** UX36 — the Activity tabs must all fit on a phone.
 *
 *  The four tabs sit in an `overflow-x-auto` pill. Empty, they fit; once a
 *  student has anything, each tab grows a count and the strip overflows — the
 *  last one, "Following", was clipped off the right edge with no scrollbar and
 *  no fade, so it read as though it were not there. Found in the sandbox at
 *  390px with one application and one RSVP: the strip measured 388px of content
 *  in a 358px box, and Following's right edge landed at 400px in a 390px
 *  viewport.
 *
 *  Checked with counts present, at the widths real phones actually use. 320px
 *  is deliberately excluded: nothing fits four labelled tabs there, and the
 *  horizontal scroll is the right answer at that size.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const USER_ID = "66666666-6666-6666-6666-666666666666";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
  sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "student@uci.edu",
})}.sig`;
const user = {
  id: USER_ID, aud: "authenticated", role: "authenticated", email: "student@uci.edu",
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

const club = { id: "c1", club_name: "Anteater Robotics", logo_url: null, category: "Engineering" };
// Shapes copied from the requests the page actually makes — the embeds are
// ALIASED (`opportunity:`, `event:`, `club:`), and "Following" comes from
// bookmarks carrying a club_id, not from club_followers. Mocking the shape you
// assume rather than the shape the page asks for produces zero counts, which is
// exactly the case this file exists to test.
const APPLICATIONS = [
  { id: "a1", status: "pending", created_at: new Date().toISOString(),
    opportunity: { id: "o1", title: "Competition Team Lead", club: { club_name: club.club_name, logo_url: null } } },
];
const RSVPS = [
  { id: "r1", status: "confirmed",
    event: { id: "e1", title: "Fall Kickoff", event_date: new Date(Date.now() + 864e5).toISOString(),
             location: "Engineering Hall", club: { club_name: club.club_name, logo_url: null } } },
];

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

for (const width of [430, 390, 375, 360]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
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
    const json = (x) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(x) });
    if (p.endsWith("/user_roles")) return json(single ? { role: "student" } : [{ role: "student" }]);
    if (p.endsWith("/student_profiles")) return json(single ? { id: "sp1" } : [{ id: "sp1" }]);
    if (p.endsWith("/applications")) return json(APPLICATIONS);
    if (p.endsWith("/rsvps")) return json(RSVPS);
    if (p.endsWith("/bookmarks")) {
      // Three different bookmark reads share one endpoint; tell them apart by
      // what they select, or Saved and Following get each other's rows.
      const q = decodeURIComponent(new URL(route.request().url()).search);
      if (q.includes("club_id=not.is.null")) return json([{ club_id: "c1" }]);
      if (q.includes("event:events")) return json([]);
      return json([{ opportunity: { id: "o1", title: "Competition Team Lead", deadline: null,
                                    club: { club_name: club.club_name, logo_url: null } } }]);
    }
    return json([]);
  });

  const page = await ctx.newPage();
  await page.goto(`${BASE}/activity`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);

  const state = await page.evaluate(() => {
    const strip = document.querySelector('[role="tablist"]');
    if (!strip) return null;
    const tabs = [...strip.children].map((c) => ({
      label: c.textContent.trim(), right: Math.round(c.getBoundingClientRect().right),
    }));
    return { hidden: strip.scrollWidth - strip.clientWidth, tabs, view: document.documentElement.clientWidth };
  }).catch(() => null);

  check(`${width}px renders the tab strip`, !!state && state.tabs.length === 4,
    state ? `${state.tabs.length} tab(s)` : "no strip — server down?");
  // The counts are what pushed it over; without them the bug is invisible.
  check(`${width}px is showing counts, so this is the case that broke`,
    !!state && /\d/.test(state.tabs.map((t) => t.label).join("")),
    state ? state.tabs.map((t) => t.label).join(" | ") : "");
  check(`${width}px hides none of the tab strip`, !!state && state.hidden === 0,
    state ? `${state.hidden}px hidden` : "");
  check(`${width}px keeps the last tab inside the screen`,
    !!state && state.tabs[state.tabs.length - 1].right <= state.view,
    state ? `Following ends at ${state.tabs[state.tabs.length - 1].right}px of ${state.view}px` : "");

  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
