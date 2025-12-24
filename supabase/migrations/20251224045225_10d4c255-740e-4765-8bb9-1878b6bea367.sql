-- Create security definer function to check if a club owns an opportunity
CREATE OR REPLACE FUNCTION public.club_owns_opportunity(opp_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM opportunities o
    JOIN club_profiles c ON o.club_id = c.id
    WHERE o.id = opp_id AND c.user_id = auth.uid()
  )
$$;

-- Create security definer function to check if a student profile belongs to current user
CREATE OR REPLACE FUNCTION public.is_own_student_profile(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM student_profiles
    WHERE id = profile_id AND user_id = auth.uid()
  )
$$;

-- Create security definer function to check if club can view a student (applicant or RSVP)
CREATE OR REPLACE FUNCTION public.club_can_view_student(student_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Student applied to club's opportunity
    SELECT 1
    FROM applications a
    JOIN opportunities o ON a.opportunity_id = o.id
    JOIN club_profiles c ON o.club_id = c.id
    WHERE a.student_id = student_profile_id AND c.user_id = auth.uid()
  ) OR EXISTS (
    -- Student RSVP'd to club's event
    SELECT 1
    FROM rsvps r
    JOIN events e ON r.event_id = e.id
    JOIN club_profiles c ON e.club_id = c.id
    WHERE r.student_id = student_profile_id AND c.user_id = auth.uid()
  )
$$;

-- Drop existing problematic policies on applications
DROP POLICY IF EXISTS "Students can view their own applications" ON public.applications;

-- Recreate applications SELECT policy using functions
CREATE POLICY "Students can view their own applications" 
ON public.applications 
FOR SELECT 
USING (
  public.is_own_student_profile(student_id) 
  OR public.club_owns_opportunity(opportunity_id)
);

-- Drop existing problematic policies on student_profiles
DROP POLICY IF EXISTS "Clubs can view applicant profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Clubs can view RSVP student profiles" ON public.student_profiles;

-- Recreate student_profiles SELECT policies using functions
CREATE POLICY "Clubs can view student profiles" 
ON public.student_profiles 
FOR SELECT 
USING (public.club_can_view_student(id));

-- Drop existing problematic policy on rsvps
DROP POLICY IF EXISTS "Students can view their own RSVPs" ON public.rsvps;

-- Recreate rsvps SELECT policy using functions
CREATE POLICY "Students can view their own RSVPs" 
ON public.rsvps 
FOR SELECT 
USING (
  public.is_own_student_profile(student_id) 
  OR EXISTS (
    SELECT 1 FROM events e
    JOIN club_profiles c ON e.club_id = c.id
    WHERE e.id = event_id AND c.user_id = auth.uid()
  )
);