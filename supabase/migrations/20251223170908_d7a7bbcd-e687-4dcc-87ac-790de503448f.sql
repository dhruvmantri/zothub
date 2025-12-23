-- Add policy to allow clubs to view all their own opportunities (including drafts)
CREATE POLICY "Clubs can view all their own opportunities" 
ON public.opportunities 
FOR SELECT 
USING (
  club_id IN (
    SELECT id FROM public.club_profiles 
    WHERE user_id = auth.uid()
  )
);