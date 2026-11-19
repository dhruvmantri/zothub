# CP1 — Automated posting of club events and roles

**Status:** plan v3 (final), 2026-11-19 — all decisions answered, nothing built. Decisions are
dated in `../BACKLOG.md` (*Decisions made*, CP1 rows). If this file and the
backlog disagree, the backlog wins.

## Goal

A dedicated Claude session reads a Google Sheet (filled by Meta Muse daily at 1 PM) every day
at 2 PM and publishes the events and roles in it under the right club — claimed or unclaimed —
indistinguishable from a post the club wrote, with **Apply Externally / RSVP Externally**
buttons pointing at the club's own link. **Done** = the backend and website can take those
posts safely, and the automation session exists, has run in dry-run, and has been switched on.

## Live system facts this plan rests on (measured read-only, 2026-11-19)

- 722 clubs, all ZotSpot-seeded and published; 710 unclaimed, 12 claimed. 0 events, 0 roles.
- Posts reference `club_profiles.id`, not a user — a post for an unclaimed club is valid, and
  on claim the owner RLS hands it over automatically.
- Every write policy (posts and `club-assets` uploads) requires being the club's owner. There
  is no non-owner write path except the service role.
- Posts record no provenance. No `external_url`. No DB check on `opportunities.type` (the
  allowed list lives only in `src/lib/constants.ts`).
- `notify_followers_on_new_post` is `AFTER INSERT` and ignores `is_active` → **drafts notify**.
- `send-reminders` emails followers about posts whose `created_at` is in the last hour and are
  active → **a draft published later is never emailed**, and a batch of N posts sends each
  follower N emails.
- `Events.tsx` / `Opportunities.tsx` fetch **`limit(50)` with no pagination** → past 50
  upcoming items, students silently can't see the rest. Automation will cross 50 quickly.
- The claim form has **no consent wording** about ZotHub posting for the club.
- `archive_past_events` (cron, nightly 09:00 UTC) hides events an hour after they start.
- `config.toml`: functions that authenticate themselves run with `verify_jwt = false`.
- Cloud environment: one personal "Default", unrestricted network, no secrets saved.

## Why not "Claude gives the maintainer SQL to run each day"

It puts the maintainer back in the loop daily (contradicts "automate it all"), and a
hand-pasted SQL script has full power over the database — one bad line can delete data.
And handing the automation the Supabase connector or the service key is the same risk with
no human in between. **Instead: one locked-down door** (below) that can do only three things
to posts, checks every row, and logs every write.

## Phase 1 — Database (one migration; maintainer approval; backup first)

