import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: "application_confirmation" | "application_status" | "rsvp_confirmation" | "rsvp_reminder" | "deadline_reminder" | "event_cancelled" | "new_club_post";
  to: string;
  data: Record<string, unknown>;
}

const getEmailFooter = (type: string) => `
  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
    <p style="color: #71717a; font-size: 12px; margin: 0;">
      You received this email because you have an account on ZotHub.<br/>
      <a href="https://zothub.lovable.app/unsubscribe?type=${type}" style="color: #3b82f6;">Unsubscribe from ${type.replace(/_/g, " ")} emails</a> | 
      <a href="https://zothub.lovable.app/unsubscribe" style="color: #3b82f6;">Manage all preferences</a>
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

    case "application_status":
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
              <a href="https://zothub.lovable.app/events" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Browse Events</a>
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

    if (!type || !to || !data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, to, data" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { subject, html } = getEmailContent(type, data);

    const emailResponse = await resend.emails.send({
      from: "ZotHub <notifications@resend.dev>",
      to: [to],
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
