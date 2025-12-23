-- Create user role enum
CREATE TYPE public.user_role AS ENUM ('student', 'club');

-- Create user roles table (security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own role on signup"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Student profiles table
CREATE TABLE public.student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  major TEXT,
  year TEXT,
  graduation_date DATE,
  skills TEXT[],
  interests TEXT[],
  resume_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  github_url TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view all student profiles"
ON public.student_profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Students can insert their own profile"
ON public.student_profiles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'student'));

CREATE POLICY "Students can update their own profile"
ON public.student_profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Club profiles table
CREATE TABLE public.club_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  club_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  logo_url TEXT,
  banner_url TEXT,
  website_url TEXT,
  instagram_url TEXT,
  discord_url TEXT,
  linkedin_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.club_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club profiles"
ON public.club_profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Clubs can insert their own profile"
ON public.club_profiles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'club'));

CREATE POLICY "Clubs can update their own profile"
ON public.club_profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Opportunities table
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.club_profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  requirements TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  application_questions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active opportunities"
ON public.opportunities FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Clubs can insert their own opportunities"
ON public.opportunities FOR INSERT
TO authenticated
WITH CHECK (
  club_id IN (SELECT id FROM public.club_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Clubs can update their own opportunities"
ON public.opportunities FOR UPDATE
TO authenticated
USING (
  club_id IN (SELECT id FROM public.club_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Clubs can delete their own opportunities"
ON public.opportunities FOR DELETE
TO authenticated
USING (
  club_id IN (SELECT id FROM public.club_profiles WHERE user_id = auth.uid())
);

-- Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES public.club_profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  capacity INTEGER,
  banner_url TEXT,
  is_active BOOLEAN DEFAULT true,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active events"
ON public.events FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Clubs can insert their own events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (
  club_id IN (SELECT id FROM public.club_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Clubs can update their own events"
ON public.events FOR UPDATE
TO authenticated
USING (
  club_id IN (SELECT id FROM public.club_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Clubs can delete their own events"
ON public.events FOR DELETE
TO authenticated
USING (
  club_id IN (SELECT id FROM public.club_profiles WHERE user_id = auth.uid())
);

-- Applications table
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.student_profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
  answers JSONB DEFAULT '{}'::jsonb,
  resume_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, student_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own applications"
ON public.applications FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid())
  OR
  opportunity_id IN (
    SELECT o.id FROM public.opportunities o
    JOIN public.club_profiles c ON o.club_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Students can insert their own applications"
ON public.applications FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Clubs can update applications to their opportunities"
ON public.applications FOR UPDATE
TO authenticated
USING (
  opportunity_id IN (
    SELECT o.id FROM public.opportunities o
    JOIN public.club_profiles c ON o.club_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

-- RSVPs table
CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.student_profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (event_id, student_id)
);

ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own RSVPs"
ON public.rsvps FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid())
  OR
  event_id IN (
    SELECT e.id FROM public.events e
    JOIN public.club_profiles c ON e.club_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

CREATE POLICY "Students can insert their own RSVPs"
ON public.rsvps FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Students can update their own RSVPs"
ON public.rsvps FOR UPDATE
TO authenticated
USING (
  student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid())
);

-- Bookmarks table
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (
    (opportunity_id IS NOT NULL AND event_id IS NULL) OR
    (opportunity_id IS NULL AND event_id IS NOT NULL)
  )
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookmarks"
ON public.bookmarks FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own bookmarks"
ON public.bookmarks FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own bookmarks"
ON public.bookmarks FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
ON public.messages FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update messages they received"
ON public.messages FOR UPDATE
TO authenticated
USING (receiver_id = auth.uid());

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_student_profiles_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_club_profiles_updated_at
  BEFORE UPDATE ON public.club_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();