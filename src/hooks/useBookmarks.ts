import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  bookmarkKeys,
  studentActivityKeys,
  EMPTY_ID_SET,
  type BookmarkType,
} from "@/lib/queryKeys";

// User-facing plural forms — "opportunity" doesn't pluralize as `${type}s`.
const TYPE_PLURALS: Record<BookmarkType, string> = {
  opportunity: "opportunities",
  event: "events",
  club: "clubs",
};

/**
 * Fetch the viewer's bookmarked ids of one type.
 *
 * Throws on error rather than logging and returning. supabase-js RESOLVES with
 * `{data, error}`, so the previous `if (error) { console.error(); return; }`
 * would have cached `undefined` as a *successful* result once this moved into a
 * query — silently emptying every heart icon on the page after one transient
 * failure, with no retry and no error state.
 */
async function fetchBookmarkIds(userId: string, type: BookmarkType): Promise<Set<string>> {
  const columnName = `${type}_id` as const;
  const { data, error } = await supabase
    .from("bookmarks")
    .select(columnName)
    .eq("user_id", userId)
    .not(columnName, "is", null);

  if (error) throw new Error(`Failed to load ${type} bookmarks: ${error.message}`);

  return new Set(
    (data ?? []).map((row) => (row as Record<string, unknown>)[columnName]).filter(Boolean) as string[],
  );
}

export function useBookmarks(type: BookmarkType) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const columnName = `${type}_id` as const;

  // Keyed on user.id (a string), NOT the user object: AuthContext calls
  // setUser(session?.user) on every auth event including TOKEN_REFRESHED, which
  // produces a new object identity for the same person. Keying on the object
  // would throw the cache away on every token refresh.
  const query = useQuery({
    queryKey: bookmarkKeys.byType(userId ?? "anon", type),
    queryFn: () => fetchBookmarkIds(userId!, type),
    enabled: Boolean(userId),
  });

  const bookmarkedIds = query.data ?? EMPTY_ID_SET;

  // "Following a club" is stored as a bookmark, but the product language for the
  // club relationship is Follow/Following/Unfollow. Opportunity/event bookmarks
  // keep the "bookmark"/"save" wording.
  const isClub = type === "club";

  const mutation = useMutation({
    mutationFn: async ({ id, isBookmarked }: { id: string; isBookmarked: boolean }) => {
      if (!userId) throw new Error("not signed in");

      if (isBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", userId)
          .eq(columnName, id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("bookmarks")
        .insert({ user_id: userId, [columnName]: id });

      // All bookmark types are DB-unique via per-column partial unique indexes
      // (club follows in WS3; opportunity/event in WS8), so a duplicate insert
      // (double-click, retry, or concurrent toggle) raises 23505. Treat that as
      // success — the bookmark already exists — instead of surfacing a raw
      // error, keeping the action idempotent.
      if (error && error.code !== "23505") throw error;
    },

    onSuccess: (_data, { id, isBookmarked }) => {
      // Patch the cached Set directly, then invalidate. The patch is what keeps
      // the heart filling instantly; the invalidation is what reconciles with
      // whatever the server actually holds.
      queryClient.setQueryData<Set<string>>(
        bookmarkKeys.byType(userId!, type),
        (prev) => {
          const next = new Set(prev ?? []);
          if (isBookmarked) next.delete(id);
          else next.add(id);
          return next;
        },
      );
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.byType(userId!, type) });
      // The student Activity page rolls up saved + followed items.
      queryClient.invalidateQueries({ queryKey: studentActivityKeys.byUser(userId!) });

      toast.success(
        isBookmarked
          ? isClub
            ? "Unfollowed"
            : "Bookmark removed"
          : isClub
            ? "Following"
            : `${type.charAt(0).toUpperCase() + type.slice(1)} bookmarked`,
      );
    },

    onError: (err) => {
      console.error("Error toggling bookmark:", err);
      toast.error(isClub ? "Failed to update follow" : "Failed to update bookmark");
    },
  });

  const toggleBookmark = useCallback(
    (id: string) => {
      if (!userId) {
        toast.error(
          isClub ? "Please log in to follow clubs" : `Please log in to bookmark ${TYPE_PLURALS[type]}`,
        );
        return;
      }
      mutation.mutate({ id, isBookmarked: bookmarkedIds.has(id) });
    },
    [userId, isClub, type, mutation, bookmarkedIds],
  );

  // Stable identity — this sits in two useMemo dependency arrays on the list
  // pages, and a fresh arrow every render would bust them.
  const isBookmarked = useCallback((id: string) => bookmarkedIds.has(id), [bookmarkedIds]);

  return {
    bookmarkedIds,
    isBookmarked,
    toggleBookmark,
    // `Boolean(userId) &&` matters: with `enabled` false, isPending stays true
    // forever, and a bare `query.isPending` would permanently disable the Follow
    // button for signed-out visitors — killing the log-in-to-follow path.
    isLoading: Boolean(userId) && query.isPending,
    refetch: query.refetch,
  };
}
