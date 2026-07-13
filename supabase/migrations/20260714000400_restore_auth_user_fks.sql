-- Cleanup of Lovable-era orphaned auth.users references — part 2 of 2 (FKs).
--
-- Re-establishes the auth.users foreign keys that production lost when it was
-- built by pg_restore (see 20260714000300), and adds first-time FK protection
-- to the user-ID columns that never had one. ON DELETE actions:
--
--   CASCADE (matches the actions declared in migration 20251223013805 for the
--   first 7; extended to the same-shaped per-user-state columns that never had
--   an FK): user_roles, student_profiles, club_profiles, bookmarks,
--   messages.sender_id, messages.receiver_id, notifications,
--   notification_preferences, waitlist.user_id, club_followers, reminder_logs.
--
--   SET NULL (metadata that should outlive the account): waitlist.reviewed_by,
--   page_views.user_id.
--
-- Deliberately excluded: club_team_members.user_id (WS8 FK, production-
-- confirmed) and rsvps.status_updated_by (WS4 FK, applied post-repair via
-- db push) — both already exist in production.
--
-- Safety design: each missing FK is added NOT VALID first (this always
-- succeeds and immediately enforces all FUTURE inserts/updates), then
-- validation is attempted. If legacy rows still violate a constraint — only
-- possible for the manual-review classes 000300 never touches (orphaned
-- profiles, one-party-dead messages) — validation is skipped with a WARNING
-- naming the exact follow-up command, and the constraint stays NOT VALID.
-- No row is ever deleted or modified by this migration.
--
-- Idempotent: existing validated constraints are skipped; existing NOT VALID
-- constraints get validation re-attempted (the upgrade path after a manual
-- review resolves the offending rows is simply re-running the DO block below,
-- or the single VALIDATE command from the warning).

DO $orphfk$
DECLARE
  spec record;
  v_conname text;
  v_valid boolean;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('user_roles',               'user_id',     'CASCADE'),
      ('student_profiles',         'user_id',     'CASCADE'),
      ('club_profiles',            'user_id',     'CASCADE'),
      ('bookmarks',                'user_id',     'CASCADE'),
      ('messages',                 'sender_id',   'CASCADE'),
      ('messages',                 'receiver_id', 'CASCADE'),
      ('notifications',            'user_id',     'CASCADE'),
      ('notification_preferences', 'user_id',     'CASCADE'),
      ('waitlist',                 'user_id',     'CASCADE'),
      ('waitlist',                 'reviewed_by', 'SET NULL'),
      ('page_views',               'user_id',     'SET NULL'),
      ('club_followers',           'user_id',     'CASCADE'),
      ('reminder_logs',            'user_id',     'CASCADE')
    ) AS t(tbl, col, del_action)
  LOOP
    -- Look up an existing FK from exactly this column to auth.users,
    -- regardless of its name (robust against non-default naming).
    SELECT c.conname, c.convalidated
      INTO v_conname, v_valid
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

    IF v_conname IS NULL THEN
      v_conname := spec.tbl || '_' || spec.col || '_fkey';
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) '
        || 'REFERENCES auth.users(id) ON DELETE %s NOT VALID',
        spec.tbl, v_conname, spec.col, spec.del_action);
      v_valid := false;
    END IF;

    IF NOT v_valid THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',
                       spec.tbl, v_conname);
      EXCEPTION WHEN foreign_key_violation THEN
        RAISE WARNING
          'orphan-cleanup: public.%.% still has rows violating % — left NOT VALID '
          '(future writes ARE enforced). Review via scripts/audit_auth_orphans.sql, '
          'resolve the rows, then run: ALTER TABLE public.% VALIDATE CONSTRAINT %;',
          spec.tbl, spec.col, v_conname, spec.tbl, v_conname;
      END;
    END IF;
  END LOOP;
END
$orphfk$;
