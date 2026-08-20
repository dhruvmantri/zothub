-- ============================================================================
-- verify_prod_state.sql — READ-ONLY production verification (Phase 0)
--
-- Every statement is a SELECT. Nothing is inserted, updated, deleted, or altered.
-- Safe to run against production in the Supabase SQL Editor.
--
-- Run each query separately and review its output. Companion to
-- scripts/audit_admin_roles.sql (the S2 admin audit, run that too).
--
-- Context: migrations 20260727000200/00300/00400/00500 were pushed on 2026-07-27
-- together with the club-claim flow. Migration ...000400 BACKFILLED
-- club_profiles.published = false for organic clubs whose waitlist row is
-- pending/rejected. Q1/Q2 confirm that backfill hit only what it should.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Q1 — BACKFILL SANITY (most important)
-- Every organic club that is currently HIDDEN, with the waitlist status that
-- justifies it. EXPECTED: every row reads 'pending' or 'rejected'.
-- ⚠️ Any row where waitlist_status is 'approved' or NULL is a club that was
--    wrongly hidden from the public site and must be re-published.
-- ----------------------------------------------------------------------------
SELECT
  cp.id,
  cp.club_name,
  cp.email,
  cp.created_at,
  w.status                AS waitlist_status,
  CASE
    WHEN w.status IN ('pending', 'rejected') THEN 'OK — correctly hidden'
    WHEN w.status = 'approved'               THEN '*** WRONGLY HIDDEN — republish ***'
    WHEN w.status IS NULL                    THEN '*** NO WAITLIST ROW — investigate ***'
    ELSE '*** UNEXPECTED STATUS ***'
  END                     AS verdict
FROM public.club_profiles cp
LEFT JOIN public.waitlist w
  ON w.user_id = cp.user_id AND w.role = 'club'
WHERE cp.source IS NULL
  AND cp.published = false
ORDER BY verdict, cp.created_at;


-- ----------------------------------------------------------------------------
-- Q2 — VISIBILITY TOTALS
-- Cross-check against what the public site currently shows.
-- Verified from the anon side on 2026-07-27: 725 published (724 zotspot + 1 organic).
-- ----------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE published)                             AS published_total,
  count(*) FILTER (WHERE published AND source = 'zotspot')      AS published_seeded,
  count(*) FILTER (WHERE published AND source IS NULL)          AS published_organic,
  count(*) FILTER (WHERE NOT published AND source IS NULL)      AS hidden_organic,
  count(*) FILTER (WHERE NOT published AND source = 'zotspot')  AS hidden_seeded,
  count(*)                                                      AS all_clubs
FROM public.club_profiles;


-- ----------------------------------------------------------------------------
-- Q3 — MB1: does the duplicate-application guard exist in PROD?
-- UNIQUE (opportunity_id, student_id) is declared inline in migration
-- 20251223013805 and never dropped, but constraints were lost during the Lovable
-- pg_restore before (see plan.md). EXPECTED: one 'u' row on applications.
-- If MISSING: dedupe first (Q3b), then re-add the constraint.
-- ----------------------------------------------------------------------------
SELECT conrelid::regclass AS table_name, conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('public.applications'::regclass, 'public.rsvps'::regclass)
  AND contype = 'u'
ORDER BY table_name;

-- Q3b — actual duplicates present right now (run regardless; should return 0 rows)
SELECT opportunity_id, student_id, count(*) AS copies
FROM public.applications
GROUP BY opportunity_id, student_id
HAVING count(*) > 1
ORDER BY copies DESC;


-- ----------------------------------------------------------------------------
-- Q4 — CRON INVENTORY
-- Needed before versioning the reminder schedule in a migration: we must replace
-- the existing manually-created job, not add a second one that double-emails.
-- EXPECTED: an hourly send-reminders job + the committed daily archive job.
-- ----------------------------------------------------------------------------
SELECT jobid, jobname, schedule, active, command
FROM cron.job
ORDER BY jobname;


-- ----------------------------------------------------------------------------
-- Q5 — D1: the Test Club junk that is LIVE on the public site
-- Confirmed from the anon side: "Test Club" is the only public organic club and
-- it owns 5 opportunities titled "opp 1/2/3/3/5" (note "opp 3" twice).
-- This lists everything attached, so nothing real is destroyed by the purge.
-- ⚠️ REVIEW BEFORE DELETING ANYTHING — this query only reads.
-- ----------------------------------------------------------------------------
SELECT
  cp.id            AS club_id,
  cp.club_name,
  (SELECT count(*) FROM public.opportunities o WHERE o.club_id = cp.id)                       AS opportunities,
  (SELECT count(*) FROM public.events e        WHERE e.club_id = cp.id)                       AS events,
  (SELECT count(*) FROM public.applications a
     JOIN public.opportunities o ON o.id = a.opportunity_id WHERE o.club_id = cp.id)          AS applications_attached,
  (SELECT count(*) FROM public.rsvps r
     JOIN public.events e ON e.id = r.event_id WHERE e.club_id = cp.id)                       AS rsvps_attached,
  (SELECT count(*) FROM public.club_team_members m WHERE m.club_id = cp.id)                   AS team_members
FROM public.club_profiles cp
WHERE cp.club_name ILIKE '%test%'
   OR cp.id = '57ea4a11-31c5-460c-bc8d-283403d00637';


-- ----------------------------------------------------------------------------
-- Q6 — MB5 remainder: logo coverage
-- Anon side shows 725/725 clubs rendering initials (logo_url IS NULL).
-- This confirms how many originals are preserved and re-hostable.
-- ----------------------------------------------------------------------------
SELECT
  count(*)                                                        AS clubs,
  count(*) FILTER (WHERE logo_url IS NOT NULL)                    AS have_hosted_logo,
  count(*) FILTER (WHERE logo_url IS NULL
                     AND source_logo_url IS NOT NULL)             AS rehostable_original,
  count(*) FILTER (WHERE logo_url IS NULL
                     AND source_logo_url IS NULL)                 AS no_logo_at_all
FROM public.club_profiles;
