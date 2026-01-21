import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { DashboardOpportunity, DashboardEvent, TeamMember } from "@/types";

export function useClubData() {
  const { user } = useAuth();
  const [clubId, setClubId] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<DashboardOpportunity[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchClubId();
    }
  }, [user]);

  useEffect(() => {
    if (clubId) {
      fetchOpportunities();
      fetchEvents();
      fetchTeamMembers();
    }
  }, [clubId]);

  const fetchClubId = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("club_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching club profile:", error);
      return;
    }

    if (data) {
      setClubId(data.id);
    }
    setIsLoading(false);
  };

  const fetchOpportunities = async () => {
    if (!clubId) return;

    const { data: opps, error: oppsError } = await supabase
      .from("opportunities")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (oppsError) {
      console.error("Error fetching opportunities:", oppsError);
      return;
    }

    // Get application counts for each opportunity
    const oppIds = opps?.map(o => o.id) || [];
    const { data: appCounts } = await supabase
      .from("applications")
      .select("opportunity_id")
      .in("opportunity_id", oppIds);

    const countMap: Record<string, number> = {};
    appCounts?.forEach(app => {
      countMap[app.opportunity_id] = (countMap[app.opportunity_id] || 0) + 1;
    });

    setOpportunities(
      (opps || []).map(o => ({
        ...o,
        views: o.views || 0,
        applications_count: countMap[o.id] || 0,
      }))
    );
  };

  const fetchEvents = async () => {
    if (!clubId) return;

    const { data: evts, error: evtsError } = await supabase
      .from("events")
      .select("*")
      .eq("club_id", clubId)
      .order("event_date", { ascending: false });

    if (evtsError) {
      console.error("Error fetching events:", evtsError);
      return;
    }

    // Get RSVP counts for each event
    const eventIds = evts?.map(e => e.id) || [];
    const { data: rsvpCounts } = await supabase
      .from("rsvps")
      .select("event_id")
      .in("event_id", eventIds);

    const countMap: Record<string, number> = {};
    rsvpCounts?.forEach(rsvp => {
      countMap[rsvp.event_id] = (countMap[rsvp.event_id] || 0) + 1;
    });

    setEvents(
      (evts || []).map(e => ({
        ...e,
        views: e.views || 0,
        rsvps_count: countMap[e.id] || 0,
      }))
    );
  };

  const fetchTeamMembers = async () => {
    if (!clubId) return;

    const { data, error } = await supabase
      .from("club_team_members")
      .select("*")
      .eq("club_id", clubId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching team members:", error);
      return;
    }

    setTeamMembers(data || []);
  };

  const deleteOpportunity = async (id: string) => {
    const { error } = await supabase
      .from("opportunities")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting opportunity:", error);
      toast.error("Failed to delete opportunity");
      return false;
    }

    toast.success("Opportunity deleted");
    fetchOpportunities();
    return true;
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
      return false;
    }

    toast.success("Event deleted");
    fetchEvents();
    return true;
  };

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
    // Update both members' display_order
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
    refetchOpportunities: fetchOpportunities,
    refetchEvents: fetchEvents,
    refetchTeamMembers: fetchTeamMembers,
  };
}
