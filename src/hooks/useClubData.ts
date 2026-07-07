import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClubOpportunities } from "./useClubOpportunities";
import { useClubEvents } from "./useClubEvents";
import { useClubTeam } from "./useClubTeam";

/**
 * Composite hook that provides all club data management functionality.
 * Internally delegates to focused hooks for opportunities, events, and team.
 */
export function useClubData() {
  const { user } = useAuth();
  const [clubId, setClubId] = useState<string | null>(null);
  const [isLoadingClubId, setIsLoadingClubId] = useState(true);

  // Fetch club ID for the current user
  useEffect(() => {
    if (user) {
      fetchClubId();
    }
  }, [user]);

  const fetchClubId = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("club_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching club profile:", error);
      setIsLoadingClubId(false);
      return;
    }

    if (data) {
      setClubId(data.id);
    }
    setIsLoadingClubId(false);
  };

  // Delegate to focused hooks
  const {
    opportunities,
    isLoading: isLoadingOpportunities,
    deleteOpportunity,
    refetchOpportunities,
  } = useClubOpportunities(clubId);

  const {
    events,
    isLoading: isLoadingEvents,
    deleteEvent,
    refetchEvents,
  } = useClubEvents(clubId);

  const {
    teamMembers,
    isLoading: isLoadingTeam,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    reorderTeamMember,
    swapTeamMemberOrder,
    refetchTeamMembers,
  } = useClubTeam(clubId);

  // Combined loading state
  const isLoading = isLoadingClubId || isLoadingOpportunities || isLoadingEvents || isLoadingTeam;

  return {
    clubId,
    opportunities,
    events,
    teamMembers,
    isLoading,
    deleteOpportunity,
    deleteEvent,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    reorderTeamMember,
    swapTeamMemberOrder,
    refetchOpportunities,
    refetchEvents,
    refetchTeamMembers,
  };
}
