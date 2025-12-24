-- Add club_id column to bookmarks table for "Follow Club" functionality
ALTER TABLE public.bookmarks ADD COLUMN club_id uuid REFERENCES public.club_profiles(id) ON DELETE CASCADE;

-- Add RLS policy for public viewing of active team members
CREATE POLICY "Anyone can view active team members"
ON public.club_team_members
FOR SELECT
USING (status = 'active');