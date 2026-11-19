-- CP1 — automated posting of club events and roles (docs/design/cp1-posting-for-unclaimed-clubs.md)
--
-- ⚠️ NOT APPLIED AUTOMATICALLY. Back up first (repo policy), and apply only with the
--    maintainer's explicit OK (decision 2026-11-19).
--
-- What this does:
--   1. Posts gain an external sign-up link (external_url) — the "Apply Externally" /
--      "RSVP Externally" buttons — plus internal provenance (source, source_key,
--      source_url) that is NEVER shown (decision: no label, seamless).
--   2. club_edited_at records when a PERSON changed a post's content through the site.
--      The automation's rule is "the club's edit wins": it never overwrites a post with
--      club_edited_at set. This cannot be read off updated_at, because a page view, an
--      RSVP-counter refresh and the nightly archive job all UPDATE the row too.
--   3. Followers are told when a post is PUBLISHED, once — not when it is saved. Before
--      this, notify_followers_on_new_post was AFTER INSERT and ignored is_active, so a
--      saved draft notified every follower (CP1-a). announced_at records the moment and
--      is what send-reminders' new-post email keys on.
--   4. opportunities.type is checked against the six values the app offers.
--   5. automation_log: every write the automation's door makes. Service-role only.
--
-- Production had 0 events and 0 opportunities when this was written (2026-11-19), so the
-- backfills below touch nothing there; they exist so a database with rows stays correct.

BEGIN;

-- 1. Columns -----------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS external_url   text,
  ADD COLUMN IF NOT EXISTS source         text NOT NULL DEFAULT 'club',
  ADD COLUMN IF NOT EXISTS source_key     text,
  ADD COLUMN IF NOT EXISTS source_url     text,
  ADD COLUMN IF NOT EXISTS club_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS announced_at   timestamptz;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS external_url   text,
  ADD COLUMN IF NOT EXISTS source         text NOT NULL DEFAULT 'club',
  ADD COLUMN IF NOT EXISTS source_key     text,
  ADD COLUMN IF NOT EXISTS source_url     text,
  ADD COLUMN IF NOT EXISTS club_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS announced_at   timestamptz;

-- An external link must be a plain https URL: no javascript:, no data:, no whitespace.
ALTER TABLE public.events
  ADD CONSTRAINT events_external_url_https
    CHECK (external_url IS NULL OR (external_url ~* '^https://[^[:space:]]+$' AND length(external_url) <= 2048)),
  ADD CONSTRAINT events_source_url_https
    CHECK (source_url IS NULL OR (source_url ~* '^https://[^[:space:]]+$' AND length(source_url) <= 2048)),
  ADD CONSTRAINT events_source_valid
    CHECK (source IN ('club', 'automation')),
  ADD CONSTRAINT events_automation_has_key
    CHECK (source <> 'automation' OR source_key IS NOT NULL);

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_external_url_https
    CHECK (external_url IS NULL OR (external_url ~* '^https://[^[:space:]]+$' AND length(external_url) <= 2048)),
  ADD CONSTRAINT opportunities_source_url_https
    CHECK (source_url IS NULL OR (source_url ~* '^https://[^[:space:]]+$' AND length(source_url) <= 2048)),
  ADD CONSTRAINT opportunities_source_valid
    CHECK (source IN ('club', 'automation')),
  ADD CONSTRAINT opportunities_automation_has_key
    CHECK (source <> 'automation' OR source_key IS NOT NULL),
  -- Mirrors OPPORTUNITY_TYPE_VALUES in src/lib/constants.ts. Change both together.
  ADD CONSTRAINT opportunities_type_valid
    CHECK (type IN ('leadership', 'project', 'internship', 'volunteer', 'committee', 'other'));

-- One post per sheet row: the automation's idempotency key.
CREATE UNIQUE INDEX IF NOT EXISTS events_source_key_uniq
  ON public.events (source_key) WHERE source_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_source_key_uniq
  ON public.opportunities (source_key) WHERE source_key IS NOT NULL;

-- Already-published rows count as announced, so editing one never re-notifies.
UPDATE public.events        SET announced_at = created_at WHERE is_active AND announced_at IS NULL;
UPDATE public.opportunities SET announced_at = created_at WHERE is_active AND announced_at IS NULL;

