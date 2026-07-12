import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface EventForRSVP {
  id: string;
  capacity: number | null;
  requires_approval: boolean | null;
  rsvps: { id: string; student_id: string; status: string | null }[];
  rsvp_questions?: unknown[] | null;
}

interface UseEventRSVPReturn {
  studentProfileId: string | null;
  hasRSVP: boolean;
  rsvpStatus: string | null;
  rsvpLoading: boolean;
  showRSVPForm: boolean;
  setShowRSVPForm: (show: boolean) => void;
  handleRSVP: () => Promise<void>;
  handleRSVPFormSuccess: () => void;
  confirmedRsvps: number;
  spotsLeft: number | null;
  refetchEvent: () => void;
}

export function useEventRSVP(
  eventId: string | undefined,
  event: EventForRSVP | null,
  onEventRefetch: () => void
): UseEventRSVPReturn {
  const { user, role } = useAuth();
  
  const [hasRSVP, setHasRSVP] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [studentProfileId, setStudentProfileId] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [showRSVPForm, setShowRSVPForm] = useState(false);

  // Fetch student profile and check RSVP status
  useEffect(() => {
    if (user && eventId) {
      fetchStudentProfile();
    }
  }, [user, eventId]);

  const fetchStudentProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setStudentProfileId(data.id);
        checkRSVP(data.id);
      }
    } catch (error) {
      console.error("Error fetching student profile:", error);
    }
  }, [user]);

  const checkRSVP = useCallback(async (profileId: string) => {
    if (!eventId) return;
    
    try {
      const { data, error } = await supabase
        .from("rsvps")
        .select("id, status")
        .eq("event_id", eventId)
        .eq("student_id", profileId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setHasRSVP(data.status !== "cancelled");
        setRsvpStatus(data.status);
      } else {
        setHasRSVP(false);
        setRsvpStatus(null);
      }
    } catch (error) {
      console.error("Error checking RSVP:", error);
    }
  }, [eventId]);

  // Live RSVP status: when the club approves/declines this student's RSVP for
  // this event, update the UI without a manual refresh. Subscribes to the
  // student's own rsvps (RLS-scoped) and reacts only to this event's row.
  useEffect(() => {
    if (!studentProfileId || !eventId) return;

    const channel = supabase
      .channel(`rsvp-status-${eventId}-${studentProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rsvps",
          filter: `student_id=eq.${studentProfileId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { event_id?: string } | null;
          if (row?.event_id === eventId) {
            checkRSVP(studentProfileId);
            onEventRefetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentProfileId, eventId, checkRSVP, onEventRefetch]);

  const handleRSVP = useCallback(async () => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }

    if (role !== "student") {
      toast.error("Only students can RSVP to events");
      return;
    }

    if (!studentProfileId || !eventId || !event) return;

    // If event has RSVP questions, show the form
    const hasQuestions = event.rsvp_questions && Array.isArray(event.rsvp_questions) && event.rsvp_questions.length > 0;
    if (hasQuestions && !hasRSVP) {
      setShowRSVPForm(true);
      return;
    }

    setRsvpLoading(true);
    try {
      if (hasRSVP) {
        // Cancel RSVP - need to update status since we can't delete
        const { error } = await supabase
          .from("rsvps")
          .update({ status: "cancelled" })
          .eq("event_id", eventId)
          .eq("student_id", studentProfileId);

        if (error) throw error;
        setHasRSVP(false);
        setRsvpStatus("cancelled");
        toast.success("RSVP cancelled");
        onEventRefetch();
      } else {
        // Check capacity
        const confirmedCount = event.rsvps.filter(r => r.status === "confirmed").length;
        if (event.capacity && confirmedCount >= event.capacity) {
          toast.error("This event is at full capacity");
          return;
        }

        const status = event.requires_approval ? "pending" : "confirmed";

        // Upsert, not insert: a previously-cancelled RSVP leaves a row behind
        // (rows are never deleted), so a plain insert hits the
        // (event_id, student_id) unique key and fails with "Failed to process
        // RSVP". Upserting reuses the existing row and flips it back to
        // pending/confirmed.
        const { error } = await supabase
          .from("rsvps")
          .upsert(
            {
              event_id: eventId,
              student_id: studentProfileId,
              status,
              answers: [],
            },
            { onConflict: "event_id,student_id" }
          );

        if (error) {
          // The DB capacity guard is authoritative (the client check above can
          // race). Surface a clean message instead of a raw error.
          console.error("Error creating RSVP:", error);
          toast.error(
            error.message?.toLowerCase().includes("full capacity")
              ? "This event is at full capacity."
              : "Failed to process RSVP"
          );
          return;
        }
        setHasRSVP(true);
        setRsvpStatus(status);
        
        if (event.requires_approval) {
          toast.success("RSVP submitted! Awaiting approval.");
        } else {
          toast.success("RSVP confirmed!");
        }
        onEventRefetch();
      }
    } catch (error) {
      console.error("Error handling RSVP:", error);
      toast.error("Failed to process RSVP");
    } finally {
      setRsvpLoading(false);
    }
  }, [user, role, studentProfileId, eventId, event, hasRSVP, onEventRefetch]);

  const handleRSVPFormSuccess = useCallback(() => {
    setShowRSVPForm(false);
    setHasRSVP(true);
    setRsvpStatus(event?.requires_approval ? "pending" : "confirmed");
    onEventRefetch();
  }, [event?.requires_approval, onEventRefetch]);

  // Computed values
  const confirmedRsvps = event?.rsvps.filter(r => r.status === "confirmed").length ?? 0;
  const spotsLeft = event?.capacity ? event.capacity - confirmedRsvps : null;

  return {
    studentProfileId,
    hasRSVP,
    rsvpStatus,
    rsvpLoading,
    showRSVPForm,
    setShowRSVPForm,
    handleRSVP,
    handleRSVPFormSuccess,
    confirmedRsvps,
    spotsLeft,
    refetchEvent: onEventRefetch,
  };
}
