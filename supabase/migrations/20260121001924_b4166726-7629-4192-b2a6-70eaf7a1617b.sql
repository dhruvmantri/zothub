-- Phase 1: Database Migrations for ZotHub PRD Features

-- 1. Add show_application_count to opportunities table
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS show_application_count boolean DEFAULT false;

-- 2. Add RSVP form fields to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS rsvp_questions jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT false;

-- 3. Add answers to rsvps table for RSVP form responses
ALTER TABLE public.rsvps 
ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '{}'::jsonb;

-- 4. Add display_order to club_team_members for custom ordering
ALTER TABLE public.club_team_members 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- 5. Create reminder_logs table to track sent reminders (prevent duplicates)
CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reminder_type text NOT NULL,
  target_id uuid NOT NULL,
  user_id uuid NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_reminder UNIQUE (reminder_type, target_id, user_id)
);

-- Enable RLS on reminder_logs
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

-- Only system can insert reminders (via edge functions with service role)
CREATE POLICY "System can insert reminder logs"
ON public.reminder_logs
FOR INSERT
WITH CHECK (true);

-- Users can view their own reminder logs
CREATE POLICY "Users can view their own reminder logs"
ON public.reminder_logs
FOR SELECT
USING (user_id = auth.uid());

-- 6. Create club_followers table for tracking who follows which clubs
CREATE TABLE IF NOT EXISTS public.club_followers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  club_id uuid NOT NULL REFERENCES public.club_profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_follow UNIQUE (user_id, club_id)
);

-- Enable RLS on club_followers
ALTER TABLE public.club_followers ENABLE ROW LEVEL SECURITY;

-- Users can view all followers (for count display)
CREATE POLICY "Anyone can view follower counts"
ON public.club_followers
FOR SELECT
USING (true);

-- Users can follow clubs
CREATE POLICY "Users can follow clubs"
ON public.club_followers
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can unfollow clubs
CREATE POLICY "Users can unfollow clubs"
ON public.club_followers
FOR DELETE
USING (user_id = auth.uid());

-- 7. Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_club_followers_club_id ON public.club_followers(club_id);
CREATE INDEX IF NOT EXISTS idx_club_followers_user_id ON public.club_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_target ON public.reminder_logs(reminder_type, target_id);
CREATE INDEX IF NOT EXISTS idx_team_members_display_order ON public.club_team_members(club_id, display_order);