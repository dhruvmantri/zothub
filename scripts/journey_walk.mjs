/**
 * journey_walk.mjs — the step-8 design pass, run rather than read.
 *
 * Walks a list of routes in every combination of {light, dark} x {390px,
 * 1440px}, screenshots each one, and reports what it could not render. The
 * point is to LOOK at the product: `CLAUDE.md` § "Verify by running, not by
 * reading" exists because several defects here survived a code review and died
 * the first time someone opened the page.
 *
 * Against production it is read-only by construction, not by good intentions:
 * with --readonly (the default) every non-GET request to the database or to an
 * edge function is aborted before it leaves the browser. Signing in is the one
 * exception, because /auth/v1/token is a POST and there is no other way to see
 * a signed-in screen. So a walk can look at real data and cannot change it.
 *
 *   node scripts/journey_walk.mjs --role out
 *   ZOTHUB_EMAIL=… ZOTHUB_PASSWORD=… node scripts/journey_walk.mjs --role club
 *
 * Credentials come from the environment and are never written to disk, logged,
 * or committed.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const has = (name) => process.argv.includes(`--${name}`);

const BASE = arg("base", process.env.ZOTHUB_BASE_URL ?? "https://www.zothub.app");
const ROLE = arg("role", "out");
const OUT = arg("out", path.join(process.env.TMPDIR ?? "/tmp", "journey", ROLE));
const READONLY = !has("allow-writes");
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];
const THEMES = ["light", "dark"];

/** Reads that PostgREST happens to expose as POST. Every one of these is
 *  declared STABLE in its migration, and Postgres refuses to let a STABLE
 *  function modify the database — so this list is guaranteed by the engine,
 *  not by a naming convention. Check the migration before adding to it. */
const READ_ONLY_RPCS = [
  "get_all_clubs_public",
  "get_club_public_profile",
  "get_student_public_profile",
];

/** Routes per journey. `wait` is a selector worth waiting for before the shot,
 *  so a screenshot of a skeleton does not get mistaken for a design problem. */
const ROUTES = {
  out: [
    { path: "/", name: "landing" },
    { path: "/opportunities", name: "opportunities" },
    { path: "/events", name: "events" },
    { path: "/clubs", name: "clubs" },
    { path: "/login", name: "login" },
    { path: "/signup", name: "signup" },
    { path: "/forgot-password", name: "forgot-password" },
    { path: "/help", name: "help" },
    { path: "/privacy", name: "privacy" },
    { path: "/waitlist", name: "waitlist" },
    { path: "/waitlist-rejected", name: "waitlist-rejected" },
    { path: "/account-setup", name: "account-setup" },
    { path: "/this-route-does-not-exist", name: "not-found" },
  ],
  club: [
    { path: "/my-club", name: "my-club-overview" },
    { path: "/postings", name: "postings-roles" },
    { path: "/postings/events", name: "postings-events" },
    { path: "/postings/new", name: "posting-new-role" },
    { path: "/postings/events/new", name: "posting-new-event" },
    { path: "/applicants", name: "applicants" },
    { path: "/applicants/events", name: "applicants-rsvps" },
    { path: "/my-club/team", name: "team" },
    { path: "/my-club/analytics", name: "analytics" },
    { path: "/my-club/edit", name: "club-edit" },
    { path: "/messages", name: "messages" },
    { path: "/notifications", name: "notifications" },
  ],
  student: [
    { path: "/opportunities", name: "opportunities" },
    { path: "/events", name: "events" },
    { path: "/clubs", name: "clubs" },
    { path: "/activity", name: "activity" },
    { path: "/messages", name: "messages" },
    { path: "/notifications", name: "notifications" },
    { path: "/profile", name: "profile" },
    { path: "/profile/edit", name: "profile-edit" },
  ],
};

