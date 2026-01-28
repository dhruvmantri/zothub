import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileInfo {
  id: string;
  name: string;
  avatar?: string;
  isClub: boolean;
  userId: string;
}

/**
 * Hook for looking up user profiles (student or club) with caching.
 * Useful for messaging, notifications, and any feature that needs to resolve user IDs to display names.
 */
export function useProfileLookup() {
  const [profileCache, setProfileCache] = useState<Map<string, ProfileInfo>>(new Map());

  const fetchProfileInfo = useCallback(async (userId: string): Promise<ProfileInfo | null> => {
    // Check cache first
    if (profileCache.has(userId)) {
      return profileCache.get(userId)!;
    }

    try {
      // Try club profile first
      const { data: clubProfile } = await supabase
        .from("club_profiles")
        .select("id, club_name, logo_url, user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (clubProfile) {
        const info: ProfileInfo = {
          id: clubProfile.id,
          name: clubProfile.club_name,
          avatar: clubProfile.logo_url || undefined,
          isClub: true,
          userId: clubProfile.user_id,
        };
        setProfileCache(prev => new Map(prev).set(userId, info));
        return info;
      }

      // Try student profile
      const { data: studentProfile } = await supabase
        .from("student_profiles")
        .select("id, full_name, avatar_url, user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (studentProfile) {
        const info: ProfileInfo = {
          id: studentProfile.id,
          name: studentProfile.full_name || "Student",
          avatar: studentProfile.avatar_url || undefined,
          isClub: false,
          userId: studentProfile.user_id,
        };
        setProfileCache(prev => new Map(prev).set(userId, info));
        return info;
      }

      return null;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  }, [profileCache]);

  /**
   * Batch fetch multiple profiles at once (fixes N+1 query pattern)
   */
  const fetchProfileInfoBatch = useCallback(async (userIds: string[]): Promise<Map<string, ProfileInfo>> => {
    const results = new Map<string, ProfileInfo>();
    const uncachedIds = userIds.filter(id => !profileCache.has(id));
    
    // Return cached results for already-known users
    userIds.forEach(id => {
      if (profileCache.has(id)) {
        results.set(id, profileCache.get(id)!);
      }
    });
    
    if (uncachedIds.length === 0) return results;
    
    try {
      // Batch fetch clubs
      const { data: clubProfiles } = await supabase
        .from("club_profiles")
        .select("id, club_name, logo_url, user_id")
        .in("user_id", uncachedIds);
      
      const foundClubUserIds = new Set<string>();
      for (const cp of clubProfiles || []) {
        const info: ProfileInfo = {
          id: cp.id,
          name: cp.club_name,
          avatar: cp.logo_url || undefined,
          isClub: true,
          userId: cp.user_id,
        };
        results.set(cp.user_id, info);
        foundClubUserIds.add(cp.user_id);
      }
      
      // Batch fetch students for remaining IDs
      const remainingIds = uncachedIds.filter(id => !foundClubUserIds.has(id));
      if (remainingIds.length > 0) {
        const { data: studentProfiles } = await supabase
          .from("student_profiles")
          .select("id, full_name, avatar_url, user_id")
          .in("user_id", remainingIds);
        
        for (const sp of studentProfiles || []) {
          const info: ProfileInfo = {
            id: sp.id,
            name: sp.full_name || "Student",
            avatar: sp.avatar_url || undefined,
            isClub: false,
            userId: sp.user_id,
          };
          results.set(sp.user_id, info);
        }
      }
      
      // Update cache
      setProfileCache(prev => {
        const newCache = new Map(prev);
        results.forEach((info, userId) => newCache.set(userId, info));
        return newCache;
      });
    } catch (error) {
      console.error("Error batch fetching profiles:", error);
    }
    
    return results;
  }, [profileCache]);

  const clearCache = useCallback(() => {
    setProfileCache(new Map());
  }, []);

  return {
    fetchProfileInfo,
    fetchProfileInfoBatch,
    profileCache,
    clearCache,
  };
}
