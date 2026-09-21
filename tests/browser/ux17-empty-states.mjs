/**
 * UX17a / UX17b — the empty states, designed against the POST-PURGE reality.
 *
 * Measured on production 2026-09-21, as an anonymous visitor: 725 clubs
 * (~722 after the test-data purge), 4 test roles (0 after it), and **0
 * publicly visible events, ever**. So on launch day both discovery lists are
 * empty and the club directory is full — which is the entire design premise.
 *
 * The old copy had the two empty pages promising each other: Opportunities
 * said "events are worth a look" while its button went to /clubs, and Events
 * said "roles are open though" and linked to a list that will have none. A
 * visitor arriving on an empty site was sent in a circle. This asserts the
 * circle is gone and that neither page claims anything that is not true.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

/** 722 clubs, nothing else — launch day. */
const CLUBS = Array.from({ length: 722 }, (_, i) => ({
  id: `c${i}`, club_name: `Club ${i}`, category: "Academic", description: "A club.",
  logo_url: null, website_url: null, instagram_url: null, linkedin_url: null,
}));

async function open(browser, { path, clubs = CLUBS }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
  await page.route("**/rest/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/rpc/get_all_clubs_public", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(clubs) }));
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2500);
  const mounted = await page.evaluate(() => {
    const r = document.getElementById("root");
    return !!r && r.children.length > 0;
  }).catch(() => false);
  const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
  return { page, ctx, mounted, text };
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

// ------------------------------------------------------------- Opportunities
{
  const { page, ctx, mounted, text } = await open(browser, { path: "/opportunities" });
  check("Opportunities mounted", mounted, mounted ? "" : "server down — rest is meaningless");
  check("it shows the LIVE club count, not a hard-coded one",
    /722 clubs are here/.test(text), `reads: ${text.slice(0, 120)}`);
  check("it no longer promises events (there are none)",
    !/events are worth a look/i.test(text));
  check("the way out goes to the clubs, and says so",
    (await page.getByRole("link", { name: /Browse all 722 clubs/ }).count()) > 0);

  await page.getByRole("link", { name: /Browse all 722 clubs/ }).first().click();
  await page.waitForTimeout(1500);
  check("and it actually lands on the clubs directory",
    new URL(page.url()).pathname === "/clubs", page.url());
  await ctx.close();
}

// -------------------------------------------------------------------- Events
{
  const { page, ctx, mounted, text } = await open(browser, { path: "/events" });
  check("Events mounted", mounted);
  check("Events no longer claims roles are open",
    !/roles are open though/i.test(text), "after the purge there are none");
  check("Events shows the same live club count",
    /722 clubs are here/.test(text), `reads: ${text.slice(0, 120)}`);
  check("the loop is broken — Events points at clubs, not at the empty roles list",
    (await page.getByRole("link", { name: /Browse all 722 clubs/ }).count()) > 0 &&
    (await page.getByRole("link", { name: /^Browse roles$/ }).count()) === 0);
  await ctx.close();
}

// ------------------------------------------- no count yet -> no false number
{
  const { ctx, mounted, text } = await open(browser, { path: "/opportunities", clubs: [] });
  check("with no clubs loaded it never prints '0 clubs are here'",
    mounted && !/0 clubs are here/.test(text) && !/Browse all 0 clubs/.test(text),
    text.slice(0, 120));
  await ctx.close();
}

// --------------------------------------------------- UX17b: no stage copy
{
  const { ctx, mounted, text } = await open(browser, { path: "/clubs", clubs: [] });
  check("Clubs mounted", mounted);
  for (const phrase of ["being onboarded", "check back soon", "No clubs yet"]) {
    check(`Clubs no longer says "${phrase}" (copy about the product's stage)`,
      !new RegExp(phrase, "i").test(text));
  }
  check("an empty directory is treated as the oddity it would be, with a retry",
    /that's unusual/i.test(text) && /Try again/i.test(text), text.slice(0, 140));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
