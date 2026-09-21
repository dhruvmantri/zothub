/**
 * UX11/UX13 — the shared discover toolbar.
 *
 * Three things have to hold, and none of them is visible by reading the diff:
 *
 *  1. The toolbar is the SAME on all three pages. The whole point of the
 *     extraction is that a control cannot exist on one page and not another,
 *     so the test asserts presence per page rather than trusting the import.
 *
 *  2. The filter menu is genuinely MULTI-select. Radix closes a menu on every
 *     item activation by default; without `onSelect: preventDefault` choosing
 *     two types means opening the menu twice, which silently reverts the one
 *     capability the redesign was for.
 *
 *  3. The sort is applied by the DATABASE. This is the part that cannot be
 *     seen at all: a client sort and a server sort look identical on a list of
 *     three rows, and only diverge past the 50-row cap — i.e. in a busy term,
 *     in production, months from now. The test therefore asserts on the
 *     REQUEST: choosing "Closing soonest" must put `order=deadline...` on the
 *     wire, and must issue a NEW request rather than reshuffling in place.
 *
 * Follows the house rules in ./README.md: REST is mocked (a failing query is
 * not cached and does retry, so a flaky database produces request counts that
 * look exactly like a broken cache), and navigation between assertions uses
 * in-page clicks, never `page.goto()`, which wipes an in-memory cache by
 * definition.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const CLUB = { club_name: "Hack at UCI", logo_url: null };
const OPPS = [
  { id: "o1", title: "Marketing Lead", type: "leadership", description: null, deadline: null,
    club_id: "c1", club_profiles: CLUB, applications_count: 12, show_application_count: true },
  { id: "o2", title: "Stage Crew", type: "volunteer", description: null, deadline: null,
    club_id: "c1", club_profiles: CLUB, applications_count: 3, show_application_count: true },
  { id: "o3", title: "Poster Designer", type: "other", description: null, deadline: null,
    club_id: "c2", club_profiles: { club_name: "Design Club", logo_url: null },
    applications_count: 0, show_application_count: true },
];
const soon = (d) => new Date(Date.now() + 86400000 * d).toISOString();
const EVENTS = [
  { id: "e1", title: "Kickoff Night", description: null, event_date: soon(3), location: "DBH",
    capacity: 20, banner_url: null, club_id: "c1", club_profiles: CLUB, confirmed_rsvps_count: 18 },
  { id: "e2", title: "Résumé Workshop", description: null, event_date: soon(9), location: null,
    capacity: null, banner_url: null, club_id: "c1", club_profiles: CLUB, confirmed_rsvps_count: 4 },
];
const CLUBS = [
  { id: "c1", club_name: "Hack at UCI", category: "Technology", description: "Build things.",
    logo_url: null, website_url: null, instagram_url: null, linkedin_url: null },
  { id: "c2", club_name: "Design Club", category: "Arts", description: "Make things pretty.",
    logo_url: null, website_url: null, instagram_url: null, linkedin_url: null },
];

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

/** Every REST URL the page asked for, in order. */
const requests = [];

async function install(page) {
  await page.route("**/auth/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/rest/v1/**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (url.pathname.endsWith("/opportunities")) return json(OPPS);
    if (url.pathname.endsWith("/events")) return json(EVENTS);
    return json([]);
  });
  await page.route("**/rpc/get_all_clubs_public", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CLUBS) }));
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await install(page);

const toolbar = {
  search: () => page.getByRole("searchbox"),
  filter: () => page.getByRole("button", { name: /^Filter/ }),
  sort: (name) => page.getByRole("combobox", { name }),
  view: () => page.getByRole("group", { name: "View density" }),
};

