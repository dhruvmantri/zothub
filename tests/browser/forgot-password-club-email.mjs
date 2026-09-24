/** Forgot password must accept a club's own (non-UCI) email.
 *
 *  Approved club accounts are created with the club's email — often Gmail —
 *  and the claim-approved email tells them "if the link expires, use Forgot
 *  password". The page refused anything not ending in @uci.edu, so that
 *  advertised recovery path was a dead end for exactly the people sent to it.
 *
 *  Judged by the request that actually reaches Supabase (/auth/v1/recover),
 *  not by the absence of an error message.
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

async function submit(email, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const recovered = [];
  await ctx.route("**/auth/v1/**", (route) => {
    const req = route.request();
    if (req.url().includes("/recover")) {
      try { recovered.push(JSON.parse(req.postData() ?? "{}").email); } catch { recovered.push("?"); }
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await ctx.route("**/rest/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
  const mounted = await page.evaluate(() => {
    const r = document.getElementById("root");
    return !!r && r.children.length > 0;
  }).catch(() => false);
  await page.fill("#email", email);
  await page.getByRole("button", { name: /Send Reset Link/i }).click();
  await page.waitForTimeout(1200);
  const confirmed = await page.getByText(/Check your email/i).count();
  const refused = await page.getByText(/Please use your UCI email/i).count();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await ctx.close();
  return { mounted, recovered, confirmed, refused, overflow };
}

for (const email of ["president.club@gmail.com", "someone@uci.edu"]) {
  const r = await submit(email);
  check(`${email}: page rendered`, r.mounted);
  check(`${email}: not refused`, r.refused === 0);
  check(`${email}: reset request sent for that exact address`,
    r.recovered.length === 1 && r.recovered[0] === email, JSON.stringify(r.recovered));
  check(`${email}: confirmation shown`, r.confirmed >= 1);
}

// Phone width — the club president will very likely do this on a phone.
{
  const r = await submit("president.club@gmail.com", { width: 375, height: 800 });
  check("phone width: reset request sent", r.recovered.length === 1, JSON.stringify(r.recovered));
  check("phone width: no horizontal overflow", !r.overflow);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
