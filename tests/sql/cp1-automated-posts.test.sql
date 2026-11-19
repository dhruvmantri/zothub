-- CP1 migration checks (20261119000100_cp1_automated_posts.sql).
--
-- LOCAL DATABASE ONLY. Runs inside one transaction that is rolled back, so it leaves
-- nothing behind. Any failed check raises and stops the run (ON_ERROR_STOP).
--
--   psql -v ON_ERROR_STOP=1 postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--        -f tests/sql/cp1-automated-posts.test.sql
--
-- Prints "CP1 SQL: ALL n CHECKS PASSED" at the end; anything else is a failure.

\set QUIET on
BEGIN;

CREATE TEMP TABLE _t (k text PRIMARY KEY, v uuid);
CREATE TEMP TABLE _passed (n int);
INSERT INTO _passed VALUES (0);
GRANT ALL ON _t, _passed TO authenticated, anon, service_role;

CREATE FUNCTION pg_temp.ok(cond boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: %', label;
  END IF;
  UPDATE _passed SET n = n + 1;
  RAISE NOTICE 'ok  %', label;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text) TO authenticated, anon, service_role;

-- ---- fixtures (as the database owner) ---------------------------------------------
INSERT INTO _t VALUES ('club_user', gen_random_uuid()), ('student_user', gen_random_uuid()),
                      ('club', gen_random_uuid()), ('student', gen_random_uuid());

INSERT INTO auth.users (id, email, instance_id, aud, role)
SELECT v, k || '-cp1test@uci.edu', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
FROM _t WHERE k IN ('club_user', 'student_user');

INSERT INTO public.club_profiles (id, user_id, club_name, published)
VALUES ((SELECT v FROM _t WHERE k='club'), (SELECT v FROM _t WHERE k='club_user'), 'CP1 Test Club', true);

-- The student follows the club (a follow is a bookmark with club_id).
INSERT INTO public.bookmarks (user_id, club_id)
VALUES ((SELECT v FROM _t WHERE k='student_user'), (SELECT v FROM _t WHERE k='club'));

CREATE FUNCTION pg_temp.notes() RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.notifications
  WHERE user_id = (SELECT v FROM _t WHERE k='student_user') AND type = 'new_post'
$$;

-- ---- 1. A club can't forge provenance or the announce time ------------------------
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT v FROM _t WHERE k='club_user'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

INSERT INTO public.events (club_id, title, event_date, is_active, source, source_key, source_url, announced_at, club_edited_at)
VALUES ((SELECT v FROM _t WHERE k='club'), 'Club live event', now() + interval '3 days', true,
        'automation', 'forged-key', 'https://example.com/x', '2000-01-01', '2000-01-01')
RETURNING id AS live_id \gset

RESET ROLE;
SELECT pg_temp.ok(source = 'club' AND source_key IS NULL AND source_url IS NULL AND club_edited_at IS NULL,
                  'club insert: provenance forced to defaults')
FROM public.events WHERE id = :'live_id';
SELECT pg_temp.ok(announced_at > now() - interval '1 minute', 'club insert: announced_at is now, not the forged date')
FROM public.events WHERE id = :'live_id';
SELECT pg_temp.ok(pg_temp.notes() = 1, 'publishing on insert notifies the follower once');

-- ---- 2. A saved draft does NOT notify (CP1-a) -------------------------------------
SET LOCAL ROLE authenticated;
INSERT INTO public.events (club_id, title, event_date, is_active)
VALUES ((SELECT v FROM _t WHERE k='club'), 'Club draft', now() + interval '4 days', false)
RETURNING id AS draft_id \gset
RESET ROLE;
SELECT pg_temp.ok(pg_temp.notes() = 1, 'saving a draft sends no notification');
SELECT pg_temp.ok(announced_at IS NULL, 'a draft is not announced') FROM public.events WHERE id = :'draft_id';

-- ---- 3. Publishing the draft notifies once; re-publishing never again --------------
SET LOCAL ROLE authenticated;
UPDATE public.events SET is_active = true WHERE id = :'draft_id';
RESET ROLE;
SELECT pg_temp.ok(pg_temp.notes() = 2, 'publishing a draft notifies the follower');
SELECT pg_temp.ok(announced_at IS NOT NULL, 'published draft is announced') FROM public.events WHERE id = :'draft_id';

SET LOCAL ROLE authenticated;
UPDATE public.events SET is_active = false WHERE id = :'draft_id';
UPDATE public.events SET is_active = true  WHERE id = :'draft_id';
RESET ROLE;
SELECT pg_temp.ok(pg_temp.notes() = 2, 'unpublish + republish does not notify again');

-- ---- 4. The automation (service role) can set provenance --------------------------
SET LOCAL ROLE service_role;
INSERT INTO public.events (club_id, title, event_date, is_active, source, source_key, source_url, external_url)
VALUES ((SELECT v FROM _t WHERE k='club'), 'Automated event', now() + interval '5 days', true,
        'automation', 'sheet-row-1', 'https://www.instagram.com/p/abc/', 'https://forms.gle/abc')
RETURNING id AS auto_id \gset
RESET ROLE;
SELECT pg_temp.ok(source = 'automation' AND source_key = 'sheet-row-1' AND club_edited_at IS NULL,
                  'automation insert keeps its provenance')
FROM public.events WHERE id = :'auto_id';
SELECT pg_temp.ok(pg_temp.notes() = 3, 'an automated post notifies followers like any other');

