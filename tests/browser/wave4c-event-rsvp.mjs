/**
 * Wave 4c — EventDetail, useEventRSVP and RSVPForm.
 *
 * Two things matter here:
 *  1. UX21 on the event side. `rsvp_questions` is selected only for a signed-in
 *     viewer. Serve an anon-shaped entry to a signed-in student and
 *     `hasQuestions` reads false, the RSVP form never opens, and the student is
 *     recorded as attending with `answers: []` for an event whose club asked
 *     questions. Neither side can tell it went wrong.
 *  2. The mutation cluster. The RSVP write now lives in useEventRSVP, so the
 *     form hands answers UP. The write must carry the answers, pick the right
 *     status, and invalidate the event so the attendee count is not stale.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
// Unset on a normal machine — Playwright finds its own browser. Set it in a
// cloud session, where the pre-installed build may not match the npm version.
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const EVENT_ID = "e1";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const QUESTION = "Any dietary requirements?";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "s@uci.edu" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "s@uci.edu", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user };

const CLUB = { id: "c1", club_name: "Hack at UCI", logo_url: null };
/** The fuller row ClubDetail selects — the test walks through the club page. */
const CLUB_FULL = {
  ...CLUB, category: "Technology", description: "We build things.", banner_url: null,
  website_url: null, linkedin_url: null, instagram_url: null, discord_url: null,
  user_id: "u1", source: null, source_url: null, imported_at: null, claimed_at: null,
};
const EVENT = {
  id: EVENT_ID, title: "Kickoff Night", description: "Come along.",
  event_date: new Date(Date.now() + 86400000 * 5).toISOString(),
  location: "DBH 6011", capacity: 100, banner_url: null,
  requires_approval: false, club_profiles: CLUB, rsvps: [],
};
const QUESTIONS = [{ id: "q1", type: "short_text", question: QUESTION, required: true }];

let authed = false;
const detailSelects = [];
/** Every write body sent to /rsvps. */
const rsvpWrites = [];
let eventReadsAfterWrite = 0;
let countingEventReads = false;

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage();

// NO injected session. The point is to browse the event logged OUT first, so
// the anon-shaped row is what the cache holds when the student signs in.
await page.route("**/auth/v1/**", (route) => {
  const u = route.request().url();
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (u.includes("/token")) { authed = true; return json(session); }
  if (u.includes("/user")) {
    return authed ? json(user) : route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  }
  return json({});
});

await page.route("**/rest/v1/**", (route) => {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const method = route.request().method();
  const single = route.request().headers()["accept"]?.includes("pgrst.object");
  const json = (b) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });

  if (p.endsWith("/user_roles")) return json(single ? { role: "student" } : [{ role: "student" }]);
  if (p.endsWith("/club_profiles")) return json(single ? CLUB_FULL : [CLUB_FULL]);
  if (p.endsWith("/club_team_members")) return json([]);
  if (p.endsWith("/opportunities")) return json([]);
  if (p.includes("/rpc/get_all_clubs_public")) return json([{ ...CLUB_FULL, opportunity_count: 0, event_count: 1 }]);
  if (p.endsWith("/student_profiles")) return json(single ? { id: "sp1", full_name: "Sam", avatar_url: null, user_id: USER_ID } : [{ id: "sp1" }]);

  if (p.endsWith("/rsvps")) {
    if (method === "POST" || method === "PATCH") {
      try { rsvpWrites.push(JSON.parse(route.request().postData() ?? "{}")); } catch { rsvpWrites.push({}); }
      return json(single ? { id: "r1" } : [{ id: "r1" }]);
    }
    // The viewer's own row — its own query, never derived from the event's
    // embedded rsvps array, which the SELECT policy filters per viewer (T14).
    return single ? json(null) : json([]);
  }

  if (p.endsWith("/events")) {
    const select = url.searchParams.get("select") ?? "";
    if (url.searchParams.get("id") === `eq.${EVENT_ID}`) {
      detailSelects.push(select);
      if (countingEventReads) eventReadsAfterWrite += 1;
      const row = select.includes("rsvp_questions")
        ? { ...EVENT, rsvp_questions: QUESTIONS }
        : { ...EVENT };
      return single ? json(row) : json([row]);
    }
    return json([EVENT]);
  }
  return json([]);
});

