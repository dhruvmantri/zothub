-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Students can view all student profiles" ON public.student_profiles;

-- Create a view for public-safe student profile data (non-sensitive fields only)
CREATE OR REPLACE VIEW public.student_profiles_public AS
SELECT 
  id,
  full_name,
  major,
  year,
  skills,
  interests,
  avatar_url
FROM public.student_profiles;

-- Policy 1: Students can view their own FULL profile
CREATE POLICY "Students can view their own full profile"
ON public.student_profiles
FOR SELECT
USING (user_id = auth.uid());

-- Policy 2: Clubs can view profiles of students who applied to their opportunities
CREATE POLICY "Clubs can view applicant profiles"
ON public.student_profiles
FOR SELECT
USING (
  id IN (
    SELECT a.student_id
    FROM applications a
    JOIN opportunities o ON a.opportunity_id = o.id
    JOIN club_profiles c ON o.club_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

-- Policy 3: Clubs can view profiles of students who RSVP'd to their events
CREATE POLICY "Clubs can view RSVP student profiles"
ON public.student_profiles
FOR SELECT
USING (
  id IN (
    SELECT r.student_id
    FROM rsvps r
    JOIN events e ON r.event_id = e.id
    JOIN club_profiles c ON e.club_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

-- Grant SELECT on the public view to authenticated users
GRANT SELECT ON public.student_profiles_public TO authenticated;
GRANT SELECT ON public.student_profiles_public TO anon;