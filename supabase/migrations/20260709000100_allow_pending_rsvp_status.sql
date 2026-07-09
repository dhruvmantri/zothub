-- Phase 2 fix (Bug Inventory: "[Events] Approval-required RSVP always fails").
--
-- The app inserts rsvps.status = 'pending' when an event has requires_approval,
-- and RSVPReview approves to 'confirmed' / declines to 'cancelled' — but the
-- original CHECK constraint only allowed ('confirmed','cancelled'), so every
-- approval-required RSVP insert failed with 23514.
--
-- Extend the constraint to include 'pending'. Existing rows are unaffected
-- (only 'confirmed'/'cancelled' can exist today, both still valid).

ALTER TABLE public.rsvps DROP CONSTRAINT rsvps_status_check;

ALTER TABLE public.rsvps
  ADD CONSTRAINT rsvps_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text]));
