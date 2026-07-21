-- Cleanup of orphaned auth.users references — part 2 of 2 (foreign keys).
--
-- Companion: 20260714000300_cleanup_orphaned_auth_user_refs.sql (must run
-- first; see its header for the timestamp/ordering note and the root-cause
-- inference). Run scripts/audit_auth_orphans.sql against production and clear
-- the manual-review classes BEFORE pushing.
--
-- Re-establishes the auth.users foreign keys that production most likely lost
-- in the pg_restore (see companion), and adds first-time FK protection to the
-- user-ID columns that never had one. This migration NEVER modifies or deletes
-- a row.
--
-- Managed columns and their ON DELETE action (CASCADE mirrors the actions
-- declared in migration 20251223013805 for the columns that originally had an
-- FK; the never-had-FK columns take the semantically-correct action):
--
--   CASCADE (per-user private state — deleting the account removes it):
--     user_roles.user_id, student_profiles.user_id, club_profiles.user_id,
--     bookmarks.user_id, notifications.user_id, notification_preferences.user_id,
--     waitlist.user_id, club_followers.user_id, reminder_logs.user_id.
--   SET NULL (metadata that should outlive the account):
--     waitlist.reviewed_by, page_views.user_id.
--
-- Deliberately EXCLUDED:
--   * messages.sender_id / messages.receiver_id — NO FK is added. Both columns
--     are NOT NULL, so ON DELETE SET NULL is impossible without a schema change;
--     ON DELETE CASCADE would delete a LIVING user's conversation history when
--     the other party is deleted (contradicting the preservation decision); and
--     ON DELETE RESTRICT/NO ACTION would block deleting any account that has
--     ever sent/received a message. Preserving message history while still
--     allowing account deletion needs a separate product decision (e.g. make
--     the columns nullable + SET NULL, or a tombstone/"deleted user" sentinel).
--     Until then messages keep their current (no-FK) behavior; the companion
--     migration one-time-deletes only the both-parties-dead messages.
--   * club_team_members.user_id (WS8) and rsvps.status_updated_by (WS4) —
--     already enforced in production; left untouched.
--
-- Success state is unambiguous: this migration completes ONLY if all 11 managed
-- FKs are present AND validated. If any orphan remains for a managed column
-- (only possible for the manual-review classes the companion does not clean —
-- orphaned student/club profiles), the ADD CONSTRAINT raises and the whole
-- migration FAILS with guidance, rather than leaving an unvalidated constraint.
-- Idempotent: an already-present FK with the expected referenced column and
-- ON DELETE action is skipped; a present FK on a managed column with an
-- UNEXPECTED referenced column or action raises (never silently accepted).

DO $orphfk$
DECLARE
  spec        record;
  con         record;
  v_expected  char(1);
  v_refcol    text;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('user_roles',               'user_id',     'CASCADE'),
      ('student_profiles',         'user_id',     'CASCADE'),
      ('club_profiles',            'user_id',     'CASCADE'),
      ('bookmarks',                'user_id',     'CASCADE'),
      ('notifications',            'user_id',     'CASCADE'),
      ('notification_preferences', 'user_id',     'CASCADE'),
      ('waitlist',                 'user_id',     'CASCADE'),
      ('waitlist',                 'reviewed_by', 'SET NULL'),
      ('page_views',               'user_id',     'SET NULL'),
      ('club_followers',           'user_id',     'CASCADE'),
      ('reminder_logs',            'user_id',     'CASCADE')
    ) AS t(tbl, col, del_action)
  LOOP
    v_expected := CASE spec.del_action WHEN 'CASCADE' THEN 'c' WHEN 'SET NULL' THEN 'n' END;

    -- Find an existing FK from exactly this column to auth.users, matching on
    -- the referencing column (not merely table/column name presence). Capture
    -- its referenced column and ON DELETE action for verification.
    SELECT c.conname,
           c.confdeltype AS deltype,
           (SELECT a.attname::text FROM pg_attribute a
             WHERE a.attrelid = c.confrelid AND a.attnum = c.confkey[1]) AS refcol
      INTO con
    FROM pg_constraint c
    WHERE c.conrelid = format('public.%I', spec.tbl)::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND (SELECT array_agg(a.attname::text ORDER BY k.ord)
             FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
             JOIN pg_attribute a
               ON a.attrelid = c.conrelid AND a.attnum = k.attnum
          ) = ARRAY[spec.col]
    LIMIT 1;

    IF con.conname IS NOT NULL THEN
      -- Verify the existing FK by referenced column AND ON DELETE behavior.
      IF con.refcol IS DISTINCT FROM 'id' OR con.deltype IS DISTINCT FROM v_expected THEN
        RAISE EXCEPTION
          'orphan-cleanup: public.%.% already has FK % referencing auth.users(%) '
          'with ON DELETE ''%'', but expected auth.users(id) ON DELETE %. '
          'Reconcile this out-of-band constraint before re-running.',
          spec.tbl, spec.col, con.conname, con.refcol,
          CASE con.deltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
                           WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
                           WHEN 'd' THEN 'SET DEFAULT' ELSE con.deltype END,
          spec.del_action;
      END IF;
      -- Correct FK already present — idempotent skip.
      CONTINUE;
    END IF;

    -- Add the FK as a validated constraint. If a managed column still has an
    -- orphan (manual-review class), this raises and aborts the migration —
    -- the intended fail-loud behavior (no unvalidated constraints left behind).
    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) '
        || 'REFERENCES auth.users(id) ON DELETE %s',
        spec.tbl, spec.tbl || '_' || spec.col || '_fkey', spec.col, spec.del_action);
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE EXCEPTION
        'orphan-cleanup: public.%.% still has rows with no matching auth.users row, '
        'so its foreign key cannot validate. This is a manual-review class the '
        'companion migration does not auto-delete (orphaned student/club profiles '
        'anchor historical content). Run scripts/audit_auth_orphans.sql sections '
        'C1/C2, resolve those rows deliberately, then re-push. (Failing on purpose '
        'rather than adding an unvalidated constraint.)',
        spec.tbl, spec.col;
    END;
  END LOOP;
END
$orphfk$;
