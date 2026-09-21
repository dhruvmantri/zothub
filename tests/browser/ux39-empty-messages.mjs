/** UX39 — the empty Messages pane must not ask for the impossible.
 *
 *  With no conversations at all, the right-hand pane still read "Select a
 *  conversation — choose a conversation from the list to start messaging",
 *  beside a list reading "No conversations yet". The design system's first rule
 *  is that a message never names a state without a way out of it, and there is
 *  no way out of picking from an empty list.
 *
 *  Both cases are checked, because the fix is only correct if "Select a
 *  conversation" SURVIVES when there is in fact something to select.
 */
import { chromium } from "playwright";

const BASE = process.env.ZOTHUB_BASE_URL ?? "http://127.0.0.1:8080";
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const USER_ID = "77777777-7777-7777-7777-777777777777";
const OTHER_ID = "88888888-8888-8888-8888-888888888888";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
  sub: USER_ID, aud: "authenticated", role: "authenticated", exp, email: "student@uci.edu",
})}.sig`;
const user = {
  id: USER_ID, aud: "authenticated", role: "authenticated", email: "student@uci.edu",
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

const MESSAGE = {
  id: "m1", sender_id: OTHER_ID, receiver_id: USER_ID,
  content: "Thanks for applying — are you free Thursday?",
  is_read: false, created_at: new Date().toISOString(),
};

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function open(withConversation) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(([k, s]) => window.localStorage.setItem(k, s),
    ["sb-127-auth-token", JSON.stringify(session)]);
  await ctx.route("**/auth/v1/**", (route) => {
    const u = route.request().url();
    if (u.includes("/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
    if (u.includes("/token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await ctx.route("**/rest/v1/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    const single = route.request().headers()["accept"]?.includes("pgrst.object");
    const json = (x) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(x) });
    if (p.endsWith("/user_roles")) return json(single ? { role: "student" } : [{ role: "student" }]);
    if (p.endsWith("/student_profiles")) return json(single ? { id: "sp1", full_name: "Priya R", user_id: USER_ID } : [{ id: "sp1", full_name: "Priya R", user_id: USER_ID }]);
    if (p.endsWith("/club_profiles")) return json([{ id: "cp1", club_name: "Anteater Robotics", logo_url: null, user_id: OTHER_ID }]);
    if (p.endsWith("/messages")) return json(withConversation ? [MESSAGE] : []);
    return json([]);
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  return { ctx, page };
}

// ---- nothing to select -----------------------------------------------------
{
  const { ctx, page } = await open(false);
  const body = (await page.textContent("body").catch(() => "")) ?? "";
  const mounted = await page.evaluate(() => {
    const r = document.getElementById("root");
    return !!r && r.children.length > 0;
  }).catch(() => false);
  check("Messages mounted with an empty list", mounted && /No conversations yet/i.test(body),
    mounted ? "" : "server down — rest is meaningless");
  check("it does not ask you to pick from an empty list",
    !/Choose a conversation from the list/i.test(body));
  check("it says what is actually true", /No messages yet/i.test(body));
  check("and says what will change it", /When a conversation starts/i.test(body));
  await ctx.close();
}

// ---- something to select ---------------------------------------------------
{
  const { ctx, page } = await open(true);
  const body = (await page.textContent("body").catch(() => "")) ?? "";
  check("with conversations present, the list is not empty",
    !/No conversations yet/i.test(body));
  // The important half: the original, correct message must survive the fix.
  check("it still asks you to pick one",
    /Choose a conversation from the list/i.test(body));
  check("and does not claim there are no messages",
    !/No messages yet/i.test(body));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
