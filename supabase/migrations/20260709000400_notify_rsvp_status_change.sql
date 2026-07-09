-- Live-QA fix #6 (Bug Inventory: "[Events] RSVP approval state mismatch").
--
-- When a club approved a pending RSVP, the student got an email but no in-app
-- notification, so email/DB/UI disagreed. This mirrors the existing
-- notify_application_status_change() trigger: create an in-app notification for
-- the student when their RSVP is approved.
--
-- Scope kept deliberately narrow to the reported case:
--   * Only fires on a transition from 'pending' -> 'confirmed' (an approval).
--     A student cannot self-confirm, so this can only be a club approval.
--   * Declines (pending -> cancelled) are intentionally NOT notified here,
--     because a student cancelling their own pending RSVP is also
--     pending -> cancelled and cannot be distinguished at the row level; that
--     would produce a misleading "declined" notification. (Documented in
--     plan.md as a follow-up.)
--   * Respects the student's event_reminders preference (RSVP/event related).

CREATE OR REPLACE FUNCTION public.notify_rsvp_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_user_id UUID;
  v_event_title TEXT;
  v_should_notify BOOLEAN;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    SELECT user_id INTO v_student_user_id
    FROM student_profiles
    WHERE id = NEW.student_id;

    SELECT title INTO v_event_title
    FROM events
    WHERE id = NEW.event_id;

    SELECT COALESCE(event_reminders, true) INTO v_should_notify
    FROM notification_preferences
    WHERE user_id = v_student_user_id;

    IF v_should_notify IS NULL THEN
      v_should_notify := true;
    END IF;

    IF v_should_notify AND v_student_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (
        v_student_user_id,
        'rsvp_update',
        'RSVP Approved',
        'Your RSVP for "' || COALESCE(v_event_title, 'an event') || '" has been approved.',
        NEW.event_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_rsvp_status_change ON public.rsvps;
CREATE TRIGGER on_rsvp_status_change
AFTER UPDATE ON public.rsvps
FOR EACH ROW
EXECUTE FUNCTION public.notify_rsvp_status_change();