**✅ Applied to production 2026-11-19** (maintainer OK; recorded in migration history as `20261119000100 cp1_automated_posts`; live function logic verified identical to the tested copy): `supabase/migrations/20261119000100_cp1_automated_posts.sql`.
Undo: `supabase/rollback/20261119000100_cp1_automated_posts.down.sql` (restores the live
trigger exactly; tested). Checks: `tests/sql/cp1-automated-posts.test.sql` — **26/26 on a local
database**; proved in reverse (removing the guard trigger fails check 1; restoring the old
notify-on-insert trigger fails "saving a draft sends no notification").
As built, two changes from the plan below: `automation_written_at` became **`club_edited_at`**
(a page view, an RSVP counter and the nightly archive all UPDATE a post, so "last changed"
cannot tell a club's edit apart); and **`GRANT SELECT (external_url) … TO anon`**, because
signed-out visitors read posts through a column allowlist and would never see the buttons.


1. `events` and `opportunities` gain:
   - `external_url text` — `CHECK (external_url IS NULL OR external_url ~* '^https://')`
   - `source text NOT NULL DEFAULT 'club' CHECK (source IN ('club','automation'))`
   - `source_key text` — the sheet row's stable id; partial **unique** index where not null
   - `source_url text` — the original Instagram post (never displayed)
   - `automation_written_at timestamptz` — when the automation last wrote the row
   - `announced_at timestamptz` — when followers were told (set once)
2. Replace `notify_followers_on_new_post` with an announce-on-publish trigger: fires when a
   post is inserted active, or flips inactive→active, **and** `announced_at IS NULL`; sets
   `announced_at`. Re-publishing never re-announces. Applies to clubs' own posts too.
3. `opportunities.type` CHECK against the six allowed values (no existing rows to violate).
4. `automation_log` — every write the door makes: run id, action, table, post id, source key,
   outcome, reason, payload, timestamp. Service-role only (RLS on, no policies).
5. Dry-run nothing; 0 posts exist, so no backfill.

## Phase 2 — Edge functions (deploy after the migration; maintainer approval)

**✅ Deployed 2026-11-19** (door v1, locked until `AUTOMATION_KEY` exists; `send-reminders` v8). `supabase/functions/publish-club-posts/` —
`index.ts` (key check only), `door.ts` (all logic; database client and fetch are injected),
`rules.ts` (pure checks). Tests: `rules.test.ts` (19, Node unit) and
`tests/automation/door.integration.ts` (21, Node against a real LOCAL database — the edge
runtime itself cannot boot in a cloud session, `T14`). Proved in reverse: removing the
club-edit guard, the deleted-post check or the club-name match each fails its tests.
Differences from the plan below, as built: `dry_run` must be stated explicitly (no default);
the club is identified by `club_id` **and** `club_name`, which must match after normalising
(case, spacing, accents, `&`→and) — the automation looks the id up by name; `hide` is a
`status: "cancelled"` row inside `upsert`; an **undo also stamps `club_edited_at`** ("a person
stepped in"), otherwise the next day's run would quietly redo it; images are stored at a path
derived from the source link, so an unchanged image is never re-copied.
`send-reminders`: one line — new-post emails key on `announced_at`. Its live `verify_jwt =
false` is preserved (and now mirrored in `config.toml`; see `S11`).


**New `publish-club-posts`** (`verify_jwt = false`, own auth):
- Auth: header `x-automation-key` compared in constant time to secret `AUTOMATION_KEY`.
  A refusal is **logged** (CLAUDE.md trap: a silent guard hides outages). No key set → 503.
- Actions: `upsert` (a batch, max 50), `hide` (by `source_key`; sets `is_active=false`, never
  deletes), `undo_run` (hides everything a run created). Every action supports `dry_run`.
- Per-row checks, each returning a readable reason: club exists and is published; kind is
  event|opportunity; title 3–120 chars, description ≤ 5,000; event date in the future and
  within a year; times given as **Pacific wall-clock** and converted in one place (the UTC trap);
  role type in the allowed list; `external_url` required and https; optional image fetched,
  must be JPEG/PNG/WebP ≤ 5 MB, re-hosted to `club-assets/automation/<club_id>/…` (Instagram
  image links expire); `source_key` required.
- Duplicate guard: skip if the club already has an active post of the same kind with a
  near-identical title on the same day (catches a claimed club that posted it themselves).
- Edit guard: on update, if the row's `updated_at` is later than `automation_written_at`, a
  person edited it → **skip and report**, never overwrite (decided 2026-11-19: the club wins).
- Returns per-row `{created|updated|hidden|skipped|failed, reason}`; writes `automation_log`.
- Pure validation logic in its own module with unit tests (runnable in this cloud session;
  the function itself can't boot locally here — `T14`).

**Changed `send-reminders`**: new-post emails key on `announced_at` (not `created_at`).

## Phase 3 — Website (agent ships after Phase 1–2 are live; browser-tested both themes, phone)

**Built and tested 2026-11-19** (`tests/browser/cp1-external-and-paging.mjs`, 158/158). As built:
`src/lib/externalLink.ts` (the one check before a stored link becomes an `href`, and the
form's input rule — a link pasted without `https://` is completed, `http://` is refused),
`src/components/ExternalActionButton.tsx`, `src/components/forms/ExternalLinkField.tsx`
(`type="text"` + `inputMode="url"` — the native URL type blocked the form on `forms.gle/…`),
`src/lib/listPages.ts` + `src/components/discover/ShowMore.tsx`. Events/Opportunities use
`useInfiniteQuery` on the same keys; each page is `range(offset, offset+49)` with
`count: "exact"`, ordered by the chosen sort then `id`. While a link is set the form hides
ZotHub's own RSVP/application questions (state kept, so clearing the link brings them back).


1. Event and role detail pages: when `external_url` is set, the primary button is
   **RSVP Externally** / **Apply Externally**, opening the link in a new tab (`noopener`) —
   **for signed-out visitors too, no sign-in step** (decided 2026-11-19);
   the in-app form, "Approval needed", "N going"/"N applied" counts and spots-left are hidden.
2. Lists and cards: hide in-app counts on external posts.
3. Club dashboard: automated posts appear in the club's postings like any other (they own
   them); the applicants/RSVP review screens say responses come in on their own link instead
   of an empty state.
4. Create/Edit forms: an optional external-link field (decided 2026-11-19: clubs may add one). **Edit must load and
   save `external_url`** — otherwise editing an automated post silently drops its link.
5. **Pagination ("Show more")** on Events and Opportunities, server-side ordering, in the
   query key (CLAUDE.md trap). Required before volume, not optional.
6. Claim form: unchanged (decided 2026-11-19: no consent sentence).
7. Regenerate `src/integrations/supabase/types.ts` for the new columns.

## Phase 4 — The automation session

- **Separate cloud environment** `zothub-automation`: network limited to the Supabase project
  host; the automation key saved as a network secret for that host (header `x-automation-key`)
  via the secure credential form — so dev sessions never carry it and the agent never sees it.
- **Runbook** `docs/automation/RUNBOOK.md`: ground rules, the sheet's column contract, the
  daily procedure, the report format, and what to do on every failure. The scheduled prompt is
  short and points here, so rules change by editing one file.
- **Sheet contract (draft, to settle with the maintainer):** row id · **club name** (always
  present, decided 2026-11-19) · club Instagram handle · kind (event/role) · title · description · event date+time (Pacific) · location ·
  role type · deadline · external link · image link · status (active/cancelled).
- **Club matching:** by the sheet's club name against the public `get_all_clubs_public` RPC
  (handle as a tiebreak). **Rule, everywhere: whenever the automation is not confident —
  matching or anything else — it does not post, and reports it** (decided 2026-11-19).
- **Scheduled task:** daily ~2 PM Pacific, a fresh session each run, Google Sheets connector
  attached. It: reads the sheet → validates → calls the door with `dry_run` → calls it for
  real → writes the report.
- **Daily report → a "Report" tab in the same Google Sheet** (decided 2026-11-19): one row
  per sheet row handled — created / updated / hidden / skipped / failed, and why — plus the
  run id. So the session needs **write** access to that sheet.
- **Rollout:** run in **dry-run for the first several days**, maintainer reads the reports,
  then switch on. **Kill switch:** pause the scheduled task, or remove `AUTOMATION_KEY`
  (the door then refuses everything). **Undo:** `undo_run` with the run id from the report.

## Deploy order (CLAUDE.md)

Migration → `publish-club-posts` + `AUTOMATION_KEY` secret → `send-reminders` → push frontend
(the site reads the new columns, so it cannot ship first) → environment + scheduled task →
dry-run → live. Update `CLAUDE.md` (the narrow write exception), `README.md` (new function,
secret, environment) and `prd.md` (posting model) as each lands.
