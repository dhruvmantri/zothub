/**
 * The posting door (supabase/functions/publish-club-posts/door.ts) against a REAL
 * local database — LOCAL ONLY, never production.
 *
 *   npx supabase start            # a local stack (see docs/HANDOFF.md §5 for T14)
 *   node --experimental-strip-types --test tests/automation/door.integration.ts
 *
 * It needs the CP1 migration applied locally. Images are served by a fake fetch, so
 * nothing leaves the machine. Fixtures are tagged and removed at the end.
 *
 * Why a Node test and not the edge function itself: in a cloud session the edge
 * runtime cannot boot (T14). door.ts takes its database client and fetch as
 * arguments, so this exercises every line the deployed function runs except the
 * key check in index.ts — and that check is rules.ts `keysMatch`, unit-tested.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { runDoor, type DoorDeps } from "../../supabase/functions/publish-club-posts/door.ts";

// Keys come from the running LOCAL stack (`supabase status`), never from this file —
// even the local demo keys trip secret scanning, and a hardcoded key invites copying.
function localStack(): { url: string; secret: string; publishable: string } {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY && process.env.SUPABASE_PUBLISHABLE_KEY) {
    return {
      url: process.env.SUPABASE_URL,
      secret: process.env.SUPABASE_SECRET_KEY,
      publishable: process.env.SUPABASE_PUBLISHABLE_KEY,
    };
  }
  const out = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const s = JSON.parse(out.slice(out.indexOf("{")));
  return { url: s.API_URL, secret: s.SECRET_KEY, publishable: s.PUBLISHABLE_KEY };
}
const { url: URL_, secret: SECRET, publishable: PUBLISHABLE } = localStack();
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) {
  throw new Error("door.integration.ts runs against a LOCAL database only.");
}

const db = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const TAG = `cp1t${Date.now().toString(36)}`;
const NOW = new Date(Date.now()); // real now: the database's own now() stamps announced_at

// A future Pacific wall-clock time, N days from now at 18:30.
function pacific(daysAhead: number, hhmm = "18:30"): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
  return `${ymd} ${hhmm}`;
}

// 1×1 PNG
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);
const fakeFetch: typeof fetch = async (input) => {
  const u = String(input);
  if (u.includes("/missing")) return new Response("gone", { status: 404 });
  if (u.includes("/page")) return new Response("<html>", { status: 200, headers: { "content-type": "text/html" } });
  return new Response(PNG, { status: 200, headers: { "content-type": "image/png", "content-length": String(PNG.length) } });
};

let n = 0;
const deps = (): DoorDeps => ({ db, fetchFn: fakeFetch, now: NOW, newId: () => randomUUID() });
const door = (body: unknown) => runDoor(body, deps());
const key = () => `${TAG}-row-${++n}`;

const ids = {
  club: randomUUID(),
  hidden: randomUUID(),
  clubUser: "",
  student: "",
};
const CLUB_NAME = `CP1 Door Test Club ${TAG}`;
let clubSession: SupabaseClient;

const ev = (over: Record<string, unknown> = {}) => ({
  source_key: key(),
  kind: "event",
  club_id: ids.club,
  club_name: CLUB_NAME,
  title: `Intro Workshop ${n}`,
  description: "Bring a laptop.",
  external_url: "https://forms.gle/abc",
  source_url: "https://www.instagram.com/p/xyz/",
  starts_at: pacific(5),
  location: "DBH 6011",
  ...over,
});

const followerNotes = async () => {
  const { count } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ids.student)
    .eq("type", "new_post");
  return count ?? 0;
};
const row = async (table: string, sourceKey: string) =>
  (await db.from(table).select("*").eq("source_key", sourceKey).maybeSingle()).data;
const only = (reply: Awaited<ReturnType<typeof door>>) => {
  const results = reply.body.results as Array<Record<string, unknown>>;
  assert.equal(results.length, 1, JSON.stringify(reply.body));
  return results[0];
};

before(async () => {
  const password = `Pw-${randomUUID()}`;
  const club = await db.auth.admin.createUser({ email: `${TAG}-club@uci.edu`, password, email_confirm: true });
  const student = await db.auth.admin.createUser({ email: `${TAG}-student@uci.edu`, password, email_confirm: true });
  assert.ifError(club.error);
  assert.ifError(student.error);
  ids.clubUser = club.data.user!.id;
  ids.student = student.data.user!.id;

  // A CLAIMED club (owner = clubUser) and an unpublished one.
  assert.ifError((await db.from("club_profiles").insert([
    { id: ids.club, user_id: ids.clubUser, club_name: CLUB_NAME, published: true },
    { id: ids.hidden, club_name: `Hidden ${TAG}`, published: false },
  ])).error);
  assert.ifError((await db.from("user_roles").insert({ user_id: ids.clubUser, role: "club" })).error);
  // The student follows the club.
  assert.ifError((await db.from("bookmarks").insert({ user_id: ids.student, club_id: ids.club })).error);

  clubSession = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await clubSession.auth.signInWithPassword({ email: `${TAG}-club@uci.edu`, password });
  assert.ifError(signIn.error);
});

after(async () => {
  await db.from("automation_log").delete().like("source_key", `${TAG}%`).then(() => {}, () => {});
  await db.from("club_profiles").delete().in("id", [ids.club, ids.hidden]); // cascades posts
  await db.storage.from("club-assets").list(`automation/${ids.club}`).then(async ({ data }) => {
    if (data?.length) await db.storage.from("club-assets").remove(data.map((f) => `automation/${ids.club}/${f.name}`));
  });
  for (const id of [ids.clubUser, ids.student]) if (id) await db.auth.admin.deleteUser(id);
});

// ---- the request shape ------------------------------------------------------------

test("dry_run must be stated explicitly — a forgotten flag never publishes", async () => {
  const r = await door({ posts: [ev()] });
  assert.equal(r.status, 400);
});

test("more than 50 posts in one call is refused", async () => {
  const r = await door({ dry_run: true, posts: Array.from({ length: 51 }, () => ev()) });
  assert.equal(r.status, 400);
});

test("an unknown action is refused", async () => {
  assert.equal((await door({ dry_run: true, action: "delete_everything" })).status, 400);
});

// ---- create -----------------------------------------------------------------------

test("a dry run reports what it would do and writes no post", async () => {
  const p = ev();
  const r = only(await door({ dry_run: true, posts: [p] }));
  assert.equal(r.action, "created");
  assert.equal(await row("events", p.source_key), null);
  const { data: logs } = await db.from("automation_log").select("dry_run").eq("source_key", p.source_key);
  assert.deepEqual(logs, [{ dry_run: true }]);
});

let liveKey = "";
test("a real run creates the post under the club, re-hosts the image, tells followers once", async () => {
  const notesBefore = await followerNotes();
  const p = ev({ image_url: "https://scontent.cdninstagram.com/v/flyer.png", views: 999, source: "club", club_edited_at: "2020-01-01" });
  liveKey = p.source_key;
  const r = only(await door({ dry_run: false, posts: [p] }));
  assert.equal(r.action, "created", JSON.stringify(r));

  const post = await row("events", liveKey);
  assert.ok(post);
  assert.equal(post.club_id, ids.club);
  assert.equal(post.source, "automation"); // the stray `source: "club"` field was ignored
  assert.equal(post.views, 0); // and so was `views`
  assert.equal(post.club_edited_at, null);
  assert.equal(post.external_url, "https://forms.gle/abc");
  assert.equal(post.is_active, true);
  assert.match(post.banner_url, new RegExp(`/club-assets/automation/${ids.club}/[0-9a-f]{32}\\.png$`));
  assert.ok(post.announced_at);
  assert.equal(await followerNotes(), notesBefore + 1);
});

test("the same row again changes nothing and re-notifies nobody", async () => {
  const notesBefore = await followerNotes();
  const p = { ...ev(), source_key: liveKey, title: "Intro Workshop 5", image_url: "https://scontent.cdninstagram.com/v/flyer.png" };
  // Use the stored title so only identity matters.
  const stored = await row("events", liveKey);
  p.title = stored!.title;
  p.starts_at = undefined as unknown as string;
  const again = only(await door({ dry_run: false, posts: [{ ...p, starts_at: pacificOf(stored!.event_date) }] }));
  assert.equal(again.action, "unchanged", JSON.stringify(again));
  assert.equal(await followerNotes(), notesBefore);
});

function pacificOf(instant: string): string {
  const f = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Los_Angeles", dateStyle: "short", timeStyle: "short" });
  return f.format(new Date(instant));
}

let updateRunId = "";
test("a changed row updates the post, records what it replaced, and does not re-notify", async () => {
  const stored = await row("events", liveKey);
  const notesBefore = await followerNotes();
  const reply = await door({
    dry_run: false,
    posts: [ev({
      source_key: liveKey,
      title: "Intro Workshop — moved rooms",
      starts_at: pacificOf(stored!.event_date),
      location: "ICS 174",
      image_url: "https://scontent.cdninstagram.com/v/flyer.png",
    })],
  });
  updateRunId = reply.body.run_id as string;
  const r = only(reply);
  assert.equal(r.action, "updated", JSON.stringify(r));
  assert.match(String(r.reason), /title/);
  const post = await row("events", liveKey);
  assert.equal(post!.title, "Intro Workshop — moved rooms");
  assert.equal(post!.location, "ICS 174");
  assert.equal(post!.banner_url, stored!.banner_url, "an unchanged image is not re-copied");
  assert.equal(post!.club_edited_at, null, "the automation's own update is not a club edit");
  assert.equal(await followerNotes(), notesBefore);
});

test("undo puts an update back exactly, and the next run leaves the post alone", async () => {
  const r = await door({ dry_run: false, action: "undo_run", run_id: updateRunId });
  const res = r.body.results as Array<Record<string, unknown>>;
  assert.equal(res.length, 1);
  assert.equal(res[0].action, "undone", JSON.stringify(res[0]));
  const post = await row("events", liveKey);
  assert.equal(post!.location, "DBH 6011");
  assert.ok(post!.club_edited_at, "an undo marks the post as handled by a person");

  const next = only(await door({ dry_run: false, posts: [ev({ source_key: liveKey, title: "Something else" })] }));
  assert.equal(next.action, "skipped");
  assert.match(String(next.reason), /leaves it alone/);
});

// ---- the confidence rules ---------------------------------------------------------

test("a club name that doesn't match the id is skipped, not posted", async () => {
  const p = ev({ club_name: "AI at UCI" });
  const r = only(await door({ dry_run: false, posts: [p] }));
  assert.equal(r.action, "skipped");
  assert.match(String(r.reason), /Not posting until the match is confirmed/);
  assert.equal(await row("events", p.source_key), null);
});

test("an unpublished club is skipped; an unknown club id fails", async () => {
  const a = only(await door({ dry_run: false, posts: [ev({ club_id: ids.hidden, club_name: `Hidden ${TAG}` })] }));
  assert.equal(a.action, "skipped");
  const b = only(await door({ dry_run: false, posts: [ev({ club_id: randomUUID() })] }));
  assert.equal(b.action, "failed");
});

test("the club's own post of the same thing, same day, is not duplicated", async () => {
  const when = pacific(9, "19:00");
  const iso = (await import("../../supabase/functions/publish-club-posts/rules.ts")).pacificToInstant(when)!;
  const own = await clubSession
    .from("events")
    .insert({ club_id: ids.club, title: "Resume Review Night", event_date: iso, is_active: true })
    .select("id")
    .single();
  assert.ifError(own.error);
  const p = ev({ title: "resume review night!", starts_at: pacific(9, "18:00") });
  const r = only(await door({ dry_run: false, posts: [p] }));
  assert.equal(r.action, "skipped", JSON.stringify(r));
  assert.match(String(r.reason), /already on ZotHub/);
  // A different day is a different event.
  const other = only(await door({ dry_run: false, posts: [ev({ title: "Resume Review Night", starts_at: pacific(16) })] }));
  assert.equal(other.action, "created");
});

test("the same row id twice in one batch fails both", async () => {
  const k = key();
  const r = await door({ dry_run: false, posts: [ev({ source_key: k }), ev({ source_key: k, title: "Other" })] });
  const res = r.body.results as Array<Record<string, unknown>>;
  assert.deepEqual(res.map((x) => x.action), ["failed", "failed"]);
  assert.equal(await row("events", k), null);
});

test("a row id cannot switch from event to role", async () => {
  const p = ev();
  assert.equal(only(await door({ dry_run: false, posts: [p] })).action, "created");
  const r = only(await door({
    dry_run: false,
    posts: [{ source_key: p.source_key, kind: "opportunity", club_id: ids.club, club_name: CLUB_NAME, title: "Role", external_url: "https://forms.gle/r", type: "committee" }],
  }));
  assert.equal(r.action, "failed");
  assert.match(String(r.reason), /cannot change kind/);
});

test("past events and bad links are refused before touching the database", async () => {
  const a = only(await door({ dry_run: false, posts: [ev({ starts_at: "2020-01-01 10:00" })] }));
  assert.equal(a.action, "failed");
  const b = only(await door({ dry_run: false, posts: [ev({ external_url: "javascript:alert(1)" })] }));
  assert.equal(b.action, "failed");
});

// ---- cancel, club edits, club deletes ---------------------------------------------

test("a cancelled row hides the post (never deletes it); again is a no-op", async () => {
  const p = ev();
  assert.equal(only(await door({ dry_run: false, posts: [p] })).action, "created");
  const cancel = { source_key: p.source_key, kind: "event", status: "cancelled", club_id: ids.club, club_name: CLUB_NAME };
  assert.equal(only(await door({ dry_run: false, posts: [cancel] })).action, "hidden");
  const post = await row("events", p.source_key);
  assert.equal(post!.is_active, false);
  assert.equal(only(await door({ dry_run: false, posts: [cancel] })).action, "unchanged");
});

test("the club's edit wins: an edited post is never overwritten or hidden", async () => {
  const p = ev();
  assert.equal(only(await door({ dry_run: false, posts: [p] })).action, "created");
  const post = await row("events", p.source_key);
  const edit = await clubSession.from("events").update({ location: "Changed by the club" }).eq("id", post!.id);
  assert.ifError(edit.error);

  const upd = only(await door({ dry_run: false, posts: [{ ...p, title: "Sheet title" }] }));
  assert.equal(upd.action, "skipped");
  const cancel = only(await door({ dry_run: false, posts: [{ ...p, status: "cancelled" }] }));
  assert.equal(cancel.action, "skipped");
  const after = await row("events", p.source_key);
  assert.equal(after!.location, "Changed by the club");
  assert.equal(after!.is_active, true);
});

test("a post the club deleted is not re-created", async () => {
  const p = ev();
  assert.equal(only(await door({ dry_run: false, posts: [p] })).action, "created");
  const post = await row("events", p.source_key);
  assert.ifError((await clubSession.from("events").delete().eq("id", post!.id)).error);
  const again = only(await door({ dry_run: false, posts: [p] }));
  assert.equal(again.action, "skipped");
  assert.match(String(again.reason), /deleted/);
  assert.equal(await row("events", p.source_key), null);
});

test("undo of a creating run hides those posts", async () => {
  const p = ev();
  const reply = await door({ dry_run: false, posts: [p] });
  assert.equal(only(reply).action, "created");
  const u = await door({ dry_run: false, action: "undo_run", run_id: reply.body.run_id });
  assert.equal((u.body.results as Array<Record<string, unknown>>)[0].action, "undone");
  assert.equal((await row("events", p.source_key))!.is_active, false);
});

// ---- images and roles -------------------------------------------------------------

test("a broken image does not block the post; it goes up without one and says so", async () => {
  const p = ev({ image_url: "https://scontent.cdninstagram.com/missing.png" });
  const r = only(await door({ dry_run: false, posts: [p] }));
  assert.equal(r.action, "created");
  assert.match(String((r.warnings as string[])[0]), /404/);
  assert.equal((await row("events", p.source_key))!.banner_url, null);

  const q = ev({ image_url: "https://example.com/page" });
  const r2 = only(await door({ dry_run: false, posts: [q] }));
  assert.match(String((r2.warnings as string[])[0]), /not a JPEG/);
});

test("a role is created with its type, deadline and external link", async () => {
  const k = key();
  const r = only(await door({
    dry_run: false,
    posts: [{
      source_key: k, kind: "opportunity", club_id: ids.club, club_name: CLUB_NAME,
      title: "Events Committee", type: "Committee", deadline: pacific(10).slice(0, 10),
      external_url: "https://forms.gle/role", image_url: "https://example.com/x.png",
    }],
  }));
  assert.equal(r.action, "created", JSON.stringify(r));
  assert.match(String((r.warnings as string[])[0]), /no image/);
  const post = await row("opportunities", k);
  assert.equal(post!.type, "committee");
  assert.equal(post!.external_url, "https://forms.gle/role");
  assert.equal(post!.source, "automation");
  assert.ok(post!.deadline);
});

// ---- the audit log ----------------------------------------------------------------

test("every row of a run is in the audit log", async () => {
  const reply = await door({ dry_run: false, posts: [ev(), ev({ club_name: "Wrong" }), ev({ starts_at: "bad" })] });
  const { data } = await db.from("automation_log").select("action").eq("run_id", reply.body.run_id);
  assert.deepEqual(data!.map((d) => d.action).sort(), ["created", "failed", "skipped"]);
});
