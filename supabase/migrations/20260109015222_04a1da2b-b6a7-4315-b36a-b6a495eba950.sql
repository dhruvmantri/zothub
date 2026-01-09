-- Drop the check constraint that prevents club-only bookmarks
ALTER TABLE public.bookmarks DROP CONSTRAINT IF EXISTS bookmarks_check;