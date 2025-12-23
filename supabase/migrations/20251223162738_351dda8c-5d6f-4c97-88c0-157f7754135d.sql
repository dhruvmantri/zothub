-- Create club_team_members table for team management
CREATE TABLE public.club_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.club_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(club_id, email)
);

-- Enable RLS
ALTER TABLE public.club_team_members ENABLE ROW LEVEL SECURITY;

-- Club admins can manage their team members
CREATE POLICY "Club admins can view their team members"
ON public.club_team_members
FOR SELECT
USING (club_id IN (
  SELECT id FROM club_profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Club admins can insert team members"
ON public.club_team_members
FOR INSERT
WITH CHECK (club_id IN (
  SELECT id FROM club_profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Club admins can update team members"
ON public.club_team_members
FOR UPDATE
USING (club_id IN (
  SELECT id FROM club_profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Club admins can delete team members"
ON public.club_team_members
FOR DELETE
USING (club_id IN (
  SELECT id FROM club_profiles WHERE user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_club_team_members_updated_at
BEFORE UPDATE ON public.club_team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-archive past events
CREATE OR REPLACE FUNCTION public.archive_past_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET is_active = false
  WHERE is_active = true
    AND event_date < (now() - INTERVAL '1 hour');
END;
$$;