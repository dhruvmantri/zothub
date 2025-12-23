-- Create storage bucket for club assets (logos, banners)
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-assets', 'club-assets', true);

-- Create storage bucket for student resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-resumes', 'student-resumes', false);

-- RLS policies for club-assets bucket
CREATE POLICY "Club owners can upload their assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'club-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Club owners can update their assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'club-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Club owners can delete their assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'club-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Club assets are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'club-assets');

-- RLS policies for student-resumes bucket
CREATE POLICY "Students can upload their resumes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'student-resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can update their resumes"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'student-resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can delete their resumes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'student-resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can view their own resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-resumes' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Clubs can view resumes of applicants
CREATE POLICY "Clubs can view applicant resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'student-resumes'
  AND EXISTS (
    SELECT 1 FROM applications a
    JOIN opportunities o ON a.opportunity_id = o.id
    JOIN club_profiles c ON o.club_id = c.id
    JOIN student_profiles s ON a.student_id = s.id
    WHERE c.user_id = auth.uid()
    AND s.user_id::text = (storage.foldername(name))[1]
  )
);