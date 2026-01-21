import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TeamMemberInfo {
  id: string;
  club_id: string;
  role: string;
  status: string;
  club_profiles?: {
    club_name: string;
  };
}

export function useTeamInvitations() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Fetches team member info for a given notification's related_id
   */
  const getTeamMemberInfo = async (teamMemberId: string): Promise<TeamMemberInfo | null> => {
    const { data, error } = await supabase
      .from("club_team_members")
      .select(`
        id,
        club_id,
        role,
        status,
        club_profiles:club_id (club_name)
      `)
      .eq("id", teamMemberId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching team member info:", error);
      return null;
    }

    return data as TeamMemberInfo | null;
  };

  /**
   * Accept a team invitation - updates team member status to 'active'
   * and updates the notification message to reflect acceptance
   */
  const acceptInvitation = async (
    teamMemberId: string,
    notificationId: string
  ): Promise<boolean> => {
    if (!user) return false;
    setIsProcessing(true);

    try {
      // Get team member info for the message
      const teamMember = await getTeamMemberInfo(teamMemberId);
      if (!teamMember) {
        toast.error("Could not find invitation details");
        return false;
      }

      const clubName = teamMember.club_profiles?.club_name || "the club";
      const role = teamMember.role;

      // Update team member status to active
      const { data: updatedMember, error: updateError } = await supabase
        .from("club_team_members")
        .update({
          status: "active",
          joined_at: new Date().toISOString(),
          user_id: user.id,
        })
        .eq("id", teamMemberId)
        .select("id, status")
        .maybeSingle();

      if (updateError) {
        console.error("Error accepting invitation:", updateError);
        toast.error("Failed to accept invitation");
        return false;
      }

      if (!updatedMember || updatedMember.status !== "active") {
        console.error("Update did not succeed - RLS may have blocked it");
        toast.error("Could not accept invitation. Please try again.");
        return false;
      }

      // Update the notification message to reflect acceptance
      const successMessage = `You accepted the invitation to join ${clubName} as ${role}. You are now a part of ${clubName}!`;
      
      const { error: notifError } = await supabase
        .from("notifications")
        .update({
          message: successMessage,
          is_read: true,
        })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (notifError) {
        console.error("Error updating notification:", notifError);
        // Don't fail the whole operation - the invitation was accepted
      }

      toast.success(`You are now a member of ${clubName}!`);
      return true;
    } catch (error) {
      console.error("Error in acceptInvitation:", error);
      toast.error("An error occurred. Please try again.");
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Decline a team invitation - updates team member status to 'declined'
   * and updates the notification message to reflect decline
   */
  const declineInvitation = async (
    teamMemberId: string,
    notificationId: string
  ): Promise<boolean> => {
    if (!user) return false;
    setIsProcessing(true);

    try {
      // Get team member info for the message
      const teamMember = await getTeamMemberInfo(teamMemberId);
      if (!teamMember) {
        toast.error("Could not find invitation details");
        return false;
      }

      const clubName = teamMember.club_profiles?.club_name || "the club";
      const role = teamMember.role;

      // Update team member status to declined
      const { data: updatedMember, error: updateError } = await supabase
        .from("club_team_members")
        .update({
          status: "declined",
          user_id: user.id,
        })
        .eq("id", teamMemberId)
        .select("id, status")
        .maybeSingle();

      if (updateError) {
        console.error("Error declining invitation:", updateError);
        toast.error("Failed to decline invitation");
        return false;
      }

      if (!updatedMember || updatedMember.status !== "declined") {
        console.error("Update did not succeed - RLS may have blocked it");
        toast.error("Could not decline invitation. Please try again.");
        return false;
      }

      // Update the notification message to reflect decline
      const declineMessage = `You declined the invitation to join ${clubName} as ${role}.`;
      
      const { error: notifError } = await supabase
        .from("notifications")
        .update({
          message: declineMessage,
          is_read: true,
        })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (notifError) {
        console.error("Error updating notification:", notifError);
        // Don't fail the whole operation - the invitation was declined
      }

      toast.success("Invitation declined");
      return true;
    } catch (error) {
      console.error("Error in declineInvitation:", error);
      toast.error("An error occurred. Please try again.");
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Check the status of a team invitation by its ID
   * Returns the current status or null if not found
   */
  const checkInvitationStatus = async (
    teamMemberId: string
  ): Promise<"pending" | "active" | "declined" | null> => {
    const { data, error } = await supabase
      .from("club_team_members")
      .select("status")
      .eq("id", teamMemberId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.status as "pending" | "active" | "declined";
  };

  return {
    acceptInvitation,
    declineInvitation,
    checkInvitationStatus,
    getTeamMemberInfo,
    isProcessing,
  };
}
