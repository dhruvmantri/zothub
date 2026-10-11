/** The Clubs directory, for an officer looking for their own club
 *  (audit G2-07 / G2-03, maintainer decision 2026-10-11).
 *
 *  G2-07: search kept every club whose name OR description contained the text
 *  and sorted A–Z, so a club's own acronym or partial name landed below
 *  unrelated matches. Now how well it matches decides the order.
 *  G2-03: the header read "722 clubs · 0 recruiting right now" and every card
 *  said "Not recruiting". Now only what IS happening is shown.
 *
 *  Uses the REAL 724 names and descriptions from the ZotSpot manifest, typed
 *  into the real search box.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const MANIFEST = JSON.parse(readFileSync("scripts/data/zotspot_club_manifest.json", "utf8"));
const CLUBS = MANIFEST.map((c, i) => ({
  id: `c${i}`, club_name: c.club_name, category: c.category ?? null, description: c.description ?? null,
  logo_url: null, banner_url: null, website_url: null, instagram_url: null, linkedin_url: null, discord_url: null,
  created_at: "2026-07-27T00:00:00Z", updated_at: "2026-07-27T00:00:00Z",
}));
// One club is recruiting (two open roles) so the "recruiting" half has something true to show.
const HACK = CLUBS.find((c) => c.club_name === "Hack at UCI");

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function open({ recruiting }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route("**/rest/v1/**", (r) => {
    const u = r.request().url();
    const j = (x) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(x) });
    if (u.includes("/rpc/get_all_clubs_public")) return j(CLUBS);
    if (u.includes("/opportunities")) return j(recruiting ? [{ club_id: HACK.id }, { club_id: HACK.id }] : []);
    return j([]);
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/clubs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  return { ctx, page };
}

const cardNames = (page) => page.evaluate(() =>
  [...document.querySelectorAll("main article h2, main article h3, main li a[href^='/clubs/']")]
    .map((e) => e.textContent.trim()).filter(Boolean));

async function firstResultFor(page, query) {
  const box = page.getByPlaceholder(/search/i).first();
  await box.fill(query);
  await page.waitForTimeout(600);
  return (await cardNames(page))[0] ?? "(none)";
}

// ---- search ranking ------------------------------------------------------------
{
  const { ctx, page } = await open({ recruiting: false });
  check("the directory rendered the real clubs (guard)", (await cardNames(page)).length >= 20, `${(await cardNames(page)).length} cards`);
  for (const [query, expected] of [
    ["swe", "Society of Women Engineers"],
    ["acm", "Association for Computing Machinery at UC Irvine - ACM"],
    ["vsa", "Vietnamese Student Association (VSA)"],
    ["society of women", "Society of Women Engineers"],
    ["hack", "Hack at UCI"],
    ["Hack at UCI", "Hack at UCI"],
  ]) {
    const first = await firstResultFor(page, query);
    check(`searching "${query}" puts "${expected}" first`, first === expected, `first was "${first}"`);
  }
  // ---- recruiting labels when nobody is recruiting --------------------------
  await page.getByPlaceholder(/search/i).first().fill("");
  await page.waitForTimeout(500);
  const body = await page.locator("main").innerText();
  check("header shows the club count", /\b724\s+clubs\b/.test(body));
  check("header does not say '0 recruiting right now'", !/\b0\s+recruiting right now/.test(body));
  check("no card says 'Not recruiting'", !/Not recruiting/.test(body));
  await ctx.close();
}

// ---- when a club IS recruiting, it says so -----------------------------------------
{
  const { ctx, page } = await open({ recruiting: true });
  await page.getByPlaceholder(/search/i).first().fill("Hack at UCI");
  await page.waitForTimeout(600);
  const body = await page.locator("main").innerText();
  check("header counts the recruiting club", /\b1\s+recruiting right now/.test(body));
  check("the recruiting club's card says its open roles", /2\s+open roles/.test(body));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
