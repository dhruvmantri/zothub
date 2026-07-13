-- WS5 — Discovery access-model consistency: PUBLIC DISCOVERY (least-privilege).
--
-- Product decision: logged-out (anon) visitors may browse active/public clubs,
-- opportunities, and events, but must authenticate for every write and for any
-- private data (apply, RSVP, follow, bookmark, message, dashboards, applications,
-- RSVPs, notifications, student profiles).
--
-- Rows are restricted by RLS (below); COLUMNS are restricted by least-privilege
-- column grants so a direct `select("*")` by anon cannot read internal/private
-- fields even on an otherwise-visible active row. Anon's column allowlist covers
-- the columns the public (logged-out) routes render, with two distinct cases for
-- fields that are not part of the logged-out experience:
--   * application_questions (opportunities) and rsvp_questions (events) are
--     EXCLUDED from the anon grants entirely; they back the auth-only apply/RSVP
--     forms and are requested only when authenticated.
--   * club_profiles.user_id, by contrast, is INCLUDED in the anon grant, but not
--     for the UI: it remains granted to anon solely because the current club-owner
--     RLS subqueries reference it (see section 3). The logged-out UI does not
--     explicitly request user_id; only the authenticated ClubDetail page requests
--     it, and only for messaging.

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
--    time — i.e. public discovery genuinely requires the grant. It is a
--    non-sensitive UUID (not email/PII); auth.users itself is never exposed to
--    anon. The grant exists solely for RLS evaluation: the logged-out UI does NOT
--    request user_id (ClubDetail adds it to its select only when authenticated,
--    for messaging), though a direct anon API `select("user_id")` remains
--    technically possible because the RLS dependency forces the column grant.
REVOKE SELECT ON public.club_profiles FROM anon;
GRANT SELECT (
  id, user_id, club_name, description, category,
  logo_url, banner_url, website_url, instagram_url, discord_url, linkedin_url
) ON public.club_profiles TO anon;

-- NOTE: anon's grants on all three tables are now column-level, so any future
-- column added to these tables must be GRANTed to anon explicitly if it should be
-- publicly discoverable. Writes are never granted to anon and remain blocked by
-- RLS regardless.
