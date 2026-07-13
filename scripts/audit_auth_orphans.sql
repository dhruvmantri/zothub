-- ============================================================================
-- READ-ONLY audit: Lovable-era orphaned auth.users references (2026-07-14)
--
-- Run in the Supabase SQL editor (or psql) against the linked project BEFORE
-- pushing migrations 20260714000300 / 20260714000400. Nothing here writes.
--
-- Background: production was built by pg_restore from the Lovable Cloud dump;
-- auth.users was intentionally NOT migrated (fresh OTP signups instead), so
-- the original schema's 7 FKs to auth.users could not validate at restore
-- time and were lost. Known production fact (maintainer, 2026-07-14):
-- user_roles has 8 rows whose user_id no longer exists in auth.users, and
-- 3 valid rows.
--
-- Expected results are noted per section. Any deviation in the
-- "MANUAL REVIEW" sections (B) means: STOP — do not push the migrations
-- until each listed row is deliberately resolved.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Which FKs to auth.users actually exist in production right now.
--    Expected: ONLY rsvps.status_updated_by (WS4) and club_team_members.user_id
--    (WS8) — the two applied via db push after the migration-history repair.
--    The 7 originally-declared FKs are expected to be MISSING (restore loss).
-- ---------------------------------------------------------------------------
SELECT c.conrelid::regclass AS table_name,
       (SELECT a.attname FROM pg_attribute a
         WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]) AS column_name,
       c.conname,
       c.confdeltype, -- 'c' = CASCADE, 'n' = SET NULL
       c.convalidated
FROM pg_constraint c
WHERE c.contype = 'f'
  AND c.confrelid = 'auth.users'::regclass
ORDER BY 1, 2;

-- ---------------------------------------------------------------------------
-- A. Orphan COUNTS per user-ID column (all 15 columns; one row per column).
--    Expected: user_roles = 8 (known fact); everything else expected 0, but
--    this is exactly what this audit exists to confirm.
-- ---------------------------------------------------------------------------
SELECT * FROM (
  SELECT 'user_roles.user_id'               AS ref, (SELECT count(*) FROM public.user_roles x               WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id))     AS orphans, 'DELETE (mig 000300)'      AS planned_action
  UNION ALL
  SELECT 'student_profiles.user_id',            (SELECT count(*) FROM public.student_profiles x         WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'MANUAL REVIEW — see B1'
  UNION ALL
  SELECT 'club_profiles.user_id',               (SELECT count(*) FROM public.club_profiles x            WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'MANUAL REVIEW — see B2'
  UNION ALL
  SELECT 'bookmarks.user_id',                   (SELECT count(*) FROM public.bookmarks x                 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE (mig 000300)'
  UNION ALL
  SELECT 'messages (BOTH parties dead)',        (SELECT count(*) FROM public.messages m                  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id)
                                                                                                            AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.receiver_id)), 'DELETE (mig 000300)'
  UNION ALL
  SELECT 'messages (exactly ONE party dead)',   (SELECT count(*) FROM public.messages m                  WHERE (NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id))
                                                                                                            <> (NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.receiver_id))), 'MANUAL REVIEW — see B3 (preserved)'
  UNION ALL
  SELECT 'notifications.user_id',               (SELECT count(*) FROM public.notifications x             WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE (mig 000300)'
  UNION ALL
  SELECT 'notification_preferences.user_id',    (SELECT count(*) FROM public.notification_preferences x  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE (mig 000300)'
  UNION ALL
  SELECT 'waitlist.user_id',                    (SELECT count(*) FROM public.waitlist x                  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE (mig 000300) — see C2'
  UNION ALL
  SELECT 'waitlist.reviewed_by (dead reviewer)',(SELECT count(*) FROM public.waitlist x                  WHERE x.reviewed_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.reviewed_by)), 'SET NULL (mig 000300)'
  UNION ALL
  SELECT 'page_views.user_id (dead viewer)',    (SELECT count(*) FROM public.page_views x                WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),          'SET NULL (mig 000300)'
  UNION ALL
  SELECT 'club_followers.user_id',              (SELECT count(*) FROM public.club_followers x            WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE (mig 000300; legacy table, unread since WS3)'
  UNION ALL
  SELECT 'reminder_logs.user_id',               (SELECT count(*) FROM public.reminder_logs x             WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),     'DELETE (mig 000300)'
  UNION ALL
  SELECT 'club_team_members.user_id',           (SELECT count(*) FROM public.club_team_members x         WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id)),          'none — WS8 FK self-heals (expected 0)'
  UNION ALL
  SELECT 'rsvps.status_updated_by',             (SELECT count(*) FROM public.rsvps x                     WHERE x.status_updated_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.status_updated_by)), 'none — WS4 FK enforced since creation (expected 0)'
) audit
ORDER BY ref;

-- Sanity: valid (non-orphaned) user_roles rows. Expected: 3 (known fact).
SELECT count(*) AS valid_user_roles
FROM public.user_roles ur
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id);

-- ---------------------------------------------------------------------------
-- B. MANUAL-REVIEW detail. Migration 000300 NEVER touches these rows; if any
--    query below returns rows, STOP and resolve each one deliberately before
--    pushing (000400 will still apply safely — it leaves the affected FK
--    NOT VALID with a warning instead of failing).
-- ---------------------------------------------------------------------------

-- B1. Orphaned student profiles + the historical content anchored to them.
--     Expected 0 (cleaned manually during 2026-07-09 QA).
SELECT sp.id, sp.email, sp.full_name, sp.user_id AS dead_user_id,
       (SELECT count(*) FROM public.applications a WHERE a.student_id = sp.id) AS applications,
       (SELECT count(*) FROM public.rsvps r WHERE r.student_id = sp.id)        AS rsvps
FROM public.student_profiles sp
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = sp.user_id);

-- B2. Orphaned club profiles + the historical content anchored to them.
--     Expected 0 (cleaned manually during 2026-07-09 QA).
SELECT cp.id, cp.club_name, cp.email, cp.user_id AS dead_user_id,
       (SELECT count(*) FROM public.opportunities o WHERE o.club_id = cp.id) AS opportunities,
       (SELECT count(*) FROM public.events e WHERE e.club_id = cp.id)        AS events,
       (SELECT count(*) FROM public.applications a JOIN public.opportunities o ON o.id = a.opportunity_id WHERE o.club_id = cp.id) AS applications_received
FROM public.club_profiles cp
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cp.user_id);

-- B3. Messages where exactly ONE party is dead — the living party's history.
--     These are PRESERVED (never auto-deleted). Expected 0.
SELECT m.id, m.created_at,
       CASE WHEN NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id)
            THEN 'sender dead' ELSE 'receiver dead' END AS dead_side,
       m.sender_id, m.receiver_id
FROM public.messages m
WHERE (NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id))
   <> (NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.receiver_id))
ORDER BY m.created_at;

-- ---------------------------------------------------------------------------
-- C. DELETE-class detail — exactly what migration 000300 will remove.
--    Review before pushing so nothing is a surprise.
-- ---------------------------------------------------------------------------

-- C1. The orphaned role grants (expected: the 8 known rows).
SELECT ur.id, ur.user_id AS dead_user_id, ur.role, ur.created_at
FROM public.user_roles ur
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id)
ORDER BY ur.created_at;

-- C2. Orphaned waitlist entries (queue rows that can never be approved —
--     the auth account they gate no longer exists).
SELECT w.id, w.email, w.role, w.status, w.requested_at, w.user_id AS dead_user_id
FROM public.waitlist w
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = w.user_id)
ORDER BY w.requested_at;