const routes = ROUTES[ROLE];
if (!routes) {
  console.error(`unknown --role ${ROLE}; expected one of ${Object.keys(ROUTES).join(", ")}`);
  process.exit(2);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const notes = [];
let blockedWrites = 0;

for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: theme,
      deviceScaleFactor: 1,
    });
    // next-themes reads this before first paint, so a page never renders in the
    // wrong theme and then corrects itself mid-screenshot.
    await ctx.addInitScript((t) => window.localStorage.setItem("theme", t), theme);

    if (READONLY) {
      await ctx.route("**/*", (route) => {
        const req = route.request();
        const url = req.url();
        const mutating = req.method() !== "GET" && req.method() !== "HEAD" && req.method() !== "OPTIONS";
        const isData = url.includes("/rest/v1/") || url.includes("/functions/v1/") || url.includes("/storage/v1/object/");
        // PostgREST calls every function over POST, read-only ones included, so
        // method alone cannot tell a read from a write. Blocking them all left
        // the clubs directory empty and the landing page reading "— clubs",
        // which looks exactly like a product defect and is not one. Named reads
        // are allowed through; anything not on the list is still refused.
        const isReadRpc = READ_ONLY_RPCS.some((fn) => url.includes(`/rest/v1/rpc/${fn}`));
        if (mutating && isData && !isReadRpc) {
          blockedWrites++;
          notes.push(`BLOCKED ${req.method()} ${new URL(url).pathname}`);
          return route.abort();
        }
        return route.continue();
      });
    }

    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));

    if (ROLE !== "out") {
      const email = process.env.ZOTHUB_EMAIL;
      const password = process.env.ZOTHUB_PASSWORD;
      if (!email || !password) {
        console.error("ZOTHUB_EMAIL and ZOTHUB_PASSWORD are required for a signed-in walk");
        process.exit(2);
      }
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await page.getByLabel(/email/i).first().fill(email).catch(() => {});
      await page.getByLabel(/password/i).first().fill(password).catch(() => {});
      // The form's submit button, NOT a name match: "Sign in with UCI Google"
      // renders above it and matches any sensible /sign ?in/ pattern, so a
      // first() match sends the walk to Google's consent screen instead.
      await page.locator('form button[type="submit"]').first().click().catch(() => {});
      await page.waitForTimeout(6000);
      if (/\/login$/.test(new URL(page.url()).pathname)) {
        notes.push(`LOGIN FAILED (${theme}/${vp.name}) — still on /login`);
      }
    }

    for (const r of routes) {
      const label = `${r.name}__${theme}__${vp.name}`;
      try {
        await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 30000 });
      } catch {
        await page.waitForTimeout(3000); // networkidle can never arrive; shoot anyway
      }
      await page.waitForTimeout(1200);

      const didMount = () => page.evaluate(() => {
        const root = document.getElementById("root");
        return !!root && root.children.length > 0;
      }).catch(() => false);

      // One retry, because the egress proxy intermittently answers 502 and an
      // empty page is indistinguishable from a page that genuinely renders
      // nothing. Two failures in a row is a finding; one is weather. This cost
      // an hour of chasing a "blank /login at desktop" that loads perfectly.
      let mounted = await didMount();
      if (!mounted) {
        await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1500);
        mounted = await didMount();
        if (!mounted) notes.push(`NOT MOUNTED ${label} (twice)`);
      }

      const landed = new URL(page.url()).pathname;
      if (landed !== r.path) notes.push(`REDIRECT ${r.path} -> ${landed} (${theme}/${vp.name})`);

      await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true }).catch((e) =>
        notes.push(`SCREENSHOT FAILED ${label}: ${e.message.slice(0, 120)}`));
    }

    if (consoleErrors.length) {
      notes.push(`CONSOLE (${theme}/${vp.name}): ${[...new Set(consoleErrors)].slice(0, 6).join(" | ")}`);
    }
    await ctx.close();
  }
}

await browser.close();
await writeFile(path.join(OUT, "notes.txt"), notes.join("\n") + "\n");
console.log(`walked ${routes.length} routes x ${THEMES.length} themes x ${VIEWPORTS.length} widths -> ${OUT}`);
console.log(READONLY ? `read-only: ${blockedWrites} write attempt(s) blocked` : "WRITES ALLOWED");
if (notes.length) console.log("\n" + notes.join("\n"));
