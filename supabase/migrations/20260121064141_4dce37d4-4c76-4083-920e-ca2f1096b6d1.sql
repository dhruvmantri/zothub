-- Drop the existing policy and recreate with normalized email matching
DROP POLICY IF EXISTS "Invitees can accept their own invitation" ON public.club_team_members;

-- Create improved policy with normalized email comparison and user_metadata fallback
CREATE POLICY "Invitees can accept their own invitation"
ON public.club_team_members
FOR UPDATE
USING (
  (user_id = auth.uid()) 
  OR (
    lower(trim(email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email')))
    AND status = 'pending'
  )
)
WITH CHECK (status = ANY (ARRAY['active', 'inactive']));