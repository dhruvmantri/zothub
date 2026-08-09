import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { validateRsvpEmailRequest } from "./rsvp-email-rules.ts";
import { esc, safeUrl } from "./email-escape.ts";

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
  type: "application_confirmation" | "application_status" | "application_notification" | "rsvp_confirmation" | "rsvp_declined" | "rsvp_reminder" | "deadline_reminder" | "event_cancelled" | "new_club_post" | "waitlist_confirmation" | "waitlist_approved" | "waitlist_rejected" | "claim_approved" | "claim_rejected" | "email_otp";
  to: string;
  data: Record<string, unknown>;
}

type SupabaseClient = ReturnType<typeof createClient>;

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

// Every ${...} below is either esc() (text/attribute) or safeUrl() (href). `data`
// can carry attacker-influenced values (club names, notes, titles), and these
// emails send from the verified zothub.app domain, so nothing dynamic is trusted
// raw. Subjects are plaintext headers set via the Resend JSON API (no SMTP header
// concatenation), so they are not HTML-escaped — that would render literal &amp;.
const getEmailContent = (type: string, data: Record<string, unknown>) => {
  switch (type) {
    case "application_confirmation":
      return {
        subject: `Application Received: ${data.opportunityTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Application Submitted!</h1>
            <p>Hi ${esc(data.studentName)},</p>
            <p>Your application for <strong>${esc(data.opportunityTitle)}</strong> at <strong>${esc(data.clubName)}</strong> has been received.</p>
            <p>The club will review your application and get back to you soon.</p>
            <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
              <p style="margin: 0; color: #71717a;">Applied on: ${esc(new Date().toLocaleDateString())}</p>
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
      const statusKey = String(data.status ?? "");
      return {
        subject: `Application Update: ${data.opportunityTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Application Status Update</h1>
            <p>Hi ${esc(data.studentName)},</p>
            <p>Your application for <strong>${esc(data.opportunityTitle)}</strong> has been updated.</p>
            <div style="margin: 24px 0; padding: 16px; background: ${statusColors[statusKey] || "#f4f4f5"}20; border-left: 4px solid ${statusColors[statusKey] || "#71717a"}; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: ${statusColors[statusKey] || "#71717a"};">
                Status: ${esc(statusKey.toUpperCase())}
              </p>
              <p style="margin: 8px 0 0 0;">${esc(statusMessages[statusKey] || "")}</p>
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
            <p>Hi ${esc(data.clubName)},</p>
            <p>You received a new application for <strong>${esc(data.opportunityTitle)}</strong>.</p>
            <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
              <p style="margin: 0;"><strong>Applicant:</strong> ${esc(data.studentName)}</p>
              ${data.studentMajor ? `<p style="margin: 8px 0 0 0;"><strong>Major:</strong> ${esc(data.studentMajor)}</p>` : ""}
              ${data.studentYear ? `<p style="margin: 8px 0 0 0;"><strong>Year:</strong> ${esc(data.studentYear)}</p>` : ""}
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
            <p>Hi ${esc(data.studentName)},</p>
            <p>Your RSVP for <strong>${esc(data.eventTitle)}</strong> has been ${data.requiresApproval ? "submitted and is pending approval" : "confirmed"}!</p>
            <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
              <p style="margin: 0;"><strong>📅 Date:</strong> ${esc(data.eventDate)}</p>
              <p style="margin: 8px 0 0 0;"><strong>📍 Location:</strong> ${esc(data.location || "TBD")}</p>
              <p style="margin: 8px 0 0 0;"><strong>🏢 Hosted by:</strong> ${esc(data.clubName)}</p>
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
            <p>Hi ${esc(data.studentName)},</p>
            <p>Unfortunately, your RSVP for <strong>${esc(data.eventTitle)}</strong> hosted by <strong>${esc(data.clubName)}</strong> was not approved.</p>
            <div style="margin: 24px 0; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: #b91c1c;">Your RSVP was declined by the organizer.</p>
              <p style="margin: 8px 0 0 0;"><strong>📅 Date:</strong> ${esc(data.eventDate)}</p>
              <p style="margin: 8px 0 0 0;"><strong>📍 Location:</strong> ${esc(data.location || "TBD")}</p>
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
            <p>Hi ${esc(data.studentName)},</p>
            <p>Just a friendly reminder that <strong>${esc(data.eventTitle)}</strong> is happening tomorrow!</p>
            <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
              <p style="margin: 0;"><strong>📅 Date:</strong> ${esc(data.eventDate)}</p>
              <p style="margin: 8px 0 0 0;"><strong>📍 Location:</strong> ${esc(data.location || "TBD")}</p>
              <p style="margin: 8px 0 0 0;"><strong>🏢 Hosted by:</strong> ${esc(data.clubName)}</p>
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
            <p>Hi ${esc(data.studentName)},</p>
            <p>The deadline for <strong>${esc(data.opportunityTitle)}</strong> at <strong>${esc(data.clubName)}</strong> is approaching!</p>
            <div style="margin: 24px 0; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: #b45309;">
                Deadline: ${esc(data.deadline)}
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
            <p>Hi ${esc(data.studentName)},</p>
            <p>Unfortunately, <strong>${esc(data.eventTitle)}</strong> hosted by <strong>${esc(data.clubName)}</strong> has been cancelled.</p>
            <div style="margin: 24px 0; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
              <p style="margin: 0;"><strong>Originally scheduled for:</strong> ${esc(data.eventDate)}</p>
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
            <p><strong>${esc(data.clubName)}</strong> just posted something new:</p>
            <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
              <p style="margin: 0; font-weight: 600; color: #1a1a2e;">${esc(data.title)}</p>
              <p style="margin: 8px 0 0 0; color: #71717a;">Type: ${esc(data.type)}</p>
            </div>
            <div style="margin: 24px 0;">
              <a href="${safeUrl(data.link)}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">View ${esc(data.type)}</a>
            </div>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("deadline_reminders")}
          </div>
        `,
      };

    case "claim_approved": {
      // Two variants: a brand-new account gets a single-use set-password link;
      // an existing account (a signed-in claimant, e.g. a student officer) is
      // told to log in — no recovery link, since they already have a password.
      const isNewAccount = data.isNewAccount !== false && !!data.actionLink;
      const cta = isNewAccount
        ? `
            <p>Set your password to finish setting up your account and start managing your club page:</p>
            <div style="margin: 24px 0;">
              <a href="${safeUrl(data.actionLink)}" style="display: inline-block; padding: 12px 24px; background: #0F5FA8; color: white; text-decoration: none; border-radius: 8px;">Set your password</a>
            </div>
            <p style="color: #71717a; font-size: 13px;">This link is single-use and expires soon. If it expires, go to <a href="https://zothub.app/login" style="color: #0F5FA8;">zothub.app/login</a>, choose “Forgot password,” and enter this email address.</p>`
        : `
            <p>Your existing ZotHub account now owns this club — just log in to start managing the page:</p>
            <div style="margin: 24px 0;">
              <a href="${safeUrl(data.manageUrl || "https://zothub.app/login")}" style="display: inline-block; padding: 12px 24px; background: #0F5FA8; color: white; text-decoration: none; border-radius: 8px;">Log in to manage ${esc(data.clubName)}</a>
            </div>`;
      return {
        subject: `Your ZotHub club claim is approved — ${data.clubName}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Your club is claimed 🎉</h1>
            <p>Your claim for <strong>${esc(data.clubName)}</strong> on ZotHub has been approved.</p>
            ${cta}
            <p>Once you're in you can post opportunities and events, add your team, and update your club's info.</p>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("application_updates")}
          </div>
        `,
      };
    }

    case "claim_rejected":
      return {
        subject: `Update on your ZotHub club claim — ${data.clubName}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Claim update</h1>
            <p>Thanks for your interest in claiming <strong>${esc(data.clubName)}</strong> on ZotHub.</p>
            <p>We weren't able to approve this claim.</p>
            ${data.reason ? `
            <div style="margin: 24px 0; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
              <p style="margin: 0; font-weight: 600; color: #b91c1c;">Reason:</p>
              <p style="margin: 8px 0 0 0;">${esc(data.reason)}</p>
            </div>
            ` : ''}
            <p>If you think this was a mistake or have questions, reach out at <a href="mailto:zothub.uci@gmail.com" style="color: #0F5FA8;">zothub.uci@gmail.com</a>.</p>
            <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
            ${getEmailFooter("application_updates")}
          </div>
        `,
      };

    case "waitlist_confirmation":
      return {
        subject: "You're on the ZotHub Waitlist!",
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a2e;">Welcome to ZotHub! 🎉</h1>
            <p>Thanks for signing up as a <strong>${esc(data.role)}</strong>!</p>
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
            <p>You can now log in and access all features as a <strong>${esc(data.role)}</strong>.</p>
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
              <p style="margin: 8px 0 0 0;">${esc(data.reason)}</p>
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
                ${esc(data.code)}
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

// STRICT runtime allowlist of known templates. Anything else is rejected 400.
const TEMPLATE_TYPES = new Set([
  "application_confirmation",
  "application_status",
  "application_notification",
  "rsvp_confirmation",
  "rsvp_declined",
  "rsvp_reminder",
  "deadline_reminder",
  "event_cancelled",
  "new_club_post",
  "waitlist_confirmation",
  "waitlist_approved",
  "waitlist_rejected",
  "claim_approved",
  "claim_rejected",
  "email_otp",
]);

// Templates ONLY a trusted server (service role) may send. They carry account /
// OTP links or are fanned out by cron/triggers; no end-user may send them.
const SERVICE_ROLE_ONLY = new Set([
  "email_otp",
  "claim_approved",
  "claim_rejected",
  "new_club_post",
  "deadline_reminder",
  "rsvp_reminder",
]);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, to, data }: EmailRequest = await req.json();

    // Strict template allowlist — reject unknown types outright.
    if (!type || !TEMPLATE_TYPES.has(type)) {
      return jsonResponse({ error: "Unknown or unsupported email type." }, 400);
    }
    const dataIn: Record<string, unknown> = (data ?? {}) as Record<string, unknown>;

    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const isServiceRole = bearer.length > 0 && bearer === supabaseServiceKey;

    const from = "ZotHub <notifications@zothub.app>";
    // Single-recipient send. Returns the Resend response verbatim at 200 — the body
    // carries `{ error }` on a Resend-side failure, which callers MUST inspect (a
    // 200 is NOT proof of delivery). See send-otp / review-club-claim.
    const sendOne = async (recipient: string | undefined, payload: Record<string, unknown>) => {
      if (!recipient) return jsonResponse({ error: "Missing recipient." }, 400);
      const { subject, html } = getEmailContent(type, payload);
      const emailResponse = await resend.emails.send({ from, to: [recipient], subject, html });
      return jsonResponse(emailResponse as unknown as Record<string, unknown>, 200);
    };

    // ── Tier 1: service-role-only templates ─────────────────────────────────
    if (SERVICE_ROLE_ONLY.has(type)) {
      if (!isServiceRole) return jsonResponse({ error: "Not authorized." }, 401);
      return await sendOne(to, dataIn);
    }

    // ── Tier 2: authoritative templates ─────────────────────────────────────
    // A trusted server (service role) — e.g. verify-otp sending waitlist_* — is
    // trusted to supply recipient/content directly. Any OTHER caller must be an
    // authenticated end-user, and the recipient + content are DERIVED from DB
    // ownership (never chosen by the client), so no ordinary user can send official
    // ZotHub content to an arbitrary address.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    if (isServiceRole) {
      return await sendOne(to, dataIn);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
    const authUser = authData?.user;
    if (authError || !authUser) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    // application_notification — club is notified of a new application (existing).
    if (type === "application_notification") {
      const applicationId = dataIn.applicationId;
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
      if (!application) return jsonResponse({ error: "Application not found" }, 404);
      const student = application.student_profiles as
        | { user_id: string; full_name: string | null; major: string | null; year: string | null }
        | null;
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
      if (!(await isPreferenceEnabled(supabase, club.user_id, "application_updates"))) {
        return jsonResponse({ skipped: true, reason: "preference_disabled" }, 200);
      }
      const { error: claimError } = await supabase.from("reminder_logs").insert({
        reminder_type: "application_notification",
        target_id: applicationId,
        user_id: club.user_id,
      });
      if (claimError) {
        if (claimError.code === "23505") return jsonResponse({ skipped: true, reason: "already_sent" }, 200);
        console.error("Failed to record application_notification log:", claimError);
        return jsonResponse({ error: "Could not record notification" }, 500);
      }
      return await sendOne(club.email, {
        clubName: club.club_name,
        opportunityTitle: opportunity?.title ?? "your opportunity",
        studentName: student.full_name || "A student",
        studentMajor: student.major ?? undefined,
        studentYear: student.year ?? undefined,
      });
    }

    // application_confirmation — the applying STUDENT is confirmed. Recipient is
    // the student's own email; caller must be that student.
    if (type === "application_confirmation") {
      const applicationId = dataIn.applicationId;
      if (!applicationId || typeof applicationId !== "string") {
        return jsonResponse({ error: "Missing applicationId" }, 400);
      }
      const { data: application } = await supabase
        .from("applications")
        .select(
          "id, student_profiles:student_id(user_id, email, full_name), " +
            "opportunities:opportunity_id(title, club_profiles:club_id(club_name))",
        )
        .eq("id", applicationId)
        .maybeSingle();
      if (!application) return jsonResponse({ error: "Application not found" }, 404);
      const student = application.student_profiles as
        | { user_id: string; email: string | null; full_name: string | null }
        | null;
      if (!student || student.user_id !== authUser.id) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      if (!student.email) return jsonResponse({ error: "Recipient could not be resolved" }, 404);
      const opportunity = application.opportunities as
        | { title: string | null; club_profiles: { club_name: string } | null }
        | null;
      if (!(await isPreferenceEnabled(supabase, student.user_id, "application_updates"))) {
        return jsonResponse({ skipped: true, reason: "preference_disabled" }, 200);
      }
      return await sendOne(student.email, {
        studentName: student.full_name || "there",
        opportunityTitle: opportunity?.title ?? "your opportunity",
        clubName: opportunity?.club_profiles?.club_name ?? "the club",
      });
    }

    // application_status — the owning CLUB notifies the student of a status change.
    // Caller must own the opportunity; the status is read from the DB, not client.
    if (type === "application_status") {
      const applicationId = dataIn.applicationId;
      if (!applicationId || typeof applicationId !== "string") {
        return jsonResponse({ error: "Missing applicationId" }, 400);
      }
      const { data: application } = await supabase
        .from("applications")
        .select(
          "id, status, student_profiles:student_id(user_id, email, full_name), " +
            "opportunities:opportunity_id(title, club_profiles:club_id(user_id, club_name))",
        )
        .eq("id", applicationId)
        .maybeSingle();
      if (!application) return jsonResponse({ error: "Application not found" }, 404);
      const opportunity = application.opportunities as
        | { title: string | null; club_profiles: { user_id: string; club_name: string } | null }
        | null;
      const club = opportunity?.club_profiles ?? null;
      if (!club || club.user_id !== authUser.id) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
      const student = application.student_profiles as
        | { user_id: string; email: string | null; full_name: string | null }
        | null;
      if (!student?.email || !student?.user_id) {
        return jsonResponse({ error: "Recipient could not be resolved" }, 404);
      }
      if (!(await isPreferenceEnabled(supabase, student.user_id, "application_updates"))) {
        return jsonResponse({ skipped: true, reason: "preference_disabled" }, 200);
      }
      return await sendOne(student.email, {
        studentName: student.full_name || "there",
        opportunityTitle: opportunity?.title ?? "your opportunity",
        status: (application as { status: string }).status,
      });
    }

    // rsvp_confirmation / rsvp_declined (existing authoritative logic).
    if (type === "rsvp_confirmation" || type === "rsvp_declined") {
      const rsvpId = dataIn.rsvpId;
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
      if (!rsvp) return jsonResponse({ error: "RSVP not found" }, 404);
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
      if (!student?.email || !student?.user_id) return jsonResponse({ error: "Recipient could not be resolved" }, 404);
      if (!club?.user_id) return jsonResponse({ error: "Event club could not be resolved" }, 404);

      const isStudent = authUser.id === student.user_id;
      const isClub = authUser.id === club.user_id;
      const statusUpdatedBy = (rsvp as { status_updated_by: string | null }).status_updated_by;
      const transitionActorIsClub = !!statusUpdatedBy && statusUpdatedBy === club.user_id;
      const decision = validateRsvpEmailRequest(type, isClub, isStudent, rsvp.status ?? "", transitionActorIsClub);
      if (!decision.ok) return jsonResponse({ error: decision.error }, decision.code);

      if (!(await isPreferenceEnabled(supabase, student.user_id, "event_reminders"))) {
        return jsonResponse({ skipped: true, reason: "preference_disabled" }, 200);
      }
      const eventDate = event?.event_date
        ? new Date(event.event_date).toLocaleString("en-US", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "America/Los_Angeles",
          })
        : "TBD";
      return await sendOne(student.email, {
        studentName: student.full_name || "there",
        eventTitle: event?.title ?? "an event",
        clubName: club.club_name ?? "the club",
        eventDate,
        location: event?.location ?? "TBD",
        requiresApproval: rsvp.status === "pending",
      });
    }

    // event_cancelled — the owning CLUB notifies all confirmed attendees. Recipients
    // are derived from the DB (never client-chosen); it is a bulk send.
    if (type === "event_cancelled") {
      const eventId = dataIn.eventId;
      if (!eventId || typeof eventId !== "string") {
        return jsonResponse({ error: "Missing eventId" }, 400);
      }
      const { data: event } = await supabase
        .from("events")
        .select("id, title, event_date, club_profiles:club_id(user_id, club_name)")
        .eq("id", eventId)
        .maybeSingle();
      if (!event) return jsonResponse({ error: "Event not found" }, 404);
      const club = event.club_profiles as { user_id: string; club_name: string } | null;
      if (!club || club.user_id !== authUser.id) return jsonResponse({ error: "Forbidden" }, 403);
      const { data: rsvps } = await supabase
        .from("rsvps")
        .select("student_profiles:student_id(user_id, email, full_name)")
        .eq("event_id", eventId)
        .eq("status", "confirmed");
      const eventDate = event.event_date
        ? new Date(event.event_date).toLocaleString("en-US", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "America/Los_Angeles",
          })
        : "TBD";
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];
      for (const r of rsvps ?? []) {
        const s = (r as { student_profiles: { user_id: string; email: string | null; full_name: string | null } | null })
          .student_profiles;
        if (!s?.email || !s?.user_id) continue;
        if (!(await isPreferenceEnabled(supabase, s.user_id, "event_reminders"))) continue;
        const { subject, html } = getEmailContent("event_cancelled", {
          studentName: s.full_name || "there",
          eventTitle: event.title ?? "an event",
          eventDate,
          clubName: club.club_name ?? "the club",
        });
        const resp = await resend.emails.send({ from, to: [s.email], subject, html });
        if ((resp as { error?: unknown })?.error) {
          failed++;
          errors.push(`${s.email}: ${String((resp as { error: unknown }).error)}`);
        } else {
          sent++;
        }
      }
      return jsonResponse({ ok: failed === 0, sent, failed, errors }, 200);
    }

    // waitlist_confirmation — sent to the SIGNED-IN user themselves (OAuth signup).
    // Recipient is forced to the caller's own email; they cannot target anyone else.
    if (type === "waitlist_confirmation") {
      if (!authUser.email) return jsonResponse({ error: "Recipient could not be resolved" }, 404);
      return await sendOne(authUser.email, { role: dataIn.role ?? "member" });
    }

    // waitlist_approved / waitlist_rejected — ADMIN action. Caller must be an admin;
    // the recipient is derived from the referenced waitlist row (a real waitlisted
    // user), so an admin cannot send official mail to an arbitrary address either.
    if (type === "waitlist_approved" || type === "waitlist_rejected") {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!adminRole) return jsonResponse({ error: "Admin only." }, 403);
      const waitlistUserId = dataIn.waitlistUserId;
      if (!waitlistUserId || typeof waitlistUserId !== "string") {
        return jsonResponse({ error: "Missing waitlistUserId" }, 400);
      }
      const { data: wl } = await supabase
        .from("waitlist")
        .select("email, role")
        .eq("user_id", waitlistUserId)
        .maybeSingle();
      if (!wl?.email) return jsonResponse({ error: "Waitlisted user not found" }, 404);
      return await sendOne(wl.email as string, { role: wl.role, reason: dataIn.reason });
    }

    return jsonResponse({ error: "Unsupported email type for this caller." }, 400);
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
