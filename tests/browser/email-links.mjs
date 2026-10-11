/** Every link in every email ZotHub sends must open a real page.
 *
 *  Found 2026-10-10 (launch-risk sweep, LR1): the "New application" email's
 *  only button pointed at /club/applications, which no route served — so the
 *  first email a club ever gets from ZotHub opened "Page not found".
 *
 *  The links are READ FROM THE TEMPLATES at test time, not copied here, so a
 *  template edited later is covered automatically. /club/applications is also
 *  checked by name forever: copies of the old email sit in inboxes no matter
 *  what the template says today.
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

// ---- harvest every zothub.app path the email code can produce ---------------
const SOURCES = [
  "supabase/functions/send-email/index.ts",
  "supabase/functions/send-reminders/index.ts",
  "supabase/functions/review-club-claim/index.ts",
];
const ID = "00000000-0000-0000-0000-000000000001";
// /events/:id is the other branch of the reminder link's ternary, which the
// substitution below resolves to /opportunities/:id only.
const paths = new Set(["/club/applications", `/events/${"00000000-0000-0000-0000-000000000001"}`]);
for (const f of SOURCES) {
  const src = readFileSync(f, "utf8");
  // A path segment may contain `${...}` expressions with spaces and quotes inside.
  for (const m of src.matchAll(/https:\/\/zothub\.app((?:\$\{[^}]*\}|[^"'`\s<)$])*)/g)) {
    let p = m[1] || "/";
    p = p.replace(/\$\{[^}]*\}/g, (expr) =>
      // `${kind === "opportunity" ? "opportunities" : "events"}/${post.id}` and `?type=${type}`
      /opportunities/.test(expr) ? "opportunities" : /type/.test(expr) ? "application_updates" : ID);
    paths.add(p.split("#")[0]);
  }
  // redirectTo: `${siteUrl}/reset-password`
  for (const m of src.matchAll(/\$\{siteUrl\}(\/[A-Za-z0-9/_-]*)/g)) paths.add(m[1]);
}
check("harvested the email links (guard: the parser found the templates)", paths.size >= 6, [...paths].join(" "));

// ---- visit each, signed out and as a signed-in club -------------------------
const USER_ID = "11111111-1111-1111-1111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "club@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "club@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function visit(path, signedIn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  if (signedIn) {
    await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-127-auth-token", JSON.stringify(session)]);
    await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
      body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
  }
  await page.route("**/rest/v1/**", (r) => {
    const u = new URL(r.request().url());
    const single = r.request().headers()["accept"]?.includes("pgrst.object");
    const j = (x) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(x) });
    if (signedIn && u.pathname.endsWith("/user_roles")) return j(single ? { role: "club" } : [{ role: "club" }]);
    if (signedIn && u.pathname.endsWith("/club_profiles"))
      return j(single ? { id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }
                      : [{ id: "c1", club_name: "Hack at UCI", logo_url: null, user_id: USER_ID }]);
    return j(single ? null : []);
  });
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2200);
  const mounted = await page.evaluate(() => {
    const r = document.getElementById("root");
    return !!r && r.children.length > 0;
  }).catch(() => false);
  const notFound = await page.getByRole("heading", { name: "Page not found" }).count();
  const landed = new URL(page.url()).pathname;
  await ctx.close();
  return { mounted, notFound, landed };
}

for (const p of paths) {
  const out = await visit(p, false);
  check(`signed out: ${p} renders`, out.mounted);
  check(`signed out: ${p} is not "Page not found"`, out.notFound === 0, `landed ${out.landed}`);
}

// The case that was broken, end to end for the person it was written for.
{
  const club = await visit("/club/applications", true);
  check("club signed in: the new-application email button opens Applicants", club.landed === "/applicants" && club.notFound === 0, `landed ${club.landed}`);
  const out = await visit("/club/applications", false);
  check("club signed out: it asks them to log in (and returns to Applicants after)", out.landed === "/login", `landed ${out.landed}`);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
