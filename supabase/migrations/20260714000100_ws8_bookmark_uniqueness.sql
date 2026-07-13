-- WS8: DB-level uniqueness for opportunity and event bookmarks.
--
-- WS3 (migration 20260710000300) already made club follows unique via the
-- partial index `bookmarks_user_club_unique (user_id, club_id) WHERE club_id
-- IS NOT NULL`. The opportunity_id / event_id bookmark cases were left with no
-- DB uniqueness (client-side isBookmarked guard only), so rapid/concurrent
-- toggles could create duplicate rows. This completes the pattern with the two
-- remaining partial unique indexes.
--
-- Each bookmark row sets exactly one of opportunity_id / event_id / club_id
-- (the other two are NULL), so a partial index per column is the correct shape
-- — it constrains only the rows of that kind and never collides across kinds.
--
-- A one-time dedup precedes each index so it can't fail on any pre-existing
-- duplicates (retention rule matches WS3: keep the earliest created_at, tie-
-- break on the smallest id). Idempotent: the dedup is a no-op once unique, and
-- the indexes use IF NOT EXISTS.
--
-- The client (useBookmarks) already treats a 23505 on insert as idempotent
-- success for every bookmark type, so no client change is required for these
-- new constraints to be handled gracefully.

-- Opportunity bookmarks -------------------------------------------------------
DELETE FROM public.bookmarks b
USING public.bookmarks dup
WHERE b.opportunity_id IS NOT NULL
  AND b.user_id = dup.user_id
  AND b.opportunity_id = dup.opportunity_id
  AND (
    b.created_at > dup.created_at
    OR (b.created_at = dup.created_at AND b.id > dup.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS bookmarks_user_opportunity_unique
  ON public.bookmarks (user_id, opportunity_id)
  WHERE opportunity_id IS NOT NULL;

-- Event bookmarks -------------------------------------------------------------
DELETE FROM public.bookmarks b
USING public.bookmarks dup
WHERE b.event_id IS NOT NULL
  AND b.user_id = dup.user_id
  AND b.event_id = dup.event_id
  AND (
    b.created_at > dup.created_at
    OR (b.created_at = dup.created_at AND b.id > dup.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS bookmarks_user_event_unique
  ON public.bookmarks (user_id, event_id)
  WHERE event_id IS NOT NULL;
