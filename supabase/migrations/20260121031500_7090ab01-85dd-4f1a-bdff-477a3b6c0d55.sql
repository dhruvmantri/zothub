-- Drop the existing problematic policy that queries auth.users
DROP POLICY IF EXISTS "Invitees can accept their own invitation" ON public.club_team_members;

-- Create corrected policy using auth.jwt() for email check
CREATE POLICY "Invitees can accept their own invitation"
ON public.club_team_members
FOR UPDATE
USING (
  (user_id = auth.uid()) 
  OR (
    email = (auth.jwt() ->> 'email') 
    AND status = 'pending'
  )
)
WITH CHECK (status = ANY (ARRAY['active', 'inactive']));