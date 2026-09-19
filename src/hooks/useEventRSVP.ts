import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentProfileId } from "@/hooks/useStudentProfileId";
import { sendRSVPConfirmation } from "@/lib/emailService";
import { eventKeys, rsvpKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

interface EventForRSVP {
  id: string;
  capacity: number | null;
  requires_approval: boolean | null;
  rsvps: { id: string; student_id: string; status: string | null }[];
  rsvp_questions?: unknown[] | null;
}

/**
 * One answer as it is stored on the rsvps row.
 *
 * A `type` alias, not an `interface`, deliberately: the generated `answers`
 * column is typed `Json`, and only a type alias gets the implicit index
 * signature that makes it assignable. An interface here fails to compile.
 */
export type RSVPAnswer = {
  question_id: string;
  question: string;
  answer: string | string[];
};

interface MyRSVP {
  id: string;
  status: string | null;
}

/**
 * The viewer's OWN rsvp row for this event.
 *
 * Deliberately its own query rather than being derived from the `rsvps` array
 * embedded in the event (contract T14). That array is filtered by the SELECT
 * policy to the viewer's own rows plus the owning club's, so deriving from it
 * would appear to work when a student tests it and be wrong for everyone else.
 */
async function fetchMyRsvp(eventId: string, studentProfileId: string): Promise<MyRSVP | null> {
  const { data, error } = await supabase
    .from("rsvps")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("student_id", studentProfileId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check your RSVP: ${error.message}`);
  return data ?? null;
}

interface UseEventRSVPReturn {
  studentProfileId: string | null;
  hasRSVP: boolean;
  rsvpStatus: string | null;
  rsvpLoading: boolean;
  showRSVPForm: boolean;
  setShowRSVPForm: (show: boolean) => void;
  handleRSVP: () => void;
  submitRSVPWithAnswers: (answers: RSVPAnswer[]) => void;
  confirmedRsvps: number;
  spotsLeft: number | null;
}

/**
 * Every write to `rsvps` from the student side lives here (contract M11).
 *
 * It used to be split: `RSVPForm` ran its own upsert while this hook ran
 * another, and `requires_approval ? "pending" : "confirmed"` was spelled out in
 * three places. A write in one file whose cache invalidation lives in another
 * is how a stale attendee count survives a migration, so the form now hands its
 * formatted answers up and this hook owns the single mutation, the status
 * expression, the capacity-rejection wording and the confirmation email.
 */
export function useEventRSVP(
  eventId: string | undefined,
  event: EventForRSVP | null,
): UseEventRSVPReturn {
  const { user, role } = useAuth();
  const { studentProfileId } = useStudentProfileId();
  const queryClient = useQueryClient();

  const [showRSVPForm, setShowRSVPForm] = useState(false);

  const myRsvpQuery = useQuery({
    queryKey: rsvpKeys.mine(eventId ?? "", studentProfileId ?? ""),
    queryFn: () => fetchMyRsvp(eventId!, studentProfileId!),
    enabled: Boolean(eventId && studentProfileId),
  });

  const hasRSVP = myRsvpQuery.data ? myRsvpQuery.data.status !== "cancelled" : false;
  const rsvpStatus = myRsvpQuery.data?.status ?? null;

  /**
   * M9/M10/M13 in one place.
   *
   * `eventKeys.details(eventId)` is the PREFIX, so it marks BOTH viewer
   * variants stale — an RSVP made while signed in must not leave a signed-out
   * variant of the same event cached with the old attendee list.
   * `eventKeys.upcoming()` is the public list, whose cards show the same count.
   */
  const invalidateRSVPSurface = useCallback(() => {
    if (!eventId) return;
    if (studentProfileId) {
      queryClient.invalidateQueries({ queryKey: rsvpKeys.mine(eventId, studentProfileId) });
      queryClient.invalidateQueries({ queryKey: rsvpKeys.byStudent(studentProfileId) });
    }
    queryClient.invalidateQueries({ queryKey: eventKeys.details(eventId) });
    queryClient.invalidateQueries({ queryKey: eventKeys.upcoming() });
  }, [queryClient, eventId, studentProfileId]);

  /**
   * Live RSVP status: when the club approves or declines this student's RSVP,
   * the change arrives on their own channel. It must INVALIDATE, not just mark
   * dirty — with `staleTime: 60s` a stale query with no other trigger does not
   * refetch, so an approval would sit unseen for a minute (contract T10/M13).
   */
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
          if (row?.event_id === eventId) invalidateRSVPSurface();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentProfileId, eventId, invalidateRSVPSurface]);

  /** The one place the pending/confirmed decision is made. */
  const nextStatus = () => (event?.requires_approval ? "pending" : "confirmed");

  const rsvpMutation = useMutation({
    mutationFn: async (answers: RSVPAnswer[]) => {
      if (!eventId || !studentProfileId) throw new Error("not ready");
      const status = nextStatus();

      // Upsert, not insert: cancelling leaves the row behind (rows are never
      // deleted), so a plain insert hits the (event_id, student_id) unique key
      // and fails. Upserting reuses the row and flips it back.
      const { data, error } = await supabase
        .from("rsvps")
        .upsert(
          { event_id: eventId, student_id: studentProfileId, status, answers },
          { onConflict: "event_id,student_id" },
        )
        .select("id")
        .single();

      if (error) throw error;
      return { id: data?.id as string | undefined, status };
    },

    onSuccess: ({ id, status }) => {
      setShowRSVPForm(false);
      invalidateRSVPSurface();
      // Non-blocking. The recipient and the event data are derived server-side
      // from the rsvp id and gated on the student's event_reminders preference.
      if (id) sendRSVPConfirmation(id).catch(console.error);
      toast.success(
        status === "pending" ? "RSVP submitted! Awaiting approval." : "RSVP confirmed!",
      );
    },

    onError: (error: { message?: string }) => {
      console.error("Error creating RSVP:", error);
      // M10 — invalidate on the ERROR path too. A capacity rejection from the
      // database trigger is proof that the count this page is showing is wrong;
      // leaving the stale number on screen after refusing the RSVP is the worst
      // of both.
      invalidateRSVPSurface();
      toast.error(
        error.message?.toLowerCase().includes("full capacity")
          ? "This event is at full capacity."
          : "Failed to process RSVP",
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!eventId || !studentProfileId) throw new Error("not ready");
      // An update, not a delete: the row is kept so a re-RSVP can reuse it.
      const { error } = await supabase
        .from("rsvps")
        .update({ status: "cancelled" })
        .eq("event_id", eventId)
        .eq("student_id", studentProfileId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateRSVPSurface();
      toast.success("RSVP cancelled");
    },
    onError: (error) => {
      console.error("Error cancelling RSVP:", error);
      invalidateRSVPSurface();
      toast.error("Failed to process RSVP");
    },
  });

  const handleRSVP = useCallback(() => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }
    if (role !== "student") {
      toast.error("Only students can RSVP to events");
      return;
    }
    if (!studentProfileId || !eventId || !event) return;

    if (hasRSVP) {
      cancelMutation.mutate();
      return;
    }

    // If the club asks questions, the form collects them first. This is the
    // read UX21 protects: on an anon-shaped cache entry `rsvp_questions` is
    // absent, `hasQuestions` reads false, and the student would be recorded as
    // attending with no answers at all.
    const hasQuestions =
      Array.isArray(event.rsvp_questions) && event.rsvp_questions.length > 0;
    if (hasQuestions) {
      setShowRSVPForm(true);
      return;
    }

    // Client-side capacity pre-check, kept exactly as it was. It is NOT
    // authoritative and cannot be: `event.rsvps` is RLS-filtered, so a student
    // sees almost none of it (see O5-counts). The `enforce_rsvp_capacity`
    // trigger is the real gate, and its rejection is handled in onError above.
    const confirmedCount = event.rsvps.filter((r) => r.status === "confirmed").length;
    if (event.capacity && confirmedCount >= event.capacity) {
      toast.error("This event is at full capacity");
      return;
    }

    rsvpMutation.mutate([]);
  }, [user, role, studentProfileId, eventId, event, hasRSVP, cancelMutation, rsvpMutation]);

  const submitRSVPWithAnswers = useCallback(
    (answers: RSVPAnswer[]) => rsvpMutation.mutate(answers),
    [rsvpMutation],
  );

  const confirmedRsvps = event?.rsvps.filter((r) => r.status === "confirmed").length ?? 0;
  const spotsLeft = event?.capacity ? event.capacity - confirmedRsvps : null;

  return {
    studentProfileId,
    hasRSVP,
    rsvpStatus,
    rsvpLoading: rsvpMutation.isPending || cancelMutation.isPending,
    showRSVPForm,
    setShowRSVPForm,
    handleRSVP,
    submitRSVPWithAnswers,
    confirmedRsvps,
    spotsLeft,
  };
}
