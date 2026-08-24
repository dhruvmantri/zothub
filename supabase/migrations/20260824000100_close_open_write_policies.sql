-- Close three open write surfaces found by the 2026-08-23 audit: S8 (anyone can
-- forge an in-app notification), S7 (anyone can permanently mute a user's
-- reminders), S9 (the public club-assets bucket accepts any file, any size).
--
-- ⚠️ NOT APPLIED AUTOMATICALLY. Review + back up before `supabase db push`.
--
-- Written to be safely re-runnable: every statement is guarded. (Migration
-- 20251223165608 is not, which is why `README.md`'s "run the migrations"
-- instruction fails on a project that already has the buckets — tracked as DP10.)

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. S8 — notifications: stop the browser from writing notifications at all
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The policy "System can insert notifications" (20251223160240) is
-- `FOR INSERT WITH CHECK (true)` with NO `TO` clause, so it applies to `public`
-- — anon and authenticated included. Its name states an intent the policy never
-- enforced. Any signed-in user could insert a notification for ANY user with
-- arbitrary title and body: a convincing fake "your application was accepted",
-- indistinguishable from a real one because it is a real row.
--
-- It could not simply be revoked, because ONE legitimate caller depended on it:
-- the browser looped over an event's confirmed attendees and inserted an
-- `event_cancelled` notification for each (src/lib/eventNotifications.ts). That
-- is the only client-side notification INSERT in the codebase.
--
-- So the capability moves into the database, matching the pattern already used by
-- notify_rsvp_status_change() (20260709000400) and
-- notify_club_on_new_application() (20260710000100) — event cancellation was the
-- odd one out. Once the database does it, the browser needs no INSERT at all.
--
-- Why BEFORE DELETE: cancelling an event is a hard DELETE of the events row
-- (useClubEvents.deleteEvent), and rsvps.event_id is ON DELETE CASCADE
-- (20251223013805:252), so by AFTER DELETE the attendee list is already gone.
-- BEFORE DELETE still sees it.
--
-- Authorisation is inherited, not re-implemented: the events DELETE policy
-- (20251223013805:197-201) already restricts deletion to the owning club, so
-- anything that reaches this trigger is an authorised cancellation by definition.

CREATE OR REPLACE FUNCTION public.notify_attendees_on_event_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_name TEXT;
BEGIN
  SELECT club_name INTO v_club_name
  FROM club_profiles
  WHERE id = OLD.club_id;

  -- One notification per confirmed attendee. Deliberately NOT gated on a
  -- notification preference: every other notification here is gated, but "the
  -- event you signed up for is cancelled" is not promotional — a student who
  -- muted reminders still needs to know not to turn up. This also preserves the
  -- previous client-side behaviour exactly, which applied no gate either.
  INSERT INTO notifications (user_id, type, title, message, related_id)
  SELECT
    sp.user_id,
    'event_cancelled',
    'Event Cancelled',
    COALESCE(OLD.title, 'An event') || ' by ' || COALESCE(v_club_name, 'a club')
      || ' has been cancelled.',
    OLD.id
  FROM rsvps r
  JOIN student_profiles sp ON sp.id = r.student_id
  WHERE r.event_id = OLD.id
    AND r.status = 'confirmed'
    -- Belt and braces: student_profiles.user_id is NOT NULL today, so this can
    -- never filter anything (only club_profiles.user_id was made nullable, by
    -- MB5 / 20260727000100). Kept deliberately — it costs nothing and the day that
    -- column becomes nullable this stops the trigger inserting a NULL recipient.
    AND sp.user_id IS NOT NULL;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS notify_attendees_on_event_delete ON public.events;
CREATE TRIGGER notify_attendees_on_event_delete
BEFORE DELETE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.notify_attendees_on_event_delete();

-- Now the browser's INSERT capability can go. Service-role edge functions keep
-- theirs explicitly; the SECURITY DEFINER triggers above are owned by the table
-- owner and so are unaffected by either the policy or the grant.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
-- Also drop the NEW name: guarding only the old one made a second apply fail with
-- 'policy already exists'. The BEGIN/COMMIT wrapper rolled that back cleanly, so it
-- was a re-runnability defect rather than a corruption risk — but it is exactly the
-- DP10 fault this migration's header claims to avoid.
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
TO service_role
WITH CHECK (true);

