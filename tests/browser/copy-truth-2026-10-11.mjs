/** Two statements of fact the site got wrong (maintainer decisions 2026-10-11).
 *
 *  G3-05: the apply panel promised a club sees "your name, year and major —
 *  nothing else from your profile". Applying grants the club the whole profile
 *  row (RLS "Clubs can view applicant profiles") and attaches the résumé.
 *
 *  LR10 / G7-07 / G8-12: emails and the privacy policy signed off with UC
 *  Irvine's postal address as ZotHub's, and nothing said ZotHub is independent.
 *
 *  Checked on the rendered pages, plus the email template source (emails cannot
 *  be rendered here; the template is what send-email sends).
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const STATEMENT = "ZotHub is an independent, student-built platform, not affiliated with or endorsed by UC Irvine.";
const UCI_ADDRESS = /Irvine, CA 92697/;

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const USER_ID = "11111111-1111-1111-1111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "s@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "s@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };
const soon = new Date(Date.now() + 5 * 864e5).toISOString();
const OPP = { id: "o1", club_id: "c1", title: "Competition Team Lead", type: "leadership", description: "Lead the build team.", requirements: "", deadline: soon,
  is_active: true, application_questions: [], show_application_count: false, created_at: soon,
  club_profiles: { id: "c1", club_name: "Anteater Robotics", logo_url: null, website_url: null, description: "Robots.", user_id: "u-club" } };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function text(path, signedIn) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (signedIn) {
    await ctx.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-127-auth-token", JSON.stringify(session)]);
    await ctx.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
      body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
  }
  await ctx.route("**/rest/v1/**", (r) => {
    const u = new URL(r.request().url());
    const t = u.pathname.split("/").pop();
    const single = r.request().headers()["accept"]?.includes("pgrst.object");
    const j = (x) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(x) });
    if (t === "user_roles") return j(single ? { role: "student" } : [{ role: "student" }]);
    if (t === "student_profiles") return j(single ? { id: "sp1", full_name: "Sam", avatar_url: null } : [{ id: "sp1" }]);
    if (t === "opportunities") return j(single ? OPP : [OPP]);
    return j(single ? null : []);
  });
  await ctx.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const t = await page.locator("body").innerText().catch(() => "");
  await ctx.close();
  return t;
}

const home = await text("/", false);
check("home footer states ZotHub's independence", home.includes(STATEMENT));

const privacy = await text("/privacy", false);
check("privacy policy states ZotHub's independence", privacy.includes(STATEMENT));
check("privacy policy no longer gives UC Irvine's postal address as ZotHub's", !UCI_ADDRESS.test(privacy));

const apply = await text("/opportunities/o1", true);
check("apply panel is on screen for a student (guard)", apply.includes("Ready to apply?"));
check("apply panel says what the club actually sees", /Anteater Robotics will see your profile — name, UCI email, year,\s+major, skills, links and résumé — and your answers\./.test(apply));
check("apply panel no longer promises 'nothing else from your profile'", !apply.includes("nothing else from your profile"));

const email = readFileSync("supabase/functions/send-email/index.ts", "utf8");
check("email footer states ZotHub's independence", email.includes(STATEMENT));
check("email footer no longer gives UC Irvine's postal address", !UCI_ADDRESS.test(email));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
