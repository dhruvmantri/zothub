import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type BookmarkType = "opportunity" | "event" | "club";

// User-facing plural forms — "opportunity" doesn't pluralize as `${type}s`.
const TYPE_PLURALS: Record<BookmarkType, string> = {
  opportunity: "opportunities",
  event: "events",
  club: "clubs",
};

export function useBookmarks(type: BookmarkType) {
  const { user } = useAuth();
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const columnName = `${type}_id` as const;

  useEffect(() => {
    if (user) {
      fetchBookmarks();
    } else {
      setBookmarkedIds(new Set());
      setIsLoading(false);
    }
  }, [user]);

  const fetchBookmarks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("bookmarks")
        .select(columnName)
        .eq("user_id", user.id)
        .not(columnName, "is", null);

      if (error) {
        console.error(`Error fetching ${type} bookmarks:`, error);
        return;
      }

      const ids = new Set(
        data?.map((b) => b[columnName]).filter(Boolean) as string[]
      );
      setBookmarkedIds(ids);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // "Following a club" is stored as a bookmark, but the product language for the
  // club relationship is Follow/Following/Unfollow. Opportunity/event bookmarks
  // keep the "bookmark"/"save" wording.
  const isClub = type === "club";

  const toggleBookmark = async (id: string) => {
    if (!user) {
      toast.error(isClub ? "Please log in to follow clubs" : `Please log in to bookmark ${TYPE_PLURALS[type]}`);
      return;
    }

    const isCurrentlyBookmarked = bookmarkedIds.has(id);

    try {
      if (isCurrentlyBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq(columnName, id);

        if (error) throw error;

        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success(isClub ? "Unfollowed" : "Bookmark removed");
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ user_id: user.id, [columnName]: id });

        // All bookmark types are DB-unique via per-column partial unique
        // indexes (club follows in WS3; opportunity/event in WS8), so a
        // duplicate insert (double-click, retry, or concurrent toggle) raises
        // 23505. Treat that as success — the bookmark already exists — instead
        // of surfacing a raw error, keeping the action idempotent.
        if (error && error.code !== "23505") throw error;

        setBookmarkedIds((prev) => new Set(prev).add(id));
        toast.success(isClub ? "Following" : `${type.charAt(0).toUpperCase() + type.slice(1)} bookmarked`);
      }
    } catch (err) {
      console.error("Error toggling bookmark:", err);
      toast.error(isClub ? "Failed to update follow" : "Failed to update bookmark");
    }
  };

  const isBookmarked = (id: string) => bookmarkedIds.has(id);

  return {
    bookmarkedIds,
    isBookmarked,
    toggleBookmark,
    isLoading,
    refetch: fetchBookmarks,
  };
}
