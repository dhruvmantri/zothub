-- WS4 — Event RSVP integrity & realtime.
--
-- Three server-authoritative changes on public.rsvps:
--   1. Capacity guard: a BEFORE INSERT/UPDATE trigger so direct API calls and
--      concurrent requests cannot confirm more RSVPs than events.capacity. Only
--      'confirmed' RSVPs consume a seat; 'pending'/'cancelled' do not. NULL
--      capacity means unlimited. The event row is locked FOR UPDATE so concurrent
--      confirmations serialize and cannot overbook.
--   2. Club-decline notification: notify_rsvp_status_change() is extended so a
--      student is notified when the CLUB declines/cancels their RSVP, but NOT
--      when the student cancels their own. The actor is determined
--      server-authoritatively via auth.uid() (the request JWT), never a client
--      field.
--   3. Realtime: add public.rsvps to the supabase_realtime publication so the
--      student's EventDetail RSVP-status subscription receives live updates.

-- 1. Capacity guard -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_rsvp_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity INTEGER;
  v_confirmed_count INTEGER;
BEGIN
  -- Only a 'confirmed' RSVP consumes a seat: skip if the row is not becoming
  -- confirmed.
  IF NEW.status IS DISTINCT FROM 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Skip the no-op ONLY when the row was already confirmed AND stays on the same
  -- event (seat already held for this event). A confirmed RSVP that MOVES to a
  -- different event (event_id changes) must be enforced against the destination's
  -- capacity, so it is intentionally NOT skipped here.
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'confirmed'
     AND OLD.event_id IS NOT DISTINCT FROM NEW.event_id THEN
    RETURN NEW;
  END IF;

  -- Lock the DESTINATION event row so concurrent confirmations/moves into the
  -- same event serialize; this is what prevents an overbooking race. NULL
  -- capacity = unlimited.
  SELECT capacity INTO v_capacity
  FROM events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count seats already taken on the destination event. SECURITY DEFINER is
  -- required: under the caller's RLS a student can only see their own rsvp rows,
  -- which would undercount. Be explicit about INSERT vs UPDATE rather than
  -- relying on whether NEW.id already holds its default:
  --   * INSERT: the new row is not yet in the table, so count every confirmed row.
  --   * UPDATE: exclude only the row being updated (NEW.id = OLD.id).
  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO v_confirmed_count
    FROM rsvps
    WHERE event_id = NEW.event_id
      AND status = 'confirmed';
  ELSE
    SELECT count(*) INTO v_confirmed_count
    FROM rsvps
    WHERE event_id = NEW.event_id
      AND status = 'confirmed'
      AND id <> NEW.id;
  END IF;

  IF v_confirmed_count >= v_capacity THEN
    -- Stable message the frontend matches to present a clean "at capacity" toast.
    RAISE EXCEPTION 'Event is at full capacity' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_rsvp_capacity_trigger ON public.rsvps;
CREATE TRIGGER enforce_rsvp_capacity_trigger
BEFORE INSERT OR UPDATE ON public.rsvps
FOR EACH ROW
EXECUTE FUNCTION public.enforce_rsvp_capacity();

-- 2. RSVP status-change notification (approval + club decline) -----------------
-- Extends the existing on_rsvp_status_change AFTER UPDATE trigger's function.
-- Approval (pending->confirmed) is notified as before. Additionally, a club
-- decline/cancel (any->cancelled where the actor is the club owner) notifies the
-- student; a student self-cancel (actor = the student) does NOT. Actor identity
-- comes from auth.uid(), not from any client-supplied value.
CREATE OR REPLACE FUNCTION public.notify_rsvp_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_user_id UUID;
  v_club_user_id UUID;
  v_event_title TEXT;
  v_actor UUID := auth.uid();
  v_should_notify BOOLEAN;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_student_user_id
  FROM student_profiles
  WHERE id = NEW.student_id;

  SELECT e.title, c.user_id INTO v_event_title, v_club_user_id
  FROM events e
  JOIN club_profiles c ON c.id = e.club_id
  WHERE e.id = NEW.event_id;

  IF v_student_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Respect the student's event_reminders preference; default on when unset.
  SELECT COALESCE(event_reminders, true) INTO v_should_notify
  FROM notification_preferences
  WHERE user_id = v_student_user_id;
  IF v_should_notify IS NULL THEN
    v_should_notify := true;
  END IF;
  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    -- Approval (a student cannot self-confirm, so this is a club action).
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      v_student_user_id,
      'rsvp_update',
      'RSVP Approved',
      'Your RSVP for "' || COALESCE(v_event_title, 'an event') || '" has been approved.',
      NEW.event_id
    );
  ELSIF NEW.status = 'cancelled'
        AND v_actor IS NOT NULL
        AND v_actor = v_club_user_id
        AND v_actor <> v_student_user_id THEN
    -- Club declined a pending RSVP or cancelled a confirmed one. A student
    -- cancelling their own RSVP is also ->cancelled but has v_actor = the
    -- student, so it is correctly not notified here.
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      v_student_user_id,
      'rsvp_update',
      CASE WHEN OLD.status = 'pending' THEN 'RSVP Declined' ELSE 'RSVP Cancelled' END,
      'Your RSVP for "' || COALESCE(v_event_title, 'an event') || '" was '
        || CASE WHEN OLD.status = 'pending' THEN 'declined' ELSE 'cancelled' END
        || ' by the organizer.',
      NEW.event_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Realtime: publish rsvps so the student's RSVP-status subscription fires ----
-- Default replica identity suffices: the EventDetail subscription filters on
-- student_id, which is present in the NEW row for the INSERT/UPDATE events it
-- cares about. Idempotent and safe against current state.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'rsvps'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps;
    END IF;
  END IF;
END $$;
