-- UNDO for 20261119000100_cp1_automated_posts.sql.
-- Kept OUTSIDE supabase/migrations so it is never applied by `db push` / `db reset`.
-- Restores the follower-notification trigger exactly as production had it on
-- 2026-11-19 (read from the live database), and drops everything CP1 added.
-- ⚠️ Dropping the columns deletes any external links / provenance stored in them.

BEGIN;

DROP TRIGGER IF EXISTS guard_event_internal_columns ON public.events;
DROP TRIGGER IF EXISTS guard_opportunity_internal_columns ON public.opportunities;
DROP FUNCTION IF EXISTS public.guard_post_internal_columns();

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
  IF TG_TABLE_NAME = 'opportunities' THEN
    v_post_type := 'opportunity';
    v_post_title := NEW.title;
  ELSIF TG_TABLE_NAME = 'events' THEN
    v_post_type := 'event';
    v_post_title := NEW.title;
  END IF;

  SELECT club_name INTO v_club_name
  FROM club_profiles
  WHERE id = NEW.club_id;

  FOR v_follower IN
    SELECT DISTINCT b.user_id
    FROM bookmarks b
    WHERE b.club_id = NEW.club_id
  LOOP
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

DROP TRIGGER IF EXISTS notify_followers_new_event ON public.events;
CREATE TRIGGER notify_followers_new_event AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION notify_followers_on_new_post();
DROP TRIGGER IF EXISTS notify_followers_new_opportunity ON public.opportunities;
CREATE TRIGGER notify_followers_new_opportunity AFTER INSERT ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION notify_followers_on_new_post();

DROP TABLE IF EXISTS public.automation_log;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_external_url_https,
  DROP CONSTRAINT IF EXISTS events_source_url_https,
  DROP CONSTRAINT IF EXISTS events_source_valid,
  DROP CONSTRAINT IF EXISTS events_automation_has_key,
  DROP COLUMN IF EXISTS external_url,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS source_key,
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS club_edited_at,
  DROP COLUMN IF EXISTS announced_at;

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_external_url_https,
  DROP CONSTRAINT IF EXISTS opportunities_source_url_https,
  DROP CONSTRAINT IF EXISTS opportunities_source_valid,
  DROP CONSTRAINT IF EXISTS opportunities_automation_has_key,
  DROP CONSTRAINT IF EXISTS opportunities_type_valid,
  DROP COLUMN IF EXISTS external_url,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS source_key,
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS club_edited_at,
  DROP COLUMN IF EXISTS announced_at;

COMMIT;
