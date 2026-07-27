#!/usr/bin/env node
/**
 * READ-ONLY automated verification for the ZotSpot club seed (MB5).
 *
 * Asserts the invariants at whichever stage you run it, from BOTH perspectives —
 * the service role (ground truth) and an anonymous visitor (the public gate):
 *
 *   node scripts/verify_seeded_clubs.mjs --expect=3   --published=false   # step 5 (pre-publish test)
 *   node scripts/verify_seeded_clubs.mjs --expect=3   --published=true    # step 5 (after publishing the 3)
 *   node scripts/verify_seeded_clubs.mjs --expect=724 --published=false   # step 7 (full import, hidden)
 *   node scripts/verify_seeded_clubs.mjs --expect=724 --published=true    # step 11 (after go-live)
 *
 * Checks: exact count, no duplicate source_club_id, every seed in the expected
 * published state, logo_url all NULL with originals preserved in source_logo_url,
 * and — for a sample of seeds — that anonymous DIRECTORY (RPC) and PROFILE
 * (direct select) visibility matches the expected published state.
 *
 * ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and an anon key
 *      (SUPABASE_ANON_KEY | SUPABASE_PUBLISHABLE_KEY | VITE_SUPABASE_PUBLISHABLE_KEY).
 * Never prints key values. Writes nothing. Exit code 1 if any check FAILS.
 */
import { createClient } from "@supabase/supabase-js";

const SOURCE = "zotspot";
const arg = (name, def) => {
  const f = process.argv.find((a) => a.startsWith(`--${name}=`));
  return f ? f.slice(name.length + 3) : def;
};
const EXPECT = Number.parseInt(arg("expect", "724"), 10);
const EXPECT_PUBLISHED = arg("published", "false") === "true";
const SAMPLES = Number.parseInt(arg("samples", "3"), 10);

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SERVICE || !ANON) {
  console.error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and an anon key " +
      "(SUPABASE_ANON_KEY | SUPABASE_PUBLISHABLE_KEY | VITE_SUPABASE_PUBLISHABLE_KEY).",
  );
  process.exit(1);
}

const svc = createClient(URL, SERVICE, { auth: { persistSession: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false } });

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
};

// --- service-role ground truth: fetch all seeded rows (paged) ---
const rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await svc
    .from("club_profiles")
    .select("id, source_club_id, logo_url, source_logo_url, published")
    .eq("source", SOURCE)
    .range(from, from + 999);
  if (error) {
    console.error("service read failed:", error.message);
    process.exit(1);
  }
  rows.push(...data);
  if (data.length < 1000) break;
}

check("service sees expected count", rows.length === EXPECT, `${rows.length} (expected ${EXPECT})`);

const ids = new Set(rows.map((r) => String(r.source_club_id)));
check("no duplicate source_club_id", ids.size === rows.length, `${ids.size} distinct of ${rows.length}`);

const wrongState = rows.filter((r) => r.published !== EXPECT_PUBLISHED).length;
check(
  `all seeds published=${EXPECT_PUBLISHED}`,
  wrongState === 0,
  `${wrongState} in the wrong state`,
);

const logoLeaked = rows.filter((r) => r.logo_url != null).length;
const preserved = rows.filter((r) => r.source_logo_url != null).length;
check("logo_url all NULL (no hotlinks live)", logoLeaked === 0, `${logoLeaked} non-null`);
check("original logos preserved in source_logo_url", preserved > 0, `${preserved} preserved`);

// --- anonymous visibility on a sample ---
const sample = rows.slice(0, Math.min(SAMPLES, rows.length));
let profileOk = 0;
let dirOk = 0;
const { data: dir, error: dirErr } = await anon.rpc("get_all_clubs_public");
if (dirErr) {
  check("anon directory RPC reachable", false, dirErr.message);
} else {
  const dirIds = new Set((dir || []).map((c) => c.id));
  for (const r of sample) {
    const { data: prof } = await anon.from("club_profiles").select("id").eq("id", r.id);
    const profileVisible = (prof?.length ?? 0) > 0;
    const inDirectory = dirIds.has(r.id);
    if (profileVisible === EXPECT_PUBLISHED) profileOk++;
    if (inDirectory === EXPECT_PUBLISHED) dirOk++;
  }
  check(
    `anon profile visibility = ${EXPECT_PUBLISHED} (sample ${sample.length})`,
    profileOk === sample.length,
    `${profileOk}/${sample.length} correct`,
  );
  check(
    `anon directory visibility = ${EXPECT_PUBLISHED} (sample ${sample.length})`,
    dirOk === sample.length,
    `${dirOk}/${sample.length} correct`,
  );
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${failed.length === 0 ? "ALL CHECKS PASSED ✓" : `${failed.length} CHECK(S) FAILED ✗`}`);
process.exit(failed.length === 0 ? 0 : 1);
