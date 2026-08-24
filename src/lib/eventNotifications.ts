import { supabase } from "@/integrations/supabase/client";
import { checkEmailResult } from "../../supabase/functions/_shared/email-result.ts";

/**
 * Cancel-notify all confirmed attendees of an event, by email.
 *
 * Emails go through the AUTHORITATIVE event_cancelled handler: the client sends
 * only the eventId, and the edge function verifies the caller owns the event and
 * derives every recipient from the DB (no client-chosen recipients or content).
 *
 * In-app notifications are NOT created here — the
 * `notify_attendees_on_event_delete` trigger on `events` does that
 * (migration 20260824000100). See the note in the body for why.
 *
 * Takes only the eventId: the title, date and club name it used to accept were
 * needed solely by the removed client-side notification loop, since both the
 * email handler and the trigger derive them from the database themselves.
 */
export async function sendEventCancellationEmails(
  eventId: string
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

    // 2. In-app notifications are NO LONGER created here. They are created by the
    //    `notify_attendees_on_event_delete` BEFORE DELETE trigger on `events`
    //    (migration 20260824000100), which reads the confirmed attendees while the
    //    cascade still has them.
    //
    //    This moved server-side because doing it from the browser required the
    //    `notifications` INSERT policy to be open to every authenticated user —
    //    which let anyone forge a notification for anyone, with any wording (S8).
    //    The browser now has no INSERT privilege on that table at all.
    //
    //    Emails stay here: they go through the send-email edge function, which
    //    verifies the caller and derives recipients server-side.

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
