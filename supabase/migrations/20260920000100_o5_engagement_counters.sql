-- O5-counts — viewer-independent applicant and attendee counts.
--
-- THE BUG. Every card counts an embedded array: `applications (id)` on a role,
-- `rsvps (id)` on an event. Both tables are locked down, and correctly so:
--
--   * anon holds NO grant on applications or rsvps at all (20260712000100), so
--     a logged-out visitor's embed comes back EMPTY. Every card reads
--     "0 applied" and "0 going", however busy the posting actually is.
--   * a signed-in student is limited by RLS (20251224045225) to their own rows,
--     so they see 0 or 1.
--   * only the owning club sees the truth.
--
-- The number is therefore wrong for almost everyone who looks at it, and most
-- wrong for the audience that matters most: someone browsing before they have
-- an account. Showing 0 everywhere makes a busy campus look dead. This is a
-- TRUST fix, not a performance one.
--
-- THE SHAPE. Denormalised counters on the parent rows, maintained by triggers,
-- rather than a SECURITY DEFINER aggregate called per page. Reasons:
--   * the count is then just a column on a row the reader is already fetching —
--     no extra round trip, and it works for anon without loosening anything;
--   * `opportunities.views` already establishes the counter-column pattern here;
--   * the alternative costs a second query on every list page, which would
--     partly undo the UX15 caching work.
--
-- WHAT THE NUMBERS MEAN (maintainer decisions, 2026-09-20 — docs/BACKLOG.md):
--   * events count CONFIRMED RSVPs only. Today the card counts everyone
--     INCLUDING people who cancelled, while the "spots left" figure beside it
--     counts only confirmed — the two numbers on the same card disagree.
--     Confirmed-only makes them agree and matches enforce_rsvp_capacity
--     (20260711000100), which is the authority on who holds a seat.
--   * roles count EVERY application ever submitted, including ones the club
--     rejected. It is the honest measure of competition, which is what a
--     student is judging, and it never goes down.
--
-- NOT A PRIVACY BOUNDARY. `opportunities.show_application_count` lets a club
-- hide the number; the app honours that, but the column below is granted to
-- anon, so a determined reader could still fetch it. Accepted deliberately: it
-- is an aggregate about a club's own posting, no student is identifiable from
-- it, and the switch reads as a display preference. If that ever has to become
-- a real guarantee, the fix is a SECURITY DEFINER reader — not a policy tweak.

-- 1. The columns ---------------------------------------------------------------
-- NOT NULL DEFAULT 0 so every existing row starts at a defined value and the
-- frontend never has to handle null; the backfill in step 4 then corrects them.

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS applications_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS confirmed_rsvps_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.opportunities.applications_count IS
  'Every application ever submitted to this role, including rejected ones. Maintained by sync_opportunity_applications_count; never written by a client.';

COMMENT ON COLUMN public.events.confirmed_rsvps_count IS
  'RSVPs with status = confirmed. Pending and cancelled are excluded, matching enforce_rsvp_capacity. Maintained by sync_event_confirmed_rsvps_count; never written by a client.';

-- 2. Applications counter ------------------------------------------------------
-- SECURITY DEFINER because the writer is a STUDENT: they may insert their own
-- application, but they hold no UPDATE on opportunities. Without it every
-- application insert would fail on the counter update.

CREATE OR REPLACE FUNCTION public.sync_opportunity_applications_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE opportunities
       SET applications_count = applications_count + 1
     WHERE id = NEW.opportunity_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- GREATEST guards against a counter that has somehow drifted below the
    -- number of rows: a negative count on a card would be worse than a stale one.
    UPDATE opportunities
       SET applications_count = GREATEST(0, applications_count - 1)
     WHERE id = OLD.opportunity_id;
    RETURN OLD;
  END IF;

  -- UPDATE. Status changes are irrelevant — every application counts, whatever
  -- the club decided. Only a move between roles changes anything.
  IF NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id THEN
    UPDATE opportunities
       SET applications_count = GREATEST(0, applications_count - 1)
     WHERE id = OLD.opportunity_id;
    UPDATE opportunities
       SET applications_count = applications_count + 1
     WHERE id = NEW.opportunity_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_opportunity_applications_count_trigger ON public.applications;
CREATE TRIGGER sync_opportunity_applications_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_opportunity_applications_count();

-- 3. Confirmed-RSVP counter ----------------------------------------------------
-- Same SECURITY DEFINER reasoning: the student writing the rsvp row holds no
-- UPDATE on events.
--
-- This one is status-sensitive, so every transition has to be handled — an RSVP
-- can be confirmed, cancelled, re-confirmed (the app upserts rather than
-- deleting), and could in principle move between events.

