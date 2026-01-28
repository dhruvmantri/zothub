-- Create waitlist table to track pending signups
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'club')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Users can view their own waitlist entry
CREATE POLICY "Users can view their own waitlist entry"
  ON public.waitlist FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own waitlist entry on signup
CREATE POLICY "Users can insert their own waitlist entry"
  ON public.waitlist FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all waitlist entries
CREATE POLICY "Admins can view all waitlist entries"
  ON public.waitlist FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update waitlist entries
CREATE POLICY "Admins can update waitlist entries"
  ON public.waitlist FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete waitlist entries
CREATE POLICY "Admins can delete waitlist entries"
  ON public.waitlist FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Add indexes for performance
CREATE INDEX idx_waitlist_status ON public.waitlist(status);
CREATE INDEX idx_waitlist_user_id ON public.waitlist(user_id);