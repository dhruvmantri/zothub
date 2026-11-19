/**
 * The posting door — the ONLY way the daily automation writes to ZotHub (CP1).
 *
 * It can do three things to posts and nothing else: create one, update one it
 * created, or hide one it created. Every row is checked (rules.ts), every outcome
 * is written to `automation_log`, and the reply says, per row, what happened and why.
 *
 * Maintainer decisions this enforces (docs/BACKLOG.md, 2026-11-19):
 *   - the club's edit wins: a post a person has edited (club_edited_at) is never
 *     overwritten, hidden or undone by the automation;
 *   - when not confident, do not post — report (club name must match the id, a
 *     look-alike of the club's own post is skipped, a post the club deleted is not
 *     re-created);
 *   - nothing is ever DELETED: hiding sets is_active = false, so a mistake is one
 *     undo away and no student's RSVP or bookmark is cascaded away.
 *
 * Pure of Deno and remote imports — the database client and fetch are passed in —
 * so the same file runs in the edge runtime and in Node against a local database
 * (tests/automation/door.integration.ts).
 */
import {
  checkHttpsUrl,
  checkPost,
  clubNameMatches,
  MAX_POSTS_PER_CALL,
  pacificDate,
  titlesLookAlike,
  type CleanPost,
  type IncomingPost,
  type Kind,
} from "./rules.ts";

// The supabase-js client. Typed loosely on purpose: the edge runtime and Node load
// it from different places, and this file must import from neither.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export interface DoorDeps {
  db: Db;
  fetchFn: typeof fetch;
  now: Date;
  newId: () => string;
}

export type RowAction = "created" | "updated" | "hidden" | "unchanged" | "skipped" | "failed" | "undone";

export interface RowResult {
  source_key: string | null;
  kind: Kind | null;
  action: RowAction;
  post_id?: string;
  reason?: string;
  warnings?: string[];
  /** For an update: the values it replaced, so undo_run can restore them exactly. */
  before?: Record<string, unknown>;
}

export interface DoorReply {
  status: number;
  body: Record<string, unknown>;
}

const BUCKET = "club-assets";
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The post fields the automation owns, per table. Nothing else is ever written. */
const CONTENT: Record<Kind, string[]> = {
  event: ["title", "description", "event_date", "location", "banner_url", "external_url", "source_url", "is_active"],
  opportunity: ["title", "description", "type", "deadline", "requirements", "external_url", "source_url", "is_active"],
};
const tableOf = (kind: Kind) => (kind === "event" ? "events" : "opportunities");
const otherKind = (kind: Kind): Kind => (kind === "event" ? "opportunity" : "event");

// ---------------------------------------------------------------------------

export async function runDoor(body: unknown, deps: DoorDeps): Promise<DoorReply> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.dry_run !== "boolean") {
    // Never default either way: a forgotten flag must not silently publish.
    return { status: 400, body: { error: 'Say "dry_run": true or false explicitly.' } };
  }
  const dry = b.dry_run;
  const action = b.action ?? "upsert";
  const runId = deps.newId();

  if (action === "upsert") {
    const posts = b.posts;
    if (!Array.isArray(posts) || posts.length === 0) {
      return { status: 400, body: { error: "Send a non-empty `posts` list." } };
    }
    if (posts.length > MAX_POSTS_PER_CALL) {
      return { status: 400, body: { error: `At most ${MAX_POSTS_PER_CALL} posts per call; split the batch.` } };
    }
    const seen = new Map<string, number>();
    for (const p of posts) {
      const k = typeof (p as IncomingPost)?.source_key === "string" ? String((p as IncomingPost).source_key).trim() : "";
      if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const results: RowResult[] = [];
    for (const p of posts) {
      const key = typeof (p as IncomingPost)?.source_key === "string" ? String((p as IncomingPost).source_key).trim() : "";
      let r: RowResult;
      if (key && (seen.get(key) ?? 0) > 1) {
        r = { source_key: key, kind: null, action: "failed", reason: "This row id appears more than once in the batch." };
      } else {
        r = await safely(() => upsertRow(p as IncomingPost, deps, dry), p as IncomingPost);
      }
      results.push(r);
      await log(deps, runId, dry, r, (p as IncomingPost)?.club_id, { input: p, before: r.before ?? null });
    }
    return reply(runId, dry, results);
  }

  if (action === "undo_run") {
    const target = typeof b.run_id === "string" ? b.run_id.trim() : "";
    if (!UUID.test(target)) return { status: 400, body: { error: "Send the `run_id` to undo." } };
    const results = await undoRun(target, deps, dry, runId);
    return reply(runId, dry, results, { undid_run: target });
  }

  return { status: 400, body: { error: 'Unknown action. Use "upsert" or "undo_run".' } };
}

