// Storage migration: old Lovable Cloud project → your new Supabase project.
// Run with: deno run --allow-net --allow-env scripts/migrate_storage.ts
//
// Requires env vars (source env.migration.sh first):
//   OLD_URL, OLD_SERVICE_KEY, NEW_URL, NEW_SERVICE_KEY
//
// Copies every object in `club-assets` and `student-resumes` from old → new,
// preserving paths. Idempotent (upserts). Prints a summary at the end.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const OLD_URL = Deno.env.get("OLD_URL")!;
const OLD_KEY = Deno.env.get("OLD_SERVICE_KEY")!;
const NEW_URL = Deno.env.get("NEW_URL")!;
const NEW_KEY = Deno.env.get("NEW_SERVICE_KEY")!;

for (const [n, v] of Object.entries({ OLD_URL, OLD_KEY, NEW_URL, NEW_KEY })) {
  if (!v) throw new Error(`Missing env var: ${n}`);
}

const oldSb = createClient(OLD_URL, OLD_KEY);
const newSb = createClient(NEW_URL, NEW_KEY);

const BUCKETS: Array<{ name: string; public: boolean }> = [
  { name: "club-assets", public: true },
  { name: "student-resumes", public: false },
];

// Ensure bucket exists in new project.
async function ensureBucket(name: string, isPublic: boolean) {
  const { data } = await newSb.storage.getBucket(name);
  if (data) {
    console.log(`  [bucket] ${name} already exists`);
    return;
  }
  const { error } = await newSb.storage.createBucket(name, { public: isPublic });
  if (error) throw new Error(`createBucket(${name}) failed: ${error.message}`);
  console.log(`  [bucket] created ${name} (public=${isPublic})`);
}

// Recursively list every object in a bucket.
async function listAll(client: ReturnType<typeof createClient>, bucket: string, prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`list(${bucket}, ${prefix}) failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      // Folders have `id === null`; files have an id.
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        const nested = await listAll(client, bucket, fullPath);
        paths.push(...nested);
      } else {
        paths.push(fullPath);
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return paths;
}

async function copyObject(bucket: string, path: string) {
  const { data: blob, error: dlErr } = await oldSb.storage.from(bucket).download(path);
  if (dlErr || !blob) throw new Error(`download failed: ${dlErr?.message}`);
  const { error: upErr } = await newSb.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: blob.type || "application/octet-stream",
  });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);
}

let copied = 0;
let failed = 0;
const failures: string[] = [];

for (const { name, public: isPublic } of BUCKETS) {
  console.log(`\n=== ${name} ===`);
  await ensureBucket(name, isPublic);
  const paths = await listAll(oldSb, name);
  console.log(`  ${paths.length} object(s) to copy`);
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    try {
      await copyObject(name, p);
      copied++;
      if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${paths.length}`);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${name}/${p} :: ${msg}`);
      console.error(`  FAIL ${p}: ${msg}`);
    }
  }
}

console.log(`\n=== DONE ===`);
console.log(`Copied: ${copied}`);
console.log(`Failed: ${failed}`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log("  " + f));
  Deno.exit(1);
}