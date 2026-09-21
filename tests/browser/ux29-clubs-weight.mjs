/** UX29 — the Clubs directory must not download the whole product to show a screen.
 *
 *  Measured on production 2026-09-21: 725 cards, 589 logo requests, 31.7MB and
 *  32 seconds to settle, for the dozen avatars actually in view. Two causes,
 *  two fixes, and this file guards both:
 *
 *  1. Radix's Avatar.Image fetches every src from JavaScript the moment it
 *     mounts, so `loading="lazy"` on the rendered <img> could never help — the
 *     browser never saw those requests. EntityAvatar now renders a native lazy
 *     <img>. The check is that scrolling causes MORE logo requests: under the
 *     old component every one had already been fetched, so scrolling adds none.
 *  2. All 725 rows rendered at once. Now 60, then "Show more" — and search
 *     still runs over the whole set, which is the part that must not regress.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const TOTAL = 200;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

// One club is named distinctively and sits near the END of the list, so a
// search that finds it proves the filter reaches past what is drawn.
const DEEP = "Zzz Quaternion Appreciation Society";
const clubs = Array.from({ length: TOTAL }, (_, i) => ({
  id: `c${i}`,
  club_name: i === TOTAL - 1 ? DEEP : `Club Number ${String(i).padStart(3, "0")}`,
  category: "Academic",
  description: "Seeded for the weight check.",
  logo_url: `https://logos.test/logo-${i}.png`,
  website_url: null, instagram_url: null, linkedin_url: null,
  opportunity_count: 0, event_count: 0,
}));

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let logoRequests = 0;
await page.route("**/logos.test/**", (route) => {
  logoRequests++;
  return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
});
await page.route("**/rest/v1/**", (route) => {
  const url = route.request().url();
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (url.includes("/rpc/get_all_clubs_public")) return json(clubs);
  return json([]);
});

await page.goto(`${BASE}/clubs`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const cards = () => page.locator("article").count();

const mounted = await page.evaluate(() => {
  const r = document.getElementById("root");
  return !!r && r.children.length > 0;
}).catch(() => false);
check("the clubs directory mounted", mounted, mounted ? "" : "server down — the rest is meaningless");

check("it draws one page, not the whole directory", (await cards()) === 60, `${await cards()} card(s) of ${TOTAL}`);
check("it says how much of the directory is showing",
  /Showing\s*60\s*of\s*200\s*clubs/.test((await page.textContent("body")) ?? ""));

const beforeScroll = logoRequests;
check("it does not fetch a logo for every card it drew",
  beforeScroll < 60, `${beforeScroll} logo request(s) for 60 cards`);

await page.mouse.wheel(0, 20000);
await page.waitForTimeout(2500);
check("scrolling fetches the logos that came into view",
  logoRequests > beforeScroll, `${beforeScroll} → ${logoRequests}`);

// ---- Show more -------------------------------------------------------------
await page.getByRole("button", { name: /^Show \d+ more$/ }).click().catch(() => {});
await page.waitForTimeout(1200);
check("Show more draws the next page", (await cards()) === 120, `${await cards()} card(s)`);

// ---- Search still covers everything, not just what is drawn ----------------
await page.getByPlaceholder(/Search clubs/i).fill("Quaternion").catch(() => {});
await page.waitForTimeout(1200);
const body = (await page.textContent("body")) ?? "";
check("search reaches a club far beyond the drawn window",
  body.includes(DEEP), `club #${TOTAL - 1} of ${TOTAL}`);
check("searching resets the window rather than paging into nothing",
  (await cards()) === 1 && !/Show \d+ more/.test(body), `${await cards()} card(s)`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
