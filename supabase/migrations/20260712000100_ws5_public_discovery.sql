-- WS5 — Discovery access-model consistency: PUBLIC DISCOVERY.
--
-- Product decision: logged-out (anon) visitors may browse active/public clubs,
-- opportunities, and events, but must authenticate for every write and for any
-- private data (apply, RSVP, follow, bookmark, message, dashboards, applications,
-- RSVPs, notifications, student profiles).
--
-- Current inconsistency: club_profiles already has a `TO public USING (true)`
-- SELECT policy (anon can read clubs), but opportunities/events SELECT policies
-- are `TO authenticated`, so anon is denied — while /opportunities, /events,
-- /clubs and their detail pages are public routes. This makes the three surfaces
-- consistent for anon (active rows only) and closes the club-email exposure.

-- 1. Opportunities: anon (and authenticated) may view ACTIVE rows only. Replaces
--    the authenticated-only policy with a `TO public` one; the club-owner policy
--    ("Clubs can view all their own opportunities", incl. inactive) is untouched,
--    and writes remain gated by the existing insert/update/delete policies.
DROP POLICY IF EXISTS "Anyone can view active opportunities" ON public.opportunities;
CREATE POLICY "Anyone can view active opportunities"
ON public.opportunities
FOR SELECT
TO public
USING (is_active = true);

-- 2. Events: same — anon may view ACTIVE rows only.
DROP POLICY IF EXISTS "Anyone can view active events" ON public.events;
CREATE POLICY "Anyone can view active events"
ON public.events
FOR SELECT
TO public
USING (is_active = true);

-- 3. club_profiles stays anon-readable at the row level (the /opportunities,
--    /events and /clubs pages embed club_name + logo_url), but anon must NOT read
--    the club's private account email. Because anon holds a TABLE-level SELECT
--    grant (which would still cover email), revoke it and re-grant SELECT at the
--    COLUMN level for every column except `email`. Authenticated clubs still read
--    their own email (via "Clubs can view their own full profile"); no client
--    path reads another club's email. (This restores the original design intent
--    from get_club_public_profile(), which deliberately excludes email.)
--    NOTE: anon's grant on club_profiles is now column-level, so a future column
--    added to club_profiles must be GRANTed to anon explicitly if it should be
--    publicly discoverable.
REVOKE SELECT ON public.club_profiles FROM anon;
GRANT SELECT (
  id, user_id, club_name, description, category,
  logo_url, banner_url, website_url, instagram_url, discord_url, linkedin_url,
  views, created_at, updated_at
) ON public.club_profiles TO anon;

-- 4. Base table SELECT for anon discovery (idempotent; Supabase grants this by
--    default — restated for clarity and safety). Writes are not granted here and
--    remain blocked by RLS regardless.
GRANT SELECT ON public.opportunities TO anon;
GRANT SELECT ON public.events TO anon;
