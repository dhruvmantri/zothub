-- WS5 — Discovery access-model consistency: PUBLIC DISCOVERY (least-privilege).
--
-- Product decision: logged-out (anon) visitors may browse active/public clubs,
-- opportunities, and events, but must authenticate for every write and for any
-- private data (apply, RSVP, follow, bookmark, message, dashboards, applications,
-- RSVPs, notifications, student profiles).
--
-- Rows are restricted by RLS (below); COLUMNS are restricted by least-privilege
-- column grants so a direct `select("*")` by anon cannot read internal/private
-- fields even on an otherwise-visible active row. Anon's column allowlist is the
-- exact union of columns the public (logged-out) routes need; auth-only fields
-- (application_questions, rsvp_questions, club user_id for messaging) are excluded
-- and the client fetches them only when logged in.

-- 1. Opportunities -------------------------------------------------------------
--    Row policy: active rows visible to everyone (anon + authenticated). The
--    club-owner "view all their own (incl. inactive)" policy and all write
--    policies are untouched.
DROP POLICY IF EXISTS "Anyone can view active opportunities" ON public.opportunities;
CREATE POLICY "Anyone can view active opportunities"
ON public.opportunities
FOR SELECT
TO public
USING (is_active = true);

--    Column allowlist for anon. Included: identity/display fields the list &
--    detail pages render, plus is_active/deadline/created_at used by client
--    filters & ordering. Excluded: application_questions (auth-only apply form),
--    views (analytics counter), updated_at (internal timestamp).
REVOKE SELECT ON public.opportunities FROM anon;
GRANT SELECT (
  id, club_id, title, type, description, requirements,
  deadline, is_active, created_at, show_application_count
) ON public.opportunities TO anon;

-- 2. Events --------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view active events" ON public.events;
CREATE POLICY "Anyone can view active events"
ON public.events
FOR SELECT
TO public
USING (is_active = true);

--    Included: display fields + is_active/event_date used by client filters &
--    ordering, and requires_approval (public "requires approval" badge/flow).
--    Excluded: rsvp_questions (auth-only RSVP form), views (analytics),
--    created_at/updated_at (internal timestamps, not shown to anon).
REVOKE SELECT ON public.events FROM anon;
GRANT SELECT (
  id, club_id, title, description, event_date, location,
  capacity, banner_url, is_active, requires_approval
) ON public.events TO anon;

-- 3. club_profiles -------------------------------------------------------------
--    Row access stays public (the /opportunities, /events and /clubs pages embed
--    club_name + logo_url). The allowlist EXCLUDES the private email, the views
--    analytics counter, and internal timestamps. Included: the public club
--    identity/branding/social fields the club pages render, PLUS user_id.
--
--    user_id (the club's owning auth id) is intentionally kept in the anon grant:
--    the SELECT RLS policies on opportunities, events, applications and rsvps all
--    reference `club_profiles.user_id` in their club-owner subquery
--    (`club_id IN (SELECT id FROM club_profiles WHERE user_id = auth.uid())`),
--    which is evaluated with the querying role's privileges. Without SELECT on
--    club_profiles.user_id, anon reads of opportunities/events (and the
--    applications/rsvps discovery embeds) fail with "permission denied" at plan
--    time — i.e. public discovery genuinely requires it. It is a non-sensitive
--    UUID (not email/PII); auth.users itself is never exposed to anon. The client
--    still never fetches it for display.
REVOKE SELECT ON public.club_profiles FROM anon;
GRANT SELECT (
  id, user_id, club_name, description, category,
  logo_url, banner_url, website_url, instagram_url, discord_url, linkedin_url
) ON public.club_profiles TO anon;

-- NOTE: anon's grants on all three tables are now column-level, so any future
-- column added to these tables must be GRANTed to anon explicitly if it should be
-- publicly discoverable. Writes are never granted to anon and remain blocked by
-- RLS regardless.
