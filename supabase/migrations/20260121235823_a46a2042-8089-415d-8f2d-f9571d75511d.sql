-- Create page_views table for deduplicated view tracking
CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- nullable for anonymous visitors
  session_id TEXT, -- fallback for anonymous users
  item_type TEXT NOT NULL CHECK (item_type IN ('opportunity', 'event', 'club')),
  item_id UUID NOT NULL,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Unique per user/session per item per day (prevents duplicate counts from refreshes)
  CONSTRAINT unique_user_view UNIQUE(user_id, item_type, item_id, view_date),
  CONSTRAINT unique_session_view UNIQUE(session_id, item_type, item_id, view_date)
);

-- Indexes for fast lookups
CREATE INDEX idx_page_views_item ON page_views(item_type, item_id);
CREATE INDEX idx_page_views_date ON page_views(view_date);
CREATE INDEX idx_page_views_created ON page_views(created_at);

-- Enable RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert page views (including anonymous)
CREATE POLICY "Anyone can insert page views" ON page_views
  FOR INSERT WITH CHECK (true);

-- Clubs can view their own content's page views
CREATE POLICY "Clubs can view their content views" ON page_views
  FOR SELECT USING (
    item_id IN (
      SELECT id FROM opportunities WHERE club_id IN (
        SELECT id FROM club_profiles WHERE user_id = auth.uid()
      )
    ) OR
    item_id IN (
      SELECT id FROM events WHERE club_id IN (
        SELECT id FROM club_profiles WHERE user_id = auth.uid()
      )
    ) OR
    item_id IN (
      SELECT id FROM club_profiles WHERE user_id = auth.uid()
    )
  );

-- Add views column to club_profiles
ALTER TABLE club_profiles ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- Create RPC function for tracking page views
CREATE OR REPLACE FUNCTION track_page_view(
  p_item_type TEXT,
  p_item_id UUID,
  p_session_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_inserted BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  
  -- Try to insert with user_id if logged in
  IF v_user_id IS NOT NULL THEN
    INSERT INTO page_views (user_id, session_id, item_type, item_id, view_date)
    VALUES (v_user_id, p_session_id, p_item_type, p_item_id, CURRENT_DATE)
    ON CONFLICT ON CONSTRAINT unique_user_view DO NOTHING;
    
    IF FOUND THEN
      v_inserted := true;
    END IF;
  ELSIF p_session_id IS NOT NULL THEN
    -- Try to insert with session_id for anonymous users
    INSERT INTO page_views (user_id, session_id, item_type, item_id, view_date)
    VALUES (NULL, p_session_id, p_item_type, p_item_id, CURRENT_DATE)
    ON CONFLICT ON CONSTRAINT unique_session_view DO NOTHING;
    
    IF FOUND THEN
      v_inserted := true;
    END IF;
  END IF;
  
  -- Only update denormalized count if a new view was inserted
  IF v_inserted THEN
    IF p_item_type = 'opportunity' THEN
      UPDATE opportunities SET views = COALESCE(views, 0) + 1 WHERE id = p_item_id;
    ELSIF p_item_type = 'event' THEN
      UPDATE events SET views = COALESCE(views, 0) + 1 WHERE id = p_item_id;
    ELSIF p_item_type = 'club' THEN
      UPDATE club_profiles SET views = COALESCE(views, 0) + 1 WHERE id = p_item_id;
    END IF;
  END IF;
END;
$$;