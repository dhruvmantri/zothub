/** UX26 — a deploy must not strand the visitors who are already here.
 *
 *  Vite fingerprints every lazy route's file, so a deploy replaces the whole
 *  set. A visitor still running the old index asks for a file that is gone and
 *  the server answers index.html, which the browser refuses as a module. The
 *  old boundary offered "Try Again", which re-rendered the same lazy route and
 *  re-requested the same missing file — a button that could never work.
 *
 *  Simulated here by answering the route's module request with HTML, which is
 *  exactly what production does. In dev the module is served from /src/pages/,
 *  in a build it is /assets/ — both are intercepted so the check does not
 *  depend on which server it runs against.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let documentLoads = 0;
page.on("request", (r) => {
  if (r.isNavigationRequest() && r.frame() === page.mainFrame()) documentLoads++;
});

// Everything except the Clubs route behaves normally.
await page.route("**/rest/v1/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

let chunkRequests = 0;
const killChunk = (route) => {
  chunkRequests++;
  // A 200 carrying the SPA shell — the exact shape of the production failure.
  return route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><html><body>index</body></html>",
  });
};
await page.route("**/src/pages/Clubs.tsx*", killChunk);
await page.route("**/assets/Clubs-*.js", killChunk);

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const mounted = await page.evaluate(() => {
  const r = document.getElementById("root");
  return !!r && r.children.length > 0;
}).catch(() => false);
check("the landing page mounted", mounted, mounted ? "" : "server down — the rest is meaningless");

const loadsBefore = documentLoads;

// Navigate the way a visitor does: a link click, not page.goto().
await page.getByRole("link", { name: "Clubs", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(4000);

check("the broken route was actually requested", chunkRequests >= 1, `${chunkRequests} request(s)`);
check("a failed route file triggers one full page load",
  documentLoads - loadsBefore === 1, `${documentLoads - loadsBefore} document load(s)`);

// The reload re-requests the same file, which this test keeps breaking — so the
// second failure is the "reloading did not help" case, and must NOT loop.
const loadsAfterFirst = documentLoads;
await page.waitForTimeout(3000);
check("it does not reload again in a loop",
  documentLoads === loadsAfterFirst, `${documentLoads - loadsAfterFirst} extra load(s)`);

const body = (await page.textContent("body").catch(() => "")) ?? "";
check("the second failure explains itself", /ZotHub just updated/i.test(body), body.slice(0, 120));
check("it does not blame the visitor with a generic error",
  !/Something went wrong/i.test(body));
check("it offers a Reload, not a Try Again that cannot work",
  (await page.getByRole("button", { name: /^Reload$/ }).count()) === 1 &&
  (await page.getByRole("button", { name: /Try Again/i }).count()) === 0);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
