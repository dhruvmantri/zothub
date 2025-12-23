-- Drop the view and recreate with security invoker (default for views in PG 15+)
-- We need to use a function instead to properly bypass RLS for the limited public data
DROP VIEW IF EXISTS public.student_profiles_public;

-- Create a security definer function that returns only public-safe student data
-- This is intentionally a security definer because we want to expose limited fields publicly
CREATE OR REPLACE FUNCTION public.get_student_public_profile(profile_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  major text,
  year text,
  skills text[],
  interests text[],
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sp.id,
    sp.full_name,
    sp.major,
    sp.year,
    sp.skills,
    sp.interests,
    sp.avatar_url
  FROM public.student_profiles sp
  WHERE sp.id = profile_id;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_student_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_public_profile(uuid) TO anon;