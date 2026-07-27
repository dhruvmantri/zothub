#!/usr/bin/env node
/**
 * Idempotent ZotSpot -> public.club_profiles seeder.
 *
 * PREREQUISITE: migration 20260727000100_mb5_seedable_clubs.sql must be APPLIED
 * first (nullable owner + source_* columns + the (source, source_club_id) unique
 * index). This script upserts SEEDED, UNCLAIMED clubs (user_id / email left NULL).
 *
 * SAFETY:
 *   - Defaults to a DRY RUN (reports counts, writes nothing). Pass --commit to write.
 *   - Idempotent: keyed on (source='zotspot', source_club_id). Re-running inserts
 *     new clubs and updates existing ones; never duplicates.
 *   - logo_url is set to NULL; the original ZotSpot logo is preserved in
 *     source_logo_url for a later download/validate/re-host job.
 *   - Seeded clubs are inserted with published = FALSE, so they are INVISIBLE in
 *     the public directory and profile pages until you run the explicit publish
 *     step (scripts/publish_seeded_clubs.mjs). Re-running the import never changes
 *     a club's published state.
 *   - Uses the SERVICE ROLE (bypasses RLS) — never ship this key to the client.
 *
 * ENV:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * RUN:
 *   node scripts/seed_clubs.mjs <path/to/zothub_club_population_import_manifest.json>
 *   node scripts/seed_clubs.mjs <manifest.json> --commit
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SOURCE = "zotspot";
const manifestPath = process.argv[2];
const COMMIT = process.argv.includes("--commit");
// --limit=N imports only the first N seedable records (deterministic, manifest
// order) — used for the small production test before the full 724-club import.
const limitFlag = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitFlag ? Number.parseInt(limitFlag.slice("--limit=".length), 10) : null;

if (!manifestPath) {
  console.error("Usage: node scripts/seed_clubs.mjs <manifest.json> [--commit]");
  process.exit(1);
}
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const clean = (v) =>
  v === undefined || v === null || String(v).trim() === "" ? null : v;

const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
const records = Array.isArray(raw)
  ? raw
  : raw.records || raw.clubs || Object.values(raw).find(Array.isArray);
if (!Array.isArray(records)) {
  console.error("Could not find a records array in the manifest.");
  process.exit(1);
}

const importedAt = new Date().toISOString();
const rows = records.map((r) => ({
  source: SOURCE,
  source_club_id: r.source_club_id != null ? String(r.source_club_id) : null,
  source_url: clean(r.source_url),
  source_logo_url: clean(r.logo_url), // preserve original; do NOT populate logo_url
  logo_url: null,
  club_name: clean(r.club_name),
  description: clean(r.description),
  category: clean(r.category),
  website_url: clean(r.website_url),
  imported_at: importedAt,
  published: false, // hard gate: invisible until the explicit publish step
}));

// A row is seedable only if it has the required identity fields.
const skipped = rows.filter((r) => !r.club_name || !r.source_club_id);
const seedableAll = rows.filter((r) => r.club_name && r.source_club_id);
const seedable = LIMIT != null ? seedableAll.slice(0, LIMIT) : seedableAll;

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// Which seeded clubs already exist? (paged, to be safe past 1000 rows)
const existing = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from("club_profiles")
    .select("source_club_id")
    .eq("source", SOURCE)
    .range(from, from + 999);
  if (error) {
    console.error("Failed to read existing seeded clubs:", error.message);
    process.exit(1);
  }
  data.forEach((d) => existing.add(String(d.source_club_id)));
  if (data.length < 1000) break;
}

const toInsert = seedable.filter((r) => !existing.has(r.source_club_id));
const toUpdate = seedable.filter((r) => existing.has(r.source_club_id));

console.log(`manifest records:        ${records.length}`);
if (LIMIT != null)
  console.log(`--limit active:          importing first ${seedable.length} of ${seedableAll.length}`);
console.log(`seedable:                ${seedable.length}`);
console.log(`skipped (no name/id):    ${skipped.length}`);
console.log(`already present:         ${existing.size}`);
console.log(`to insert:               ${toInsert.length}`);
console.log(`to update:               ${toUpdate.length}`);

if (!COMMIT) {
  console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
  process.exit(0);
}

let inserted = 0,
  updated = 0,
  failed = 0;

for (let i = 0; i < toInsert.length; i += 200) {
  const chunk = toInsert.slice(i, i + 200);
  const { error } = await sb.from("club_profiles").insert(chunk);
  if (error) {
    failed += chunk.length;
    console.error(`insert chunk @${i} failed:`, error.message);
  } else {
    inserted += chunk.length;
  }
}

for (const r of toUpdate) {
  // never overwrite the first-import timestamp OR the published state on re-runs
  const { source, source_club_id, imported_at, published, ...fields } = r;
  const { error } = await sb
    .from("club_profiles")
    .update(fields)
    .eq("source", source)
    .eq("source_club_id", source_club_id);
  if (error) failed++;
  else updated++;
}

console.log(
  `\nDONE — inserted: ${inserted}, updated: ${updated}, failed: ${failed}, skipped: ${skipped.length}`,
);
