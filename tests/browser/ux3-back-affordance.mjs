/** UX3 — no entry page may be a dead end.
 *
 *  Login, the first Sign-up screen and both waitlist screens had no back
 *  affordance at all: the browser's Back button was the only way out, and the
 *  waitlist pages' sole control was Sign Out — the app made you destroy your
 *  session to leave a page that exists to tell you to wait.
 *
 *  Checked as a real, followable link rather than the presence of some text,
 *  because a label that goes nowhere is the defect this is meant to catch.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const USER_ID = "33333333-3333-3333-3333-333333333333";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
  sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "waiting@uci.edu",
})}.sig`;
const user = {
  id: USER_ID, aud: "authenticated", role: "authenticated", email: "waiting@uci.edu",
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

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function open({ signedIn, waitlistStatus }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (signedIn) {
    await ctx.addInitScript(([k, s]) => window.localStorage.setItem(k, s),
      ["sb-127-auth-token", JSON.stringify(session)]);
    await ctx.route("**/auth/v1/**", (route) => {
      const u = route.request().url();
      if (u.includes("/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
      if (u.includes("/token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
  }
  await ctx.route("**/rest/v1/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    const single = route.request().headers()["accept"]?.includes("pgrst.object");
    const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (p.endsWith("/waitlist")) {
      const row = { id: "w1", user_id: USER_ID, email: user.email, role: "student",
        status: waitlistStatus, requested_at: new Date().toISOString(), rejection_reason: "Not a UCI address." };
      return json(waitlistStatus ? (single ? row : [row]) : (single ? null : []));
    }
    if (p.endsWith("/user_roles")) return json(single ? null : []);
    return json([]);
  });
  return { ctx, page: await ctx.newPage() };
}

const PAGES = [
  { path: "/login", name: "Login", signedIn: false },
  { path: "/signup", name: "Sign-up (first screen)", signedIn: false },
  { path: "/help", name: "Help", signedIn: false },
  { path: "/waitlist", name: "Waitlist", signedIn: true, waitlistStatus: "pending" },
  { path: "/waitlist-rejected", name: "Waitlist rejected", signedIn: true, waitlistStatus: "rejected" },
];

for (const target of PAGES) {
  const { ctx, page } = await open(target);
  await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const mounted = await page.evaluate(() => {
    const r = document.getElementById("root");
    return !!r && r.children.length > 0;
  }).catch(() => false);
  const landed = new URL(page.url()).pathname;

  check(`${target.name} rendered`, mounted && landed === target.path,
    mounted ? `landed on ${landed}` : "never mounted");

  const link = page.getByRole("link", { name: /Back to Home/i });
  const count = await link.count();
  check(`${target.name} offers a way back`, count >= 1, `${count} link(s)`);
  if (count >= 1) {
    check(`${target.name}'s way back points at the home page`,
      (await link.first().getAttribute("href")) === "/",
      String(await link.first().getAttribute("href")));
  } else {
    check(`${target.name}'s way back points at the home page`, false, "no link to check");
  }
  await ctx.close();
}

// Following it must actually work, not merely look right.
{
  const { ctx, page } = await open({ signedIn: false });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Back to Home/i }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  check("following it from Login reaches the home page",
    new URL(page.url()).pathname === "/", new URL(page.url()).pathname);
  await ctx.close();
}

// UX28 — the 404 had no header and no footer, so "Back to home" was the only
// way off it. Same rule as above: never a dead end.
{
  const { ctx, page } = await open({ signedIn: false });
  await page.goto(`${BASE}/no-such-page-exists`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const names = ["Opportunities", "Events", "Clubs"];
  for (const name of names) {
    const link = page.getByRole("link", { name, exact: true });
    const count = await link.count();
    check(`the 404 can reach ${name}`, count >= 1, `${count} link(s)`);
  }
  await page.getByRole("link", { name: "Clubs", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  check("following one of them leaves the 404",
    new URL(page.url()).pathname === "/clubs", new URL(page.url()).pathname);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
