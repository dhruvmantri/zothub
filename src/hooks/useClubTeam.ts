import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TeamMember } from "@/types";

export function useClubTeam(clubId: string | null) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeamMembers = useCallback(async () => {
    if (!clubId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from("club_team_members")
      .select("*")
      .eq("club_id", clubId)
      .neq("status", "declined")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching team members:", error);
      setIsLoading(false);
      return;
    }

    setTeamMembers(data || []);
    setIsLoading(false);
  }, [clubId]);

  useEffect(() => {
    if (clubId) {
      fetchTeamMembers();

      // Subscribe to real-time team member updates
      const channel = supabase
        .channel(`team-members-${clubId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "club_team_members",
            filter: `club_id=eq.${clubId}`,
          },
          () => {
            fetchTeamMembers();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [clubId, fetchTeamMembers]);

  const addTeamMember = async (email: string, name: string, role: string) => {
    if (!clubId) return false;

    const { error } = await supabase
      .from("club_team_members")
      .insert({
        club_id: clubId,
        email,
        name,
        role,
      });

    if (error) {
      console.error("Error adding team member:", error);
      if (error.code === "23505") {
        toast.error("This email is already a team member");
      } else {
        toast.error("Failed to add team member");
      }
      return false;
    }

    toast.success("Team member added");
    fetchTeamMembers();
    return true;
  };

  const updateTeamMember = async (id: string, updates: { role?: string; status?: string }) => {
    const { error } = await supabase
      .from("club_team_members")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Error updating team member:", error);
      toast.error("Failed to update team member");
      return false;
    }

    toast.success("Team member updated");
    fetchTeamMembers();
    return true;
  };

  const removeTeamMember = async (id: string) => {
    const { error } = await supabase
      .from("club_team_members")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error removing team member:", error);
      toast.error("Failed to remove team member");
      return false;
    }

    toast.success("Team member removed");
    fetchTeamMembers();
    return true;
  };

  const reorderTeamMember = async (id: string, newOrder: number) => {
    const { error } = await supabase
      .from("club_team_members")
      .update({ display_order: newOrder })
      .eq("id", id);

    if (error) {
      console.error("Error reordering team member:", error);
      toast.error("Failed to reorder team member");
      return false;
    }

    return true;
  };

  const swapTeamMemberOrder = async (memberId1: string, order1: number, memberId2: string, order2: number) => {
    const [result1, result2] = await Promise.all([
      supabase.from("club_team_members").update({ display_order: order2 }).eq("id", memberId1),
      supabase.from("club_team_members").update({ display_order: order1 }).eq("id", memberId2),
    ]);

    if (result1.error || result2.error) {
      console.error("Error swapping order:", result1.error || result2.error);
      toast.error("Failed to reorder team members");
      return false;
    }

    fetchTeamMembers();
    return true;
  };

  return {
    teamMembers,
    isLoading,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    reorderTeamMember,
    swapTeamMemberOrder,
    refetchTeamMembers: fetchTeamMembers,
  };
}
