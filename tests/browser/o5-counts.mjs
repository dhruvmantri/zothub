/**
 * O5-counts, frontend half.
 *
 * The counts a visitor sees were computed from RLS-filtered arrays, so they were
 * wrong for almost everyone: a logged-out visitor read "0 applied" on every role
 * and — worse — "spots left" was computed from 0 attendees, so a FULL event
 * advertised every seat as available. The pages now read trigger-maintained
 * counters instead.
 *
 * This checks the three maintainer decisions of 2026-09-20:
 *   1. a role's number counts every application ever submitted;
 *   2. an event's number counts CONFIRMED RSVPs only, so it agrees with
 *      "spots left" beside it;
 *   3. zero is hidden, not rendered as "0".
 * ...and that the club's "show applicant count" switch is honoured on the LIST,
 * which it was not before.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
// Unset on a normal machine — Playwright finds its own browser. Set it in a
// cloud session, where the pre-installed build may not match the npm version.
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const CLUB = { club_name: "Hack at UCI", logo_url: null };

const OPPS = [
  // Busy, and the club is happy to show it.
  { id: "o1", title: "Marketing Lead", type: "leadership", description: null, deadline: null,
    club_id: "c1", club_profiles: CLUB, applications_count: 12, show_application_count: true },
  // Busy, but the club turned the count off. The list used to ignore that.
  { id: "o2", title: "Treasurer", type: "leadership", description: null, deadline: null,
    club_id: "c1", club_profiles: CLUB, applications_count: 9, show_application_count: false },
  // Brand new. Must not read "0 applied".
  { id: "o3", title: "Designer", type: "creative", description: null, deadline: null,
    club_id: "c1", club_profiles: CLUB, applications_count: 0, show_application_count: true },
];

const soon = (d) => new Date(Date.now() + 86400000 * d).toISOString();
const EVENTS = [
  // Capacity 20, 18 confirmed -> 2 left. A visitor used to see all 20 free.
  { id: "e1", title: "Kickoff Night", description: null, event_date: soon(4),
    location: "DBH", capacity: 20, banner_url: null, club_id: "c1",
    club_profiles: CLUB, confirmed_rsvps_count: 18 },
  // Full. A visitor used to see 20 seats free on a sold-out event.
  { id: "e2", title: "Sold Out Social", description: null, event_date: soon(6),
    location: null, capacity: 20, banner_url: null, club_id: "c1",
    club_profiles: CLUB, confirmed_rsvps_count: 20 },
];

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage();

await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.route("**/rest/v1/**", (route) => {
  const p = new URL(route.request().url()).pathname;
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (p.endsWith("/opportunities")) return json(OPPS);
  if (p.endsWith("/events")) return json(EVENTS);
  return json([]);
});

// ------------------------------------------------------------------- roles
await page.goto(`${BASE}/opportunities`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Marketing Lead" }).first().waitFor({ timeout: 15000 });
const oppsText = (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");

check("a logged-out visitor sees the REAL applicant count, not 0",
  /12 applied/.test(oppsText), `page mentions: ${(oppsText.match(/\d+ applied/g) ?? []).join(", ") || "nothing"}`);
check("a club that turned the count off is respected ON THE LIST",
  !/9 applied/.test(oppsText), "the list used to ignore the switch entirely");
check("a brand-new role does NOT read '0 applied'",
  !/0 applied/.test(oppsText));

// ------------------------------------------------------------------ events
await page.goto(`${BASE}/events`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Kickoff Night" }).first().waitFor({ timeout: 15000 });
const evText = (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");

check("'spots left' is computed from confirmed RSVPs, not from what the viewer can see",
  /2 left/.test(evText), `page mentions: ${(evText.match(/\d+ left/g) ?? []).join(", ") || "nothing"}`);
check("a FULL event no longer advertises every seat as free",
  /0 left/.test(evText) && !/20 left/.test(evText),
  `a logged-out visitor previously saw "20 left" on a sold-out event`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
