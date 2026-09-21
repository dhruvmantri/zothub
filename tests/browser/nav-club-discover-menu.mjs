/**
 * The club "Discover" nav menu.
 *
 * It groups three destinations that are equally the point (Opportunities,
 * Events, Clubs), so it must NOT navigate anywhere itself — picking one would
 * bury the other two behind a page the club never asked for.
 *
 * Opening on hover was the requirement; opening on click and by keyboard is
 * the part that keeps it usable for anyone not holding a mouse, and on a phone
 * where hover does not exist at all.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
// Unset on a normal machine — Playwright finds its own browser. Set it in a
// cloud session, where the pre-installed build may not match the npm version.
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const USER_ID = "11111111-1111-1111-1111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "c@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "c@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

async function install(page) {
  await page.addInitScript(([k, v]) => { window.localStorage.setItem(k, v); },
    ["sb-127-auth-token", JSON.stringify(session)]);
  await page.route("**/auth/v1/**", (route) => {
    const u = route.request().url();
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (u.includes("/user")) return json(user);
    return json({});
  });
  await page.route("**/rest/v1/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    const single = route.request().headers()["accept"]?.includes("pgrst.object");
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p.endsWith("/user_roles")) return json(single ? { role: "club" } : [{ role: "club" }]);
    if (p.endsWith("/club_profiles"))
      return json(single ? { id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }
                         : [{ id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }]);
    return json([]);
  });
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

// ------------------------------------------------------ desktop: hover opens
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 700 } });
  const page = await ctx.newPage();
  await install(page);
  await page.goto(`${BASE}/my-club`, { waitUntil: "networkidle" }).catch(() => {});

  const trigger = page.getByRole("button", { name: /Discover/ });
  await trigger.waitFor({ timeout: 15000 }).catch(() => {});
  check("Discover is a menu button, not a link",
    await trigger.isVisible().catch(() => false),
    `links named Discover: ${await page.getByRole("link", { name: /^Discover$/ }).count()}`);
  check("Discover is NOT also a link (it must not navigate on its own)",
    (await page.getByRole("link", { name: /^Discover$/ }).count()) === 0);

  const urlBefore = page.url();
  await trigger.hover();
  await page.waitForTimeout(500);
  const menu = page.getByRole("menu");
  check("hovering opens the menu without a click",
    await menu.isVisible().catch(() => false));
  check("hovering did not navigate anywhere", page.url() === urlBefore,
    `${urlBefore} -> ${page.url()}`);

  const menuText = (await menu.innerText().catch(() => "")).replace(/\s+/g, " ");
  check("the menu offers Opportunities, Events and Clubs",
    /Opportunities/.test(menuText) && /Events/.test(menuText) && /Clubs/.test(menuText),
    `menu reads: ${menuText}`);

  // Moving the pointer onto the menu must not close it on the way.
  await menu.hover();
  await page.waitForTimeout(300);
  check("the menu survives the pointer moving onto it",
    await menu.isVisible().catch(() => false));

  await page.getByRole("menuitem", { name: /Events/ }).click();
  await page.waitForURL("**/events", { timeout: 10000 }).catch(() => {});
  check("choosing Events navigates there", /\/events$/.test(page.url()), page.url());
  await ctx.close();
}

// --------------------------------------------------------- keyboard: opens
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 700 } });
  const page = await ctx.newPage();
  await install(page);
  await page.goto(`${BASE}/my-club`, { waitUntil: "networkidle" }).catch(() => {});
  const trigger = page.getByRole("button", { name: /Discover/ });
  await trigger.waitFor({ timeout: 15000 }).catch(() => {});
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  check("the menu opens from the keyboard",
    await page.getByRole("menu").isVisible().catch(() => false));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("Escape closes it again",
    (await page.getByRole("menu").count()) === 0);
  await ctx.close();
}

// ------------------------------------------------- mobile: tap, not hover
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },
    hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  await install(page);
  await page.goto(`${BASE}/my-club`, { waitUntil: "networkidle" }).catch(() => {});

  const tab = page.getByRole("button", { name: /Discover/ });
  await tab.waitFor({ timeout: 15000 }).catch(() => {});
  await tab.click();
  await page.waitForTimeout(500);
  check("tapping the mobile tab opens the menu",
    await page.getByRole("menu").isVisible().catch(() => false));
  check("tapping did not navigate on its own", /\/my-club$/.test(page.url()), page.url());
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
