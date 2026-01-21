-- Create a security definer function to safely check if user email matches team member email
CREATE OR REPLACE FUNCTION public.is_team_invitation_recipient(member_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(member_email)) = lower(trim(COALESCE(
    auth.jwt() ->> 'email',
    auth.jwt() -> 'user_metadata' ->> 'email'
  )))
$$;

-- Drop and recreate the policy using the security definer function
DROP POLICY IF EXISTS "Invitees can accept their own invitation" ON public.club_team_members;

CREATE POLICY "Invitees can accept their own invitation"
ON public.club_team_members
FOR UPDATE
USING (
  (user_id = auth.uid()) 
  OR (
    is_team_invitation_recipient(email)
    AND status = 'pending'
  )
)
WITH CHECK (status = ANY (ARRAY['active', 'inactive']));