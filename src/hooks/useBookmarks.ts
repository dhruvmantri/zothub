import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type BookmarkType = "opportunity" | "event" | "club";

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

  const toggleBookmark = async (id: string) => {
    if (!user) {
      toast.error(`Please log in to bookmark ${type}s`);
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
        toast.success("Bookmark removed");
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ user_id: user.id, [columnName]: id });

        // Club follows are DB-unique via a partial unique index, so a duplicate
        // insert (double-click, retry, or concurrent follow) raises 23505. Treat
        // that as success — the relationship already exists — instead of surfacing
        // a raw error, keeping the action idempotent.
        if (error && error.code !== "23505") throw error;

        setBookmarkedIds((prev) => new Set(prev).add(id));
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} bookmarked`);
      }
    } catch (err) {
      console.error("Error toggling bookmark:", err);
      toast.error("Failed to update bookmark");
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
