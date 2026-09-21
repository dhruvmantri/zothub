#!/usr/bin/env node
/**
 * Re-host the seeded clubs' logos into our own storage (MB5-logo).
 *
 * WHY THIS EXISTS: all 725 clubs render grey initials because `logo_url` is
 * NULL on every one of them. The seeder deliberately kept the original ZotSpot
 * URL in `source_logo_url` and left `logo_url` empty for exactly this job.
 *
 * WHAT IT DOES, per club: download the logo from ZotSpot, check it really is
 * an image, upload it to the `club-assets` bucket, and set `logo_url`.
 *
 * SAFETY — read this before running it:
 *   - DRY RUN BY DEFAULT. Without --commit it downloads and validates
 *     everything and writes nothing, so you can see exactly what would happen.
 *   - --commit opens with a CANARY: one tiny image uploaded and deleted. If
 *     that fails the run aborts before touching a single club. The storage
 *     policies key on auth.uid() and these clubs have no owner, so the service
 *     role is assumed to bypass RLS — the canary is what turns that assumption
 *     into a checked fact rather than 589 silent failures.
 *   - IDEMPOTENT AND RESUMABLE. Clubs that already have a `logo_url` are
 *     skipped, so an interrupted run is continued by running it again.
 *   - --limit=N does the first N only. Do a small run first.
 *
 * RESOLUTION (maintainer decision, 2026-09-21): the manifest URLs are the
 * `s2` variant, which is 100×100. The club detail page renders the logo at
 * 88 CSS px, so 100px is visibly soft on any 2× screen. The same path serves
 * `s3` at 320×320 for ~55 KB, which is sharp everywhere we display it. Each
 * club falls back to its manifest URL if `s3` is not an image, and every
 * fallback is reported — 40 of 40 sampled had `s3`, which is not 589 of 589.
 *
 * ENV:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (never ship the latter)
 * RUN:
 *   node scripts/rehost_club_logos.mjs <manifest.json>                  # dry run, all
 *   node scripts/rehost_club_logos.mjs <manifest.json> --limit=5        # dry run, 5
 *   node scripts/rehost_club_logos.mjs <manifest.json> --limit=5 --commit
 *   node scripts/rehost_club_logos.mjs <manifest.json> --commit         # the real thing
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "club-assets";
const SOURCE = "zotspot";
/** Bucket ceiling is 10 MB (S9); nothing here is near it, so anything that is
 *  says the URL gave us something other than a logo. */
const MAX_BYTES = 5 * 1024 * 1024;
const CONCURRENCY = 6;

const manifestPath = process.argv[2];
const COMMIT = process.argv.includes("--commit");
const limitFlag = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitFlag ? Number.parseInt(limitFlag.slice("--limit=".length), 10) : null;

if (!manifestPath) {
  console.error("Usage: node scripts/rehost_club_logos.mjs <manifest.json> [--limit=N] [--commit]");
  process.exit(2);
}
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

const clean = (v) => (v == null || String(v).trim() === "" ? null : String(v).trim());

// ---------------------------------------------------------------- manifest
const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
const records = Array.isArray(raw)
  ? raw
  : raw.records || raw.clubs || Object.values(raw).find(Array.isArray);
if (!Array.isArray(records)) {
  console.error("No records array in the manifest.");
  process.exit(1);
}
let todo = records
  .map((r) => ({ sourceId: clean(r.source_club_id), name: clean(r.club_name), url: clean(r.logo_url) }))
  .filter((r) => r.sourceId && r.url);
console.log(`manifest: ${records.length} records, ${todo.length} with both an id and a logo URL`);

// ------------------------------------------------------------------ lookup
// One read for every seeded club, so a missing club is reported rather than
// silently skipped — an id in the manifest that is not in the database means
// the manifest and the seeding run have diverged, which is worth knowing
// BEFORE a bulk write rather than after.
const { data: clubs, error: clubsErr } = await sb
  .from("club_profiles")
  .select("id, source_club_id, logo_url, club_name")
  .eq("source", SOURCE);
if (clubsErr) {
  console.error(`Could not read club_profiles: ${clubsErr.message}`);
  process.exit(1);
}
const bySourceId = new Map(clubs.map((c) => [String(c.source_club_id), c]));
console.log(`database: ${clubs.length} seeded clubs, ${clubs.filter((c) => c.logo_url).length} already have a logo`);

const missing = todo.filter((r) => !bySourceId.has(r.sourceId));
const already = todo.filter((r) => bySourceId.get(r.sourceId)?.logo_url);
todo = todo.filter((r) => bySourceId.has(r.sourceId) && !bySourceId.get(r.sourceId).logo_url);
if (missing.length) console.log(`skipping ${missing.length} not found in the database (manifest/DB drift)`);
if (already.length) console.log(`skipping ${already.length} that already have a logo (this is what makes a re-run safe)`);
if (LIMIT) todo = todo.slice(0, LIMIT);
console.log(`\n${COMMIT ? "COMMITTING" : "DRY RUN"} — ${todo.length} club(s) to process\n`);

