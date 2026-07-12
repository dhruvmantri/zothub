import { supabase } from "@/integrations/supabase/client";

/**
 * Send cancellation emails to all confirmed attendees of an event
 */
export async function sendEventCancellationEmails(
  eventId: string,
  eventTitle: string,
  eventDate: string,
  clubName: string
): Promise<{ success: boolean; sent: number; error?: string }> {
  try {
    // Get all confirmed RSVPs with student info
    const { data: rsvps, error: rsvpError } = await supabase
      .from("rsvps")
      .select(`
        id,
        student_profiles:student_id (
          user_id,
          email,
          full_name
        )
      `)
      .eq("event_id", eventId)
      .eq("status", "confirmed");

    if (rsvpError) {
      console.error("Error fetching RSVPs for cancellation:", rsvpError);
      return { success: false, sent: 0, error: rsvpError.message };
    }

    if (!rsvps || rsvps.length === 0) {
      return { success: true, sent: 0 };
    }

    let sent = 0;
    const errors: string[] = [];

    for (const rsvp of rsvps) {
      const studentProfile = rsvp.student_profiles as unknown as {
        user_id: string;
        email: string;
        full_name: string | null;
      } | null;

      if (!studentProfile?.email) continue;

      try {
        const { error } = await supabase.functions.invoke("send-email", {
          body: {
            type: "event_cancelled",
            to: studentProfile.email,
            data: {
              studentName: studentProfile.full_name || "there",
              eventTitle,
              eventDate,
              clubName,
            },
          },
        });

        if (error) {
          errors.push(`Failed to email ${studentProfile.email}: ${error.message}`);
        } else {
          sent++;
        }

        // Also create in-app notification
        if (studentProfile.user_id) {
          await supabase.from("notifications").insert({
            user_id: studentProfile.user_id,
            type: "event_cancelled",
            title: "Event Cancelled",
            message: `${eventTitle} by ${clubName} has been cancelled.`,
            related_id: eventId,
          });
        }
      } catch (err) {
        errors.push(`Error for ${studentProfile.email}: ${err}`);
      }
    }

    return {
      success: errors.length === 0,
      sent,
      error: errors.length > 0 ? errors.join("; ") : undefined,
    };
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
