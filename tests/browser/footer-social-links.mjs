/** The home-page footer links to ZotHub's LinkedIn, Instagram and email.
 *
 *  Maintainer decision 2026-10-10: three icons, home-page footer only. An icon
 *  link has no visible text, so "it renders" proves little. Checked instead:
 *  the exact destination of each, that each has an accessible name (a screen
 *  reader otherwise announces "link"), that each is a 44px target, that the
 *  icon clears 3:1 against the footer in BOTH themes (WCAG 1.4.11 — AA is a
 *  merge gate here), that clicking one really opens it, and that a phone does
 *  not scroll sideways.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const EXPECTED = [
  { name: "ZotHub on LinkedIn", href: "https://www.linkedin.com/company/zothub", external: true },
  { name: "ZotHub on Instagram", href: "https://www.instagram.com/zothub", external: true },
  { name: "Email ZotHub at zothub.uci@gmail.com", href: "mailto:zothub.uci@gmail.com", external: false },
];

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function open(theme, viewport) {
  const ctx = await browser.newContext({ viewport, colorScheme: theme });
  await ctx.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
  await ctx.route("**/rest/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  // Never reach the real sites from a test; a stub page proves the click opened it.
  for (const host of ["https://www.linkedin.com/**", "https://www.instagram.com/**"]) {
    await ctx.route(host, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title>" }));
  }
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const mounted = await page.evaluate(() => {
    const r = document.getElementById("root");
    return !!r && r.children.length > 0;
  }).catch(() => false);
  return { ctx, page, mounted };
}

/** WCAG contrast of a link's own colour (the icon is currentColor) against
 *  the footer. Takes the element itself, not a selector built from the href, so
 *  a wrong href fails its own check instead of crashing the run. */
const contrastOf = (link) => link.evaluate((a) => {
  const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const fg = parse(getComputedStyle(a).color);
  const bg = parse(getComputedStyle(a.closest("footer")).backgroundColor);
  const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
});

for (const theme of ["light", "dark"]) {
  for (const vp of [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 375, height: 800 }]) {
    const tag = `${theme}/${vp.name}`;
    const { ctx, page, mounted } = await open(theme, vp);
    check(`${tag}: page rendered`, mounted);

    const footer = page.locator("footer");
    for (const e of EXPECTED) {
      const link = footer.getByRole("link", { name: e.name, exact: true });
      const count = await link.count();
      check(`${tag}: "${e.name}" present once, by accessible name`, count === 1, `found ${count}`);
      if (count !== 1) continue;

      const href = await link.getAttribute("href");
      check(`${tag}: "${e.name}" goes to ${e.href}`, href === e.href, href ?? "no href");

      const target = await link.getAttribute("target");
      const rel = await link.getAttribute("rel");
      check(`${tag}: "${e.name}" ${e.external ? "opens a new tab, noopener" : "opens in place"}`,
        e.external ? target === "_blank" && /noopener/.test(rel ?? "") : target === null,
        `target=${target} rel=${rel}`);

      await link.scrollIntoViewIfNeeded();
      const box = await link.boundingBox();
      check(`${tag}: "${e.name}" is at least 44x44`, !!box && box.width >= 44 && box.height >= 44,
        box ? `${box.width}x${box.height}` : "no box");
      check(`${tag}: "${e.name}" sits inside the viewport`, !!box && box.x >= 0 && box.x + box.width <= vp.width,
        box ? `x=${box.x}` : "no box");

      const ratio = await contrastOf(link);
      check(`${tag}: "${e.name}" icon contrast >= 3:1`, ratio >= 3, ratio.toFixed(2));
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(`${tag}: no horizontal scroll`, !overflow);

    if (theme === "light" && vp.name === "desktop") {
      // A real click, not an href read: proves nothing sits on top of the link.
      const [popup] = await Promise.all([
        page.waitForEvent("popup", { timeout: 5000 }).catch(() => null),
        footer.getByRole("link", { name: "ZotHub on LinkedIn", exact: true }).click(),
      ]);
      check("clicking LinkedIn opens the company page in a new tab",
        !!popup && popup.url().startsWith("https://www.linkedin.com/company/zothub"), popup?.url() ?? "no popup");
      check("the home page stays open behind it", new URL(page.url()).pathname === "/");
    }
    await ctx.close();
  }
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
