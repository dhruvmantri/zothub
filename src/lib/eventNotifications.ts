import { supabase } from "@/integrations/supabase/client";
import { checkEmailResult } from "../../supabase/functions/_shared/email-result.ts";

/**
 * Cancel-notify all confirmed attendees of an event.
 *
 * Emails go through the AUTHORITATIVE event_cancelled handler: the client sends
 * only the eventId, and the edge function verifies the caller owns the event and
 * derives every recipient from the DB (no client-chosen recipients or content).
 * In-app notifications are still created client-side for the same attendees.
 */
export async function sendEventCancellationEmails(
  eventId: string,
  eventTitle: string,
  _eventDate: string,
  clubName: string
): Promise<{ success: boolean; sent: number; error?: string }> {
  try {
    // 1. Authoritative bulk email send.
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { type: "event_cancelled", data: { eventId } },
    });
    // Shared checker: a 200 carrying { error }, or a bulk result with ok:false /
    // failed > 0, is a delivery FAILURE — never reported as sent.
    const emailResult = checkEmailResult(error, data);
    const sent = emailResult.sent ?? 0;
    const emailError = emailResult.ok ? undefined : emailResult.error;

    // 2. In-app notifications for the same confirmed attendees (unchanged behavior).
    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("student_profiles:student_id ( user_id )")
      .eq("event_id", eventId)
      .eq("status", "confirmed");

    for (const rsvp of rsvps ?? []) {
      const uid = (rsvp.student_profiles as unknown as { user_id: string } | null)?.user_id;
      if (!uid) continue;
      await supabase.from("notifications").insert({
        user_id: uid,
        type: "event_cancelled",
        title: "Event Cancelled",
        message: `${eventTitle} by ${clubName} has been cancelled.`,
        related_id: eventId,
      });
    }

    return { success: !emailError, sent, error: emailError };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return { success: false, sent: 0, error: errorMessage };
  }
}

/**
 * Send an RSVP status-update email when a club approves or declines a pending
 * RSVP. An approval sends the confirmation email; a decline sends the dedicated
 * decline email (no "confirmed"/"You're In" wording). Only the authoritative
 * rsvpId is sent — the edge function verifies the caller (the owning club or the
 * student), derives the recipient and event/club data from the database, and
 * gates on the student's event_reminders preference.
 */
export async function sendRSVPStatusEmail(
  rsvpId: string,
  newStatus: "confirmed" | "cancelled"
): Promise<{ success: boolean; error?: string }> {
  try {
    const type = newStatus === "confirmed" ? "rsvp_confirmation" : "rsvp_declined";

    const { error } = await supabase.functions.invoke("send-email", {
      body: {
        type,
        data: { rsvpId },
      },
    });

    if (error) {
      console.error("RSVP status email error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}
