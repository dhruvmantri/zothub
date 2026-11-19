# CP1 — Posting events and roles for a club that has not claimed its listing

**Status:** proposal, 2026-11-19. Nothing built. Open decisions are in `../BACKLOG.md`
(`CP1`, and *Decisions needed* #14). If this file and the backlog disagree, the backlog wins.

## Goal

The maintainer gathers a club's public announcements (Instagram etc.) and hands them to the
agent, which turns them into ZotHub events and roles that appear under that club — as if the
club posted them — for a club that has **not** claimed its listing.

## What the live system looks like (measured read-only, 2026-11-19)

- 722 clubs, all ZotSpot-seeded and published; **710 unclaimed** (`user_id IS NULL`), 12
  claimed. **0 events, 0 opportunities** in the database.
- `events.club_id` and `opportunities.club_id` reference **`club_profiles.id`** (the listing),
  not a user. So a post for an unclaimed club is valid data, and the day the club claims, the
  existing owner RLS (`club_profiles.user_id = auth.uid()`) hands them full control of it
  automatically. No migration of ownership is needed.
- **Nothing records who created a post** (no `created_by`, no `source` on posts).
- **Every write policy requires being the club's owner.** There is no admin write policy on
  `events`, `opportunities`, or the `club-assets` bucket (uploads must sit in a folder named
  after the uploader's user id). Today only the service role or SQL could create such a post.
- **Responses to an unclaimed club go nowhere.** `notify_club_on_new_application` returns early
  when the club has no owner, so an application is stored for a club nobody can read, and
  nobody is told. An RSVP to a `requires_approval` event would sit `pending` forever.
  Applicants grant the club their full profile (decision G3-05) — to nobody, in this case.
- There is **no external link field** on posts (e.g. the club's own Google Form / sign-up
  link), which is how most Instagram announcements take sign-ups.
- **No club has `instagram_url` set (0/722)**, so matching an Instagram account to a listing
  needs a lookup by name the first time, then the handle should be saved.
- Instagram image URLs expire; flyers must be re-hosted into `club-assets`.
- `notify_followers_on_new_post` is an **AFTER INSERT** trigger and ignores `is_active`, so
  **even a saved draft notifies every follower** — a mistaken post is announced the instant it
  is saved, before anyone reviews it. (This is also a latent bug for clubs using "Save as
  draft" today.) Relevant to any import or review step.

## Proposed changes (each one needs maintainer sign-off; migrations + deploys are theirs)

1. **Migration — provenance on posts.** `source` (`'club'` | `'zothub'`), `source_url`
   (the original post), `created_by` (the admin who published it), and `external_url`
   (club's own sign-up link) on `events` and `opportunities`.
2. **Migration — admin write access.** Let the `admin` role insert/update/delete posts **for
   unclaimed clubs only**, plus an admin storage folder in `club-assets` for flyers.
3. **Migration — responses for unclaimed clubs.** Either posts by ZotHub for unclaimed clubs
   point students to `external_url` instead of in-app Apply/RSVP-with-approval, or
   responses are held and handed over on claim. Decision needed.
4. **Migration — follower notification fires on publish, not on insert**, so drafts don't
   announce themselves.
5. **Frontend — `/admin` "Post for a club" screen**: pick the club, paste or import the
   agent's prepared posts, preview them exactly as students will see them, publish.
6. **Frontend — honest label** on such posts (wording is a decision), and the claim banner
   can point at them ("3 events are already listed for your club — claim it to manage them").
7. **Workflow.** Maintainer sends raw material → agent drafts the post(s) as a file → the
   maintainer reviews and publishes in `/admin`. The agent never writes to production itself
   (CLAUDE.md non-negotiable) unless the maintainer explicitly decides otherwise.