// ------------------------------------- 1. browse the event LOGGED OUT first
await page.goto(`${BASE}/events/${EVENT_ID}`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Kickoff Night", level: 1 }).waitFor({ timeout: 15000 });
await page.waitForTimeout(400);

check("logged out, the event read does NOT ask for rsvp_questions",
  detailSelects.length === 1 && !detailSelects[0].includes("rsvp_questions"),
  `${detailSelects.length} detail reads so far`);

// ---------------------------------------- 2. sign in through the real form
await page.getByRole("link", { name: /Log in/ }).first().click();
await page.waitForURL("**/login");
await page.getByLabel(/email/i).first().fill("s@uci.edu");
await page.getByLabel(/password/i).first().fill("hunter2hunter2");
await page.getByRole("button", { name: /^(Log in|Sign in)$/i }).first().click();
await page.waitForTimeout(2500);

// 3. Back to the SAME event through HISTORY.
//
//    NOT page.goto(): a full document load wipes an in-memory cache by
//    definition, so the test would pass whether or not the fix exists. It did,
//    once — the first version of this script used goto here and reported a
//    clean pass with BOTH UX21 protections deliberately removed.
//
//    History rather than a link click because there is no nav link to /events
//    yet (that is UX2, in the nav restructure). Back navigation inside an SPA
//    is client-side, so the cache survives it.
//    History does not work here either: going back lands on /login, which
//    bounces an authenticated visitor forward to their dashboard. So the test
//    walks a real client-side route instead — Clubs -> the club -> its event.
await page.getByRole("link", { name: "Clubs", exact: true }).first().click();
await page.waitForURL(/\/clubs$/);
await page.getByRole("link", { name: "Hack at UCI" }).first().click({ timeout: 15000 });
await page.waitForURL(`**/clubs/c1`);
await page.getByRole("link", { name: "Kickoff Night" }).first().click({ timeout: 15000 });
await page.waitForURL(`**/events/${EVENT_ID}`, { timeout: 15000 });
await page.getByRole("heading", { name: "Kickoff Night", level: 1 }).waitFor({ timeout: 15000 });
await page.waitForTimeout(600);

check("signed in, the event was re-read WITH rsvp_questions",
  detailSelects.length > 1 && detailSelects[detailSelects.length - 1].includes("rsvp_questions"),
  `${detailSelects.length} detail reads; last asked for questions: ${detailSelects[detailSelects.length - 1]?.includes("rsvp_questions")}`);
check("the anon-shaped entry was not reused for the signed-in viewer",
  detailSelects.length >= 2);

// --------------------------------------------------- the RSVP mutation cluster
const rsvpButton = page.getByRole("button", { name: /^RSVP/ }).first();
await rsvpButton.waitFor({ timeout: 10000 }).catch(() => {});
await rsvpButton.click({ timeout: 8000 }).catch(() => {});

const dialog = page.getByRole("dialog");
await dialog.waitFor({ timeout: 8000 }).catch(() => {});
const dialogText = await dialog.innerText().catch(() => "");
check("UX21: the RSVP form opened and carries the club's question",
  dialogText.includes(QUESTION),
  dialogText.includes(QUESTION)
    ? "the question reached the form"
    : `NO QUESTION — this is the silent blank-RSVP bug. Dialog: ${dialogText.slice(0, 200)}`);

// Answer it and submit. The form hands the answers UP; the hook writes them.
//
// Every step is guarded. When UX21 regresses, the dialog has no question and
// therefore no textbox, and an unguarded fill() throws — which aborts the run
// and hides the FAIL lines that explain what actually broke.
countingEventReads = true;
await dialog.getByRole("textbox").first().fill("Vegetarian").catch(() => {});
await dialog
  .getByRole("button", { name: /Confirm RSVP|Submit RSVP/ })
  .click({ timeout: 8000 })
  .catch(() => {});
await page.waitForTimeout(2500);

check("the RSVP write happened exactly once", rsvpWrites.length === 1, `${rsvpWrites.length} writes`);
const body = Array.isArray(rsvpWrites[0]) ? rsvpWrites[0][0] : rsvpWrites[0];
check("the answers reached the database, not an empty array",
  Array.isArray(body?.answers) && body.answers.length === 1 && body.answers[0].answer === "Vegetarian",
  `answers: ${JSON.stringify(body?.answers)}`);
check("the status was computed once, from requires_approval=false",
  body?.status === "confirmed", `status: ${body?.status}`);
check("the write invalidated the event, so the attendee count refetches",
  eventReadsAfterWrite >= 1, `${eventReadsAfterWrite} event re-reads after the write`);
check("the form closed on success", (await page.getByRole("dialog").count()) === 0);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
