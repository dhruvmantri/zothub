-- Cleanup of orphaned auth.users references — part 1 of 2 (rows).
--
-- Companion: 20260714000400_restore_auth_user_fks.sql (re-establishes the FKs).
--
-- Timestamp note: these two migrations use the next unused versions after the
-- already-applied WS8 migrations (…000100 / …000200), so they sort AFTER all
-- applied production migrations (monotonically increasing history). Their
-- logic is independent of WS8 (they touch no bookmark index and neither
-- adds/needs the club_team_members or rsvps FKs); `supabase db push` applies
-- them as the next new versions.
--
-- Why orphans exist (inference, not a directly-verified restore record):
-- production was stood up by pg_restore from the Lovable Cloud dump, and
-- auth.users was intentionally not migrated (fresh OTP signups were used
-- instead). Migration 20251223013805 DECLARES an FK on user_roles.user_id ->
-- auth.users, yet production carries user_roles rows whose user_id is absent
-- from auth.users (maintainer-confirmed: 8 orphaned, 3 valid). The most
-- consistent explanation is that the originally-declared auth.users FKs could
-- not validate against the fresh/empty auth.users at restore time and were
-- dropped/skipped. This migration does not depend on that history being
-- proven; it simply removes rows referencing a nonexistent auth account,
-- guarded so it is a no-op on any database whose FKs were never lost.
--
-- This migration removes ONLY rows that are deterministically junk — per-user
-- private state belonging to an auth account that no longer exists, which no
-- living user can ever see (RLS keys on auth.uid(), which can never equal a
-- dead UUID) and which anchors no shared content:
--
--   DELETE class: user_roles (a role grant for a nonexistent account),
--     bookmarks, notifications, notification_preferences, reminder_logs
--     (cron dedup ledger — a dead UUID can never be a recipient again),
--     club_followers (legacy table, unread since WS3), waitlist (a queue
--     entry that can never be approved; approving would only re-create
--     orphaned user_roles rows), and messages where BOTH parties are dead
--     (invisible to every living user: the messages SELECT policy is
--     `sender_id = auth.uid() OR receiver_id = auth.uid()`, which no live
--     session can satisfy for two dead UUIDs).
--
--   SET NULL class (reference cleared, row/value kept):
--     waitlist.reviewed_by (audit metadata — the review record stays),
--     page_views.user_id (column is already "nullable for anonymous
--     visitors"; the analytics row keeps counting).
--
-- Deliberately NOT touched (manual-review / preservation classes):
--   * student_profiles / club_profiles with a dead user_id — they anchor
--     historical content (applications, opportunities, events, RSVPs).
--     Expected 0 in production (cleaned during 2026-07-09 QA); the FK
--     migration HARD-FAILS rather than silently skipping if any remain, so
--     confirm via scripts/audit_auth_orphans.sql query Q4 BEFORE pushing.
--   * messages where exactly ONE party is dead — the living party's
--     conversation history is preserved (messages carry NO auth FK: the
--     companion migration DROPS any existing one and does not recreate it, so
--     deleting the dead account never cascades away the survivor's history;
--     see the companion migration's header for why).
--   * club_team_members.user_id (WS8 FK) and rsvps.status_updated_by (WS4 FK)
--     are already enforced in production.
--
-- Idempotent and forward-only: every statement is a WHERE-guarded no-op once
-- clean, and a full no-op on a database whose FKs were never lost.

-- DELETE class ---------------------------------------------------------------
DELETE FROM public.user_roles x
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id);

DELETE FROM public.bookmarks x
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id);

DELETE FROM public.notifications x
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id);

DELETE FROM public.notification_preferences x
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id);

DELETE FROM public.reminder_logs x
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id);

DELETE FROM public.club_followers x
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id);

DELETE FROM public.waitlist x
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id);

-- Messages: ONLY when BOTH sides are dead. A message with one living party is
-- that user's conversation history and is preserved (messages carry no auth FK
-- once the companion migration drops it, so this is a one-time cleanup of rows
-- no living user can ever read).
DELETE FROM public.messages m
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.sender_id)
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.receiver_id);

-- SET NULL class -------------------------------------------------------------
UPDATE public.waitlist w
SET reviewed_by = NULL
WHERE w.reviewed_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = w.reviewed_by);

UPDATE public.page_views pv
SET user_id = NULL
WHERE pv.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = pv.user_id);
