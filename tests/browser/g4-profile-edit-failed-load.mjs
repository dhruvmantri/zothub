/** Edit profile must never overwrite a profile it failed to read (audit G4-05).
 *
 *  On a read error the page toasted, then rendered the form with every field
 *  blank — and Save upserts all ten columns. One failed load on campus wifi
 *  plus a tap on Save replaced a student's real profile with nothing.
 *
 *  Judged by what is on screen and by what is WRITTEN: after a failed read there
 *  must be no form, no Save, and no write; a retry must bring the real values.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const USER_ID = "11111111-1111-1111-1111-111111111111";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "priya@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "priya@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };
const PROFILE = { id: "sp1", user_id: USER_ID, email: "priya@uci.edu", full_name: "Priya Raghunathan", major: "Computer Science", year: "Junior",
  graduation_date: null, skills: ["React"], interests: ["Robotics"], resume_url: null, linkedin_url: null, github_url: null, portfolio_url: null };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
let profileReads = 0;
const writes = [];
await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ["sb-127-auth-token", JSON.stringify(session)]);
await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
  body: r.request().url().includes("/user") ? JSON.stringify(user) : "{}" }));
await page.route("**/rest/v1/**", (r) => {
  const req = r.request();
  const u = new URL(req.url());
  const table = u.pathname.split("/").pop();
  const single = req.headers()["accept"]?.includes("pgrst.object");
  const j = (x, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(x) });
  if (req.method() !== "GET" && req.method() !== "HEAD") {
    writes.push({ table, method: req.method(), body: req.postData() });
    return j(single ? PROFILE : [PROFILE], 201);
  }
  if (table === "user_roles") return j(single ? { role: "student" } : [{ role: "student" }]);
  if (table === "student_profiles" && u.search.includes("select=*")) {
    profileReads += 1;
    // The FIRST full-profile read on the edit page fails; every later one works.
    if (profileReads === 1) return j({ code: "PGRST500", message: "upstream connect error" }, 503);
    return j(single ? PROFILE : [PROFILE]);
  }
  if (table === "student_profiles") return j(single ? { id: "sp1", full_name: "Priya Raghunathan", avatar_url: null } : [{ id: "sp1" }]);
  return j(single ? null : []);
});
await page.route("**/rpc/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
check("the first profile read really failed (guard)", profileReads >= 1, `${profileReads} read(s)`);

const saveAfterFail = await page.getByRole("button", { name: /^save/i }).count();
check("after a failed read: an error with a retry is shown", (await page.getByText("We couldn't load").count()) > 0);
check("after a failed read: no Save button to press", saveAfterFail === 0, `${saveAfterFail} found`);
if (saveAfterFail > 0) {
  // The old behaviour: press it, as a student would, and show what it does.
  await page.getByRole("button", { name: /^save/i }).first().click();
  await page.waitForTimeout(1500);
}
check("after a failed read: nothing was written", writes.length === 0, writes.map((w) => w.body?.slice(0, 140)).join(" | "));

if (saveAfterFail > 0) {
  console.log("(old behaviour detected — stopping before the retry half)");
} else {
await page.getByRole("button", { name: /try again/i }).click();
await page.waitForTimeout(2000);
const nameValue = await page.locator("input").evaluateAll((els) => els.map((e) => e.value)).catch(() => []);
check("after retry: the real profile is in the form", nameValue.includes("Priya Raghunathan"), nameValue.slice(0, 3).join(" | "));

await page.getByRole("button", { name: /^save/i }).first().click();
await page.waitForTimeout(1500);
const upsert = writes.find((w) => w.table === "student_profiles");
check("after retry: Save writes the real values, not blanks", !!upsert && upsert.body.includes("Priya Raghunathan"), upsert?.body?.slice(0, 100) ?? "no write");
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
