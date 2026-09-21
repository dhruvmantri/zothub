#!/usr/bin/env node
/**
 * Check a ZotSpot club manifest BEFORE anything is built on it (MB5-logo).
 *
 * The manifest is not in the repo — it is supplied by the maintainer — so the
 * first question is always "is this the right file, and is it enough?". This
 * answers that without writing anything anywhere.
 *
 * It is READ-ONLY. It never touches the database and never uploads. The only
 * network traffic is optional HEAD requests to the logo URLs, to find out how
 * many still resolve — which is the number that decides whether the re-host is
 * a morning's work or a data-cleaning project.
 *
 * USAGE
 *   node scripts/verify_logo_manifest.mjs <manifest.json>              # structure only
 *   node scripts/verify_logo_manifest.mjs <manifest.json> --check-urls # + liveness, sample of 40
 *   node scripts/verify_logo_manifest.mjs <manifest.json> --check-urls --all
 *
 * EXPECTED, from the seeding run already in production:
 *   725 clubs, of which 589 carry a source logo and 136 do not.
 * A manifest that disagrees with those numbers is either the wrong file or a
 * different vintage, and this says so rather than letting the difference be
 * discovered halfway through a bulk write.
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
const CHECK_URLS = process.argv.includes("--check-urls");
const ALL = process.argv.includes("--all");
const SAMPLE = 40;

if (!path) {
  console.error("Usage: node scripts/verify_logo_manifest.mjs <manifest.json> [--check-urls] [--all]");
  process.exit(2);
}

// Same shape-sniffing as seed_clubs.mjs, so "it parses here" means "the seeder
// would read it too".
let raw;
try {
  raw = JSON.parse(readFileSync(path, "utf8"));
} catch (err) {
  console.error(`✗ Not readable as JSON: ${err.message}`);
  process.exit(1);
}
const records = Array.isArray(raw)
  ? raw
  : raw.records || raw.clubs || Object.values(raw).find(Array.isArray);

if (!Array.isArray(records)) {
  console.error("✗ No array of records found. seed_clubs.mjs looks for a top-level array,");
  console.error("  or a `records` / `clubs` key, or the first array-valued key.");
  console.error(`  Top-level keys seen: ${Object.keys(raw ?? {}).join(", ") || "(none)"}`);
  process.exit(1);
}

const clean = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());
const withLogo = records.filter((r) => clean(r.logo_url));
const withoutLogo = records.length - withLogo.length;
const withSourceId = records.filter((r) => clean(r.source_club_id)).length;
const withName = records.filter((r) => clean(r.club_name)).length;

const dupIds = (() => {
  const seen = new Map();
  for (const r of records) {
    const id = clean(r.source_club_id);
    if (id) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1);
})();

console.log(`\nfile              ${path}`);
console.log(`records           ${records.length}`);
console.log(`with a club_name  ${withName}${withName === records.length ? "" : "   <-- some records have no name"}`);
console.log(`with source id    ${withSourceId}${withSourceId === records.length ? "" : "   <-- the seeder keys on this; missing ones cannot be matched"}`);
console.log(`with a logo URL   ${withLogo.length}`);
console.log(`without one       ${withoutLogo}   (these keep initials permanently, by decision)`);
if (dupIds.length) console.log(`duplicate ids     ${dupIds.length}   <-- ${dupIds.slice(0, 3).map(([id, n]) => `${id}×${n}`).join(", ")}`);

// --- does it match what production actually holds? ---------------------------
const EXPECT = { clubs: 725, withLogo: 589, withoutLogo: 136 };
const near = (a, b, tol = 3) => Math.abs(a - b) <= tol;
console.log(`\nagainst the seeding run already in production (${EXPECT.clubs} clubs / ${EXPECT.withLogo} logos):`);
const verdicts = [
  ["record count", records.length, EXPECT.clubs],
  ["logos present", withLogo.length, EXPECT.withLogo],
];
let mismatch = false;
for (const [label, got, want] of verdicts) {
  const ok = near(got, want);
  if (!ok) mismatch = true;
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(14)} ${got} (expected ~${want})`);
}
if (mismatch) {
  console.log("\n  A mismatch does NOT mean the file is wrong — it may be a newer or older");
  console.log("  export. It does mean the difference has to be understood before any bulk");
  console.log("  write, because the seeder matches on source_club_id and would treat");
  console.log("  unknown ids as new clubs.");
}

// --- what do the URLs look like? --------------------------------------------
const hosts = new Map();
for (const r of withLogo) {
  try {
    hosts.set(new URL(clean(r.logo_url)).host, (hosts.get(new URL(clean(r.logo_url)).host) ?? 0) + 1);
  } catch {
    hosts.set("(unparseable)", (hosts.get("(unparseable)") ?? 0) + 1);
  }
}
console.log("\nlogo URLs by host:");
for (const [host, n] of [...hosts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${host}`);
}
if (withLogo.length) console.log(`\nexample: ${clean(withLogo[0].logo_url)}`);

if (!CHECK_URLS) {
  console.log("\nRe-run with --check-urls to find out how many still resolve.");
  process.exit(0);
}

// --- liveness ---------------------------------------------------------------
// A HEAD first (cheap); some CDNs refuse HEAD, so a failure retries with a
// ranged GET before being called dead — otherwise we would report a live image
// as broken purely because of how it was asked for.
const targets = ALL ? withLogo : withLogo.slice(0, SAMPLE);
console.log(`\nchecking ${targets.length}${ALL ? "" : ` of ${withLogo.length} (sample)`} URLs…`);

async function probe(url) {
  const attempt = async (init) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch(url, { ...init, signal: ctl.signal, redirect: "follow" });
      return { status: res.status, type: res.headers.get("content-type"), len: res.headers.get("content-length") };
    } finally {
      clearTimeout(t);
    }
  };
  try {
    const head = await attempt({ method: "HEAD" });
    if (head.status < 400) return head;
    return await attempt({ method: "GET", headers: { Range: "bytes=0-0" } });
  } catch (err) {
    try {
      return await attempt({ method: "GET", headers: { Range: "bytes=0-0" } });
    } catch (err2) {
      return { status: 0, error: String(err2.message ?? err2).slice(0, 60) };
    }
  }
}

const out = [];
const CONCURRENCY = 8;
let cursor = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < targets.length) {
      const r = targets[cursor++];
      const url = clean(r.logo_url);
      out.push({ name: clean(r.club_name), url, ...(await probe(url)) });
      if (out.length % 25 === 0) process.stdout.write(`  …${out.length}\n`);
    }
  }),
);

const resolved = out.filter((r) => r.status >= 200 && r.status < 400);
const notImage = resolved.filter((r) => r.type && !/^image\//i.test(r.type));
const dead = out.filter((r) => !(r.status >= 200 && r.status < 400));
// THE headline number. A 2xx is NOT enough on its own: a missing image on an
// SPA host answers 200 with text/html, so counting status alone would report
// error pages as usable logos and the bulk job would faithfully re-host them.
// Found by planting a known-404 in a test manifest and watching it come back
// "resolved" — hence this distinction exists.
const usable = resolved.filter((r) => r.type && /^image\//i.test(r.type));
const bytes = usable.map((r) => Number(r.len)).filter((n) => Number.isFinite(n) && n > 0);

console.log(`\n  USABLE images  ${usable.length}/${out.length}   <-- the number that matters`);
console.log(`  resolved (2xx) ${resolved.length}`);
console.log(`  dead           ${dead.length}`);
if (notImage.length) console.log(`  200 but NOT an image ${notImage.length}   <-- an error page pretending to be a logo`);
if (bytes.length) {
  bytes.sort((a, b) => a - b);
  const kb = (n) => `${Math.round(n / 1024)} KB`;
  console.log(`  size         median ${kb(bytes[Math.floor(bytes.length / 2)])}, largest ${kb(bytes[bytes.length - 1])}`);
}
for (const r of dead.slice(0, 8)) console.log(`    dead: ${r.status || r.error}  ${r.name}`);
for (const r of notImage.slice(0, 5)) console.log(`    not image: ${r.type}  ${r.name}`);

if (!ALL && withLogo.length > SAMPLE) {
  const rate = usable.length / out.length;
  console.log(`\n  extrapolated over all ${withLogo.length}: roughly ${Math.round(withLogo.length * rate)} usable images.`);
  console.log("  Re-run with --all for the real number before committing to a plan.");
}
