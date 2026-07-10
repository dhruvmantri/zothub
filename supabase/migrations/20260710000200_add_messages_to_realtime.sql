-- WS2 — Realtime delivery for messages.
--
-- The frontend subscribes to Postgres changes on public.messages in two places:
--   * useMessages         — event INSERT, filter receiver_id=eq.<uid> (live chat)
--   * useNavigationCounts  — event *,      filter receiver_id=eq.<uid> (unread badge)
-- but public.messages was never added to the supabase_realtime publication (only
-- notifications and club_team_members were), so those subscriptions received no
-- events. This adds messages to the publication so the existing subscriptions
-- deliver live inserts and read-state updates.
--
-- Replica identity: intentionally left at DEFAULT (primary key). Every filter the
-- app uses (receiver_id) is evaluated against the NEW row, which is fully present
-- for INSERT and UPDATE regardless of replica identity — the flows the live chat
-- and unread badge actually depend on (a message arriving; a message being marked
-- read). REPLICA IDENTITY FULL is NOT set: it would only change DELETE events,
-- whose OLD row otherwise carries just the PK, and the app has no subscription
-- that depends on matching a non-PK filter on a DELETE (the only affected case is
-- a sender deleting an unread message, which self-heals on the receiver's next
-- fetch). notifications — already realtime and working in production — likewise
-- runs on DEFAULT replica identity, so this matches the established pattern.
--
-- Idempotent: only adds messages if it is not already a member of the publication,
-- and only if the publication exists (it is provisioned by Supabase in prod and by
-- the local harness bootstrap).
--
-- NOTE: rsvps is deliberately NOT added here. No frontend code subscribes to the
-- rsvps table; the student's RSVP-approval signal is already delivered live via
-- the notifications table (which is in the publication). Wiring true rsvps realtime
-- requires a new client subscription (an RSVP-journey/UX change) and is deferred to
-- WS4, which owns the RSVP journey.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  END IF;
END $$;
