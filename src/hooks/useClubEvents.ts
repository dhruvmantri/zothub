import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendEventCancellationEmails } from "@/lib/eventNotifications";
import type { DashboardEvent } from "@/types";

export function useClubEvents(clubId: string | null) {
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!clubId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data: evts, error: evtsError } = await supabase
      .from("events")
      .select("*")
      .eq("club_id", clubId)
      .order("event_date", { ascending: false });

    if (evtsError) {
      console.error("Error fetching events:", evtsError);
      setIsLoading(false);
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
    setIsLoading(false);
  }, [clubId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const deleteEvent = async (id: string) => {
    // Fetch event details before deletion to send cancellation emails
    const { data: eventData } = await supabase
      .from("events")
      .select("title, event_date, club_id")
      .eq("id", id)
      .single();

    // Get club name for the cancellation email
    let clubName = "Unknown Club";
    if (eventData?.club_id) {
      const { data: clubData } = await supabase
        .from("club_profiles")
        .select("club_name")
        .eq("id", eventData.club_id)
        .single();
      if (clubData?.club_name) {
        clubName = clubData.club_name;
      }
    }

    // Send cancellation emails to all confirmed attendees
    if (eventData) {
      const result = await sendEventCancellationEmails(
        id,
        eventData.title,
        eventData.event_date,
        clubName
      );
      if (result.sent > 0) {
        console.log(`Sent ${result.sent} cancellation emails`);
      }
      if (result.error) {
        console.error("Some cancellation emails failed:", result.error);
      }
    }

    // Now delete the event
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

  return {
    events,
    isLoading,
    deleteEvent,
    refetchEvents: fetchEvents,
  };
}
