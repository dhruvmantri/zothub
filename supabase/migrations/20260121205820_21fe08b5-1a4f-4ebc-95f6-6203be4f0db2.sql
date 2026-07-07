-- Simplify RLS policies for team member invitations
-- Drop the existing complex policy
DROP POLICY IF EXISTS "Invitees can accept their own invitation" ON club_team_members;

-- Create a clear policy for invitees to respond to their pending invitation
-- They can update their own pending invitation to either 'active' or 'declined'
CREATE POLICY "Invitees can respond to their invitation"
ON club_team_members FOR UPDATE
USING (
  is_team_invitation_recipient(email) AND status = 'pending'
)
WITH CHECK (
  status IN ('active', 'declined')
);