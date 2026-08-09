import { supabase } from "@/integrations/supabase/client";
// THE single shared email-result check — same module the edge functions use, so the
// client and server agree on what "delivered" means (notably: HTTP 200 + { error }
// is a FAILURE, not a success).
import { checkEmailResult } from "../../supabase/functions/_shared/email-result.ts";

type EmailType =
  | "application_confirmation"
  | "application_status"
  | "application_notification"
  | "rsvp_confirmation"
  | "rsvp_declined"
  | "rsvp_reminder"
  | "deadline_reminder"
  | "event_cancelled"
  | "new_club_post"
  | "waitlist_confirmation"
  | "waitlist_approved"
  | "waitlist_rejected";

interface EmailData {
  studentName?: string;
  applicationId?: string;
  rsvpId?: string;
  opportunityTitle?: string;
  eventTitle?: string;
  clubName?: string;
  eventDate?: string;
  location?: string;
  deadline?: string;
  status?: string;
  requiresApproval?: boolean;
}

export async function sendEmail(
  type: EmailType,
  to: string,
  data: EmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: response, error } = await supabase.functions.invoke("send-email", {
      body: { type, to, data },
    });

    // A 200 response can still carry { error } (Resend false-success), so judge the
    // outcome with the shared checker rather than the transport error alone.
    const result = checkEmailResult(error, response);
    if (!result.ok) {
      console.error("Email sending failed:", type, result.error);
      return { success: false, error: result.error };
    }
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Email service error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Confirm to the applying student. Only the authoritative applicationId is sent;
// the edge function verifies the caller owns the application and derives the
// recipient (the student's own email) + content from the database. No client-chosen
// recipient or content.
export async function sendApplicationConfirmation(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail("application_confirmation", "", { applicationId });
}

// Notify the owning club that a new application was submitted. Only the
// authoritative applicationId is sent; the edge function verifies the caller
// owns the application, then derives the club recipient, applicant identity,
// and opportunity from database rows, gates on the club's application_updates
// preference, and de-duplicates the send. No applicant data is trusted from the
// client here.
export async function sendNewApplicationNotification(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail("application_notification", "", {
    applicationId,
  });
}

// Notify the student of a status change. Only the authoritative applicationId is
// sent; the edge function verifies the caller owns the opportunity and derives the
// recipient + the CURRENT status from the database (never a client-supplied status).
export async function sendApplicationStatusUpdate(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail("application_status", "", { applicationId });
}

// Send the RSVP confirmation email to the student. Only the authoritative
// rsvpId is sent; the edge function verifies the caller (the student who owns
// the RSVP, or the owning club), derives the recipient and event/club data from
// the database, and gates on the student's event_reminders preference.
export async function sendRSVPConfirmation(
  rsvpId: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail("rsvp_confirmation", "", { rsvpId });
}