CREATE OR REPLACE FUNCTION public.sync_event_confirmed_rsvps_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_counted boolean := false;
  is_counted  boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    was_counted := (OLD.status = 'confirmed');
  END IF;
  IF TG_OP <> 'DELETE' THEN
    is_counted := (NEW.status = 'confirmed');
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF is_counted THEN
      UPDATE events SET confirmed_rsvps_count = confirmed_rsvps_count + 1
       WHERE id = NEW.event_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF was_counted THEN
      UPDATE events SET confirmed_rsvps_count = GREATEST(0, confirmed_rsvps_count - 1)
       WHERE id = OLD.event_id;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE. Handle the event moving and the status changing independently,
  -- because both can happen in one statement.
  IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    IF was_counted THEN
      UPDATE events SET confirmed_rsvps_count = GREATEST(0, confirmed_rsvps_count - 1)
       WHERE id = OLD.event_id;
    END IF;
    IF is_counted THEN
      UPDATE events SET confirmed_rsvps_count = confirmed_rsvps_count + 1
       WHERE id = NEW.event_id;
    END IF;
  ELSIF was_counted AND NOT is_counted THEN
    UPDATE events SET confirmed_rsvps_count = GREATEST(0, confirmed_rsvps_count - 1)
     WHERE id = NEW.event_id;
  ELSIF is_counted AND NOT was_counted THEN
    UPDATE events SET confirmed_rsvps_count = confirmed_rsvps_count + 1
     WHERE id = NEW.event_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_event_confirmed_rsvps_count_trigger ON public.rsvps;
CREATE TRIGGER sync_event_confirmed_rsvps_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.rsvps
FOR EACH ROW
EXECUTE FUNCTION public.sync_event_confirmed_rsvps_count();

-- 4. Reconcile, and the backfill -----------------------------------------------
-- Kept as a callable function rather than a one-off statement so drift can be
-- repaired later without writing another migration. A counter maintained by a
-- trigger can only drift through something that bypasses the trigger (a bulk
-- load, a restore), and when that happens the repair should not need a deploy.

CREATE OR REPLACE FUNCTION public.recount_engagement_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE opportunities o
     SET applications_count = COALESCE(c.n, 0)
    FROM (
      SELECT opportunity_id, count(*)::int AS n
        FROM applications
       GROUP BY opportunity_id
    ) c
   WHERE o.id = c.opportunity_id
     AND o.applications_count IS DISTINCT FROM COALESCE(c.n, 0);

  -- Roles with no applications at all are absent from the subquery above, so
  -- they are zeroed separately rather than left at whatever they held.
  UPDATE opportunities o
     SET applications_count = 0
   WHERE o.applications_count <> 0
     AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.opportunity_id = o.id);

  UPDATE events e
     SET confirmed_rsvps_count = COALESCE(c.n, 0)
    FROM (
      SELECT event_id, count(*)::int AS n
        FROM rsvps
       WHERE status = 'confirmed'
       GROUP BY event_id
    ) c
   WHERE e.id = c.event_id
     AND e.confirmed_rsvps_count IS DISTINCT FROM COALESCE(c.n, 0);

  UPDATE events e
     SET confirmed_rsvps_count = 0
   WHERE e.confirmed_rsvps_count <> 0
     AND NOT EXISTS (
       SELECT 1 FROM rsvps r WHERE r.event_id = e.id AND r.status = 'confirmed'
     );
END;
$$;

-- Nobody should be able to trigger a full recount from the browser.
REVOKE ALL ON FUNCTION public.recount_engagement_counters() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recount_engagement_counters() TO service_role;

-- The backfill itself.
SELECT public.recount_engagement_counters();

-- 5. Grants --------------------------------------------------------------------
-- THE STEP THIS MIGRATION MOST EASILY SHIPS WITHOUT.
--
-- anon's grants on these two tables are COLUMN-LEVEL (20260712000100 revoked the
-- table grant and re-granted an allowlist), and that migration's closing note
-- says so explicitly: any new column must be granted to anon or it stays
-- invisible. Without these two lines the whole fix would silently do nothing for
-- logged-out visitors — the exact audience it exists for — while looking
-- perfectly correct to a signed-in developer testing it.
--
-- `authenticated` keeps its table-level SELECT (only anon was revoked), so it
-- picks up the new columns without a grant here.

GRANT SELECT (applications_count) ON public.opportunities TO anon;
GRANT SELECT (confirmed_rsvps_count) ON public.events TO anon;

-- 6. Writes stay closed --------------------------------------------------------
-- Neither counter is ever written by a client: the triggers own them.
--
-- Be precise about WHAT closes them, because it is not the grants. Supabase's
-- default `GRANT ALL ON ALL TABLES` leaves anon holding INSERT/UPDATE/DELETE on
-- opportunities and events (20260712000100 revoked only SELECT, then re-granted
-- it per column) — and a new column inherits those write grants automatically.
-- **RLS is the gate**, not the privilege bits.
--
-- Verified on a throwaway database rather than assumed (scripts/test_o5_counters.sql):
-- as anon, `UPDATE opportunities SET applications_count = 999` affects 0 rows,
-- the same on events, and INSERTs into rsvps / applications / opportunities are
-- all refused with "new row violates row-level security policy". A grant-bit
-- assertion would have reported the opposite and been useless — so the test
-- attempts the operation instead of inspecting the catalogue.
--
-- A club CAN update its own rows, so a club could in principle write its own
-- counter through the API — harmless (it only lies about itself) and repaired by
-- the next application or RSVP, or by recount_engagement_counters().
