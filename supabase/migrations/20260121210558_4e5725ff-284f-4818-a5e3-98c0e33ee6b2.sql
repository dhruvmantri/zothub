-- Fix 1: Allow invitees to view their own pending/declined invitations
CREATE POLICY "Invitees can view their own invitation"
ON club_team_members FOR SELECT
USING (
  is_team_invitation_recipient(email)
);

-- Fix 2: Create trigger to delete notification when team member is deleted
CREATE OR REPLACE FUNCTION public.cleanup_team_invitation_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete any notifications that reference this team member
  DELETE FROM notifications
  WHERE related_id = OLD.id
    AND type = 'team_invitation';
  
  RETURN OLD;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_team_member_deleted
  BEFORE DELETE ON club_team_members
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_team_invitation_notification();