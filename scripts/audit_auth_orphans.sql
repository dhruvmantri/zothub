-- ============================================================================
-- READ-ONLY audit: orphaned auth.users references (project date 2026-07-13)
--
-- Run BEFORE pushing migrations 20260713000200 (row cleanup) and
-- 20260713000300 (FK restore). Nothing here writes.
--
-- HOW TO RUN IN THE SUPABASE SQL EDITOR: the editor shows only the LAST
-- result set when several statements run together, so run each numbered query
-- (Q1..Q5) SEPARATELY — highlight one query and press Cmd/Ctrl+Enter. Each
-- returns exactly one result set. In psql you can run the whole file.
--
-- Context (inference, not a proven restore record): production was stood up by
-- pg_restore from the Lovable dump with auth.users intentionally not migrated,
-- so the originally-declared auth.users FKs most likely could not validate and
-- were lost, leaving orphaned rows. Maintainer-confirmed: user_roles has 8
-- orphaned rows and 3 valid.
--
-- GATE: if Q4 (manual-review / preservation) returns any row, STOP — resolve
-- each deliberately before pushing. The FK migration will HARD-FAIL on an
-- orphaned profile rather than leave an unvalidated constraint.
-- ============================================================================


-- Q1 — which auth.users FKs actually exist right now, verified by referenced
-- column and ON DELETE action. Expected: ONLY rsvps.status_updated_by and
-- club_team_members.user_id (both SET NULL), from WS4/WS8. The 11 columns the
-- cleanup manages are expected to be MISSING here (restore loss / never had one).
SELECT c.conrelid::regclass                         AS table_name,
       (SELECT a.attname FROM pg_attribute a
         WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1])   AS ref_column,
       (SELECT a.attname FROM pg_attribute a
         WHERE a.attrelid = c.confrelid AND a.attnum = c.confkey[1]) AS references_col,
       CASE c.confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
            WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
            WHEN 'd' THEN 'SET DEFAULT' END          AS on_delete,
       c.convalidated                                AS validated
FROM pg_constraint c
WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
ORDER BY 1, 2;


-- Q2 — orphan COUNTS per managed class, with the planned action. Expected:
-- user_roles = 8 (known); all other counts expected 0 (this is what confirms it).
SELECT ref, orphans, planned_action FROM (
  SELECT 1 AS ord, 'user_roles.user_id'               AS ref, (SELECT count(*) FROM public.user_roles x               WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id))     AS orphans, 'DELETE'                       AS planned_action
  UNION ALL SELECT 2,  'bookmarks.user_id',                   (SELECT count(*) FROM public.bookmarks x                 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE'
  UNION ALL SELECT 3,  'notifications.user_id',               (SELECT count(*) FROM public.notifications x             WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE'
  UNION ALL SELECT 4,  'notification_preferences.user_id',    (SELECT count(*) FROM public.notification_preferences x  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE'
  UNION ALL SELECT 5,  'reminder_logs.user_id',               (SELECT count(*) FROM public.reminder_logs x             WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE'
  UNION ALL SELECT 6,  'club_followers.user_id',              (SELECT count(*) FROM public.club_followers x            WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE (legacy table)'
  UNION ALL SELECT 7,  'waitlist.user_id',                    (SELECT count(*) FROM public.waitlist x                  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE'
  UNION ALL SELECT 8,  'messages (BOTH parties dead)',        (SELECT count(*) FROM public.messages m                  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id)
                                                                                                                        AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.receiver_id)), 'DELETE'
  UNION ALL SELECT 9,  'waitlist.reviewed_by (dead reviewer)',(SELECT count(*) FROM public.waitlist x                  WHERE x.reviewed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.reviewed_by)), 'SET NULL'
  UNION ALL SELECT 10, 'page_views.user_id (dead viewer)',    (SELECT count(*) FROM public.page_views x                WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),          'SET NULL'
  -- preservation / manual-review classes (NOT auto-cleaned):
  UNION ALL SELECT 11, 'student_profiles.user_id  [REVIEW]',  (SELECT count(*) FROM public.student_profiles x         WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'MANUAL REVIEW — Q4'
  UNION ALL SELECT 12, 'club_profiles.user_id  [REVIEW]',     (SELECT count(*) FROM public.club_profiles x            WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'MANUAL REVIEW — Q4'
  UNION ALL SELECT 13, 'messages (exactly ONE party dead)',   (SELECT count(*) FROM public.messages m                  WHERE (NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id))
                                                                                                                        <> (NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.receiver_id))), 'PRESERVED (no FK) — Q4'
  -- already enforced (expected 0):
  UNION ALL SELECT 14, 'club_team_members.user_id',           (SELECT count(*) FROM public.club_team_members x         WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),          'none (WS8 FK)'
  UNION ALL SELECT 15, 'rsvps.status_updated_by',             (SELECT count(*) FROM public.rsvps x                     WHERE x.status_updated_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.status_updated_by)), 'none (WS4 FK)'
) audit ORDER BY ord;


-- Q3 — ROW-LEVEL detail of EVERY row migration 20260713000200 will DELETE or
-- SET NULL, one consolidated result set (one row per affected row). Review
-- this so nothing the cleanup changes is a surprise. Expected: 8 user_roles
-- DELETE rows and nothing else (unless other classes also carry orphans).
SELECT action, tbl, row_id, dead_user_id, detail FROM (
  SELECT 'DELETE'::text AS action, 'user_roles'::text AS tbl, x.id AS row_id, x.user_id AS dead_user_id, ('role='||x.role)::text AS detail
    FROM public.user_roles x WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)
  UNION ALL
  SELECT 'DELETE', 'bookmarks', x.id, x.user_id, 'opp='||coalesce(x.opportunity_id::text,'-')||' event='||coalesce(x.event_id::text,'-')||' club='||coalesce(x.club_id::text,'-')
    FROM public.bookmarks x WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)
  UNION ALL
  SELECT 'DELETE', 'notifications', x.id, x.user_id, x.type||': '||x.title
    FROM public.notifications x WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)
  UNION ALL
  SELECT 'DELETE', 'notification_preferences', x.id, x.user_id, 'prefs row'
    FROM public.notification_preferences x WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)
  UNION ALL
  SELECT 'DELETE', 'reminder_logs', x.id, x.user_id, 'type='||x.reminder_type
    FROM public.reminder_logs x WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)
  UNION ALL
  SELECT 'DELETE', 'club_followers', x.id, x.user_id, 'club='||x.club_id
    FROM public.club_followers x WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)
  UNION ALL
  SELECT 'DELETE', 'waitlist', x.id, x.user_id, x.email||' ('||x.role||'/'||x.status||')'
    FROM public.waitlist x WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)
  UNION ALL
  SELECT 'DELETE', 'messages (both dead)', m.id, m.sender_id, 'receiver='||m.receiver_id||' created='||m.created_at
    FROM public.messages m
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id)
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.receiver_id)
  UNION ALL
  SELECT 'SET NULL reviewed_by', 'waitlist', x.id, x.reviewed_by, 'entry kept ('||x.email||'/'||x.status||')'
    FROM public.waitlist x WHERE x.reviewed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.reviewed_by)
  UNION ALL
  SELECT 'SET NULL user_id', 'page_views', x.id, x.user_id, 'analytics row kept ('||x.item_type||')'
    FROM public.page_views x WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)
) rows ORDER BY action, tbl, row_id;


