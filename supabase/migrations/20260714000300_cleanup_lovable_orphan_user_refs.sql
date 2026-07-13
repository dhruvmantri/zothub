-- Cleanup of Lovable-era orphaned auth.users references — part 1 of 2 (rows).
--
-- Background: production was built by pg_restore from the Lovable Cloud dump
-- and auth.users was intentionally never migrated, so public rows referencing
-- old Lovable auth UUIDs are orphans, and the original schema's FKs to
-- auth.users were lost in the restore (confirmed: user_roles carries orphaned
-- rows despite migration 20251223013805 declaring an FK). Part 2
-- (20260714000400) re-establishes the FKs.
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
--     (invisible to every living user).
--
--   SET NULL class (reference cleared, row/value kept):
--     waitlist.reviewed_by (audit metadata — the review record stays),
--     page_views.user_id (column is already "nullable for anonymous
--     visitors"; the analytics row keeps counting).
--
-- Deliberately NOT touched (manual-review classes — never auto-deleted):
--   * student_profiles / club_profiles with a dead user_id — they anchor
--     historical content (applications, opportunities, events, RSVPs).
--     Expected 0 in production (cleaned during 2026-07-09 QA); confirm via
--     scripts/audit_auth_orphans.sql sections B1/B2 BEFORE pushing.
--   * messages where exactly ONE party is dead — the living party's
--     conversation history (audit section B3).
--   * club_team_members.user_id — already self-healing via the WS8 FK
--     (production-confirmed). rsvps.status_updated_by — FK enforced since
--     the column was created (WS4); orphans impossible.
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

-- Messages: only when BOTH sides are dead. A message with one living party is
-- that user's conversation history and is preserved (manual-review class).
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
