/** A7 — "Sign in with UCI Google" when the provider is switched off.
 *
 *  Measured in production on 2026-10-10: /auth/v1/settings read
 *  `"google": false`, and the button navigated straight to Supabase's raw
 *  JSON 400 on a supabase.co address. The button now asks first.
 *
 *  Judged by where the browser actually goes (was /authorize requested at
 *  all?) and by what the visitor reads, in three states of the settings
 *  endpoint — and the two that must NOT block are as important as the one
 *  that must: an enabled provider still redirects, and a settings call that
 *  fails still redirects (unknown never blocks a working sign-in).
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

/** settings: "off" | "on" | "fail" */
async function tap(path, buttonName, settings, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const authorize = [];
  await ctx.route("**/auth/v1/settings", (route) => {
    if (settings === "fail") return route.abort();
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ external: { email: true, google: settings === "on" } }),
    });
  });
  await ctx.route("**/auth/v1/authorize**", (route) => {
    authorize.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub google</title>stub" });
  });
  await ctx.route("**/rest/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const mounted = await page.evaluate(() => {
    const r = document.getElementById("root");
    return !!r && r.children.length > 0;
  }).catch(() => false);
  const button = page.getByRole("button", { name: buttonName });
  const present = await button.count();
  if (present) await button.click();
  await page.waitForTimeout(2000);
  const toast = await page.getByText("Google sign-in isn't available right now. Please use your email instead.").count();
  const landed = page.url();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth).catch(() => null);
  const enabledAfter = present ? await button.isEnabled().catch(() => false) : false;
  await ctx.close();
  return { mounted, present, authorize, toast, landed, errors, overflow, enabledAfter };
}

for (const [path, name, label] of [
  ["/login", /Sign in with UCI Google/i, "login"],
  ["/signup?role=student", /Sign up with UCI Google/i, "signup (student)"],
  ["/signup?role=club", /Sign up with UCI Google/i, "signup (club)"],
]) {
  const off = await tap(path, name, "off");
  check(`${label}: page rendered`, off.mounted);
  check(`${label}: Google button present`, off.present === 1, `found ${off.present}`);
  check(`${label}, provider OFF: never navigates to /authorize`, off.authorize.length === 0, off.authorize.join(" "));
  check(`${label}, provider OFF: stays on ZotHub`, new URL(off.landed).host === new URL(BASE).host, off.landed);
  check(`${label}, provider OFF: tells the visitor to use email`, off.toast >= 1);
  check(`${label}, provider OFF: button usable again afterwards`, off.enabledAfter);
  check(`${label}, provider OFF: logs the cause for whoever looks`,
    off.errors.some((e) => /switched off.*A7/.test(e)), off.errors.slice(0, 2).join(" | "));

  const on = await tap(path, name, "on");
  check(`${label}, provider ON: still redirects to Google via /authorize`,
    on.authorize.length === 1 && /provider=google/.test(on.authorize[0]), on.authorize.join(" "));
  check(`${label}, provider ON: no 'unavailable' message`, on.toast === 0);

  const fail = await tap(path, name, "fail");
  check(`${label}, settings UNREACHABLE: still redirects (unknown never blocks)`,
    fail.authorize.length === 1, fail.authorize.join(" ") || "no /authorize request");
}

// Phone width: the message must be readable where most students will tap it.
{
  const r = await tap("/login", /Sign in with UCI Google/i, "off", { width: 375, height: 800 });
  check("phone, provider OFF: message shown", r.toast >= 1);
  check("phone, provider OFF: no horizontal scroll", r.overflow === false);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
