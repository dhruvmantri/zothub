-- WS3 — Unify follow/bookmark semantics & restore new-post notifications.
--
-- Root cause: the whole app stores "follow a club" as a bookmark
-- (bookmarks.club_id) — the follow button (useBookmarks("club")), the
-- personalized feed, the followed-clubs list, and the dashboard "Following"
-- count all read/write bookmarks. But the new-post in-app trigger
-- notify_followers_on_new_post() and the send-reminders new-post emails read
-- public.club_followers, a table the app NEVER writes. So a student who follows
-- a club received no new-post notification or email even though the feed worked.
--
-- Fix: make bookmarks.club_id the single source of truth by repointing the
-- trigger at bookmarks (this migration) and the send-reminders new-post email
-- query at bookmarks (edge function change). club_followers is left in place but
-- is no longer read (retained to avoid a destructive drop; no data depends on it).
--
-- Also: the new-post notification/email was gated on the deadline_reminders
-- preference, which is semantically wrong (a new post from a followed club is not
-- a deadline reminder). This adds a dedicated new_post_notifications preference
-- (default true) and gates on it instead. The preferences UI + unsubscribe page
-- are updated in the same change; send-reminders is updated to match.
--
-- No backfill: bookmarks already holds the real follow data, so switching the
-- reader needs no data migration. Club follows are additionally made DB-unique
-- (step 3 below): one canonical row per (user_id, club_id). The follower loop
-- still selects DISTINCT user_id as defense in depth.

-- 1. Dedicated preference for new-post-from-followed-club notifications/emails.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS new_post_notifications boolean NOT NULL DEFAULT true;

-- 2. Repoint the follower notification at bookmarks.club_id and gate on the new
--    preference. CREATE OR REPLACE updates the function in place; the existing
--    notify_followers_new_opportunity / notify_followers_new_event triggers keep
--    calling it, so they are not recreated here.
CREATE OR REPLACE FUNCTION public.notify_followers_on_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_club_name TEXT;
  v_follower RECORD;
  v_should_notify BOOLEAN;
  v_post_type TEXT;
  v_post_title TEXT;
BEGIN
  -- Determine post type and title based on trigger table
  IF TG_TABLE_NAME = 'opportunities' THEN
    v_post_type := 'opportunity';
    v_post_title := NEW.title;
  ELSIF TG_TABLE_NAME = 'events' THEN
    v_post_type := 'event';
    v_post_title := NEW.title;
  END IF;

  -- Get club name
  SELECT club_name INTO v_club_name
  FROM club_profiles
  WHERE id = NEW.club_id;

  -- Notify all followers. "Following a club" is a bookmark with club_id set.
  -- Club follows are DB-unique (partial unique index, step 3), so there is at
  -- most one row per (user_id, club_id); DISTINCT is kept as defense in depth.
  FOR v_follower IN
    SELECT DISTINCT b.user_id
    FROM bookmarks b
    WHERE b.club_id = NEW.club_id
  LOOP
    -- Respect the follower's new-post preference; default on when unset.
    SELECT COALESCE(new_post_notifications, true) INTO v_should_notify
    FROM notification_preferences
    WHERE user_id = v_follower.user_id;

    IF v_should_notify IS NULL THEN
      v_should_notify := true;
    END IF;

    IF v_should_notify THEN
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (
        v_follower.user_id,
        'new_post',
        'New ' || v_post_type || ' from ' || v_club_name,
        v_club_name || ' just posted: ' || v_post_title,
        NEW.id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3. Make club follows unique and idempotent at the database level.
--    Historically bookmarks had no uniqueness on (user_id, club_id), so a user
--    could accumulate multiple identical club-follow rows (double-clicks, retries,
--    concurrent inserts). This guarantees one canonical follow relationship.
--
-- 3a. Remove existing duplicate CLUB-follow rows before adding the index.
--     Retention rule: for each (user_id, club_id) group among rows where
--     club_id IS NOT NULL, KEEP the earliest-created row (MIN created_at),
--     breaking ties by the smallest id; DELETE the rest. Rows that are
--     opportunity/event bookmarks (club_id IS NULL) are never considered here,
--     so non-club bookmarks are left completely untouched.
DELETE FROM public.bookmarks b
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, club_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.bookmarks
  WHERE club_id IS NOT NULL
) dups
WHERE b.id = dups.id
  AND dups.rn > 1;

-- 3b. Partial unique index enforcing one club-follow per (user_id, club_id).
--     Partial (WHERE club_id IS NOT NULL) so it constrains ONLY club follows and
--     leaves opportunity/event bookmarks (club_id IS NULL) unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS bookmarks_user_club_unique
  ON public.bookmarks (user_id, club_id)
  WHERE club_id IS NOT NULL;
