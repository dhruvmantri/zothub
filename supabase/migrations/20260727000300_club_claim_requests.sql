-- MB5 claim flow — club_claim_requests.
--
-- ⚠️ NOT APPLIED AUTOMATICALLY. Review + back up before `supabase db push`.
--
-- A person on an UNCLAIMED (ZotSpot-seeded) club page submits a claim (email +
-- optional note) via the submit-club-claim edge function. An admin reviews in
-- /admin; review-club-claim (admin-only, service role) approves → creates the club
-- account, binds this seeded club to it, grants 'club', and emails a one-click
-- set-password link. Rows are written/updated only by those service-role edge
-- functions; admins may read the queue for the /admin UI. No self-service removal.
BEGIN;

CREATE TABLE IF NOT EXISTS public.club_claim_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           uuid NOT NULL REFERENCES public.club_profiles(id) ON DELETE CASCADE,
  -- Claims are LOGGED-OUT ONLY: a person submits a dedicated club email and, on
  -- approval, a SEPARATE club account is always created for that email. There is
  -- deliberately no existing-user / dual-role binding.
  claimant_email    text NOT NULL,
  note              text,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
  created_user_id   uuid,            -- the club account created on approval (audit trail)
  rejection_reason  text,
  -- Delivery state of the approval/rejection email so the admin UI can tell the
  -- truth ('sent' | 'failed') and offer a resend. NULL until an email is attempted.
  email_status      text CHECK (email_status IN ('sent','failed')),
  -- Single mutual-exclusion lock shared by BOTH approve and reject so the two can
  -- never race into a partial/split state. Set when processing starts; cleared on
  -- failure; left set once terminal.
  processing_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at       timestamptz,
  reviewed_by       uuid
);

-- At most one PENDING claim per (club, email). A different person may still claim
-- the same club, and a rejected claimant may resubmit.
CREATE UNIQUE INDEX IF NOT EXISTS club_claim_requests_pending_uniq
  ON public.club_claim_requests (club_id, lower(claimant_email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS club_claim_requests_status_idx
  ON public.club_claim_requests (status, created_at);

ALTER TABLE public.club_claim_requests ENABLE ROW LEVEL SECURITY;

-- Admins read the queue for /admin. Inserts/updates happen ONLY via the
-- service-role edge functions (which bypass RLS) — there is deliberately no
-- anon/authenticated write policy, so the table cannot be written to directly.
CREATE POLICY "Admins can view claim requests"
  ON public.club_claim_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Exact, prod-like grants: only the service role (edge functions) writes/reads
-- for its logic; authenticated admins read via the RLS policy above.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_claim_requests TO service_role;
GRANT SELECT ON public.club_claim_requests TO authenticated;

COMMIT;
