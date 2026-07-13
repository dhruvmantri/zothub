-- WS8: harden club_team_members.user_id against orphaned auth references.
--
-- Background (plan.md Known Issue #2 / inventory): auth.users was intentionally
-- never migrated from Lovable Cloud, so some public.* rows referenced old
-- Lovable auth UUIDs that don't exist in the new auth.users. club_team_members
-- is the exposed case: user_id is nullable WITH NO FOREIGN KEY, so a row whose
-- user_id points at a dead UUID renders as a real team member (and its "Message"
-- button would target a ghost account). Those orphans were cleaned manually
-- during QA; this migration makes the invariant enforceable going forward.
--
-- Self-guarding & production-safe by construction:
--   1. First NULL any user_id that does not resolve to an auth.users row. This
--      only clears DEAD references — a user_id absent from auth.users cannot be
--      an active account — so it never touches a real member's link, and it
--      keeps the roster entry itself (name/email/role) intact.
--   2. Then add the FK with ON DELETE SET NULL, so a future auth deletion nulls
--      the link automatically (self-healing) instead of leaving an orphan. The
--      existing UI already hides the Message button when user_id is null, so a
--      nulled link degrades gracefully.
--
-- Because step 1 removes every possible orphan before step 2, the FK add cannot
-- fail regardless of current data. Still, run the read-only orphan check in the
-- WS8 notes against production first to confirm the expected zero-orphan state
-- before pushing. Idempotent: step 1 is a no-op once clean; the constraint add
-- is guarded by a not-exists check.

UPDATE public.club_team_members ctm
SET user_id = NULL
WHERE ctm.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = ctm.user_id
  );

DO $ws8$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'club_team_members_user_id_fkey'
      AND conrelid = 'public.club_team_members'::regclass
  ) THEN
    ALTER TABLE public.club_team_members
      ADD CONSTRAINT club_team_members_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$ws8$;
