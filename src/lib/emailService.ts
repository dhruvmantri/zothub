import { supabase } from "@/integrations/supabase/client";

type EmailType =
  | "application_confirmation"
  | "application_status"
  | "application_notification"
  | "rsvp_confirmation"
  | "rsvp_reminder"
  | "deadline_reminder"
  | "event_cancelled"
  | "new_club_post"
  | "waitlist_confirmation"
  | "waitlist_approved"
  | "waitlist_rejected";

interface EmailData {
  studentName?: string;
  studentMajor?: string;
  studentYear?: string;
  opportunityId?: string;
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

// Notify the owning club that a new application was submitted. The club
// recipient is resolved server-side from the opportunity (never passed as a
// `to` address), so the notification can't be misrouted, and the send is gated
// on the club's application_updates preference inside the edge function.
export async function sendNewApplicationNotification(
  opportunityId: string,
  studentName: string,
  studentMajor?: string,
  studentYear?: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail("application_notification", "", {
    opportunityId,
    studentName,
    studentMajor,
    studentYear,
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

export async function sendRSVPConfirmation(
  studentEmail: string,
  studentName: string,
  eventTitle: string,
  clubName: string,
  eventDate: string,
  location: string,
  requiresApproval: boolean
): Promise<{ success: boolean; error?: string }> {
  return sendEmail("rsvp_confirmation", studentEmail, {
    studentName,
    eventTitle,
    clubName,
    eventDate,
    location,
    requiresApproval,
  });
}
