/** UX27 — no list page may scroll sideways on a phone.
 *
 *  A card title is `truncate`, so its min-content width is the whole name, and
 *  a grid item defaults to `min-width: auto` — it refuses to shrink below that.
 *  The three list grids declared `md:grid-cols-2 lg:grid-cols-3` and no base
 *  column, so on a phone one implicit column sized itself to the longest name.
 *  Production measured 1357px of content inside a 390px viewport: the whole
 *  Clubs directory, the only page with content at launch, scrolled sideways.
 *
 *  The assertion is the symptom itself — document scrollWidth against the
 *  viewport — not the class that happens to fix it today. Names here are longer
 *  than any real one so the check keeps biting if the base column is lost again.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const PHONE = { width: 390, height: 844 };

const LONG = "Associated Students Interdisciplinary Undergraduate Consortium for Sustainable Urban Policy";

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const club = (id, name) => ({
  id, club_name: name, category: "Academic",
  description: "A club with a deliberately unreasonable name, to keep this check honest.",
  logo_url: null, website_url: null, instagram_url: null, linkedin_url: null,
  opportunity_count: 2, event_count: 1,
});
const opp = (id, title) => ({
  id, title, type: "leadership", description: "Long title above.",
  deadline: null, club_id: "c1", is_active: true,
  club_profiles: { club_name: LONG, logo_url: null },
  applications_count: 3, show_application_count: true,
});
const evt = (id, title) => ({
  id, title, description: "Long title above.",
  event_date: new Date(Date.now() + 86400000 * 7).toISOString(),
  location: "Student Center Conference Room B", club_id: "c1", is_active: true,
  club_profiles: { club_name: LONG, logo_url: null },
  confirmed_rsvps_count: 4, capacity: null, rsvps: [],
});

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

for (const [path, label] of [["/clubs", "Clubs"], ["/opportunities", "Opportunities"], ["/events", "Events"]]) {
  const ctx = await browser.newContext({ viewport: PHONE });
  const page = await ctx.newPage();

  await page.route("**/rest/v1/**", (route) => {
    const url = route.request().url();
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("/rpc/get_all_clubs_public")) return json([club("c1", LONG), club("c2", LONG + " II")]);
    if (url.includes("/opportunities")) return json([opp("o1", LONG), opp("o2", LONG + " II")]);
    if (url.includes("/events")) return json([evt("e1", LONG), evt("e2", LONG + " II")]);
    return json([]);
  });

  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const m = await page.evaluate(() => {
    const d = document.documentElement;
    return { view: d.clientWidth, scroll: d.scrollWidth, cards: document.querySelectorAll("article, li").length };
  }).catch(() => null);

  check(`${label} mounted with cards`, !!m && m.cards > 0, m ? `${m.cards} item(s)` : "page never rendered");
  check(`${label} does not scroll sideways on a phone`,
    !!m && m.scroll <= m.view + 1,
    m ? `${m.scroll}px of content in a ${m.view}px viewport` : "");

  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
