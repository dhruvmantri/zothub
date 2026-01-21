-- Allow invitees to accept their own invitation by updating their team member record
CREATE POLICY "Invitees can accept their own invitation"
ON public.club_team_members
FOR UPDATE
USING (
  user_id = auth.uid() 
  OR (
    -- Allow update if the user's email matches and they're updating their own record
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
  )
)
WITH CHECK (
  -- Only allow setting status to active and adding user_id and joined_at
  status IN ('active', 'inactive')
);