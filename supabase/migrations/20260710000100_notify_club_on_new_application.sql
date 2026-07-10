-- WS1 — Application-pipeline notifications.
--
-- Before this migration, a club received NOTHING when a student submitted an
-- application: there was no AFTER INSERT trigger on public.applications (only
-- the AFTER UPDATE status-change trigger `on_application_status_change`), so a
-- club only saw new applications if it happened to open its dashboard.
--
-- This mirrors the established notify_application_status_change() /
-- notify_rsvp_status_change() pattern: on a new application, create ONE in-app
-- notification for the owning club account, gated on the club's
-- `application_updates` preference (COALESCE(..., true) — default on when no
-- preferences row exists), inserted via SECURITY DEFINER through the existing
-- "System can insert notifications" policy.
--
-- Recipient safety: the owning club is derived entirely from
-- opportunity.club_id -> club_profiles.user_id (server-side, authoritative),
-- never from client input, so an application can never notify the wrong club.
--
-- No duplicates: this is AFTER INSERT, so it fires only on a real, committed
-- INSERT. A blocked duplicate application (unique key opportunity_id+student_id,
-- error 23505) never inserts a row, so it produces no notification.

CREATE OR REPLACE FUNCTION public.notify_club_on_new_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_user_id UUID;
  v_opportunity_title TEXT;
  v_student_name TEXT;
  v_should_notify BOOLEAN;
BEGIN
  -- Resolve the owning club's account and the opportunity title from the
  -- opportunity referenced by the new application (never from client input).
  SELECT c.user_id, o.title
    INTO v_club_user_id, v_opportunity_title
  FROM opportunities o
  JOIN club_profiles c ON c.id = o.club_id
  WHERE o.id = NEW.opportunity_id;

  -- Nothing to notify if the opportunity/club can't be resolved.
  IF v_club_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Applicant display name for context (best-effort).
  SELECT full_name INTO v_student_name
  FROM student_profiles
  WHERE id = NEW.student_id;

  -- Respect the club's application-updates preference; default on when unset.
  SELECT COALESCE(application_updates, true) INTO v_should_notify
  FROM notification_preferences
  WHERE user_id = v_club_user_id;

  IF v_should_notify IS NULL THEN
    v_should_notify := true;
  END IF;

  IF v_should_notify THEN
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      v_club_user_id,
      'new_application',
      'New Application Received',
      COALESCE(v_student_name, 'A student') || ' applied to "'
        || COALESCE(v_opportunity_title, 'your opportunity') || '".',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_application ON public.applications;
CREATE TRIGGER on_new_application
AFTER INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_club_on_new_application();