// ------------------------------------------------------- Opportunities
await page.goto(`${BASE}/opportunities`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Marketing Lead" }).first().waitFor({ timeout: 15000 });

check("Opportunities: the toolbar has a search box", await toolbar.search().isVisible());
check("Opportunities: the toolbar has a Filter menu", await toolbar.filter().isVisible());
check("Opportunities: the toolbar has a sort", await toolbar.sort("Sort roles").isVisible());
check("Opportunities: the toolbar has a card/list toggle", await toolbar.view().isVisible());

// --- the filter menu stays open across two ticks (the multi-select claim)
await toolbar.filter().click();
await page.getByRole("menuitemcheckbox", { name: "Leadership Role" }).click();
await page.waitForTimeout(250);
const stillOpen = await page.getByRole("menu").isVisible().catch(() => false);
check("the filter menu stays open after ticking one type", stillOpen,
  stillOpen ? "" : "it closed — picking two types would mean opening it twice");
await page.getByRole("menuitemcheckbox", { name: "Volunteer" }).click();
await page.waitForTimeout(250);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

check("the Filter button shows how many filters are on", 
  /2/.test(await toolbar.filter().innerText()),
  `button reads: ${(await toolbar.filter().innerText()).replace(/\s+/g, " ")}`);

let body = (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");
check("two types ticked shows roles of BOTH types, not their intersection",
  /Marketing Lead/.test(body) && /Stage Crew/.test(body),
  `visible: ${["Marketing Lead", "Stage Crew", "Poster Designer"].filter((t) => body.includes(t)).join(", ")}`);
check("a role of a third type is filtered out",
  !/Poster Designer/.test(body));

// --- clearing
await toolbar.filter().click();
await page.getByRole("menuitem", { name: "Clear filters" }).click();
await page.waitForTimeout(400);
body = (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");
check("Clear filters brings every role back", /Poster Designer/.test(body));

// --- THE SORT IS SERVER-SIDE. Assert on the wire, not on the screen.
requests.length = 0;
await toolbar.sort("Sort roles").click();
await page.getByRole("option", { name: "Closing soonest" }).click();
await page.waitForTimeout(1200);
const sortReq = requests.filter((r) => r.includes("/opportunities"));
check("choosing a sort issues a NEW request (it is not a client reshuffle)",
  sortReq.length > 0, `${sortReq.length} requests to /opportunities`);
check("the sort is sent to the database as an ORDER clause",
  sortReq.some((r) => /order=deadline/.test(r)),
  sortReq[0] ? decodeURIComponent(sortReq[0]).slice(0, 160) : "no request at all");
check("the 50-row cap is still applied by the database, under the new order",
  sortReq.some((r) => /limit=50/.test(r)));

// --- switching sort must NOT flash the skeletons (keepPreviousData)
requests.length = 0;
await toolbar.sort("Sort roles").click();
await page.getByRole("option", { name: "Most applied to" }).click();
await page.waitForTimeout(120); // mid-flight, before the response lands
const rowsDuring = await page.getByRole("heading", { name: "Marketing Lead" }).count();
check("the rows stay on screen while the new order loads",
  rowsDuring > 0,
  rowsDuring > 0 ? "" : "the page fell back to skeletons — a full-page flash for a re-order");
await page.waitForTimeout(1000);
check("the popularity sort is also sent to the database",
  requests.some((r) => /applications_count/.test(r)),
  decodeURIComponent(requests.find((r) => r.includes("/opportunities")) ?? "none").slice(0, 160));

// ------------------------------------------------------------- Events
await page.getByRole("link", { name: "Events", exact: true }).first().click();
await page.getByRole("heading", { name: "Kickoff Night" }).first().waitFor({ timeout: 15000 });

check("Events: it finally has a sort (UX13)", await toolbar.sort("Sort events").isVisible());
check("Events: it has the same Filter menu", await toolbar.filter().isVisible());
check("Events: it has the same card/list toggle", await toolbar.view().isVisible());

requests.length = 0;
await toolbar.sort("Sort events").click();
await page.getByRole("option", { name: "Most popular" }).click();
await page.waitForTimeout(1200);
check("the Events sort is server-side too (contract O3)",
  requests.some((r) => r.includes("/events") && /order=confirmed_rsvps_count/.test(r)),
  decodeURIComponent(requests.find((r) => r.includes("/events")) ?? "none").slice(0, 160));

// The date windows overlap, so only one can be on at a time.
await toolbar.filter().click();
await page.getByRole("menuitemradio", { name: "This week" }).click();
await page.waitForTimeout(300);
await toolbar.filter().click();
const weekOn = await page.getByRole("menuitemradio", { name: "This week" }).getAttribute("aria-checked");
const monthOn = await page.getByRole("menuitemradio", { name: "This month" }).getAttribute("aria-checked");
check("the date windows are one-at-a-time, not tick-both",
  weekOn === "true" && monthOn === "false", `week=${weekOn} month=${monthOn}`);
await page.keyboard.press("Escape");

// -------------------------------------------------------------- Clubs
await page.getByRole("link", { name: "Clubs", exact: true }).first().click();
await page.getByRole("heading", { name: "Hack at UCI" }).first().waitFor({ timeout: 15000 });

check("Clubs: it finally has a card/list toggle (UX13)", await toolbar.view().isVisible());
check("Clubs: it has the same Filter menu", await toolbar.filter().isVisible());
check("Clubs: it has the same sort", await toolbar.sort("Sort clubs").isVisible());

await page.getByRole("button", { name: "List" }).click();
await page.waitForTimeout(500);
const listRows = await page.locator("ul > li").filter({ hasText: "Hack at UCI" }).count();
check("switching Clubs to List renders the dense rows", listRows > 0);
check("every club is still a link to its profile",
  (await page.getByRole("link", { name: "Design Club" }).count()) > 0);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
