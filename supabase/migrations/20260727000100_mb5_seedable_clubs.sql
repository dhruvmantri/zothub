-- MB5 — make public.club_profiles seedable as UNCLAIMED, CLAIMABLE profiles,
--       with a hard PUBLISHED gate so seeded clubs are invisible until published.
--
-- ⚠️ NOT APPLIED AUTOMATICALLY. Review this, confirm the linked project is the
--    intended one, take a DB backup (repo policy: backup before every schema
--    migration), then `supabase db push`.
--
-- Model (docs/LAUNCH-BACKLOG.md MB5 + the readiness sweep):
--   * A seeded club has NO owner yet -> user_id nullable; "claimed" ≡ user_id
--     IS NOT NULL (claimed_at is a display convenience).
--   * Provenance columns record origin and make re-seeding idempotent.
--   * PUBLISHED GATE (hard safety guarantee): `published` defaults TRUE so every
--     existing/organic club stays visible. The seeder writes seeded clubs with
--     published = FALSE. Public read is gated on `published` in BOTH paths:
--       - the club PROFILE page selects club_profiles directly -> RLS SELECT
--         policy is narrowed from USING (true) to USING (published);
--       - the Clubs DIRECTORY reads via the SECURITY DEFINER RPCs, which BYPASS
--         RLS, so they get an explicit WHERE published.
--     An unpublished club therefore cannot appear in the directory nor be opened
--     via its profile page. Owners still see their OWN unpublished row (the
--     "Clubs can view their own full profile" owner policy is left intact), which
--     also covers the rollback case (unpublish without deleting).

BEGIN;

-- 1. Owner becomes optional. FK + UNIQUE stay (UNIQUE allows many NULLs; FK not
--    enforced for NULL). Supersedes, going forward, 20260714000400's
--    "dead user_id = orphan" assumption: NULL now means "unclaimed" (legitimate).
ALTER TABLE public.club_profiles ALTER COLUMN user_id DROP NOT NULL;

-- 2. Email becomes optional — a scraped listing has no contact email and we must
--    NOT fabricate one; the owner supplies it at claim / profile setup.
ALTER TABLE public.club_profiles ALTER COLUMN email DROP NOT NULL;

-- 3. Provenance + the published gate. Adding `published` with a constant default
--    is a metadata-only change in modern Postgres (no table rewrite); existing
--    rows read TRUE and stay visible.
ALTER TABLE public.club_profiles
  ADD COLUMN IF NOT EXISTS source          text,        -- e.g. 'zotspot'
  ADD COLUMN IF NOT EXISTS source_club_id  text,        -- id in the source system
  ADD COLUMN IF NOT EXISTS source_url      text,        -- link to the source listing
  ADD COLUMN IF NOT EXISTS source_logo_url text,        -- ORIGINAL logo; logo_url stays NULL until re-hosted
  ADD COLUMN IF NOT EXISTS imported_at     timestamptz, -- when this seed row was first imported
  ADD COLUMN IF NOT EXISTS claimed_at      timestamptz, -- when an owner claimed it (mirrors user_id IS NOT NULL)
  ADD COLUMN IF NOT EXISTS published       boolean NOT NULL DEFAULT true; -- visibility gate; seeds are inserted FALSE

-- 4. Idempotent re-seed key. PARTIAL unique so it constrains ONLY seeded rows;
--    organic clubs (source IS NULL) are unaffected and can coexist.
CREATE UNIQUE INDEX IF NOT EXISTS club_profiles_source_uniq
  ON public.club_profiles (source, source_club_id)
  WHERE source IS NOT NULL AND source_club_id IS NOT NULL;

-- 5. PUBLISHED GATE — profile path (RLS). Narrow the public SELECT policy from
--    USING (true) to USING (published). Note: RLS predicates are owner-defined
--    and read `published` regardless of the caller's column grants, so no anon
--    column grant on `published` is needed. The owner policy is left intact, so
--    a club still sees its own row even when unpublished (preview / rollback).
DROP POLICY IF EXISTS "Anyone can view club profiles" ON public.club_profiles;
CREATE POLICY "Anyone can view published club profiles"
ON public.club_profiles
FOR SELECT
USING (published);

-- 6. PUBLISHED GATE — directory path (RPCs). These are SECURITY DEFINER and thus
--    BYPASS RLS, so the filter must be explicit. Signatures unchanged (published
--    is filtered, not returned); CREATE OR REPLACE preserves grants, re-GRANTed
--    below for safety.
CREATE OR REPLACE FUNCTION public.get_all_clubs_public()
RETURNS TABLE (
  id uuid, club_name text, description text, category text, logo_url text,
  banner_url text, website_url text, linkedin_url text, discord_url text,
  instagram_url text, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cp.id, cp.club_name, cp.description, cp.category, cp.logo_url,
         cp.banner_url, cp.website_url, cp.linkedin_url, cp.discord_url,
         cp.instagram_url, cp.created_at, cp.updated_at
  FROM public.club_profiles cp
  WHERE cp.published;
$$;

CREATE OR REPLACE FUNCTION public.get_club_public_profile(club_profile_id uuid)
RETURNS TABLE (
  id uuid, club_name text, description text, category text, logo_url text,
  banner_url text, website_url text, linkedin_url text, discord_url text,
  instagram_url text, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cp.id, cp.club_name, cp.description, cp.category, cp.logo_url,
         cp.banner_url, cp.website_url, cp.linkedin_url, cp.discord_url,
         cp.instagram_url, cp.created_at, cp.updated_at
  FROM public.club_profiles cp
  WHERE cp.id = club_profile_id AND cp.published;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_clubs_public() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_club_public_profile(uuid) TO authenticated, anon;

-- 7. Public discovery: extend anon's column allowlist (20260712000100) so the
--    unclaimed PROFILE page can render the "Source: … · imported …" line.
--    source_club_id / source_logo_url / published are intentionally NOT granted
--    (internal; the re-host + publish jobs run with the service role).
GRANT SELECT (source, source_url, imported_at, claimed_at) ON public.club_profiles TO anon;

COMMIT;

-- Directory renders unclaimed clubs identically to claimed ones (maintainer
-- decision); the unclaimed treatment lives only on the club profile page. No
-- schema implication — recorded so the UI slice honors it.
