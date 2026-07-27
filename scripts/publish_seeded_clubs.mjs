#!/usr/bin/env node
/**
 * Publish (or roll back) the ZotSpot-seeded clubs — the explicit visibility gate.
 *
 * Seeded clubs are imported with published = FALSE (invisible everywhere public).
 * This is the SEPARATE, deliberate step that makes them visible — run it only
 * AFTER the new club UI is deployed and verified. It is scoped strictly to
 * `source = 'zotspot'`, so it can never touch organic/real clubs.
 *
 *   --publish     set published = TRUE  for all ZotSpot seeds (go live)
 *   --unpublish   set published = FALSE for all ZotSpot seeds (SAFE ROLLBACK —
 *                 hides them again WITHOUT deleting any data)
 *
 * SAFETY: exactly one mode is required; DRY RUN by default (reports counts, writes
 * nothing); pass --commit to apply. Uses the SERVICE ROLE (bypasses RLS).
 *
 * ENV:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * RUN:
 *   node scripts/publish_seeded_clubs.mjs --publish            # dry run
 *   node scripts/publish_seeded_clubs.mjs --publish --commit    # go live
 *   node scripts/publish_seeded_clubs.mjs --unpublish --commit  # roll back
 *
 * Equivalent SQL (if you prefer the Supabase SQL editor):
 *   -- publish:   update public.club_profiles set published = true  where source = 'zotspot' and published = false;
 *   -- rollback:  update public.club_profiles set published = false where source = 'zotspot' and published = true;
 */
import { createClient } from "@supabase/supabase-js";

const SOURCE = "zotspot";
const publishMode = process.argv.includes("--publish");
const unpublishMode = process.argv.includes("--unpublish");
const COMMIT = process.argv.includes("--commit");

if (publishMode === unpublishMode) {
  console.error(
    "Specify exactly one mode.\n" +
      "Usage: node scripts/publish_seeded_clubs.mjs (--publish | --unpublish) [--commit]",
  );
  process.exit(1);
}
const target = publishMode; // true = publish, false = unpublish (rollback)

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const { count: total, error: e1 } = await sb
  .from("club_profiles")
  .select("id", { count: "exact", head: true })
  .eq("source", SOURCE);
if (e1) {
  console.error("Failed to count seeded clubs:", e1.message);
  process.exit(1);
}
const { count: toFlip, error: e2 } = await sb
  .from("club_profiles")
  .select("id", { count: "exact", head: true })
  .eq("source", SOURCE)
  .eq("published", !target);
if (e2) {
  console.error("Failed to count clubs to change:", e2.message);
  process.exit(1);
}

const verb = target ? "PUBLISH" : "UNPUBLISH (rollback)";
console.log(`Mode: ${verb}`);
console.log(`ZotSpot-seeded clubs total:        ${total}`);
console.log(`Currently ${target ? "unpublished" : "published"} (would change): ${toFlip}`);

if (!COMMIT) {
  console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
  process.exit(0);
}

const { data, error } = await sb
  .from("club_profiles")
  .update({ published: target })
  .eq("source", SOURCE)
  .eq("published", !target)
  .select("id");

if (error) {
  console.error("Update failed:", error.message);
  process.exit(1);
}
console.log(`\nDONE — ${data.length} club(s) set to published = ${target}.`);
