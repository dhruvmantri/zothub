-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view club profiles" ON public.club_profiles;

-- Policy 1: Clubs can view their own full profile (including email)
CREATE POLICY "Clubs can view their own full profile"
ON public.club_profiles
FOR SELECT
USING (user_id = auth.uid());

-- Create a security definer function to get public club data WITHOUT email
CREATE OR REPLACE FUNCTION public.get_club_public_profile(club_profile_id uuid)
RETURNS TABLE (
  id uuid,
  club_name text,
  description text,
  category text,
  logo_url text,
  banner_url text,
  website_url text,
  linkedin_url text,
  discord_url text,
  instagram_url text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cp.id,
    cp.club_name,
    cp.description,
    cp.category,
    cp.logo_url,
    cp.banner_url,
    cp.website_url,
    cp.linkedin_url,
    cp.discord_url,
    cp.instagram_url,
    cp.created_at,
    cp.updated_at
  FROM public.club_profiles cp
  WHERE cp.id = club_profile_id;
$$;

-- Function to get all clubs public data (for listing pages)
CREATE OR REPLACE FUNCTION public.get_all_clubs_public()
RETURNS TABLE (
  id uuid,
  club_name text,
  description text,
  category text,
  logo_url text,
  banner_url text,
  website_url text,
  linkedin_url text,
  discord_url text,
  instagram_url text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cp.id,
    cp.club_name,
    cp.description,
    cp.category,
    cp.logo_url,
    cp.banner_url,
    cp.website_url,
    cp.linkedin_url,
    cp.discord_url,
    cp.instagram_url,
    cp.created_at,
    cp.updated_at
  FROM public.club_profiles cp;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_club_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_public_profile(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_all_clubs_public() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_clubs_public() TO anon;