SET LOCAL ROLE service_role;
UPDATE public.events SET title = 'Automated event (updated)' WHERE id = :'auto_id';
RESET ROLE;
SELECT pg_temp.ok(club_edited_at IS NULL, 'an automation update is not a club edit')
FROM public.events WHERE id = :'auto_id';

-- ---- 5. Counters, views and the archive job are not club edits ----------------------
UPDATE public.events SET views = COALESCE(views, 0) + 1 WHERE id = :'auto_id';  -- as owner, like the view RPC
SELECT pg_temp.ok(club_edited_at IS NULL, 'a page-view count is not a club edit')
FROM public.events WHERE id = :'auto_id';

-- ---- 6. A club's edit of an automated post is recorded; provenance survives ----------
SET LOCAL ROLE authenticated;
UPDATE public.events SET location = 'Student Center', source = 'club', source_key = 'stolen'
WHERE id = :'auto_id';
RESET ROLE;
SELECT pg_temp.ok(club_edited_at IS NOT NULL, 'a club content edit sets club_edited_at')
FROM public.events WHERE id = :'auto_id';
SELECT pg_temp.ok(source = 'automation' AND source_key = 'sheet-row-1', 'a club cannot rewrite provenance')
FROM public.events WHERE id = :'auto_id';

-- A club "update" that changes nothing visible is not an edit.
SET LOCAL ROLE service_role;
UPDATE public.events SET club_edited_at = NULL WHERE id = :'auto_id';
RESET ROLE;
SET LOCAL ROLE authenticated;
UPDATE public.events SET title = title WHERE id = :'auto_id';
RESET ROLE;
SELECT pg_temp.ok(club_edited_at IS NULL, 'a no-op save is not a club edit')
FROM public.events WHERE id = :'auto_id';

-- ---- 7. Bad links and bad types are refused ---------------------------------------
DO $$
DECLARE bad text;
BEGIN
  FOREACH bad IN ARRAY ARRAY['javascript:alert(1)', 'http://forms.gle/x', 'https://a b.com', 'data:text/html,hi'] LOOP
    BEGIN
      UPDATE public.events SET external_url = bad WHERE title = 'Club live event';
      RAISE EXCEPTION 'FAIL: external_url % was accepted', bad;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  PERFORM pg_temp.ok(true, 'non-https / unsafe external links are refused');

  BEGIN
    INSERT INTO public.opportunities (club_id, title, type)
    VALUES ((SELECT v FROM _t WHERE k='club'), 'Bad type', 'party');
    RAISE EXCEPTION 'FAIL: opportunity type "party" was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM pg_temp.ok(true, 'an unknown role type is refused');

  BEGIN
    INSERT INTO public.events (club_id, title, event_date, source, source_key)
    VALUES ((SELECT v FROM _t WHERE k='club'), 'Dup', now() + interval '1 day', 'automation', 'sheet-row-1');
    RAISE EXCEPTION 'FAIL: a duplicate source_key was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  PERFORM pg_temp.ok(true, 'one post per sheet row (source_key is unique)');

  BEGIN
    INSERT INTO public.events (club_id, title, event_date, source)
    VALUES ((SELECT v FROM _t WHERE k='club'), 'No key', now() + interval '1 day', 'automation');
    RAISE EXCEPTION 'FAIL: an automation post without a source_key was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM pg_temp.ok(true, 'an automation post must carry a source_key');
END $$;

-- ---- 8. Opportunities behave the same way -----------------------------------------
SET LOCAL ROLE authenticated;
INSERT INTO public.opportunities (club_id, title, type, is_active)
VALUES ((SELECT v FROM _t WHERE k='club'), 'Role draft', 'committee', false)
RETURNING id AS opp_id \gset
RESET ROLE;
SELECT pg_temp.ok(pg_temp.notes() = 3, 'a draft role sends no notification');
SET LOCAL ROLE authenticated;
UPDATE public.opportunities SET is_active = true WHERE id = :'opp_id';
RESET ROLE;
SELECT pg_temp.ok(pg_temp.notes() = 4, 'publishing a role notifies once');

-- ---- 9. Who can read what ---------------------------------------------------------
SET LOCAL ROLE anon;
SELECT pg_temp.ok(external_url = 'https://forms.gle/abc', 'signed-out visitors can read external_url')
FROM public.events WHERE id = :'auto_id';
DO $$
BEGIN
  BEGIN
    PERFORM source FROM public.events LIMIT 1;
    RAISE EXCEPTION 'FAIL: anon can read events.source';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM pg_temp.ok(true, 'signed-out visitors cannot read provenance');
  BEGIN
    PERFORM 1 FROM public.automation_log LIMIT 1;
    RAISE EXCEPTION 'FAIL: anon can read automation_log';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM pg_temp.ok(true, 'signed-out visitors cannot read the automation log');
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.automation_log (run_id, action) VALUES (gen_random_uuid(), 'created');
    RAISE EXCEPTION 'FAIL: a signed-in user can write automation_log';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM pg_temp.ok(true, 'signed-in users cannot touch the automation log');
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
INSERT INTO public.automation_log (run_id, action, kind, source_key) VALUES (gen_random_uuid(), 'created', 'event', 'k');
RESET ROLE;
SELECT pg_temp.ok(true, 'the service role can write the automation log');

SELECT 'CP1 SQL: ALL ' || n || ' CHECKS PASSED' AS result FROM _passed;
ROLLBACK;
