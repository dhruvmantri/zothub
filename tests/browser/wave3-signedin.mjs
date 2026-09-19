/** Wave 3, signed-in student: the Applied badge and the applications cache. */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
// Unset on a normal machine — Playwright finds its own browser. Set it in a
// cloud session, where the pre-installed build may not match the npm version.
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const USER_ID = "11111111-1111-1111-1111-111111111111";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
  sub: USER_ID, aud: "authenticated", role: "authenticated", exp,
  email: "student@uci.edu",
})}.sig`;

const user = {
  id: USER_ID, aud: "authenticated", role: "authenticated",
  email: "student@uci.edu", app_metadata: { provider: "email" },
  user_metadata: {}, created_at: new Date().toISOString(),
};
const session = {
  access_token: jwt, token_type: "bearer", expires_in: 3600,
  expires_at: exp, refresh_token: "r", user,
};

const OPPS = [
  { id: "o1", title: "Marketing Lead", type: "leadership", description: "Run the socials.",
    deadline: new Date(Date.now() + 86400000 * 14).toISOString(), club_id: "c1",
    club_profiles: { club_name: "Hack at UCI", logo_url: null }, applications: [{ id: "a1" }] },
  { id: "o2", title: "Treasurer", type: "leadership", description: null,
    deadline: null, club_id: "c1",
    club_profiles: { club_name: "Hack at UCI", logo_url: null }, applications: [] },
];

const counts = { opportunities: 0, applications: 0, student_profiles: 0, clubs: 0 };

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage();

await page.addInitScript(([k, s]) => { window.localStorage.setItem(k, s); },
  ["sb-127-auth-token", JSON.stringify(session)]);

await page.route("**/auth/v1/**", (route) => {
  const u = route.request().url();
  if (u.includes("/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
  if (u.includes("/token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

await page.route("**/rest/v1/**", (route) => {
  const p = new URL(route.request().url()).pathname;
  const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  const single = route.request().headers()["accept"]?.includes("pgrst.object");

  if (p.endsWith("/user_roles")) return json(single ? { role: "student" } : [{ role: "student" }]);
  if (p.endsWith("/student_profiles")) { counts.student_profiles++; return json(single ? { id: "sp1" } : [{ id: "sp1" }]); }
  if (p.endsWith("/applications")) { counts.applications++; return json([{ opportunity_id: "o1" }]); }
  if (p.endsWith("/opportunities")) { counts.opportunities++; return json(OPPS); }
  if (p.endsWith("/clubs") || p.includes("/rpc/")) { counts.clubs++; return json([]); }
  return json([]);
});

await page.goto(`${BASE}/opportunities`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Marketing Lead" }).first().waitFor({ timeout: 15000 });
await page.waitForTimeout(1500);

check("signed-in student session is recognised", counts.student_profiles >= 1,
  `student_profiles reads: ${counts.student_profiles}`);
check("the applications read fired exactly once", counts.applications === 1, `got ${counts.applications}`);
check("the applied role shows the Applied state",
  (await page.getByText(/^Applied$/).count()) > 0,
  `found ${await page.getByText(/^Applied$/).count()}`);
check("the un-applied role still shows Apply",
  (await page.getByText(/^Apply$/).count()) > 0);

// Saved chip must NOT show the sign-in prompt for a signed-in student.
await page.getByRole("button", { name: /^Saved$/ }).first().click();
await page.waitForTimeout(400);
check("signed-in student does NOT get the sign-in prompt",
  (await page.getByText("Saving needs an account").count()) === 0);
await page.getByRole("button", { name: /^All$/ }).first().click();

// Client-side navigation away and back: nothing refetches.
const before = { ...counts };
await page.getByRole("link", { name: "Clubs", exact: true }).first().click();
await page.waitForURL("**/clubs");
await page.goBack();
await page.waitForURL("**/opportunities");
await page.getByRole("heading", { name: "Marketing Lead" }).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1500);
check("return trip refetches no opportunities", counts.opportunities === before.opportunities,
  `${counts.opportunities - before.opportunities} extra`);
check("return trip refetches no applications", counts.applications === before.applications,
  `${counts.applications - before.applications} extra`);
check("return trip refetches no student profile", counts.student_profiles === before.student_profiles,
  `${counts.student_profiles - before.student_profiles} extra`);
check("the Applied state survives the round trip",
  (await page.getByText(/^Applied$/).count()) > 0);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
