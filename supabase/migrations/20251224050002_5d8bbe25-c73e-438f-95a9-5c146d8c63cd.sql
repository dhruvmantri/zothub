-- Allow anyone to view club profiles (clubs are public entities)
CREATE POLICY "Anyone can view club profiles" 
ON public.club_profiles 
FOR SELECT 
USING (true);