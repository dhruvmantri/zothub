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

  const clearCache = useCallback(() => {
    setProfileCache(new Map());
  }, []);

  return {
    fetchProfileInfo,
    profileCache,
    clearCache,
  };
}
