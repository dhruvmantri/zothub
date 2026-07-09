-- Live-QA fix #4/#6 (Bug Inventory: "[Events] RSVP approval does not persist").
--
-- ROOT CAUSE: rsvps had UPDATE policies for the owning STUDENT only. There was
-- no policy letting a club update RSVPs for events it owns, so a club approval
-- (UPDATE rsvps SET status='confirmed') was silently filtered by RLS to ZERO
-- rows with NO error. supabase-js reported success, the UI optimistically
-- showed "confirmed" and sent the approval email, but the row never changed —
-- so after refresh it was still pending, and the approval-notification trigger
-- never fired.
--
-- This adds the missing UPDATE policy so club approvals actually persist. The
-- accompanying client change (RSVPReview) additionally verifies the update
-- affected a row before showing success / sending email.
--
-- Idempotent (safe to run manually; migration history is unreconciled).

DROP POLICY IF EXISTS "Clubs can update RSVPs for their events" ON public.rsvps;

CREATE POLICY "Clubs can update RSVPs for their events"
ON public.rsvps
FOR UPDATE
TO authenticated
USING (
  event_id IN (
    SELECT e.id
    FROM public.events e
    JOIN public.club_profiles c ON e.club_id = c.id
    WHERE c.user_id = auth.uid()
  )
)
WITH CHECK (
  event_id IN (
    SELECT e.id
    FROM public.events e
    JOIN public.club_profiles c ON e.club_id = c.id
    WHERE c.user_id = auth.uid()
  )
);
