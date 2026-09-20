-- Proof for 20260920000100_o5_engagement_counters.sql.
--
-- Run against a THROWAWAY local database only:
--   npx supabase db reset
--   docker exec -i supabase_db_<ref> psql -U postgres -d postgres < scripts/test_o5_counters.sql
--
-- Prints PASS/FAIL per assertion and RAISEs at the end if any failed, so a
-- partial pass cannot be mistaken for a green run.

\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE TEMP TABLE _results (name text, ok boolean, detail text);

CREATE OR REPLACE FUNCTION pg_temp.check_eq(p_name text, p_got anyelement, p_want anyelement)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO _results
  VALUES (p_name, p_got IS NOT DISTINCT FROM p_want,
          format('got %s, want %s', p_got, p_want));
END;
$$;

-- No explicit transaction: psql autocommits each statement. Wrapping the run
-- and rolling back would discard the results table along with everything else,
-- and the script already requires a throwaway database that `db reset` rebuilds.

-- ---------------------------------------------------------------- fixtures
INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES ('00000000-0000-0000-0000-0000000000c1'::uuid, 'club@uci.edu',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT DO NOTHING;

INSERT INTO auth.users (id, email, instance_id, aud, role)
SELECT ('00000000-0000-0000-0000-00000000' || lpad(g::text, 4, '0'))::uuid,
       'student' || g || '@uci.edu',
       '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
FROM generate_series(1, 5) g
ON CONFLICT DO NOTHING;

INSERT INTO public.club_profiles (id, user_id, email, club_name)
VALUES ('11111111-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-0000000000c1', 'club@uci.edu', 'Test Club');

INSERT INTO public.student_profiles (id, user_id, email, full_name)
SELECT ('22222222-2222-2222-2222-22222222000' || g)::uuid,
       ('00000000-0000-0000-0000-00000000' || lpad(g::text, 4, '0'))::uuid,
       'student' || g || '@uci.edu', 'Student ' || g
FROM generate_series(1, 5) g;

INSERT INTO public.opportunities (id, club_id, title, type, is_active)
VALUES ('33333333-3333-3333-3333-333333333331',
        '11111111-1111-1111-1111-111111111111', 'Role A', 'leadership', true),
       ('33333333-3333-3333-3333-333333333332',
        '11111111-1111-1111-1111-111111111111', 'Role B', 'volunteer', true);

INSERT INTO public.events (id, club_id, title, event_date, capacity, is_active)
VALUES ('44444444-4444-4444-4444-444444444441',
        '11111111-1111-1111-1111-111111111111', 'Event A', now() + interval '7 days', 3, true),
       ('44444444-4444-4444-4444-444444444442',
        '11111111-1111-1111-1111-111111111111', 'Event B', now() + interval '8 days', NULL, true);

SELECT pg_temp.check_eq('a new role starts at zero',
  (SELECT applications_count FROM opportunities WHERE id = '33333333-3333-3333-3333-333333333331'), 0);
SELECT pg_temp.check_eq('a new event starts at zero',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 0);

-- ------------------------------------------------------------ applications
INSERT INTO public.applications (opportunity_id, student_id, status)
SELECT '33333333-3333-3333-3333-333333333331',
       ('22222222-2222-2222-2222-22222222000' || g)::uuid, 'pending'
FROM generate_series(1, 3) g;

SELECT pg_temp.check_eq('three applications count as three',
  (SELECT applications_count FROM opportunities WHERE id = '33333333-3333-3333-3333-333333333331'), 3);

-- The maintainer's decision: a rejected application still counts.
UPDATE public.applications SET status = 'rejected'
 WHERE opportunity_id = '33333333-3333-3333-3333-333333333331'
   AND student_id = '22222222-2222-2222-2222-222222220001';

SELECT pg_temp.check_eq('rejecting one does NOT lower the count',
  (SELECT applications_count FROM opportunities WHERE id = '33333333-3333-3333-3333-333333333331'), 3);

UPDATE public.applications SET status = 'accepted'
 WHERE opportunity_id = '33333333-3333-3333-3333-333333333331'
   AND student_id = '22222222-2222-2222-2222-222222220002';
SELECT pg_temp.check_eq('accepting one does not change it either',
  (SELECT applications_count FROM opportunities WHERE id = '33333333-3333-3333-3333-333333333331'), 3);

-- Moving an application between roles must move the count with it.
UPDATE public.applications SET opportunity_id = '33333333-3333-3333-3333-333333333332'
 WHERE opportunity_id = '33333333-3333-3333-3333-333333333331'
   AND student_id = '22222222-2222-2222-2222-222222220003';

SELECT pg_temp.check_eq('moving an application decrements the old role',
  (SELECT applications_count FROM opportunities WHERE id = '33333333-3333-3333-3333-333333333331'), 2);
SELECT pg_temp.check_eq('moving an application increments the new role',
  (SELECT applications_count FROM opportunities WHERE id = '33333333-3333-3333-3333-333333333332'), 1);

DELETE FROM public.applications
 WHERE opportunity_id = '33333333-3333-3333-3333-333333333331'
   AND student_id = '22222222-2222-2222-2222-222222220001';
SELECT pg_temp.check_eq('deleting an application decrements',
  (SELECT applications_count FROM opportunities WHERE id = '33333333-3333-3333-3333-333333333331'), 1);

-- ------------------------------------------------------------------- rsvps
INSERT INTO public.rsvps (event_id, student_id, status)
VALUES ('44444444-4444-4444-4444-444444444441', '22222222-2222-2222-2222-222222220001', 'confirmed');
SELECT pg_temp.check_eq('a confirmed RSVP counts',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 1);

INSERT INTO public.rsvps (event_id, student_id, status)
VALUES ('44444444-4444-4444-4444-444444444441', '22222222-2222-2222-2222-222222220002', 'pending');
SELECT pg_temp.check_eq('a PENDING RSVP does not count',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 1);

-- The club approves it.
UPDATE public.rsvps SET status = 'confirmed'
 WHERE event_id = '44444444-4444-4444-4444-444444444441'
   AND student_id = '22222222-2222-2222-2222-222222220002';
SELECT pg_temp.check_eq('approving a pending RSVP increments',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 2);

-- The student cancels. The row survives (the app upserts rather than deleting).
UPDATE public.rsvps SET status = 'cancelled'
 WHERE event_id = '44444444-4444-4444-4444-444444444441'
   AND student_id = '22222222-2222-2222-2222-222222220001';
SELECT pg_temp.check_eq('cancelling decrements',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 1);

-- Re-RSVP: the real app upserts onto the cancelled row.
UPDATE public.rsvps SET status = 'confirmed'
 WHERE event_id = '44444444-4444-4444-4444-444444444441'
   AND student_id = '22222222-2222-2222-2222-222222220001';
SELECT pg_temp.check_eq('re-RSVPing on a cancelled row increments again',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 2);

-- A no-op update (the app writes `answers` without touching status).
UPDATE public.rsvps SET answers = '[{"question_id":"q","question":"q","answer":"a"}]'::jsonb
 WHERE event_id = '44444444-4444-4444-4444-444444444441'
   AND student_id = '22222222-2222-2222-2222-222222220001';
SELECT pg_temp.check_eq('updating answers does not double-count',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 2);

-- Moving a confirmed RSVP between events.
UPDATE public.rsvps SET event_id = '44444444-4444-4444-4444-444444444442'
 WHERE event_id = '44444444-4444-4444-4444-444444444441'
   AND student_id = '22222222-2222-2222-2222-222222220002';
SELECT pg_temp.check_eq('moving a confirmed RSVP decrements the old event',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 1);
SELECT pg_temp.check_eq('moving a confirmed RSVP increments the new event',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444442'), 1);

DELETE FROM public.rsvps
 WHERE event_id = '44444444-4444-4444-4444-444444444442'
   AND student_id = '22222222-2222-2222-2222-222222220002';
SELECT pg_temp.check_eq('deleting a confirmed RSVP decrements',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444442'), 0);

-- ------------------------------ the counter must agree with the capacity trigger
-- Event A has capacity 3 and 1 confirmed. Fill it, then prove the 4th is refused
-- AND that the refusal left the counter untouched.
INSERT INTO public.rsvps (event_id, student_id, status) VALUES
  ('44444444-4444-4444-4444-444444444441', '22222222-2222-2222-2222-222222220003', 'confirmed'),
  ('44444444-4444-4444-4444-444444444441', '22222222-2222-2222-2222-222222220004', 'confirmed');
SELECT pg_temp.check_eq('the event is now at capacity',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 3);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.rsvps (event_id, student_id, status)
    VALUES ('44444444-4444-4444-4444-444444444441', '22222222-2222-2222-2222-222222220005', 'confirmed');
    INSERT INTO _results VALUES ('a 4th RSVP past capacity is refused', false, 'it was ACCEPTED');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO _results VALUES ('a 4th RSVP past capacity is refused', true, 'rejected as expected');
  END;
END $$;

SELECT pg_temp.check_eq('a refused RSVP leaves the counter alone',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 3);

-- ------------------------------------------------------- the counter is truthful
SELECT pg_temp.check_eq('the role counter matches a live count',
  (SELECT applications_count FROM opportunities WHERE id = '33333333-3333-3333-3333-333333333331'),
  (SELECT count(*)::int FROM applications WHERE opportunity_id = '33333333-3333-3333-3333-333333333331'));
SELECT pg_temp.check_eq('the event counter matches a live count',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'),
  (SELECT count(*)::int FROM rsvps
    WHERE event_id = '44444444-4444-4444-4444-444444444441' AND status = 'confirmed'));

-- ------------------------------------------------------------- drift repair
UPDATE public.opportunities SET applications_count = 999
 WHERE id = '33333333-3333-3333-3333-333333333331';
UPDATE public.events SET confirmed_rsvps_count = 999
 WHERE id = '44444444-4444-4444-4444-444444444441';
SELECT public.recount_engagement_counters();

SELECT pg_temp.check_eq('recount repairs a drifted role counter',
  (SELECT applications_count FROM opportunities WHERE id = '33333333-3333-3333-3333-333333333331'), 1);
SELECT pg_temp.check_eq('recount repairs a drifted event counter',
  (SELECT confirmed_rsvps_count FROM events WHERE id = '44444444-4444-4444-4444-444444444441'), 3);

-- A role that never had applications must be zeroed, not left drifted.
UPDATE public.opportunities SET applications_count = 42
 WHERE id = '33333333-3333-3333-3333-333333333332';
DELETE FROM public.applications WHERE opportunity_id = '33333333-3333-3333-3333-333333333332';
UPDATE public.opportunities SET applications_count = 42
 WHERE id = '33333333-3333-3333-3333-333333333332';
SELECT public.recount_engagement_counters();
SELECT pg_temp.check_eq('recount zeroes a role with no applications at all',
  (SELECT applications_count FROM opportunities WHERE id = '33333333-3333-3333-3333-333333333332'), 0);

-- ------------------------------------------------------------------- grants
-- The step this migration would most easily ship without.
SELECT pg_temp.check_eq('anon may read applications_count',
  has_column_privilege('anon', 'public.opportunities', 'applications_count', 'SELECT'), true);
SELECT pg_temp.check_eq('anon may read confirmed_rsvps_count',
  has_column_privilege('anon', 'public.events', 'confirmed_rsvps_count', 'SELECT'), true);
-- EFFECTIVE access, not grant bits.
--
-- Supabase's default GRANT ALL leaves anon holding SELECT/INSERT/UPDATE/DELETE
-- on these tables at the privilege level, and a new column inherits the write
-- grants automatically. RLS is what actually closes them. Asking the catalogue
-- (has_table_privilege / has_column_privilege) therefore answers a question
-- nobody cares about and reports "wide open" for a table that is firmly shut —
-- the first version of this script did exactly that and produced three
-- frightening, meaningless failures. These attempt the operation instead.
--
-- Each block resets the role BEFORE recording its result: the results table is
-- owned by postgres, and anon cannot write to it.

DO $$
DECLARE
  v_apps int; v_rsvps int; v_opps int; v_events int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_apps   FROM public.applications;
  SELECT count(*) INTO v_rsvps  FROM public.rsvps;
  SELECT count(*) INTO v_opps   FROM public.opportunities WHERE applications_count >= 0;
  SELECT count(*) INTO v_events FROM public.events WHERE confirmed_rsvps_count >= 0;
  RESET ROLE;

  INSERT INTO _results VALUES
    ('anon reads NO application rows (RLS, not grants)', v_apps = 0, format('saw %s', v_apps)),
    ('anon reads NO rsvp rows (RLS, not grants)', v_rsvps = 0, format('saw %s', v_rsvps)),
    ('anon CAN read the new role counter — the point of this migration', v_opps = 2, format('saw %s roles', v_opps)),
    ('anon CAN read the new event counter', v_events = 2, format('saw %s events', v_events));
END $$;

DO $$
DECLARE n_opp int; n_evt int;
BEGIN
  SET LOCAL ROLE anon;
  UPDATE public.opportunities SET applications_count = 999;
  GET DIAGNOSTICS n_opp = ROW_COUNT;
  UPDATE public.events SET confirmed_rsvps_count = 999;
  GET DIAGNOSTICS n_evt = ROW_COUNT;
  RESET ROLE;

  INSERT INTO _results VALUES
    ('anon cannot WRITE the role counter', n_opp = 0, format('%s rows changed', n_opp)),
    ('anon cannot WRITE the event counter', n_evt = 0, format('%s rows changed', n_evt));
EXCEPTION WHEN insufficient_privilege THEN
  RESET ROLE;
  INSERT INTO _results VALUES ('anon cannot WRITE the counters', true, 'refused at the grant level');
END $$;

DO $$
DECLARE v_msg text;
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    INSERT INTO public.applications (opportunity_id, student_id, status)
    VALUES ('33333333-3333-3333-3333-333333333332','22222222-2222-2222-2222-222222220005','pending');
    v_msg := NULL;
  EXCEPTION WHEN others THEN
    v_msg := SQLERRM;
  END;
  RESET ROLE;
  INSERT INTO _results VALUES
    ('anon cannot forge an application', v_msg IS NOT NULL, COALESCE(v_msg, 'IT WAS ACCEPTED'));
END $$;

SELECT pg_temp.check_eq('anon may not run a full recount',
  has_function_privilege('anon', 'public.recount_engagement_counters()', 'EXECUTE'), false);
SELECT pg_temp.check_eq('authenticated may not run a full recount',
  has_function_privilege('authenticated', 'public.recount_engagement_counters()', 'EXECUTE'), false);
SELECT pg_temp.check_eq('service_role may run a full recount',
  has_function_privilege('service_role', 'public.recount_engagement_counters()', 'EXECUTE'), true);


-- ------------------------------------------------------------------- report
SELECT CASE WHEN ok THEN 'PASS  ' ELSE 'FAIL  ' END || name ||
       CASE WHEN ok THEN '' ELSE '  — ' || detail END AS result
FROM _results;

SELECT format('EXECUTED %s checks — %s passed, %s failed',
              count(*), count(*) FILTER (WHERE ok), count(*) FILTER (WHERE NOT ok)) AS summary
FROM _results;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _results WHERE NOT ok;
  IF n > 0 THEN
    RAISE EXCEPTION '% counter assertion(s) FAILED', n;
  END IF;
END $$;