function reply(runId: string, dry: boolean, results: RowResult[], extra: Record<string, unknown> = {}): DoorReply {
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.action] = (counts[r.action] ?? 0) + 1;
  return { status: 200, body: { run_id: runId, dry_run: dry, counts, results, ...extra } };
}

async function safely(fn: () => Promise<RowResult>, p: IncomingPost): Promise<RowResult> {
  try {
    return await fn();
  } catch (e) {
    console.error("publish-club-posts: row error", e);
    return {
      source_key: typeof p?.source_key === "string" ? p.source_key : null,
      kind: p?.kind === "event" || p?.kind === "opportunity" ? p.kind : null,
      action: "failed",
      reason: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** Every outcome goes to the audit log. A failed log write is loud, never silent. */
async function log(
  deps: DoorDeps,
  runId: string,
  dry: boolean,
  r: RowResult,
  clubId: unknown,
  payload: Record<string, unknown>,
) {
  const { error } = await deps.db.from("automation_log").insert({
    run_id: runId,
    action: r.action,
    dry_run: dry,
    kind: r.kind,
    source_key: r.source_key,
    club_id: typeof clubId === "string" && UUID.test(clubId) ? clubId : null,
    post_id: r.post_id ?? null,
    reason: r.reason ?? null,
    payload: { ...payload, warnings: r.warnings ?? [] },
  });
  if (error) {
    console.error("publish-club-posts: AUDIT LOG WRITE FAILED", error.message);
    (r.warnings ??= []).push(`The audit log could not record this row: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// upsert

async function upsertRow(input: IncomingPost, deps: DoorDeps, dry: boolean): Promise<RowResult> {
  const checked = checkPost(input, deps.now);
  const rawKey = typeof input?.source_key === "string" ? input.source_key.trim() : null;
  const rawKind = input?.kind === "event" || input?.kind === "opportunity" ? (input.kind as Kind) : null;
  if (!checked.ok) return { source_key: rawKey, kind: rawKind, action: "failed", reason: checked.reason };
  const post = checked.post;
  const base = { source_key: post.source_key, kind: post.kind };

  // The club: must exist, be public, and be the club the sheet names.
  const { data: club, error: clubErr } = await deps.db
    .from("club_profiles")
    .select("id, club_name, published")
    .eq("id", post.club_id)
    .maybeSingle();
  if (clubErr) throw new Error(`club lookup: ${clubErr.message}`);
  if (!club) return { ...base, action: "failed", reason: "No ZotHub club has this id." };
  if (!club.published) return { ...base, action: "skipped", reason: "That club's page is not public on ZotHub." };
  if (!clubNameMatches(post.club_name, club.club_name)) {
    return {
      ...base,
      action: "skipped",
      reason: `The sheet says "${post.club_name}", but this id is "${club.club_name}". Not posting until the match is confirmed.`,
    };
  }

  // A row id belongs to one kind forever.
  const { data: clash, error: clashErr } = await deps.db
    .from(tableOf(otherKind(post.kind)))
    .select("id")
    .eq("source_key", post.source_key)
    .maybeSingle();
  if (clashErr) throw new Error(`row-id check: ${clashErr.message}`);
  if (clash) {
    return { ...base, action: "failed", reason: `This row id is already used by a ${otherKind(post.kind)}; a row cannot change kind.` };
  }

  const { data: existing, error: exErr } = await deps.db
    .from(tableOf(post.kind))
    .select("*")
    .eq("source_key", post.source_key)
    .maybeSingle();
  if (exErr) throw new Error(`existing post lookup: ${exErr.message}`);

  if (post.status === "cancelled") return cancelRow(post, existing, deps, dry);
  if (existing) return updateRow(post, existing, deps, dry);
  return createRow(post, deps, dry);
}

// club_edited_at means "a person stepped in": the club edited the post on ZotHub, or
// the maintainer undid the automation's change. Either way the automation stops
// touching the post — otherwise the next day's run would quietly redo an undo.
const EDITED_BY_CLUB =
  "Someone has edited or withdrawn this post on ZotHub (the club, or an undo), so the automation leaves it alone.";

async function cancelRow(post: CleanPost, existing: Record<string, unknown> | null, deps: DoorDeps, dry: boolean): Promise<RowResult> {
  const base = { source_key: post.source_key, kind: post.kind };
  if (!existing) return { ...base, action: "skipped", reason: "Nothing to hide — this row was never posted." };
  const id = existing.id as string;
  if (existing.club_edited_at) return { ...base, post_id: id, action: "skipped", reason: EDITED_BY_CLUB };
  if (existing.is_active === false) return { ...base, post_id: id, action: "unchanged", reason: "Already hidden." };
  if (!dry) {
    const { error } = await deps.db.from(tableOf(post.kind)).update({ is_active: false }).eq("id", id);
    if (error) throw new Error(`hide: ${error.message}`);
  }
  return { ...base, post_id: id, action: "hidden", reason: "Cancelled in the sheet." };
}

/** The fields to write for this post (the automation's columns only). */
function fieldsFor(post: CleanPost, bannerUrl: string | null): Record<string, unknown> {
  const common = {
    title: post.title,
    description: post.description,
    external_url: post.external_url,
    source_url: post.source_url,
    is_active: true,
  };
  return post.kind === "event"
    ? { ...common, event_date: post.event_date, location: post.location ?? null, banner_url: bannerUrl }
    : { ...common, type: post.type, deadline: post.deadline ?? null, requirements: post.requirements ?? null };
}

async function createRow(post: CleanPost, deps: DoorDeps, dry: boolean): Promise<RowResult> {
  const base = { source_key: post.source_key, kind: post.kind };
  const table = tableOf(post.kind);

  // Posted before and now gone: the club (or an admin) deleted it. Don't resurrect it.
  const { data: tomb, error: tombErr } = await deps.db
    .from("automation_log")
    .select("id")
    .eq("source_key", post.source_key)
    .eq("action", "created")
    .eq("dry_run", false)
    .limit(1);
  if (tombErr) throw new Error(`history check: ${tombErr.message}`);
  if (tomb && tomb.length > 0) {
    return {
      ...base,
      action: "skipped",
      reason: "This row was posted before and has since been deleted from ZotHub (most likely by the club). Not re-creating it.",
    };
  }

  // Did the club already post this themselves?
  const cols = post.kind === "event" ? "id, title, event_date" : "id, title";
  const { data: siblings, error: sibErr } = await deps.db
    .from(table)
    .select(cols)
    .eq("club_id", post.club_id)
    .eq("is_active", true);
  if (sibErr) throw new Error(`duplicate check: ${sibErr.message}`);
  const day = post.kind === "event" ? pacificDate(post.event_date!) : null;
  const twin = (siblings ?? []).find(
    (s: { title: string; event_date?: string }) =>
      titlesLookAlike(s.title, post.title) && (day === null || pacificDate(s.event_date!) === day),
  );
  if (twin) {
    return {
      ...base,
      post_id: twin.id,
      action: "skipped",
      reason: `Looks like this is already on ZotHub: "${twin.title}". Not posting a duplicate.`,
    };
  }

  const warnings: string[] = [];
  let bannerUrl: string | null = null;
  if (post.kind === "event" && post.image_url) {
    if (dry) {
      const err = await probeImage(post.image_url, deps);
      if (err) warnings.push(err);
    } else {
      const img = await rehostImage(post.image_url, post.club_id, deps);
      if ("error" in img) warnings.push(img.error);
      else bannerUrl = img.url;
    }
  }
  if (post.kind === "opportunity" && post.image_url) {
    warnings.push("Roles have no image on ZotHub; the image was ignored.");
  }

  if (dry) return { ...base, action: "created", reason: "Would be created (dry run).", warnings };

  const { data: row, error } = await deps.db
    .from(table)
    .insert({
      club_id: post.club_id,
      source: "automation",
      source_key: post.source_key,
      ...fieldsFor(post, bannerUrl),
    })
    .select("id")
    .single();
  if (error) {
    // The unique index catches a concurrent run creating the same row.
    return { ...base, action: "failed", reason: `Could not create: ${error.message}`, warnings };
  }
  return { ...base, post_id: row.id, action: "created", warnings };
}

async function updateRow(post: CleanPost, existing: Record<string, unknown>, deps: DoorDeps, dry: boolean): Promise<RowResult> {
  const base = { source_key: post.source_key, kind: post.kind, post_id: existing.id as string };
  if (existing.club_id !== post.club_id) {
    return { ...base, action: "skipped", reason: "This row now names a different club than the post it created. Not moving the post." };
  }
  if (existing.club_edited_at) return { ...base, action: "skipped", reason: EDITED_BY_CLUB };

  const warnings: string[] = [];
  let bannerUrl = (existing.banner_url as string | null) ?? null;
  if (post.kind === "event") {
    if (!post.image_url) {
      bannerUrl = null;
    } else if (!(bannerUrl && bannerUrl.includes(await imagePathStem(post.image_url, post.club_id)))) {
      if (dry) {
        const err = await probeImage(post.image_url, deps);
        if (err) warnings.push(err);
        bannerUrl = "(new image)";
      } else {
        const img = await rehostImage(post.image_url, post.club_id, deps);
        if ("error" in img) warnings.push(`${img.error} Kept the previous image.`);
        else bannerUrl = img.url;
      }
    }
  }

  const desired = fieldsFor(post, bannerUrl);
  const changes: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};
  for (const col of CONTENT[post.kind]) {
    if (!sameValue(existing[col], desired[col])) {
      changes[col] = desired[col];
      before[col] = existing[col] ?? null;
    }
  }
  if (Object.keys(changes).length === 0) return { ...base, action: "unchanged", warnings };

  if (!dry) {
    const { error } = await deps.db.from(tableOf(post.kind)).update(changes).eq("id", existing.id);
    if (error) return { ...base, action: "failed", reason: `Could not update: ${error.message}`, warnings };
  }
  return {
    ...base,
    action: "updated",
    reason: `Changed: ${Object.keys(changes).join(", ")}${dry ? " (dry run)" : ""}.`,
    warnings,
    before,
  };
}

/** Equal as stored? Timestamps are compared as instants, not strings. */
function sameValue(a: unknown, b: unknown): boolean {
  if ((a ?? null) === (b ?? null)) return true;
  if (typeof a === "string" && typeof b === "string") {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (!Number.isNaN(ta) && !Number.isNaN(tb) && /\d{4}-\d{2}-\d{2}T/.test(a) && /\d{4}-\d{2}-\d{2}T/.test(b)) {
      return ta === tb;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// undo

async function undoRun(target: string, deps: DoorDeps, dry: boolean, runId: string): Promise<RowResult[]> {
  const { data: entries, error } = await deps.db
    .from("automation_log")
    .select("id, action, kind, source_key, post_id, club_id, payload")
    .eq("run_id", target)
    .eq("dry_run", false)
    .in("action", ["created", "updated", "hidden"])
    .order("id", { ascending: false });
  if (error) throw new Error(`undo lookup: ${error.message}`);

  const results: RowResult[] = [];
  if (!entries || entries.length === 0) {
    const r: RowResult = { source_key: null, kind: null, action: "skipped", reason: "That run made no changes (or does not exist)." };
    results.push(r);
    return results;
  }

  for (const e of entries) {
    const r = await safely(async (): Promise<RowResult> => {
      const kind = e.kind as Kind;
      const base = { source_key: e.source_key, kind, post_id: e.post_id };
      const { data: post, error: pErr } = await deps.db.from(tableOf(kind)).select("*").eq("id", e.post_id).maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!post) return { ...base, action: "skipped", reason: "The post no longer exists." };
      if (post.club_edited_at) return { ...base, action: "skipped", reason: EDITED_BY_CLUB };

      let changes: Record<string, unknown>;
      if (e.action === "created") changes = { is_active: false };
      else if (e.action === "hidden") changes = { is_active: true };
      else changes = (e.payload?.before ?? {}) as Record<string, unknown>;
      if (Object.keys(changes).length === 0) return { ...base, action: "skipped", reason: "Nothing recorded to restore." };

      if (!dry) {
        // Stamp the intervention so tomorrow's run does not redo what was undone.
        const stamped = { ...changes, club_edited_at: deps.now.toISOString() };
        const { error: uErr } = await deps.db.from(tableOf(kind)).update(stamped).eq("id", e.post_id);
        if (uErr) throw new Error(uErr.message);
      }
      const what = e.action === "created" ? "hidden again" : e.action === "hidden" ? "shown again" : "restored";
      return { ...base, action: "undone", reason: `Undid "${e.action}": ${what}${dry ? " (dry run)" : ""}.` };
    }, { source_key: e.source_key, kind: e.kind } as IncomingPost);
    results.push(r);
    await log(deps, runId, dry, r, e.club_id, { undid_run: target, undid_log_id: e.id });
  }
  return results;
}

// ---------------------------------------------------------------------------
// images — Instagram image links expire, so a banner is copied into club-assets.

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Same source image → same storage path, so an unchanged image is never re-copied. */
async function imagePathStem(imageUrl: string, clubId: string): Promise<string> {
  return `automation/${clubId}/${(await sha256Hex(imageUrl)).slice(0, 32)}`;
}

async function fetchImage(url: string, deps: DoorDeps): Promise<{ bytes: Uint8Array; type: string } | { error: string }> {
  let res: Response;
  try {
    res = await deps.fetchFn(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    return { error: `The image could not be downloaded (${e instanceof Error ? e.message : "network error"}).` };
  }
  if (res.url && !checkHttpsUrl(res.url, "image").ok) return { error: "The image link redirected somewhere unsafe." };
  if (!res.ok) return { error: `The image link answered ${res.status} — it may have expired.` };
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES[type]) return { error: `The image is not a JPEG, PNG or WebP (it is "${type || "unknown"}").` };
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_IMAGE_BYTES) return { error: "The image is larger than 5 MB." };
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { error: "The image is larger than 5 MB." };
  if (bytes.byteLength === 0) return { error: "The image is empty." };
  return { bytes, type };
}

/** Dry run: would this image work? Downloads it, stores nothing. */
async function probeImage(url: string, deps: DoorDeps): Promise<string | null> {
  const img = await fetchImage(url, deps);
  return "error" in img ? `${img.error} The post would go up without an image.` : null;
}

async function rehostImage(url: string, clubId: string, deps: DoorDeps): Promise<{ url: string } | { error: string }> {
  const img = await fetchImage(url, deps);
  if ("error" in img) return { error: `${img.error} Posted without an image.` };
  const path = `${await imagePathStem(url, clubId)}.${IMAGE_TYPES[img.type]}`;
  const { error } = await deps.db.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.type, upsert: true });
  if (error) return { error: `The image could not be stored (${error.message}). Posted without an image.` };
  const { data } = deps.db.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
