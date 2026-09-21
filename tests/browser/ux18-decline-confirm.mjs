/** UX18 — a decline must ask first.
 *
 *  Before this, every path that declined a student (the row's X, the detail
 *  dialog's Decline, and "Decline all" over a whole selection) wrote the status
 *  and fired the rejection email on the first click. The point of these checks
 *  is therefore not "a dialog appears" but "NO PATCH was sent while it was up".
 *  A confirmation that renders after the damage is done would pass a looser
 *  test and fail a real club.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const USER_ID = "22222222-2222-2222-2222-222222222222";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
  sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "club@uci.edu",
})}.sig`;
const user = {
  id: USER_ID, aud: "authenticated", role: "authenticated", email: "club@uci.edu",
  app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString(),
};
const session = {
  access_token: jwt, token_type: "bearer", expires_in: 3600,
  expires_at: exp, refresh_token: "r", user,
};

const applicant = (id, name, email) => ({
  id, status: "pending", created_at: new Date().toISOString(), resume_url: null, answers: [],
  opportunity: { id: "o1", title: "Marketing Lead", application_questions: [], club_id: "cp1" },
  student: { id: `s-${id}`, full_name: name, email, major: "Informatics", year: "Junior" },
});
// Row order is the fetch order, so index 0 is Ada, 1 is Grace, 2 is Alan.
const APPS = [
  applicant("a1", "Ada Lovelace", "ada@uci.edu"),
  applicant("a2", "Grace Hopper", "grace@uci.edu"),
  applicant("a3", "Alan Turing", "alan@uci.edu"),
];

let writes = 0;          // PATCHes against /applications — the thing that must not happen early
let emails = 0;          // send-application-status edge calls

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.addInitScript(([k, s]) => { window.localStorage.setItem(k, s); },
  ["sb-127-auth-token", JSON.stringify(session)]);

await page.route("**/auth/v1/**", (route) => {
  const u = route.request().url();
  if (u.includes("/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
  if (u.includes("/token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

await page.route("**/functions/v1/**", (route) => {
  emails++;
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.route("**/rest/v1/**", (route) => {
  const req = route.request();
  const p = new URL(req.url()).pathname;
  const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  const single = req.headers()["accept"]?.includes("pgrst.object");

  if (req.method() === "PATCH") {
    if (p.endsWith("/applications")) writes++;
    return json([]);
  }
  if (p.endsWith("/user_roles")) return json(single ? { role: "club" } : [{ role: "club" }]);
  if (p.endsWith("/club_profiles")) return json(single ? { id: "cp1", club_name: "Hack at UCI" } : [{ id: "cp1", club_name: "Hack at UCI" }]);
  if (p.endsWith("/applications")) return json(APPS);
  if (p.endsWith("/opportunities")) return json([{ id: "o1", title: "Marketing Lead" }]);
  return json([]);
});

await page.goto(`${BASE}/applicants`, { waitUntil: "networkidle" });

const mounted = await page.evaluate(() => {
  const r = document.getElementById("root");
  return !!r && r.children.length > 0;
});
check("the applicants queue mounted", mounted, mounted ? "" : "server down — every result below is meaningless");

await page.getByText("Ada Lovelace").first().waitFor({ timeout: 15000 }).catch(() => {});
check("the three applicants rendered", (await page.getByRole("button", { name: "Decline application" }).count()) === 3,
  `found ${await page.getByRole("button", { name: "Decline application" }).count()} decline buttons`);

const dialog = page.getByRole("alertdialog");

// ---- A. row decline asks, and writes nothing while it asks -------------------
await page.getByRole("button", { name: "Decline application" }).nth(0).click().catch(() => {});
await page.waitForTimeout(300);
check("declining a row opens a confirmation", (await dialog.count()) === 1);
check("it names the student being declined",
  /Decline Ada Lovelace\?/.test(await dialog.textContent().catch(() => "")),
  (await dialog.locator("h2, [role=heading]").first().textContent().catch(() => "")) || "no title");
check("it warns that the email goes out",
  /emailed/i.test(await dialog.textContent().catch(() => "")));
check("NOTHING was written while the confirmation was open", writes === 0, `${writes} PATCH(es)`);
check("NO rejection email was sent while the confirmation was open", emails === 0, `${emails} call(s)`);

// ---- B. cancelling leaves the student alone, and the page usable ------------
await page.getByRole("button", { name: "Cancel" }).click().catch(() => {});
await page.waitForTimeout(300);
check("Cancel closes the confirmation", (await dialog.count()) === 0);
check("Cancel wrote nothing", writes === 0, `${writes} PATCH(es)`);
// A stacked Radix modal that restores `pointer-events` wrongly leaves the page
// looking fine and clicking nothing. Prove the page still responds.
await page.getByRole("checkbox", { name: "Select Grace Hopper" }).click().catch(() => {});
await page.waitForTimeout(250);
check("the page is still interactive after Cancel",
  (await page.getByText("1 selected").count()) === 1);

// ---- C. bulk decline names the whole selection ------------------------------
await page.getByRole("checkbox", { name: "Select Alan Turing" }).click().catch(() => {});
await page.waitForTimeout(250);
await page.getByRole("button", { name: "Decline all" }).click().catch(() => {});
await page.waitForTimeout(300);
const bulkText = await dialog.textContent().catch(() => "");
check("Decline all opens a confirmation", (await dialog.count()) === 1);
check("it counts the selection", /Decline 2 applicants\?/.test(bulkText), bulkText.slice(0, 80));
check("it names both students", /Grace Hopper/.test(bulkText) && /Alan Turing/.test(bulkText));
check("Decline all wrote nothing while asking", writes === 0, `${writes} PATCH(es)`);
await page.getByRole("button", { name: "Cancel" }).click().catch(() => {});
await page.waitForTimeout(300);

// ---- D. bulk accept confirms too (many people at once) ----------------------
await page.getByRole("button", { name: "Accept all" }).click().catch(() => {});
await page.waitForTimeout(300);
check("Accept all also confirms", (await dialog.count()) === 1);
check("it counts the selection", /Accept 2 applicants\?/.test(await dialog.textContent().catch(() => "")));
await page.getByRole("button", { name: "Cancel" }).click().catch(() => {});
await page.waitForTimeout(300);
check("nothing has been written yet at all", writes === 0, `${writes} PATCH(es)`);

// ---- E. a single accept stays instant ---------------------------------------
await page.getByRole("button", { name: "Accept application" }).nth(0).click().catch(() => {});
await page.waitForTimeout(600);
check("accepting one student does NOT confirm", (await dialog.count()) === 0);
check("accepting one student writes immediately", writes === 1, `${writes} PATCH(es)`);

// ---- F. confirming actually goes through ------------------------------------
await page.getByRole("button", { name: "Decline application" }).last().click().catch(() => {});
await page.waitForTimeout(300);
check("the last confirmation opened", (await dialog.count()) === 1);
await page.getByRole("button", { name: "Decline", exact: true }).click().catch(() => {});
await page.waitForTimeout(800);
check("confirming writes the decline", writes === 2, `${writes} PATCH(es)`);
check("confirming sends the email", emails >= 1, `${emails} call(s)`);
check("the confirmation closed itself", (await dialog.count()) === 0);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