-- 2 + 3. One BEFORE trigger owns the internal columns ------------------------------
--
-- A signed-in user (a club, through the site) can never set provenance or the announce
-- time: on INSERT they are forced to the defaults, on UPDATE they keep their old values.
-- Only the service role (the automation's door) or the database owner can set them.
-- A club's content change stamps club_edited_at.
--
-- current_user is the PostgREST role ('authenticated' / 'anon') for a direct request,
-- and the function OWNER inside a SECURITY DEFINER function — so the view counter,
-- the RSVP counters and the archive job never look like a club edit.

CREATE OR REPLACE FUNCTION public.guard_post_internal_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_user  boolean := current_user IN ('authenticated', 'anon');
  v_changed  boolean := false;
BEGIN
  IF v_is_user THEN
    IF TG_OP = 'INSERT' THEN
      NEW.source         := 'club';
      NEW.source_key     := NULL;
      NEW.source_url     := NULL;
      NEW.club_edited_at := NULL;
      NEW.announced_at   := NULL;
    ELSE
      NEW.source         := OLD.source;
      NEW.source_key     := OLD.source_key;
      NEW.source_url     := OLD.source_url;
      NEW.club_edited_at := OLD.club_edited_at;
      NEW.announced_at   := OLD.announced_at;

      -- Content a person can change on the Edit form, or by publishing/unpublishing.
      IF TG_TABLE_NAME = 'events' THEN
        v_changed := (NEW.title, NEW.description, NEW.event_date, NEW.location, NEW.capacity,
                      NEW.banner_url, NEW.is_active, NEW.external_url, NEW.requires_approval,
                      NEW.rsvp_questions)
          IS DISTINCT FROM
                     (OLD.title, OLD.description, OLD.event_date, OLD.location, OLD.capacity,
                      OLD.banner_url, OLD.is_active, OLD.external_url, OLD.requires_approval,
                      OLD.rsvp_questions);
      ELSE
        v_changed := (NEW.title, NEW.description, NEW.type, NEW.requirements, NEW.deadline,
                      NEW.is_active, NEW.external_url, NEW.application_questions,
                      NEW.show_application_count)
          IS DISTINCT FROM
                     (OLD.title, OLD.description, OLD.type, OLD.requirements, OLD.deadline,
                      OLD.is_active, OLD.external_url, OLD.application_questions,
                      OLD.show_application_count);
      END IF;

      IF v_changed THEN
        NEW.club_edited_at := now();
      END IF;
    END IF;
  END IF;

  -- Announce on first publish. is_active is nullable; NULL is not published.
  IF COALESCE(NEW.is_active, false) AND NEW.announced_at IS NULL THEN
    NEW.announced_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_event_internal_columns ON public.events;
CREATE TRIGGER guard_event_internal_columns
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.guard_post_internal_columns();

DROP TRIGGER IF EXISTS guard_opportunity_internal_columns ON public.opportunities;
CREATE TRIGGER guard_opportunity_internal_columns
BEFORE INSERT OR UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.guard_post_internal_columns();

-- 3. Notify followers when a post is announced (first publish), exactly once --------
--
-- Same notification text and preference handling as before
-- (20260710000300_unify_follow_new_post_notifications); only WHEN it fires changes.

CREATE OR REPLACE FUNCTION public.notify_followers_on_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_name TEXT;
  v_follower RECORD;
  v_should_notify BOOLEAN;
  v_post_type TEXT;
BEGIN
  -- Only the moment of announcement: set on this write, not before it.
  IF NEW.announced_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.announced_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_post_type := CASE WHEN TG_TABLE_NAME = 'opportunities' THEN 'opportunity' ELSE 'event' END;

  SELECT club_name INTO v_club_name FROM club_profiles WHERE id = NEW.club_id;

  -- "Following a club" is a bookmark with club_id set (DB-unique per user + club).
  FOR v_follower IN
    SELECT DISTINCT b.user_id FROM bookmarks b WHERE b.club_id = NEW.club_id
  LOOP
    SELECT COALESCE(new_post_notifications, true) INTO v_should_notify
    FROM notification_preferences WHERE user_id = v_follower.user_id;

    IF v_should_notify IS NULL THEN
      v_should_notify := true;
    END IF;

    IF v_should_notify THEN
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (
        v_follower.user_id,
        'new_post',
        'New ' || v_post_type || ' from ' || v_club_name,
        v_club_name || ' just posted: ' || NEW.title,
        NEW.id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_followers_new_event ON public.events;
CREATE TRIGGER notify_followers_new_event
AFTER INSERT OR UPDATE OF is_active ON public.events
FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_new_post();

DROP TRIGGER IF EXISTS notify_followers_new_opportunity ON public.opportunities;
CREATE TRIGGER notify_followers_new_opportunity
AFTER INSERT OR UPDATE OF is_active ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_new_post();

-- 4. Public read of the external link ------------------------------------------------
--
-- anon's SELECT on these tables is a COLUMN allowlist (20260712000100): a new column is
-- invisible to signed-out visitors unless granted, so the external buttons would never
-- render for them. Provenance columns are deliberately NOT granted.
GRANT SELECT (external_url) ON public.events        TO anon;
GRANT SELECT (external_url) ON public.opportunities TO anon;

-- 5. Audit log ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.automation_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id      uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  action      text        NOT NULL
              CHECK (action IN ('created', 'updated', 'hidden', 'skipped', 'failed', 'undone', 'unchanged')),
  dry_run     boolean     NOT NULL DEFAULT false,
  kind        text        CHECK (kind IN ('event', 'opportunity')),
  source_key  text,
  club_id     uuid,       -- no FK: the log must outlive a deleted club or post
  post_id     uuid,
  reason      text,
  payload     jsonb
);

CREATE INDEX IF NOT EXISTS automation_log_run_idx        ON public.automation_log (run_id);
CREATE INDEX IF NOT EXISTS automation_log_source_key_idx ON public.automation_log (source_key);

ALTER TABLE public.automation_log ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) reads or writes it.
REVOKE ALL ON public.automation_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.automation_log TO service_role;

COMMIT;
