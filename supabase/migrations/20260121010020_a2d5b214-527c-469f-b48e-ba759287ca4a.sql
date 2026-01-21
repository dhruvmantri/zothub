-- Create trigger function to notify followers when club posts new content
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

  -- Notify all followers
  FOR v_follower IN
    SELECT cf.user_id
    FROM club_followers cf
    WHERE cf.club_id = NEW.club_id
  LOOP
    -- Check notification preferences (deadline_reminders covers new posts)
    SELECT COALESCE(deadline_reminders, true) INTO v_should_notify
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

-- Create triggers for opportunities and events
DROP TRIGGER IF EXISTS notify_followers_new_opportunity ON opportunities;
CREATE TRIGGER notify_followers_new_opportunity
AFTER INSERT ON opportunities
FOR EACH ROW
EXECUTE FUNCTION notify_followers_on_new_post();

DROP TRIGGER IF EXISTS notify_followers_new_event ON events;
CREATE TRIGGER notify_followers_new_event
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION notify_followers_on_new_post();