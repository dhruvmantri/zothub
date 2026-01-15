-- 1. Allow users to delete their own sent messages
CREATE POLICY "Users can delete their own sent messages"
ON public.messages
FOR DELETE
USING (sender_id = auth.uid());

-- 2. Add team_invitations preference column
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS team_invitations boolean DEFAULT true;

-- 3. Create function to notify team invitation (looks up user by email)
CREATE OR REPLACE FUNCTION public.notify_team_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_club_name TEXT;
  v_invitee_user_id UUID;
  v_should_notify BOOLEAN;
BEGIN
  -- Get club name
  SELECT club_name INTO v_club_name
  FROM club_profiles
  WHERE id = NEW.club_id;

  -- Find user by email (if they have an account)
  SELECT id INTO v_invitee_user_id
  FROM auth.users
  WHERE email = NEW.email;

  -- Only create notification if user exists
  IF v_invitee_user_id IS NOT NULL THEN
    -- Store the user_id on the team member record
    UPDATE club_team_members
    SET user_id = v_invitee_user_id
    WHERE id = NEW.id;

    -- Check notification preferences
    SELECT COALESCE(team_invitations, true) INTO v_should_notify
    FROM notification_preferences
    WHERE user_id = v_invitee_user_id;

    IF v_should_notify IS NULL THEN
      v_should_notify := true;
    END IF;

    IF v_should_notify THEN
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (
        v_invitee_user_id,
        'team_invitation',
        'Club Invitation',
        'You have been invited to join ' || v_club_name || ' as ' || NEW.role || '.',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Create trigger for team invitations
DROP TRIGGER IF EXISTS on_team_member_invited ON public.club_team_members;
CREATE TRIGGER on_team_member_invited
  AFTER INSERT ON public.club_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_team_invitation();