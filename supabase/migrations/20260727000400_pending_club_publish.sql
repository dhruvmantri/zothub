-- Pending club signups must be INVISIBLE until an admin approves them.
--
-- ⚠️ NOT APPLIED AUTOMATICALLY. Review + back up before `supabase db push`.
--
-- A normal club signup (verify-otp, or the Google OAuth path) creates a
-- club_profiles row. Those rows are now written with published = FALSE (see
-- verify-otp / AuthContext), so the public directory (get_all_clubs_public, which
-- filters WHERE published) and the public profile RLS (USING (published)) both
-- exclude them. This trigger is what FLIPS them to published = TRUE — and ONLY on
-- admin approval, i.e. when the club's waitlist row transitions to 'approved'. The
-- club owner can still see/edit their own unpublished row via the owner RLS policy.
--
-- (Seeded ZotSpot clubs are published = TRUE already and are claimed by binding an
-- existing published row, so the claim flow is unaffected by this trigger.)

BEGIN;

CREATE OR REPLACE FUNCTION public.publish_club_on_waitlist_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'club'
     AND NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM 'approved')
  THEN
    UPDATE public.club_profiles
       SET published = true
     WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publish_club_on_waitlist_approval_trg ON public.waitlist;
CREATE TRIGGER publish_club_on_waitlist_approval_trg
AFTER UPDATE ON public.waitlist
FOR EACH ROW
EXECUTE FUNCTION public.publish_club_on_waitlist_approval();

-- BACKFILL: existing club signups that were created BEFORE this change were written
-- published = true (the column default), so clubs still awaiting review — or already
-- rejected — are publicly visible today. Hide them, matching the new rule.
--
-- Scope is deliberately narrow, and each condition matters:
--   * cp.source IS NULL         → ORGANIC clubs only. ZotSpot-seeded listings
--                                 (source = 'zotspot') are public directory data and
--                                 MUST stay published (they are also what the claim
--                                 flow requires), so they are never touched.
--   * waitlist status in        → only clubs whose own waitlist row says they are
--     ('pending','rejected')      still unreviewed or were declined. APPROVED clubs
--                                 keep published = true.
--   * EXISTS (...)              → a club with NO waitlist row at all (legacy or
--                                 admin-created) is left alone rather than hidden.
--   * cp.published              → only flip rows that are currently true, so the
--                                 statement is idempotent and touches nothing on re-run.
UPDATE public.club_profiles cp
   SET published = false
 WHERE cp.source IS NULL
   AND cp.published
   AND cp.user_id IS NOT NULL
   AND EXISTS (
     SELECT 1
       FROM public.waitlist w
      WHERE w.user_id = cp.user_id
        AND w.role = 'club'
        AND w.status IN ('pending', 'rejected')
   );

COMMIT;
