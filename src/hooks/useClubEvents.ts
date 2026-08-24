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
    // Email the confirmed attendees BEFORE the row goes, because the edge
    // function derives the recipient list from the event's RSVPs and
    // rsvps.event_id is ON DELETE CASCADE.
    //
    // The in-app notifications are handled by the notify_attendees_on_event_delete
    // trigger on `events` (migration 20260824000100), so nothing here inserts them.
    // That is also why this no longer pre-fetches the title, date and club name:
    // they were only ever passed to the removed client-side notification loop —
    // both the email handler and the trigger read them from the database.
    const result = await sendEventCancellationEmails(id);
    if (result.sent > 0) {
      console.log(`Sent ${result.sent} cancellation emails`);
    }
    if (result.error) {
      console.error("Some cancellation emails failed:", result.error);
    }

    // Now delete the event. The trigger fires here.
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