-- RLS is only half of it: a permissive policy is unreachable without the
-- table-level privilege, and a missing policy is irrelevant if the privilege is
-- absent. Revoke the privilege too, so neither alone can reopen this.
REVOKE INSERT ON public.notifications FROM anon, authenticated;

-- Note for future readers: 20260710000100's header says it inserts "via the
-- existing 'System can insert notifications' policy". After this migration that
-- policy no longer exists, and the trigger works regardless — table-owner
-- SECURITY DEFINER functions bypass both the policy and the REVOKE (verified
-- empirically, not assumed). That comment is stale, but the migration is already
-- applied in production so it is left untouched rather than rewritten. Do not
-- re-add a permissive policy on its account.

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. S7 — reminder_logs: stop anyone permanently muting another user's reminders
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Same shape of bug, worse consequence. "System can insert reminder logs"
-- (20260121001924:36-39) is `WITH CHECK (true)` with no `TO` clause. The table
-- carries `unique_reminder UNIQUE (reminder_type, target_id, user_id)` and
-- send-reminders checks it before sending — so forging one row makes that
-- reminder PERMANENTLY unsendable to that user. Silent, and irreversible without
-- manual DB surgery.
--
-- No client ever writes this table; only the send-reminders edge function does.
-- The permissive policy was never needed.

DROP POLICY IF EXISTS "System can insert reminder logs" ON public.reminder_logs;
DROP POLICY IF EXISTS "Service role can insert reminder logs" ON public.reminder_logs;

CREATE POLICY "Service role can insert reminder logs"
ON public.reminder_logs FOR INSERT
TO service_role
WITH CHECK (true);

REVOKE INSERT ON public.reminder_logs FROM anon, authenticated;

-- Users keep reading their own rows: the SELECT policy from 20260121001924 is
-- untouched, and this migration revokes INSERT only. Caveat for anyone testing this
-- locally: a fresh `supabase db reset` does NOT grant `authenticated` SELECT on this
-- table, so that policy is unreachable on a local stack — the very "a permissive
-- policy is unreachable without the table-level privilege" point made above, in
-- reverse. Production has the grant. Do not use a local stack as evidence either way.

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. S9 — club-assets: constrain the public bucket
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The bucket was created `public = true` with NO file_size_limit and NO
-- allowed_mime_types (20251223165608:2-3), i.e. unlimited size and any type.
-- The INSERT policy does confine a user to their own uid-named folder, so this
-- is not cross-user tampering — but any @uci.edu account could still park
-- arbitrary files of any size in publicly-readable storage on the project's
-- quota. The client-side `accept` / `maxSizeMB` guards are trivially bypassed
-- because they run in the browser.
--
-- Limits chosen by the maintainer (2026-08-23): images + PDF, 10 MB each. Bucket
-- limits are enforced by the storage API for EVERY caller, service role included
-- — worth knowing for the MB5-logo bulk re-host, which is well within them
-- (a typical club logo is 20-80 KB).

UPDATE storage.buckets
   SET file_size_limit = 10485760,  -- 10 MiB
       allowed_mime_types = ARRAY[
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/gif',
         'image/svg+xml',
         'application/pdf'
       ]
 WHERE id = 'club-assets';

-- student-resumes is private (public = false) and holds documents, so it gets
-- the same size ceiling but a document-oriented type list. Left otherwise alone.
UPDATE storage.buckets
   SET file_size_limit = 10485760,  -- 10 MiB
       allowed_mime_types = ARRAY[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]
 WHERE id = 'student-resumes';

COMMIT;

-- ───────────────────────────────────────────────────────────────────────────
-- Post-apply verification (run these; all three should read as described):
--
--   -- (a) No permissive INSERT left on either table. Expect exactly one row
--   --     each, with roles = {service_role}:
--   SELECT tablename, policyname, roles, cmd
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('notifications','reminder_logs')
--      AND cmd = 'INSERT';
--
--   -- (b) anon/authenticated hold no INSERT privilege. Expect ZERO rows:
--   SELECT grantee, table_name, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_name IN ('notifications','reminder_logs')
--      AND grantee IN ('anon','authenticated')
--      AND privilege_type = 'INSERT';
--
--   -- (c) Bucket limits are set:
--   SELECT id, public, file_size_limit, allowed_mime_types
--     FROM storage.buckets WHERE id IN ('club-assets','student-resumes');
--
--   -- (d) The cancellation trigger exists:
--   SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'public.events'::regclass AND NOT tgisinternal;
-- ───────────────────────────────────────────────────────────────────────────
