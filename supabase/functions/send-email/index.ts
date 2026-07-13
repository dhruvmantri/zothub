import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { validateRsvpEmailRequest } from "./rsvp-email-rules.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

interface EmailRequest {
  type: "application_confirmation" | "application_status" | "application_notification" | "rsvp_confirmation" | "rsvp_declined" | "rsvp_reminder" | "deadline_reminder" | "event_cancelled" | "new_club_post" | "waitlist_confirmation" | "waitlist_approved" | "waitlist_rejected" | "email_otp";
  to: string;
  data: Record<string, unknown>;
}

// Email types that are gated by a notification_preferences column. When the
// recipient has that preference disabled, the send is skipped. Types not listed
// here (auth/waitlist/OTP and the cron-sent reminders, which are already
// preference-checked in send-reminders) always send.
const PREFERENCE_COLUMN_BY_TYPE: Record<string, string> = {
  application_confirmation: "application_updates",
  application_status: "application_updates",
  application_notification: "application_updates",
};

type SupabaseClient = ReturnType<typeof createClient>;

// Resolve a recipient's auth user_id from their email (student or club account),
// so we can look up their notification preferences.
const resolveUserIdByEmail = async (
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> => {
  const { data: student } = await supabase
    .from("student_profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (student?.user_id) return student.user_id as string;

  const { data: club } = await supabase
    .from("club_profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  return (club?.user_id as string) ?? null;
};

// Whether a preference column is enabled for a user. Defaults to true when no
// preferences row exists — matching the DB triggers' COALESCE(<pref>, true).
const isPreferenceEnabled = async (
  supabase: SupabaseClient,
  userId: string,
  column: string,
): Promise<boolean> => {
  const { data } = await supabase
    .from("notification_preferences")
    .select(column)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return true;
  const value = (data as Record<string, unknown>)[column];
  return value === null || value === undefined ? true : Boolean(value);
};

const getEmailFooter = (type: string) => `
  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
    <p style="color: #71717a; font-size: 12px; margin: 0;">
      You received this email because you have an account on ZotHub.<br/>
      <a href="https://zothub.app/unsubscribe?type=${type}" style="color: #3b82f6;">Unsubscribe from ${type.replace(/_/g, " ")} emails</a> | 
      <a href="https://zothub.app/unsubscribe" style="color: #3b82f6;">Manage all preferences</a>
    </p>
    <p style="color: #a1a1aa; font-size: 11px; margin-top: 12px;">
      ZotHub • University of California, Irvine • Irvine, CA 92697
    </p>
  </div>
`;

const getEmailContent = (type: string, data: Record<string, unknown>) => {
  switch (type) {
    case "application_confirmation":
      return {
        subject: `Application Received: ${data.opportunityTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Application Submitted!</h1>
            <p>Hi ${data.studentName},</p>
            <p>Your application for <strong>${data.opportunityTitle}</strong> at <strong>${data.clubName}</strong> has been received.</p>
            <p>The club will review your application and get back to you soon.</p>
            <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
              <p style="margin: 0; color: #71717a;">Applied on: ${new Date().toLocaleDateString()}</p>
            </div>
            <p>Best of luck!</p>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("application_updates")}
          </div>
        `,
      };

    case "application_status": {
      const statusColors: Record<string, string> = {
        accepted: "#22c55e",
        rejected: "#ef4444",
        pending: "#f59e0b",
        reviewed: "#3b82f6",
      };
      const statusMessages: Record<string, string> = {
        accepted: "Congratulations! Your application has been accepted.",
        rejected: "Unfortunately, your application was not selected this time.",
        reviewed: "Your application is being reviewed by the team.",
        pending: "Your application is still pending review.",
      };
      return {
        subject: `Application Update: ${data.opportunityTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Application Status Update</h1>
            <p>Hi ${data.studentName},</p>
            <p>Your application for <strong>${data.opportunityTitle}</strong> has been updated.</p>
            <div style="margin: 24px 0; padding: 16px; background: ${statusColors[data.status as string] || "#f4f4f5"}20; border-left: 4px solid ${statusColors[data.status as string] || "#71717a"}; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: ${statusColors[data.status as string] || "#71717a"};">
                Status: ${(data.status as string).toUpperCase()}
              </p>
              <p style="margin: 8px 0 0 0;">${statusMessages[data.status as string] || ""}</p>
            </div>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("application_updates")}
          </div>
        `,
      };
    }

    case "application_notification":
      return {
        subject: `New application for ${data.opportunityTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">New Application Received 📬</h1>
            <p>Hi ${data.clubName},</p>
            <p>You received a new application for <strong>${data.opportunityTitle}</strong>.</p>
            <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
              <p style="margin: 0;"><strong>Applicant:</strong> ${data.studentName}</p>
              ${data.studentMajor ? `<p style="margin: 8px 0 0 0;"><strong>Major:</strong> ${data.studentMajor}</p>` : ""}
              ${data.studentYear ? `<p style="margin: 8px 0 0 0;"><strong>Year:</strong> ${data.studentYear}</p>` : ""}
            </div>
            <div style="margin: 24px 0;">
              <a href="https://zothub.app/club/applications" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">View application &amp; review answers</a>
            </div>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("application_updates")}
          </div>
        `,
      };

    case "rsvp_confirmation":
      return {
        subject: `RSVP Confirmed: ${data.eventTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">You're In! 🎉</h1>
            <p>Hi ${data.studentName},</p>
            <p>Your RSVP for <strong>${data.eventTitle}</strong> has been ${data.requiresApproval ? "submitted and is pending approval" : "confirmed"}!</p>
            <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
              <p style="margin: 0;"><strong>📅 Date:</strong> ${data.eventDate}</p>
              <p style="margin: 8px 0 0 0;"><strong>📍 Location:</strong> ${data.location || "TBD"}</p>
              <p style="margin: 8px 0 0 0;"><strong>🏢 Hosted by:</strong> ${data.clubName}</p>
            </div>
            ${data.requiresApproval ? "<p>You'll receive another email once your RSVP is approved.</p>" : "<p>We look forward to seeing you there!</p>"}
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("event_reminders")}
          </div>
        `,
      };

    case "rsvp_declined":
      return {
        subject: `RSVP Update: ${data.eventTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">RSVP Update</h1>
            <p>Hi ${data.studentName},</p>
            <p>Unfortunately, your RSVP for <strong>${data.eventTitle}</strong> hosted by <strong>${data.clubName}</strong> was not approved.</p>
            <div style="margin: 24px 0; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: #b91c1c;">Your RSVP was declined by the organizer.</p>
              <p style="margin: 8px 0 0 0;"><strong>📅 Date:</strong> ${data.eventDate}</p>
              <p style="margin: 8px 0 0 0;"><strong>📍 Location:</strong> ${data.location || "TBD"}</p>
            </div>
            <p>Spots may be limited. Check out other events on ZotHub!</p>
            <div style="margin: 24px 0;">
              <a href="https://zothub.app/events" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Browse Events</a>
            </div>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("event_reminders")}
          </div>
        `,
      };

    case "rsvp_reminder":
      return {
        subject: `Reminder: ${data.eventTitle} is tomorrow!`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Event Reminder 📅</h1>
            <p>Hi ${data.studentName},</p>
            <p>Just a friendly reminder that <strong>${data.eventTitle}</strong> is happening tomorrow!</p>
            <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
              <p style="margin: 0;"><strong>📅 Date:</strong> ${data.eventDate}</p>
              <p style="margin: 8px 0 0 0;"><strong>📍 Location:</strong> ${data.location || "TBD"}</p>
              <p style="margin: 8px 0 0 0;"><strong>🏢 Hosted by:</strong> ${data.clubName}</p>
            </div>
            <p>See you there!</p>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("event_reminders")}
          </div>
        `,
      };

    case "deadline_reminder":
      return {
        subject: `Deadline Approaching: ${data.opportunityTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Deadline Reminder ⏰</h1>
            <p>Hi ${data.studentName},</p>
            <p>The deadline for <strong>${data.opportunityTitle}</strong> at <strong>${data.clubName}</strong> is approaching!</p>
            <div style="margin: 24px 0; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: #b45309;">
                Deadline: ${data.deadline}
              </p>
            </div>
            <p>Don't miss out on this opportunity!</p>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("deadline_reminders")}
          </div>
        `,
      };

    case "event_cancelled":
      return {
        subject: `Event Cancelled: ${data.eventTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Event Cancelled</h1>
            <p>Hi ${data.studentName},</p>
            <p>Unfortunately, <strong>${data.eventTitle}</strong> hosted by <strong>${data.clubName}</strong> has been cancelled.</p>
            <div style="margin: 24px 0; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
              <p style="margin: 0;"><strong>Originally scheduled for:</strong> ${data.eventDate}</p>
            </div>
            <p>We apologize for any inconvenience. Check out other events on ZotHub!</p>
            <div style="margin: 24px 0;">
              <a href="https://zothub.app/events" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Browse Events</a>
            </div>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("event_reminders")}
          </div>
        `,
      };

    case "new_club_post":
      return {
        subject: `New from ${data.clubName}: ${data.title}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">New Post from a Club You Follow! 🔔</h1>
            <p>Hi there,</p>
            <p><strong>${data.clubName}</strong> just posted something new:</p>
            <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
              <p style="margin: 0; font-weight: 600; color: #1a1a2e;">${data.title}</p>
              <p style="margin: 8px 0 0 0; color: #71717a;">Type: ${data.type}</p>
            </div>
            <div style="margin: 24px 0;">
              <a href="${data.link}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">View ${data.type}</a>
            </div>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("deadline_reminders")}
          </div>
        `,
      };

    case "waitlist_confirmation":
      return {
        subject: "You're on the ZotHub Waitlist!",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Welcome to ZotHub! 🎉</h1>
            <p>Thanks for signing up as a <strong>${data.role}</strong>!</p>
            <p>You're now on our waitlist. We manually review all signups to ensure a quality experience for our UCI community.</p>
            <div style="margin: 24px 0; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: #b45309;">What happens next?</p>
              <p style="margin: 8px 0 0 0;">We'll review your signup and send you an email once you're approved. This usually takes 1-2 business days.</p>
            </div>
            <p>In the meantime, you can explore <a href="https://zothub.app" style="color: #3b82f6;">ZotHub</a> to see what's available.</p>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("application_updates")}
          </div>
        `,
      };

    case "waitlist_approved":
      return {
        subject: "You're Approved! Welcome to ZotHub 🎉",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">You're In! 🎊</h1>
            <p>Great news! Your ZotHub account has been approved.</p>
            <p>You can now log in and access all features as a <strong>${data.role}</strong>.</p>
            <div style="margin: 24px 0;">
              <a href="https://zothub.app/login" style="display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px;">Log In Now</a>
            </div>
            ${data.role === "club" ? `
            <p>As a club, you can now:</p>
            <ul>
              <li>Create and manage opportunities</li>
              <li>Post events and track RSVPs</li>
              <li>Build your team</li>
              <li>Connect with UCI students</li>
            </ul>
            ` : `
            <p>As a student, you can now:</p>
            <ul>
              <li>Discover opportunities from UCI clubs</li>
              <li>Apply for leadership roles, projects, and more</li>
              <li>RSVP to events</li>
              <li>Follow your favorite clubs</li>
            </ul>
            `}
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("application_updates")}
          </div>
        `,
      };

    case "waitlist_rejected":
      return {
        subject: "ZotHub Application Update",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Application Update</h1>
            <p>Thank you for your interest in ZotHub.</p>
            <p>Unfortunately, we're unable to approve your signup request at this time.</p>
            ${data.reason ? `
            <div style="margin: 24px 0; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: #b91c1c;">Reason:</p>
              <p style="margin: 8px 0 0 0;">${data.reason}</p>
            </div>
            ` : ''}
            <p>If you believe this was a mistake, please reach out to us.</p>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("application_updates")}
          </div>
        `,
      };

    case "email_otp":
      return {
        subject: "Your ZotHub Verification Code",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Verify Your Email</h1>
            <p>Use this code to verify your email address and complete your ZotHub signup:</p>
            <div style="margin: 24px 0; padding: 24px; background: #f4f4f5; border-radius: 8px; text-align: center;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">
                ${data.code}
              </span>
            </div>
            <p style="color: #71717a;">This code expires in 10 minutes.</p>
            <p style="color: #71717a;">If you didn't request this code, you can safely ignore this email.</p>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
          </div>
        `,
      };

    default:
      return {
        subject: "ZotHub Notification",
        html: `<p>You have a new notification from ZotHub.</p>${getEmailFooter("application_updates")}`,
      };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, data }: EmailRequest = await req.json();

    if (!type || !data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, data" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Recipient and the user whose preferences gate this send. For most types
    // the recipient is the client-provided `to`; for the club "new application"
    // notification everything is resolved server-side from authoritative rows so
    // it can never be misrouted or spoofed by client input.
    let recipient = to;
    let preferenceUserId: string | null = null;
    let payload: Record<string, unknown> = data;

    const isRsvpAuthoritative = type === "rsvp_confirmation" || type === "rsvp_declined";
    const needsAdmin =
      type === "application_notification" || isRsvpAuthoritative || Boolean(PREFERENCE_COLUMN_BY_TYPE[type]);
    const supabase = needsAdmin ? createClient(supabaseUrl, supabaseServiceKey) : null;

    if (type === "application_notification" && supabase) {
      // 1. Require an authenticated end-user (the applying student). The bearer
      //    is forwarded by supabase-js functions.invoke; a service-role token or
      //    anonymous request resolves to no user and is rejected.
      const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!token) {
        return jsonResponse({ error: "Missing authorization" }, 401);
      }
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      const authUser = authData?.user;
      if (authError || !authUser) {
        return jsonResponse({ error: "Invalid or expired session" }, 401);
      }

      // 2. Load the referenced application and its authoritative relations.
      const applicationId = data.applicationId;
      if (!applicationId || typeof applicationId !== "string") {
        return jsonResponse({ error: "Missing applicationId" }, 400);
      }
      const { data: application } = await supabase
        .from("applications")
        .select(
          "id, student_profiles:student_id(user_id, full_name, major, year), " +
            "opportunities:opportunity_id(title, club_profiles:club_id(user_id, email, club_name))",
        )
        .eq("id", applicationId)
        .maybeSingle();

      if (!application) {
        return jsonResponse({ error: "Application not found" }, 404);
      }

      const student = application.student_profiles as
        | { user_id: string; full_name: string | null; major: string | null; year: string | null }
        | null;

      // 3. Authorize: the application must belong to the authenticated student.
      if (!student || student.user_id !== authUser.id) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      const opportunity = application.opportunities as
        | { title: string | null; club_profiles: { user_id: string; email: string; club_name: string } | null }
        | null;
      const club = opportunity?.club_profiles ?? null;
      if (!club?.email || !club?.user_id) {
        return jsonResponse({ error: "Owning club could not be resolved" }, 404);
      }

      // 4. Derive every recipient/content field from DB rows — ignore client data.
      recipient = club.email;
      preferenceUserId = club.user_id;
      payload = {
        clubName: club.club_name,
        opportunityTitle: opportunity?.title ?? "your opportunity",
        studentName: student.full_name || "A student",
        studentMajor: student.major ?? undefined,
        studentYear: student.year ?? undefined,
      };

      // 5. Respect the club's application_updates preference.
      const enabled = await isPreferenceEnabled(supabase, club.user_id, "application_updates");
      if (!enabled) {
        return jsonResponse({ skipped: true, reason: "preference_disabled" }, 200);
      }

      // 6. Idempotency: claim this (application, club) send before emailing, reusing
      //    the existing reminder_logs unique key. A duplicate claim means the club
      //    was already notified for this application, so skip the send.
      const { error: claimError } = await supabase.from("reminder_logs").insert({
        reminder_type: "application_notification",
        target_id: applicationId,
        user_id: club.user_id,
      });
      if (claimError) {
        if (claimError.code === "23505") {
          return jsonResponse({ skipped: true, reason: "already_sent" }, 200);
        }
        console.error("Failed to record application_notification log:", claimError);
        return jsonResponse({ error: "Could not record notification" }, 500);
      }
    } else if (isRsvpAuthoritative && supabase) {
      // RSVP confirmation / decline emails. Like application_notification, the
      // client sends only an authoritative rsvpId; the recipient (student) and
      // all event/club data are derived from DB rows, the caller is authorized,
      // and the send is gated on the student's event_reminders preference.
      const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      if (!token) {
        return jsonResponse({ error: "Missing authorization" }, 401);
      }
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      const authUser = authData?.user;
      if (authError || !authUser) {
        return jsonResponse({ error: "Invalid or expired session" }, 401);
      }

      const rsvpId = data.rsvpId;
      if (!rsvpId || typeof rsvpId !== "string") {
        return jsonResponse({ error: "Missing rsvpId" }, 400);
      }
      const { data: rsvp } = await supabase
        .from("rsvps")
        .select(
          "id, status, status_updated_by, student_profiles:student_id(user_id, email, full_name), " +
            "events:event_id(title, event_date, location, requires_approval, club_profiles:club_id(user_id, club_name))",
        )
        .eq("id", rsvpId)
        .maybeSingle();

      if (!rsvp) {
        return jsonResponse({ error: "RSVP not found" }, 404);
      }

      const student = rsvp.student_profiles as
        | { user_id: string; email: string | null; full_name: string | null }
        | null;
      const event = rsvp.events as
        | {
            title: string | null;
            event_date: string | null;
            location: string | null;
            requires_approval: boolean | null;
            club_profiles: { user_id: string; club_name: string } | null;
          }
        | null;
      const club = event?.club_profiles ?? null;

      if (!student?.email || !student?.user_id) {
        return jsonResponse({ error: "Recipient could not be resolved" }, 404);
      }
      if (!club?.user_id) {
        return jsonResponse({ error: "Event club could not be resolved" }, 404);
      }

      // Authorize the caller (must be the RSVP's student or the owning club) and
      // validate the requested email type against the caller's role and the
      // AUTHORITATIVE RSVP status (never a client-supplied status/actor). Delegated
      // to a pure, unit-tested rule so every combination is covered. Fail-closed.
      const isStudent = authUser.id === student.user_id;
      const isClub = authUser.id === club.user_id;
      // Was the latest status transition performed by the owning club? Derived
      // from the DB-persisted actor stamp, never from client input. Required for
      // rsvp_declined so a student self-cancel can't yield a club decline email.
      const statusUpdatedBy = (rsvp as { status_updated_by: string | null }).status_updated_by;
      const transitionActorIsClub = !!statusUpdatedBy && statusUpdatedBy === club.user_id;
      const decision = validateRsvpEmailRequest(
        type,
        isClub,
        isStudent,
        rsvp.status ?? "",
        transitionActorIsClub,
      );
      if (!decision.ok) {
        return jsonResponse({ error: decision.error }, decision.code);
      }

      recipient = student.email;
      preferenceUserId = student.user_id;
      const eventDate = event?.event_date
        ? new Date(event.event_date).toLocaleString("en-US", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "America/Los_Angeles",
          })
        : "TBD";
      payload = {
        studentName: student.full_name || "there",
        eventTitle: event?.title ?? "an event",
        clubName: club.club_name ?? "the club",
        eventDate,
        location: event?.location ?? "TBD",
        // Only meaningful for rsvp_confirmation: a still-pending RSVP shows the
        // "submitted, pending approval" copy; a confirmed one shows "confirmed".
        requiresApproval: rsvp.status === "pending",
      };

      // Gate on the student's event_reminders preference (recipient already
      // resolved from the DB, so this fails closed by construction).
      const enabled = await isPreferenceEnabled(supabase, student.user_id, "event_reminders");
      if (!enabled) {
        return jsonResponse({ skipped: true, reason: "preference_disabled" }, 200);
      }
    } else {
      // For the remaining preference-gated application emails (confirmation /
      // status) the recipient is the client-provided address. Resolve it to a
      // user and FAIL CLOSED for gated types when it can't be resolved, rather
      // than silently sending past the preference check.
      if (!recipient) {
        return jsonResponse({ error: "Missing required field: to" }, 400);
      }

      const preferenceColumn = PREFERENCE_COLUMN_BY_TYPE[type];
      if (supabase && preferenceColumn) {
        preferenceUserId = await resolveUserIdByEmail(supabase, recipient);
        if (!preferenceUserId) {
          console.log(`Skipping ${type} email: recipient ${recipient} could not be resolved to a user`);
          return jsonResponse({ skipped: true, reason: "recipient_unresolved" }, 200);
        }
        const enabled = await isPreferenceEnabled(supabase, preferenceUserId, preferenceColumn);
        if (!enabled) {
          console.log(`Skipping ${type} email: ${preferenceColumn} disabled for recipient`);
          return jsonResponse({ skipped: true, reason: "preference_disabled" }, 200);
        }
      }
    }

    const { subject, html } = getEmailContent(type, payload);

    const emailResponse = await resend.emails.send({
      from: "ZotHub <notifications@zothub.app>",
      to: [recipient],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-email function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