-- Q4 — MANUAL-REVIEW / PRESERVATION detail. Migration 20260713000200 NEVER
-- touches these rows. If ANY row appears here, STOP: resolve the profile rows
-- deliberately before pushing (the FK migration hard-fails on an orphaned
-- profile). One-party-dead messages are informational (preserved; no FK added).
-- Expected: no rows.
SELECT klass, row_id, dead_user_id, detail FROM (
  SELECT 'student_profile (anchors content)'::text AS klass, sp.id AS row_id, sp.user_id AS dead_user_id,
         (coalesce(sp.full_name,'?')||' <'||sp.email||'>  applications='
          ||(SELECT count(*) FROM public.applications a WHERE a.student_id = sp.id)
          ||' rsvps='||(SELECT count(*) FROM public.rsvps r WHERE r.student_id = sp.id))::text AS detail
    FROM public.student_profiles sp WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = sp.user_id)
  UNION ALL
  SELECT 'club_profile (anchors content)', cp.id, cp.user_id,
         cp.club_name||' <'||cp.email||'>  opportunities='
          ||(SELECT count(*) FROM public.opportunities o WHERE o.club_id = cp.id)
          ||' events='||(SELECT count(*) FROM public.events e WHERE e.club_id = cp.id)
          ||' applications_received='||(SELECT count(*) FROM public.applications a
               JOIN public.opportunities o ON o.id = a.opportunity_id WHERE o.club_id = cp.id)
    FROM public.club_profiles cp WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cp.user_id)
  UNION ALL
  SELECT 'message (one party dead — PRESERVED)', m.id,
         CASE WHEN NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id) THEN m.sender_id ELSE m.receiver_id END,
         CASE WHEN NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id)
              THEN 'sender dead; live receiver='||m.receiver_id
              ELSE 'receiver dead; live sender='||m.sender_id END
    FROM public.messages m
    WHERE (NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id))
       <> (NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.receiver_id))
) review ORDER BY klass, row_id;


-- Q5 — sanity: valid (non-orphaned) user_roles rows. Expected: 3 (known fact).
SELECT count(*) AS valid_user_roles
FROM public.user_roles ur
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id);
