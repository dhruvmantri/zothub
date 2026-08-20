-- ============================================================================
-- purge_test_data.sql — D1: remove test/demo data from PRODUCTION
--
-- ⚠️  THIS DELETES DATA AND CANNOT BE UNDONE. TAKE A DATABASE BACKUP FIRST.
--     Supabase Dashboard → Database → Backups (or a `pg_dump`), and confirm it
--     exists before running STEP 3.
--
-- Run STEP 1 and STEP 2 first and READ the output. Only run STEP 3 once you have
-- confirmed nothing real is attached.
--
-- Targets (identified 2026-08-11 by scripts/verify_prod_state.sql Q5):
--   Test Club            57ea4a11-31c5-460c-bc8d-283403d00637  (5 opps, 6 events,
--                                                               5 applications, 5 RSVPs)
--   Test: Purple Crewmate d689c87c-27b9-41e1-8df3-776794389e23  (empty)
--   Test: Blue Crewmate   56d45091-ef16-45ec-8926-4207fbe4edfe  (empty)
--
-- Why: Test Club's five opportunities ("opp 1/2/3/3/5") are currently the ENTIRE
-- opportunity inventory of the live site — the first thing any real visitor sees.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1 — REVIEW: what exactly is attached, and is any of it real?
-- Read the applicant/attendee emails. If every one is a test account, proceed.
-- If ANY belongs to a real student, stop and decide what to preserve.
-- ----------------------------------------------------------------------------
WITH targets(id) AS (
  VALUES ('57ea4a11-31c5-460c-bc8d-283403d00637'::uuid),
         ('d689c87c-27b9-41e1-8df3-776794389e23'::uuid),
         ('56d45091-ef16-45ec-8926-4207fbe4edfe'::uuid)
)
SELECT 'application' AS kind, o.title AS attached_to, sp.email AS person_email,
       sp.full_name AS person_name, a.created_at
  FROM public.applications a
  JOIN public.opportunities o    ON o.id = a.opportunity_id
  JOIN public.student_profiles sp ON sp.id = a.student_id
 WHERE o.club_id IN (SELECT id FROM targets)
UNION ALL
SELECT 'rsvp', e.title, sp.email, sp.full_name, r.created_at
  FROM public.rsvps r
  JOIN public.events e            ON e.id = r.event_id
  JOIN public.student_profiles sp ON sp.id = r.student_id
 WHERE e.club_id IN (SELECT id FROM targets)
ORDER BY kind, created_at;


-- ----------------------------------------------------------------------------
-- STEP 2 — REVIEW: the club rows themselves + their owning auth accounts.
-- Note each club's `source` / `source_club_id`: the two "Crewmate" rows appear to
-- carry a non-null source, which is why they hide inside the 724 "seeded" count.
-- Record those values — deleting them changes the seeded total to ~722, and the
-- seeder's idempotency key is (source, source_club_id).
-- ----------------------------------------------------------------------------
SELECT cp.id, cp.club_name, cp.email, cp.source, cp.source_club_id, cp.published,
       cp.user_id, au.email AS owner_auth_email, au.created_at AS owner_created_at,
       (SELECT count(*) FROM public.opportunities o WHERE o.club_id = cp.id) AS opportunities,
       (SELECT count(*) FROM public.events e       WHERE e.club_id = cp.id) AS events,
       (SELECT count(*) FROM public.club_team_members m WHERE m.club_id = cp.id) AS team_members
  FROM public.club_profiles cp
  LEFT JOIN auth.users au ON au.id = cp.user_id
 WHERE cp.id IN ('57ea4a11-31c5-460c-bc8d-283403d00637',
                 'd689c87c-27b9-41e1-8df3-776794389e23',
                 '56d45091-ef16-45ec-8926-4207fbe4edfe');


-- ----------------------------------------------------------------------------
-- STEP 3 — DELETE. Backup taken? Steps 1–2 reviewed? Then run this whole block.
--
-- It runs inside a transaction and RAISES if the post-delete state is wrong, so a
-- surprise rolls the whole thing back instead of half-deleting. Deleting the club
-- rows cascades opportunities → applications and events → RSVPs, plus team members.
-- ----------------------------------------------------------------------------
BEGIN;

DELETE FROM public.club_profiles
 WHERE id IN ('57ea4a11-31c5-460c-bc8d-283403d00637',
              'd689c87c-27b9-41e1-8df3-776794389e23',
              '56d45091-ef16-45ec-8926-4207fbe4edfe');

DO $$
DECLARE
  remaining_clubs   int;
  remaining_opps    int;
  remaining_events  int;
BEGIN
  SELECT count(*) INTO remaining_clubs FROM public.club_profiles
   WHERE club_name ILIKE '%test%' OR club_name ILIKE '%crewmate%';
  SELECT count(*) INTO remaining_opps   FROM public.opportunities;
  SELECT count(*) INTO remaining_events FROM public.events;

  RAISE NOTICE 'test-named clubs remaining: %', remaining_clubs;
  RAISE NOTICE 'opportunities remaining: %  |  events remaining: %',
               remaining_opps, remaining_events;

  IF remaining_clubs > 0 THEN
    RAISE EXCEPTION 'Test-named clubs still present (%) — rolling back for review', remaining_clubs;
  END IF;
END $$;

-- Read the NOTICEs above. Expect: 0 test clubs, 0 opportunities, 0 events.
-- If that looks right:
COMMIT;
-- ...otherwise:  ROLLBACK;


-- ----------------------------------------------------------------------------
-- STEP 4 — the orphaned auth accounts.
-- Deleting a club_profiles row does NOT delete the auth user that owned it, nor
-- the test STUDENT accounts that submitted the applications/RSVPs in STEP 1.
-- List them, then remove the ones you recognise as test accounts via
-- Dashboard → Authentication → Users (safer than deleting from auth.users in SQL).
-- Deleting an auth user cascades its roles, waitlist row, profile and bookmarks.
-- Keep the admin account (zothub.uci@gmail.com) — the `roles` column below flags it.
-- ----------------------------------------------------------------------------
SELECT au.id, au.email, au.created_at, au.last_sign_in_at,
       (SELECT string_agg(r.role::text, ',') FROM public.user_roles r WHERE r.user_id = au.id) AS roles,
       EXISTS (SELECT 1 FROM public.club_profiles c    WHERE c.user_id = au.id) AS owns_club,
       EXISTS (SELECT 1 FROM public.student_profiles s WHERE s.user_id = au.id) AS has_student_profile
  FROM auth.users au
 ORDER BY au.created_at;


-- ----------------------------------------------------------------------------
-- STEP 5 — confirm the public site is clean (re-run of the Phase 0 checks).
-- Expect: published_seeded ≈ 722, published_organic 0, opportunities 0, events 0.
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.club_profiles WHERE published AND source = 'zotspot') AS published_seeded,
  (SELECT count(*) FROM public.club_profiles WHERE published AND source IS NULL)     AS published_organic,
  (SELECT count(*) FROM public.opportunities WHERE is_active)                        AS active_opportunities,
  (SELECT count(*) FROM public.events        WHERE is_active)                        AS active_events;