// ------------------------------------------------------------------ canary
// The one assumption worth checking before a bulk write: that the service role
// can write to a bucket whose policies key on auth.uid(), for clubs that have
// no owner at all.
if (COMMIT) {
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const path = `seeded/_canary/${Date.now()}.png`;
  const up = await sb.storage.from(BUCKET).upload(path, onePixelPng, { contentType: "image/png", upsert: true });
  if (up.error) {
    console.error(`CANARY FAILED — aborting before touching any club.\n  ${up.error.message}`);
    console.error("  The service role could not write to the bucket. Nothing has been changed.");
    process.exit(1);
  }
  await sb.storage.from(BUCKET).remove([path]);
  console.log("canary upload+delete OK — the service role can write to the bucket\n");
}

// -------------------------------------------------------------------- work
/** ZotSpot serves the same image at several sizes from one path. */
const toS3 = (url) => url.replace("/s2_image_upload_", "/s3_image_upload_");
const extFor = (type) =>
  /png/i.test(type) ? "png" : /jpe?g/i.test(type) ? "jpg" : /gif/i.test(type) ? "gif" : /webp/i.test(type) ? "webp" : null;

async function fetchImage(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctl.signal });
    if (!res.ok) return { ok: false, why: `HTTP ${res.status}` };
    const type = res.headers.get("content-type") ?? "";
    // A missing image can answer 200 with text/html — status alone would have
    // us re-host error pages as logos. Checked, not assumed.
    if (!/^image\//i.test(type)) return { ok: false, why: `not an image (${type || "no content-type"})` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return { ok: false, why: "empty body" };
    if (buf.length > MAX_BYTES) return { ok: false, why: `${Math.round(buf.length / 1024)} KB is implausible for a logo` };
    return { ok: true, buf, type };
  } catch (err) {
    return { ok: false, why: String(err?.message ?? err).slice(0, 80) };
  } finally {
    clearTimeout(t);
  }
}

const done = [];
const failed = [];
let usedFallback = 0;
let cursor = 0;

async function worker() {
  while (cursor < todo.length) {
    const rec = todo[cursor++];
    const club = bySourceId.get(rec.sourceId);

    let got = await fetchImage(toS3(rec.url));
    if (!got.ok) {
      const fb = await fetchImage(rec.url);
      if (fb.ok) {
        usedFallback++;
        got = fb;
      } else {
        failed.push({ name: rec.name, why: `${got.why} (fallback: ${fb.why})` });
        continue;
      }
    }

    const ext = extFor(got.type);
    if (!ext) {
      failed.push({ name: rec.name, why: `unsupported image type ${got.type}` });
      continue;
    }
    const path = `seeded/${club.id}/logo.${ext}`;

    if (!COMMIT) {
      done.push({ name: rec.name, path, kb: Math.round(got.buf.length / 1024) });
      continue;
    }

    const up = await sb.storage.from(BUCKET).upload(path, got.buf, { contentType: got.type, upsert: true });
    if (up.error) {
      failed.push({ name: rec.name, why: `upload: ${up.error.message}` });
      continue;
    }
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    const { error: updErr } = await sb
      .from("club_profiles")
      .update({ logo_url: pub.publicUrl })
      .eq("id", club.id);
    if (updErr) {
      // The file is uploaded but the row is not pointed at it. Reported rather
      // than retried silently: a re-run picks this club up again, because its
      // logo_url is still null, and the upload upserts.
      failed.push({ name: rec.name, why: `uploaded but logo_url not set: ${updErr.message}` });
      continue;
    }
    done.push({ name: rec.name, path, kb: Math.round(got.buf.length / 1024) });
    if (done.length % 25 === 0) console.log(`  …${done.length}/${todo.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// ------------------------------------------------------------------ report
const totalKb = done.reduce((n, d) => n + d.kb, 0);
console.log(`\n${COMMIT ? "uploaded" : "would upload"}   ${done.length}`);
console.log(`failed             ${failed.length}`);
if (usedFallback) console.log(`fell back to 100px ${usedFallback}   (no 320px variant for these)`);
console.log(`total size         ${Math.round(totalKb / 1024)} MB`);
for (const f of failed.slice(0, 15)) console.log(`  ✗ ${f.name}: ${f.why}`);
if (failed.length > 15) console.log(`  …and ${failed.length - 15} more`);
if (!COMMIT) console.log(`\nNothing was written. Re-run with --commit to do it for real.`);
else console.log(`\nRe-running is safe: clubs that now have a logo are skipped.`);
process.exit(failed.length && !done.length ? 1 : 0);
