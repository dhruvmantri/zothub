// End-to-end security tests for the signup gate + LOGGED-OUT club claim flow, run
// against a LOCAL Supabase stack (never production). See tests/e2e/README.md.
//
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY),
// SUPABASE_ANON_KEY (or ANON_KEY). tests/e2e/run.sh wires these. Run with Node ≥ 22:
//   node --experimental-strip-types tests/e2e/claim-and-signup.e2e.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { esc, safeUrl } from "../../supabase/functions/send-email/email-escape.ts";
import { checkEmailResult } from "../../supabase/functions/_shared/email-result.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.ANON_KEY;
if (!URL || !SERVICE_KEY || !ANON_KEY) {
  console.error("Missing SUPABASE_URL / service-role key / anon key in env.");
  process.exit(2);
}

const RUN = randomUUID().slice(0, 8);
const PW = "Passw0rd!e2e";
const hashPassword = (p) => createHash("sha256").update(p).digest("hex");

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL, ANON_KEY, { auth: { persistSession: false } });

let passed = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ""}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function section(t) { console.log(`\n== ${t} ==`); }

async function invokeFn(fn, body, bearer) {
  const res = await fetch(`${URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${bearer}` },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}
async function emailExists(email) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data?.users ?? []).some((u) => u.email?.toLowerCase() === email.toLowerCase());
}
async function signInToken(email, password) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed for ${email}: ${error.message}`);
  return data.session.access_token;
}
// --- direct SQL, for fault injection + testing the migration's backfill ---------
// Uses the LOCAL Supabase database container only (name derived from config.toml),
// never a remote/production database. Returns null when unavailable so the affected
// tests report as SKIPPED rather than silently "passing".
const PROJECT_REF = (readFileSync(resolve(REPO_ROOT, "supabase/config.toml"), "utf8")
  .match(/^project_id\s*=\s*"([^"]+)"/m) ?? [])[1];
const DB_CONTAINER = PROJECT_REF ? `supabase_db_${PROJECT_REF}` : null;
let sqlAvailable = null;
function psql(sql) {
  if (!DB_CONTAINER) return null;
  try {
    return execFileSync(
      "docker",
      ["exec", "-i", "-e", "PGPASSWORD=postgres", DB_CONTAINER,
        "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", sql],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PATH: `${process.env.PATH}:/Applications/Docker.app/Contents/Resources/bin` } },
    ).trim();
  } catch (e) {
    if (sqlAvailable === null) console.log(`  (direct SQL unavailable: ${String(e.message).split("\n")[0]})`);
    return null;
  }
}
function sqlReady() {
  if (sqlAvailable === null) sqlAvailable = psql("select 1") === "1";
  return sqlAvailable;
}
let skipped = 0;
function skip(name, why) {
  skipped++;
  console.log(`  ⚠ SKIPPED ${name} — ${why}`);
}

async function seedClub({ tag, source = "zotspot", published = true, userId = null }) {
  const row = {
    club_name: `E2E ${tag} ${RUN}`,
    source,
    published,
    ...(source ? { source_club_id: `e2e-${tag}-${RUN}` } : {}),
    ...(userId ? { user_id: userId, claimed_at: new Date().toISOString() } : {}),
  };
  const { data, error } = await admin.from("club_profiles").insert(row).select("id").single();
  if (error) throw new Error(`seed club failed: ${error.message}`);
  return data.id;
}

async function main() {
  const adminEmail = `admin+${RUN}@uci.edu`;
  const { data: adminUser, error: adminErr } = await admin.auth.admin.createUser({ email: adminEmail, password: PW, email_confirm: true });
  if (adminErr) throw new Error(`admin create failed: ${adminErr.message}`);
  await admin.from("user_roles").insert({ user_id: adminUser.user.id, role: "admin" });
  const adminToken = await signInToken(adminEmail, PW);

  // An ordinary authenticated (non-admin) user for authorization checks.
  const studentEmail = `student.actor+${RUN}@uci.edu`;
  const { data: studentUser } = await admin.auth.admin.createUser({ email: studentEmail, password: PW, email_confirm: true });
  await admin.from("user_roles").insert({ user_id: studentUser.user.id, role: "student" });
  const studentToken = await signInToken(studentEmail, PW);

  // ===== Finding #1 — DB @uci.edu gate + one-time authorization =====
  section("DB trigger: @uci.edu authoritative; non-UCI needs a one-time grant");
  {
    const uci = `s.direct+${RUN}@uci.edu`;
    const r1 = await admin.auth.admin.createUser({ email: uci, email_confirm: true });
    ok("UCI email creatable directly", !r1.error, r1.error?.message);
    if (r1.data?.user) await admin.auth.admin.deleteUser(r1.data.user.id);

    const nonUci = `nobody+${RUN}@gmail.com`;
    const r2 = await admin.auth.admin.createUser({ email: nonUci, email_confirm: true });
    ok("non-UCI BLOCKED without authorization", !!r2.error, r2.error ? "" : "allowed!");
    if (r2.data?.user) await admin.auth.admin.deleteUser(r2.data.user.id);

    const clubEmail = `officer+${RUN}@club.org`;
    await admin.from("signup_email_authorizations").insert({ email: clubEmail, reason: "e2e", expires_at: new Date(Date.now() + 36e5).toISOString() });
    const r3 = await admin.auth.admin.createUser({ email: clubEmail, email_confirm: true });
    ok("non-UCI allowed WITH authorization", !r3.error, r3.error?.message);
    const { data: authz } = await admin.from("signup_email_authorizations").select("consumed_at").ilike("email", clubEmail).maybeSingle();
    ok("authorization consumed", !!authz?.consumed_at);
    if (r3.data?.user) await admin.auth.admin.deleteUser(r3.data.user.id);
  }

  // ===== Finding #1 — email_verifications not publicly forgeable =====
  section("email_verifications RLS: anon cannot forge / read");
  {
    const { error: insErr } = await anon.from("email_verifications").insert({
      email: `forge+${RUN}@uci.edu`, code: "000000", role: "club", password_hash: hashPassword(PW), expires_at: new Date(Date.now() + 6e5).toISOString(),
    });
    ok("anon INSERT denied", !!insErr, insErr ? "" : "insert succeeded!");
    const { data: rows } = await anon.from("email_verifications").select("code").limit(5);
    ok("anon SELECT returns nothing", !rows || rows.length === 0);
  }

  // ===== verify-otp: student (UCI) + club (non-UCI) with published=false =====
  section("verify-otp: student auto-approved; club NON-UCI created published=false");
  {
    const sEmail = `v.student+${RUN}@uci.edu`;
    await admin.from("email_verifications").insert({ email: sEmail, code: "123456", role: "student", password_hash: hashPassword(PW), expires_at: new Date(Date.now() + 6e5).toISOString() });
    const vs = await invokeFn("verify-otp", { email: sEmail, code: "123456", password: PW }, ANON_KEY);
    ok("student verify-otp auto-approved", vs.status === 200 && vs.json?.autoApproved === true, JSON.stringify(vs.json));

    const cEmail = `v.club+${RUN}@clubdomain.io`;
    await admin.from("email_verifications").insert({ email: cEmail, code: "654321", role: "club", password_hash: hashPassword(PW), expires_at: new Date(Date.now() + 6e5).toISOString() });
    const vc = await invokeFn("verify-otp", { email: cEmail, code: "654321", password: PW }, ANON_KEY);
    ok("club verify-otp succeeds (non-UCI)", vc.status === 200 && !!vc.json?.userId, JSON.stringify(vc.json));
    const { data: clubProf } = await admin.from("club_profiles").select("published").eq("user_id", vc.json.userId).maybeSingle();
    ok("pending club created with published=false", clubProf?.published === false, JSON.stringify(clubProf));
  }

  // ===== Finding #2 — pending clubs are invisible until published =====
  section("pending-club visibility: published=false absent from directory + profile");
  {
    const { data: pu } = await admin.auth.admin.createUser({ email: `pending.club+${RUN}@uci.edu`, password: PW, email_confirm: true });
    const pendingClubId = await seedClub({ tag: "Pending", source: null, published: false, userId: pu.user.id });

    const { data: dir } = await anon.rpc("get_all_clubs_public");
    ok("pending club NOT in public directory rpc", !(dir ?? []).some((c) => c.id === pendingClubId));
    const { data: prof } = await anon.rpc("get_club_public_profile", { club_profile_id: pendingClubId });
    ok("pending club NOT returned by public profile rpc", !prof || prof.length === 0);
    const { data: direct } = await anon.from("club_profiles").select("id").eq("id", pendingClubId).maybeSingle();
    ok("pending club NOT visible via anon direct select (RLS)", !direct);

    await admin.from("club_profiles").update({ published: true }).eq("id", pendingClubId);
    const { data: prof2 } = await anon.rpc("get_club_public_profile", { club_profile_id: pendingClubId });
    ok("becomes visible once published", Array.isArray(prof2) && prof2.length === 1);
  }

  // ===== Finding #5 — OTP delivery false-success handling =====
  section("send-otp: rejects student non-UCI; false-success email → 500 + OTP deleted");
  {
    const bad = await invokeFn("send-otp", { email: `x+${RUN}@gmail.com`, password: PW, role: "student" }, ANON_KEY);
    ok("student non-UCI rejected", bad.status === 400 && /uci\.edu/i.test(bad.json?.error ?? ""), JSON.stringify(bad.json));

    const cEmail = `otp.fail+${RUN}@uci.edu`;
    const r = await invokeFn("send-otp", { email: cEmail, password: PW, role: "student" }, ANON_KEY);
    ok("send-otp reports failure when email can't be delivered", r.status === 500 && /verification email/i.test(r.json?.error ?? ""), JSON.stringify(r.json));
    const { data: leftover } = await admin.from("email_verifications").select("id").eq("email", cEmail);
    ok("unusable OTP record deleted after failed send", (leftover ?? []).length === 0, `rows=${leftover?.length}`);
  }

  // ===== Finding #6 — atomic rate limiting =====
  section("send-otp: atomic per-email rate limit");
  {
    const em = `rl.otp+${RUN}@uci.edu`;
    const codes = [];
    for (let i = 0; i < 4; i++) {
      const r = await invokeFn("send-otp", { email: em, password: PW, role: "student" }, ANON_KEY);
      codes.push(r.status);
    }
    ok("4th OTP request for same email is rate-limited (429)", codes[3] === 429, `statuses=${codes.join(",")}`);
  }

  section("verify-otp: atomic attempt cap deletes the record");
  {
    const em = `att+${RUN}@uci.edu`;
    await admin.from("email_verifications").insert({ email: em, code: "111111", role: "student", password_hash: hashPassword(PW), expires_at: new Date(Date.now() + 6e5).toISOString() });
    let last;
    for (let i = 0; i < 5; i++) last = await invokeFn("verify-otp", { email: em, code: "000000", password: PW }, ANON_KEY);
    ok("5 wrong attempts → 'too many'", /too many/i.test(last.json?.error ?? ""), JSON.stringify(last.json));
    const { data: rows } = await admin.from("email_verifications").select("id").eq("email", em);
    ok("verification record deleted after cap", (rows ?? []).length === 0);
  }

  // ===== Finding #3 — send-email authorization matrix + escaping =====
  section("send-email: strict allowlist + tiered authorization");
  {
    const bogus = await invokeFn("send-email", { type: "totally_bogus", to: `v+${RUN}@x.com`, data: {} }, SERVICE_KEY);
    ok("unknown type rejected (400) even for service role", bogus.status === 400, JSON.stringify(bogus.json));

    const serviceOnly = ["email_otp", "claim_approved", "claim_rejected", "new_club_post", "deadline_reminder", "rsvp_reminder"];
    for (const t of serviceOnly) {
      const a = await invokeFn("send-email", { type: t, to: `v+${RUN}@x.com`, data: { code: "1", clubName: "X", actionLink: "https://zothub.app/x", title: "t", link: "https://zothub.app", opportunityTitle: "o", eventTitle: "e" } }, ANON_KEY);
      ok(`service-only '${t}': anon → 401`, a.status === 401, `status ${a.status}`);
      const u = await invokeFn("send-email", { type: t, to: `v+${RUN}@x.com`, data: { code: "1" } }, studentToken);
      ok(`service-only '${t}': ordinary user → 401`, u.status === 401, `status ${u.status}`);
      const s = await invokeFn("send-email", { type: t, to: `v+${RUN}@x.com`, data: { code: "1", clubName: "X", actionLink: "https://zothub.app/x", title: "t", link: "https://zothub.app", opportunityTitle: "o", eventTitle: "e", deadline: "soon" } }, SERVICE_KEY);
      ok(`service-only '${t}': service role passes gate (not 401)`, s.status !== 401, `status ${s.status}`);
    }

    const authoritative = ["application_notification", "application_confirmation", "application_status", "rsvp_confirmation", "rsvp_declined", "event_cancelled", "waitlist_confirmation", "waitlist_approved", "waitlist_rejected"];
    for (const t of authoritative) {
      const a = await invokeFn("send-email", { type: t, to: `v+${RUN}@x.com`, data: {} }, ANON_KEY);
      ok(`authoritative '${t}': anon → 401`, a.status === 401, `status ${a.status}`);
    }

    // Ordinary user cannot send admin / arbitrary-recipient mail.
    const wa = await invokeFn("send-email", { type: "waitlist_approved", data: { waitlistUserId: studentUser.user.id } }, studentToken);
    ok("ordinary user waitlist_approved → 403 (admin only)", wa.status === 403, JSON.stringify(wa.json));
    const as = await invokeFn("send-email", { type: "application_status", data: { applicationId: randomUUID() } }, studentToken);
    ok("ordinary user application_status w/ bogus id → 404 (no ownership)", as.status === 404, JSON.stringify(as.json));

    // Self-derived + service-trusted paths succeed (not 401/403).
    const wc = await invokeFn("send-email", { type: "waitlist_confirmation", data: { role: "student" } }, studentToken);
    ok("authed user waitlist_confirmation (self) passes (200)", wc.status === 200, JSON.stringify(wc.json));
    const wcs = await invokeFn("send-email", { type: "waitlist_confirmation", to: `someone+${RUN}@x.com`, data: { role: "club" } }, SERVICE_KEY);
    ok("service waitlist_confirmation passes (200)", wcs.status === 200, `status ${wcs.status}`);
  }

  section("send-email: dynamic content escaped");
  {
    ok("esc neutralises <script>", esc("<script>x</script>") === "&lt;script&gt;x&lt;/script&gt;");
    ok("esc escapes quotes/amp", esc(`a&"b'`) === "a&amp;&quot;b&#39;");
    ok("safeUrl blocks javascript:", safeUrl("javascript:alert(1)") === "#");
    ok("safeUrl blocks data:", safeUrl("data:text/html,x") === "#");
    ok("safeUrl strips quotes from https", !safeUrl(`https://z.app/"x`).includes('"'));
  }

  // ===== Findings #1/#5 (claim) — submit-club-claim (logged-out-only) =====
  section("submit-club-claim: claimable rules, idempotency, no enumeration, rate limit");
  const clubA = await seedClub({ tag: "A" });
  {
    const c1 = await invokeFn("submit-club-claim", { clubId: clubA, email: `claimer+${RUN}@club.org`, note: "hi" }, ANON_KEY);
    ok("claim on published zotspot club accepted", c1.status === 200 && c1.json?.ok === true, JSON.stringify(c1.json));
    const { data: row, count } = await admin.from("club_claim_requests").select("id", { count: "exact" }).eq("club_id", clubA).ilike("claimant_email", `claimer+${RUN}@club.org`);
    ok("pending row created", (count ?? 0) === 1 && !!row);

    const c2 = await invokeFn("submit-club-claim", { clubId: clubA, email: `claimer+${RUN}@club.org` }, ANON_KEY);
    ok("duplicate claim idempotent (still ok)", c2.status === 200 && c2.json?.ok === true);

    const existing = `exists+${RUN}@uci.edu`;
    await admin.auth.admin.createUser({ email: existing, password: PW, email_confirm: true });
    const c3 = await invokeFn("submit-club-claim", { clubId: clubA, email: existing }, ANON_KEY);
    ok("existing-account email does NOT leak (still ok)", c3.status === 200 && !/already/i.test(JSON.stringify(c3.json)), JSON.stringify(c3.json));

    const organic = await seedClub({ tag: "Organic", source: null, published: true });
    const c4 = await invokeFn("submit-club-claim", { clubId: organic, email: `x+${RUN}@club.org` }, ANON_KEY);
    ok("non-zotspot club not claimable → 409", c4.status === 409, JSON.stringify(c4.json));

    const unpub = await seedClub({ tag: "Unpub", source: "zotspot", published: false });
    const c5 = await invokeFn("submit-club-claim", { clubId: unpub, email: `x+${RUN}@club.org` }, ANON_KEY);
    ok("unpublished zotspot club not claimable → 409", c5.status === 409, JSON.stringify(c5.json));

    const claimed = await seedClub({ tag: "Claimed", source: "zotspot", published: true, userId: adminUser.user.id });
    const c6 = await invokeFn("submit-club-claim", { clubId: claimed, email: `x+${RUN}@club.org` }, ANON_KEY);
    ok("already-claimed club → 409", c6.status === 409, JSON.stringify(c6.json));

    // Same email across DIFFERENT clubs (each a new (club,email) pair, so none is a
    // no-op idempotent hit) → the per-email atomic limit trips.
    const rlEmail = `rl.claim+${RUN}@x.org`;
    let got429 = false;
    for (let i = 0; i < 7; i++) {
      const c = await seedClub({ tag: `RL${i}` });
      const r = await invokeFn("submit-club-claim", { clubId: c, email: rlEmail }, ANON_KEY);
      if (r.status === 429) { got429 = true; break; }
    }
    ok("atomic per-email claim rate limit triggers 429", got429);
  }

  // ===== Findings #2/#4 — review-club-claim =====
  section("review-club-claim: guards, approval (new account), truthful email, concurrency");
  {
    const g1 = await invokeFn("review-club-claim", { requestId: randomUUID(), action: "approve" }, ANON_KEY);
    ok("unauthenticated review → 401", g1.status === 401);
    const g2 = await invokeFn("review-club-claim", { requestId: randomUUID(), action: "approve" }, studentToken);
    ok("non-admin review → 403", g2.status === 403);

    const { data: pend } = await admin.from("club_claim_requests").select("id").eq("club_id", clubA).eq("status", "pending").ilike("claimant_email", `claimer+${RUN}@club.org`).maybeSingle();
    const ap = await invokeFn("review-club-claim", { requestId: pend.id, action: "approve" }, adminToken);
    ok("approve returns ok", ap.status === 200 && ap.json?.ok === true, JSON.stringify(ap.json));
    ok("approve honestly reports emailSent=false (local)", ap.json?.emailSent === false);
    const { data: clubAfter } = await admin.from("club_profiles").select("user_id, claimed_at, email").eq("id", clubA).single();
    ok("club bound to new owner", clubAfter.user_id === ap.json?.userId && !!clubAfter.claimed_at);
    ok("approved email SAVED to club_profiles", clubAfter.email === `claimer+${RUN}@club.org`, clubAfter.email);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", ap.json.userId).eq("role", "club").maybeSingle();
    ok("club role granted", !!role);
    ok("separate club account created for the submitted email", await emailExists(`claimer+${RUN}@club.org`));
    const { data: reqAfter } = await admin.from("club_claim_requests").select("status, created_user_id, email_status").eq("id", pend.id).single();
    ok("request approved + email_status failed", reqAfter.status === "approved" && reqAfter.created_user_id === ap.json.userId && reqAfter.email_status === "failed");

    const { data: link } = await admin.auth.admin.generateLink({ type: "recovery", email: `claimer+${RUN}@club.org`, options: { redirectTo: `${process.env.PUBLIC_SITE_URL ?? "http://localhost:8080"}/reset-password` } });
    const actionLink = link?.properties?.action_link ?? "";
    ok("password-reset (recovery) link generated", /^https?:\/\//.test(actionLink) && /type=recovery/.test(actionLink) && /token=/.test(actionLink), actionLink.slice(0, 60));

    const rs = await invokeFn("review-club-claim", { requestId: pend.id, action: "resend" }, adminToken);
    ok("resend approval email runs (502 locally, link regenerated)", rs.status === 502 && /email failed/i.test(rs.json?.error ?? ""), JSON.stringify(rs.json));

    // Reject with reason + retryable rejection email.
    const rejClub = await seedClub({ tag: "Reject" });
    await invokeFn("submit-club-claim", { clubId: rejClub, email: `rej+${RUN}@x.org` }, ANON_KEY);
    const { data: rejReq } = await admin.from("club_claim_requests").select("id").eq("club_id", rejClub).eq("status", "pending").maybeSingle();
    const rj = await invokeFn("review-club-claim", { requestId: rejReq.id, action: "reject", reason: "Not verifiable." }, adminToken);
    ok("reject ok + honest emailSent=false", rj.status === 200 && rj.json?.status === "rejected" && rj.json?.emailSent === false, JSON.stringify(rj.json));
    const { data: rejAfter } = await admin.from("club_claim_requests").select("status, rejection_reason, email_status").eq("id", rejReq.id).single();
    ok("reject sets reason + email_status failed", rejAfter.status === "rejected" && rejAfter.rejection_reason === "Not verifiable." && rejAfter.email_status === "failed");
    const rjr = await invokeFn("review-club-claim", { requestId: rejReq.id, action: "resend" }, adminToken);
    ok("rejection email is retryable via resend (502 locally)", rjr.status === 502 && /email failed/i.test(rjr.json?.error ?? ""), JSON.stringify(rjr.json));

    // approve/reject race on the SAME request → exactly one wins, no partial state.
    const arClub = await seedClub({ tag: "AR" });
    await invokeFn("submit-club-claim", { clubId: arClub, email: `ar+${RUN}@x.org` }, ANON_KEY);
    const { data: arReq } = await admin.from("club_claim_requests").select("id").eq("club_id", arClub).eq("status", "pending").maybeSingle();
    const [aRes, rRes] = await Promise.all([
      invokeFn("review-club-claim", { requestId: arReq.id, action: "approve" }, adminToken),
      invokeFn("review-club-claim", { requestId: arReq.id, action: "reject", reason: "race" }, adminToken),
    ]);
    const winners = [aRes, rRes].filter((r) => r.status === 200).length;
    ok("approve/reject race → exactly one succeeds", winners === 1, `approve=${aRes.status} reject=${rRes.status}`);
    const { data: arAfter } = await admin.from("club_profiles").select("user_id").eq("id", arClub).single();
    const approvedWon = aRes.status === 200;
    ok("no partial state (club bound iff approve won)", approvedWon ? !!arAfter.user_id : !arAfter.user_id, `approvedWon=${approvedWon} bound=${!!arAfter.user_id}`);

    // Concurrent same-club approvals of TWO claims → one owner, loser cleaned up.
    const raceClub = await seedClub({ tag: "Race" });
    await invokeFn("submit-club-claim", { clubId: raceClub, email: `race.a+${RUN}@x.org` }, ANON_KEY);
    await invokeFn("submit-club-claim", { clubId: raceClub, email: `race.b+${RUN}@x.org` }, ANON_KEY);
    const { data: rr } = await admin.from("club_claim_requests").select("id").eq("club_id", raceClub).eq("status", "pending");
    const [x, y] = await Promise.all([
      invokeFn("review-club-claim", { requestId: rr[0].id, action: "approve" }, adminToken),
      invokeFn("review-club-claim", { requestId: rr[1].id, action: "approve" }, adminToken),
    ]);
    ok("concurrent same-club approvals → exactly one wins", [x, y].filter((r) => r.status === 200 && r.json?.ok).length === 1, `${x.status},${y.status}`);
    const aEx = await emailExists(`race.a+${RUN}@x.org`);
    const bEx = await emailExists(`race.b+${RUN}@x.org`);
    ok("loser account cleaned up (exactly one email exists)", aEx !== bEx, `a=${aEx} b=${bEx}`);

    // Double-approve SAME request → exactly one user.
    const dupClub = await seedClub({ tag: "Dup" });
    await invokeFn("submit-club-claim", { clubId: dupClub, email: `dup+${RUN}@x.org` }, ANON_KEY);
    const { data: dupReq } = await admin.from("club_claim_requests").select("id").eq("club_id", dupClub).eq("status", "pending").maybeSingle();
    const [d1, d2] = await Promise.all([
      invokeFn("review-club-claim", { requestId: dupReq.id, action: "approve" }, adminToken),
      invokeFn("review-club-claim", { requestId: dupReq.id, action: "approve" }, adminToken),
    ]);
    ok("same-request double approve → exactly one success", [d1, d2].filter((r) => r.status === 200 && r.json?.ok).length === 1, `${d1.status},${d2.status}`);
    const dupUsers = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.filter((u) => u.email === `dup+${RUN}@x.org`).length;
    ok("same-request double approve → exactly one user", dupUsers === 1, `users=${dupUsers}`);
  }

  // ===== Correction #3 — authenticated claim submissions are rejected =====
  section("submit-club-claim: LOGGED-OUT ONLY (authenticated submissions rejected)");
  {
    const c = await seedClub({ tag: "AuthReject" });
    const r = await invokeFn("submit-club-claim", { clubId: c, email: `authed+${RUN}@club.org` }, studentToken);
    ok("signed-in claim submission → 403", r.status === 403 && /signed out/i.test(r.json?.error ?? ""), JSON.stringify(r.json));
    const { count } = await admin.from("club_claim_requests").select("id", { count: "exact", head: true }).eq("club_id", c);
    ok("no claim row written for a signed-in submitter", (count ?? 0) === 0, `rows=${count}`);
    // The admin's own token must be rejected too — it's still "signed in".
    const r2 = await invokeFn("submit-club-claim", { clubId: c, email: `authed2+${RUN}@club.org` }, adminToken);
    ok("admin's signed-in claim submission → 403", r2.status === 403, `status ${r2.status}`);
    // Logged out (anon key) still works.
    const r3 = await invokeFn("submit-club-claim", { clubId: c, email: `loggedout+${RUN}@club.org` }, ANON_KEY);
    ok("logged-out claim on the same club still accepted", r3.status === 200 && r3.json?.ok === true, JSON.stringify(r3.json));
  }

  // ===== Correction #5 — HTTP 200 carrying { error } is treated as failure =====
  section("send-email: HTTP 200 + { error } is a delivery FAILURE, not success");
  {
    const res = await fetch(`${URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ type: "email_otp", to: `false.success+${RUN}@uci.edu`, data: { code: "123456" } }),
    });
    const body = await res.json().catch(() => null);
    ok("send-email returns HTTP 200 even though Resend rejected it", res.status === 200, `status ${res.status}`);
    ok("...and the body carries { error }", !!(body && body.error), JSON.stringify(body)?.slice(0, 120));
    const verdict = checkEmailResult(null, body, res.status);
    ok("shared checker marks that 200 response as FAILED", verdict.ok === false, JSON.stringify(verdict));
  }

  // ===== Correction #1 — approval rollback on a forced finalization failure =====
  section("review-club-claim: forced failure at the final 'approved' update rolls everything back");
  if (!sqlReady()) {
    skip("approval rollback (forced failure)", "direct SQL to the local DB container is unavailable");
  } else {
    const rbClub = await seedClub({ tag: "Rollback" });
    const rbEmail = `rollback+${RUN}@club.org`;
    await invokeFn("submit-club-claim", { clubId: rbClub, email: rbEmail, note: "E2E_FORCE_APPROVE_FAIL" }, ANON_KEY);
    const { data: rbReq } = await admin.from("club_claim_requests").select("id").eq("club_id", rbClub).eq("status", "pending").maybeSingle();

    // Fault injection: make ONLY the status→'approved' transition fail, leaving the
    // lock/processing_at updates working, so we exercise the exact final-step failure.
    psql(`CREATE OR REPLACE FUNCTION public._e2e_block_approve() RETURNS trigger LANGUAGE plpgsql AS $fn$
          BEGIN IF NEW.status = 'approved' AND OLD.note = 'E2E_FORCE_APPROVE_FAIL'
                THEN RAISE EXCEPTION 'e2e forced failure finalizing approval'; END IF; RETURN NEW; END $fn$;
          DROP TRIGGER IF EXISTS _e2e_block_approve_trg ON public.club_claim_requests;
          CREATE TRIGGER _e2e_block_approve_trg BEFORE UPDATE ON public.club_claim_requests
          FOR EACH ROW EXECUTE FUNCTION public._e2e_block_approve();`);

    const ap = await invokeFn("review-club-claim", { requestId: rbReq.id, action: "approve" }, adminToken);
    ok("forced finalization failure → 500", ap.status === 500 && /finalize/i.test(ap.json?.error ?? ""), JSON.stringify(ap.json));
    ok("no cleanup problems reported", !ap.json?.cleanupProblems, JSON.stringify(ap.json?.cleanupProblems));

    const { data: rbAfter } = await admin.from("club_profiles").select("user_id, claimed_at, email").eq("id", rbClub).single();
    ok("ROLLBACK: club left unbound", !rbAfter.user_id && !rbAfter.claimed_at, JSON.stringify(rbAfter));
    ok("ROLLBACK: club email not left behind", !rbAfter.email, String(rbAfter.email));
    ok("ROLLBACK: created account deleted", !(await emailExists(rbEmail)));
    const { data: rbReqAfter } = await admin.from("club_claim_requests").select("status, processing_at, created_user_id").eq("id", rbReq.id).single();
    ok("ROLLBACK: request still pending (not half-approved)", rbReqAfter.status === "pending", rbReqAfter.status);
    ok("ROLLBACK: lock released so it can be retried", rbReqAfter.processing_at === null, String(rbReqAfter.processing_at));
    ok("ROLLBACK: no owner recorded", rbReqAfter.created_user_id === null);

    // Remove the fault and prove the retry now succeeds cleanly.
    psql(`DROP TRIGGER IF EXISTS _e2e_block_approve_trg ON public.club_claim_requests;
          DROP FUNCTION IF EXISTS public._e2e_block_approve();`);
    const retry = await invokeFn("review-club-claim", { requestId: rbReq.id, action: "approve" }, adminToken);
    ok("retry after the fault is cleared succeeds", retry.status === 200 && retry.json?.ok === true, JSON.stringify(retry.json));
    ok("retry created exactly the expected owner", await emailExists(rbEmail));
  }

  // ===== Correction #4 — rate-limit check failure fails CLOSED with 503 =====
  section("rate limiting: a failing rate-limit CHECK returns 503 (never unmetered)");
  if (!sqlReady()) {
    skip("rate-limit failure → 503", "direct SQL to the local DB container is unavailable");
  } else {
    // Renaming the function makes the rate-limit RPC fail. NOTIFY pgrst refreshes
    // PostgREST's schema cache so each rename takes effect immediately.
    const reloadSchema = async () => {
      psql(`NOTIFY pgrst, 'reload schema';`);
      await new Promise((r) => setTimeout(r, 1500));
    };
    psql(`ALTER FUNCTION public.rate_limit_hit(text,integer,integer) RENAME TO rate_limit_hit_e2e_hidden;`);
    await reloadSchema();
    const otp = await invokeFn("send-otp", { email: `rl503+${RUN}@uci.edu`, password: PW, role: "student" }, ANON_KEY);
    ok("send-otp → 503 when the rate-limit check fails", otp.status === 503, `status ${otp.status} ${JSON.stringify(otp.json)}`);
    const { data: leftover } = await admin.from("email_verifications").select("id").eq("email", `rl503+${RUN}@uci.edu`);
    ok("no OTP stored when the rate-limit check fails", (leftover ?? []).length === 0);

    const rlClub = await seedClub({ tag: "RL503" });
    const claim = await invokeFn("submit-club-claim", { clubId: rlClub, email: `rl503c+${RUN}@club.org` }, ANON_KEY);
    ok("submit-club-claim → 503 when the rate-limit check fails", claim.status === 503, `status ${claim.status}`);
    const { count } = await admin.from("club_claim_requests").select("id", { count: "exact", head: true }).eq("club_id", rlClub);
    ok("no claim row written when the rate-limit check fails", (count ?? 0) === 0, `rows=${count}`);

    psql(`ALTER FUNCTION public.rate_limit_hit_e2e_hidden(text,integer,integer) RENAME TO rate_limit_hit;`);
    await reloadSchema();
    const after = await invokeFn("submit-club-claim", { clubId: rlClub, email: `rl503c+${RUN}@club.org` }, ANON_KEY);
    ok("claims work again once the rate limiter is restored", after.status === 200 && after.json?.ok === true, JSON.stringify(after.json));
  }

  // ===== Correction #2 — backfill hides EXISTING pending/rejected organic clubs =====
  section("migration backfill: existing pending/rejected organic clubs become unpublished");
  if (!sqlReady()) {
    skip("pending-club backfill", "direct SQL to the local DB container is unavailable");
  } else {
    // Build the four pre-existing shapes, all published=true as they would have been
    // before this change.
    const mk = async (tag, waitlistStatus, source) => {
      const em = `bf.${tag}+${RUN}@uci.edu`;
      const { data: u } = await admin.auth.admin.createUser({ email: em, password: PW, email_confirm: true });
      const { data: cp } = await admin.from("club_profiles").insert({
        club_name: `BF ${tag} ${RUN}`, user_id: u.user.id, email: em, published: true,
        ...(source ? { source, source_club_id: `bf-${tag}-${RUN}` } : {}),
      }).select("id").single();
      if (waitlistStatus) {
        await admin.from("waitlist").insert({ user_id: u.user.id, email: em, role: "club", status: waitlistStatus });
      }
      return cp.id;
    };
    const pendingId = await mk("pending", "pending", null);
    const rejectedId = await mk("rejected", "rejected", null);
    const approvedId = await mk("approved", "approved", null);
    const seededId = await mk("seeded", null, "zotspot");
    const noWaitlistId = await mk("nowaitlist", null, null);

    // Run the REAL backfill statement out of the migration file (not a copy).
    const migSql = readFileSync(resolve(REPO_ROOT, "supabase/migrations/20260727000400_pending_club_publish.sql"), "utf8");
    const backfill = (migSql.match(/UPDATE public\.club_profiles cp[\s\S]*?;\s*$/m) ?? [])[0];
    ok("backfill statement found in the migration", !!backfill && /published = false/.test(backfill));
    const applied = backfill ? psql(backfill.replace(/\s+/g, " ")) !== null : false;
    ok("backfill statement executes", applied);

    const pub = async (id) => (await admin.from("club_profiles").select("published").eq("id", id).single()).data.published;
    ok("existing PENDING organic club → hidden (published=false)", (await pub(pendingId)) === false);
    ok("existing REJECTED organic club → hidden (published=false)", (await pub(rejectedId)) === false);
    ok("APPROVED organic club → untouched (still published)", (await pub(approvedId)) === true);
    ok("ZotSpot-seeded club → untouched (still published)", (await pub(seededId)) === true);
    ok("organic club with NO waitlist row → untouched (still published)", (await pub(noWaitlistId)) === true);

    // And the hidden ones really are gone from the public surface.
    const { data: dir } = await anon.rpc("get_all_clubs_public");
    const ids = new Set((dir ?? []).map((c) => c.id));
    ok("hidden pending club absent from the public directory", !ids.has(pendingId));
    ok("approved + seeded clubs still in the public directory", ids.has(approvedId) && ids.has(seededId));
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`PASSED ${passed}, FAILED ${failures.length}${skipped ? `, SKIPPED ${skipped}` : ""}`);
  if (failures.length) { console.log("FAILURES:"); failures.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
  console.log("ALL GREEN ✅");
}

main().catch((e) => { console.error("\nFATAL:", e); process.exit(1); });
