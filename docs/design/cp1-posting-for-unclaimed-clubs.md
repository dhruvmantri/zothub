# CP1 — Automated posting of club events and roles

**Status:** plan v2, 2026-11-19. Nothing built. Decisions are dated in `../BACKLOG.md`
(*Decisions made*, CP1 rows); open questions are *Decisions needed* #15. If this file and the
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
  person edited it → **skip and report**, never overwrite (pending decision #15).
- Returns per-row `{created|updated|hidden|skipped|failed, reason}`; writes `automation_log`.
- Pure validation logic in its own module with unit tests (runnable in this cloud session;
  the function itself can't boot locally here — `T14`).

**Changed `send-reminders`**: new-post emails key on `announced_at` (not `created_at`).

## Phase 3 — Website (agent ships after Phase 1–2 are live; browser-tested both themes, phone)

1. Event and role detail pages: when `external_url` is set, the primary button is
   **RSVP Externally** / **Apply Externally**, opening the link in a new tab (`noopener`);
   the in-app form, "Approval needed", "N going"/"N applied" counts and spots-left are hidden.
2. Lists and cards: hide in-app counts on external posts.
3. Club dashboard: automated posts appear in the club's postings like any other (they own
   them); the applicants/RSVP review screens say responses come in on their own link instead
   of an empty state.
4. Create/Edit forms: an optional external-link field (pending #15). **Edit must load and
   save `external_url`** — otherwise editing an automated post silently drops its link.
5. **Pagination ("Show more")** on Events and Opportunities, server-side ordering, in the
   query key (CLAUDE.md trap). Required before volume, not optional.
6. Claim form: a consent sentence (pending #15).
7. Regenerate `src/integrations/supabase/types.ts` for the new columns.

## Phase 4 — The automation session

- **Separate cloud environment** `zothub-automation`: network limited to the Supabase project
  host; the automation key saved as a network secret for that host (header `x-automation-key`)
  via the secure credential form — so dev sessions never carry it and the agent never sees it.
- **Runbook** `docs/automation/RUNBOOK.md`: ground rules, the sheet's column contract, the
  daily procedure, the report format, and what to do on every failure. The scheduled prompt is
  short and points here, so rules change by editing one file.
- **Sheet contract (draft, to settle with the maintainer):** row id · club Instagram handle ·
  club name · kind (event/role) · title · description · event date+time (Pacific) · location ·
  role type · deadline · external link · image link · status (active/cancelled).
- **Club matching:** by saved Instagram handle; first sighting falls back to name lookup via
  the public `get_all_clubs_public` RPC; ambiguous → skip and report (pending #15).
- **Scheduled task:** daily ~2 PM Pacific, a fresh session each run, Google Sheets connector
  attached. It: reads the sheet → validates → calls the door with `dry_run` → calls it for
  real → reports.
- **Rollout:** run in **dry-run for the first several days**, maintainer reads the reports,
  then switch on. **Kill switch:** pause the scheduled task, or remove `AUTOMATION_KEY`
  (the door then refuses everything). **Undo:** `undo_run` with the run id from the report.

## Deploy order (CLAUDE.md)

Migration → `publish-club-posts` + `AUTOMATION_KEY` secret → `send-reminders` → push frontend
(the site reads the new columns, so it cannot ship first) → environment + scheduled task →
dry-run → live. Update `CLAUDE.md` (the narrow write exception), `README.md` (new function,
secret, environment) and `prd.md` (posting model) as each lands.
