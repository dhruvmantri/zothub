import { useCallback } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface ProfileInfo {
  id: string;
  name: string;
  avatar?: string;
  isClub: boolean;
  userId: string;
}

/**
 * Resolve a user id to a display profile (club first, then student).
 *
 * Previously this kept its "cache" in component-local `useState<Map>`, which had
 * two consequences the old comment claimed the opposite of:
 *
 *   1. The cache died on every unmount, so it cached nothing across navigation —
 *      and the nav remounts per route. A single club-dashboard navigation fired
 *      four separate `club_profiles` lookups.
 *   2. `fetchProfileInfo` listed `profileCache` in its deps, so writing to the
 *      cache produced a NEW callback identity, which re-ran every effect that
 *      depended on it — including `useAccountIdentity`'s — causing the refetch
 *      the cache was meant to prevent.
 *
 * It now uses the TanStack Query cache, which is genuinely shared across
 * components and survives unmount (UX15). That is what actually fixes the avatar
 * flashing the wrong initials on every navigation (UX7).
 */

export const profileKeys = {
  all: ["profile"] as const,
  byUser: (userId: string) => ["profile", "byUser", userId] as const,
};

/** The resolver itself — plain async, so it can be reused by both hooks below. */
export async function resolveProfile(userId: string): Promise<ProfileInfo | null> {
  const { data: clubProfile } = await supabase
    .from("club_profiles")
    .select("id, club_name, logo_url, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (clubProfile) {
    return {
      id: clubProfile.id,
      name: clubProfile.club_name,
      avatar: clubProfile.logo_url || undefined,
      isClub: true,
      userId: clubProfile.user_id,
    };
  }

  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select("id, full_name, avatar_url, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (studentProfile) {
    return {
      id: studentProfile.id,
      name: studentProfile.full_name || "Student",
      avatar: studentProfile.avatar_url || undefined,
      isClub: false,
      userId: studentProfile.user_id,
    };
  }

  return null;
}

/** Declarative single-profile read. Prefer this in components. */
export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: profileKeys.byUser(userId ?? "none"),
    queryFn: () => resolveProfile(userId!),
    enabled: Boolean(userId),
  });
}

/**
 * Imperative access, for call sites that resolve profiles inside an event handler
 * or a loop rather than at render time (messaging, notifications).
 *
 * `fetchQuery` reads through the SAME shared cache, so these callers now benefit
 * from — and contribute to — it. Both callbacks have stable identities, so they
 * no longer invalidate the effects that depend on them.
 */
export function useProfileLookup() {
  const queryClient = useQueryClient();

  const fetchProfileInfo = useCallback(
    (userId: string): Promise<ProfileInfo | null> =>
      queryClient.fetchQuery({
        queryKey: profileKeys.byUser(userId),
        queryFn: () => resolveProfile(userId),
      }),
    [queryClient],
  );

  /**
   * Batch resolve, preserving the N+1 fix: only ids missing from the cache are
   * queried, in two `.in()` reads rather than one request per user. Results are
   * written back into the shared cache so later single lookups are free.
   */
  const fetchProfileInfoBatch = useCallback(
    async (userIds: string[]): Promise<Map<string, ProfileInfo>> => {
      const results = new Map<string, ProfileInfo>();
      const uncachedIds: string[] = [];

      for (const id of userIds) {
        const cached = queryClient.getQueryData<ProfileInfo | null>(profileKeys.byUser(id));
        if (cached) results.set(id, cached);
        else if (!uncachedIds.includes(id)) uncachedIds.push(id);
      }

      if (uncachedIds.length === 0) return results;

      try {
        const { data: clubProfiles } = await supabase
          .from("club_profiles")
          .select("id, club_name, logo_url, user_id")
          .in("user_id", uncachedIds);

        const foundClubUserIds = new Set<string>();
        for (const cp of clubProfiles || []) {
          results.set(cp.user_id, {
            id: cp.id,
            name: cp.club_name,
            avatar: cp.logo_url || undefined,
            isClub: true,
            userId: cp.user_id,
          });
          foundClubUserIds.add(cp.user_id);
        }

        const remainingIds = uncachedIds.filter((id) => !foundClubUserIds.has(id));
        if (remainingIds.length > 0) {
          const { data: studentProfiles } = await supabase
            .from("student_profiles")
            .select("id, full_name, avatar_url, user_id")
            .in("user_id", remainingIds);

          for (const sp of studentProfiles || []) {
            results.set(sp.user_id, {
              id: sp.id,
              name: sp.full_name || "Student",
              avatar: sp.avatar_url || undefined,
              isClub: false,
              userId: sp.user_id,
            });
          }
        }

        // Seed the shared cache so a later single lookup is a cache hit.
        results.forEach((info, userId) => {
          queryClient.setQueryData(profileKeys.byUser(userId), info);
        });
      } catch (error) {
        console.error("Error batch fetching profiles:", error);
      }

      return results;
    },
    [queryClient],
  );

  const clearCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: profileKeys.all });
  }, [queryClient]);

  return { fetchProfileInfo, fetchProfileInfoBatch, clearCache };
}

/** Drop every cached profile — call on sign-out so the next account starts clean. */
export function clearProfileCache(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: profileKeys.all });
}
