-- Add policy to allow clubs to view all their own events (including drafts/inactive)
CREATE POLICY "Clubs can view all their own events" 
ON public.events 
FOR SELECT 
USING (
  club_id IN (
    SELECT id FROM public.club_profiles 
    WHERE user_id = auth.uid()
  )
);