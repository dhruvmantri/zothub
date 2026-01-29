-- Create table to store pending email verifications
CREATE TABLE public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'club')),
  password_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for unauthenticated access (needed before user is created)
CREATE POLICY "Anyone can insert verification" ON public.email_verifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can select by email" ON public.email_verifications
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update verification status" ON public.email_verifications
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete expired verifications" ON public.email_verifications
  FOR DELETE USING (expires_at < now());

-- Indexes for performance
CREATE INDEX idx_email_verifications_expires ON public.email_verifications(expires_at);
CREATE INDEX idx_email_verifications_email ON public.email_verifications(email);
CREATE INDEX idx_email_verifications_code ON public.email_verifications(email, code);