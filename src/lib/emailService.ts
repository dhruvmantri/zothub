import { supabase } from "@/integrations/supabase/client";

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

    if (error) {
      console.error("Email sending error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Email service error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function sendApplicationConfirmation(
  studentEmail: string,
  studentName: string,
  opportunityTitle: string,
  clubName: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail("application_confirmation", studentEmail, {
    studentName,
    opportunityTitle,
    clubName,
  });
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

export async function sendApplicationStatusUpdate(
  studentEmail: string,
  studentName: string,
  opportunityTitle: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail("application_status", studentEmail, {
    studentName,
    opportunityTitle,
    status,
  });
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
