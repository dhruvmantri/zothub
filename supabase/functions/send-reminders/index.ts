import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const results = {
      eventReminders: 0,
      deadlineReminders: 0,
      newPostEmails: 0,
      errors: [] as string[],
    };

    // 1. Event reminders (events happening in next 24-48 hours)
    const { data: upcomingEvents, error: eventsError } = await supabase
      .from("events")
      .select(`
        id, title, event_date, location,
        club_profiles!inner(club_name),
        rsvps!inner(
          id, student_id, status,
          student_profiles:student_id(user_id, email, full_name)
        )
      `)
      .eq("is_active", true)
      .gte("event_date", tomorrow.toISOString())
      .lte("event_date", in48Hours.toISOString());

    if (eventsError) {
      results.errors.push(`Events query error: ${eventsError.message}`);
    } else if (upcomingEvents) {
      for (const event of upcomingEvents) {
        const clubName = (event.club_profiles as unknown as { club_name: string })?.club_name || "Unknown Club";
        for (const rsvp of event.rsvps || []) {
          if (rsvp.status !== "confirmed") continue;
          
          const studentProfile = rsvp.student_profiles as unknown as { user_id: string; email: string; full_name: string } | null;
          if (!studentProfile?.email || !studentProfile?.user_id) continue;

          // Check if reminder already sent
          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("reminder_type", "event_reminder")
            .eq("target_id", event.id)
            .eq("user_id", studentProfile.user_id)
            .single();

          if (existingLog) continue;

          // Check notification preferences
          const { data: prefs } = await supabase
            .from("notification_preferences")
            .select("event_reminders")
            .eq("user_id", studentProfile.user_id)
            .single();

          if (prefs && !prefs.event_reminders) continue;

          try {
            await resend.emails.send({
              from: "ZotHub <notifications@zothub.app>",
              to: [studentProfile.email],
              subject: `Reminder: ${event.title} is tomorrow!`,
              html: `
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #1a1a2e;">Event Reminder 📅</h1>
                  <p>Hi ${studentProfile.full_name || "there"},</p>
                  <p>Just a friendly reminder that <strong>${event.title}</strong> is happening tomorrow!</p>
                  <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
                    <p style="margin: 0;"><strong>📅 Date:</strong> ${new Date(event.event_date).toLocaleString()}</p>
                    <p style="margin: 8px 0 0 0;"><strong>📍 Location:</strong> ${event.location || "TBD"}</p>
                    <p style="margin: 8px 0 0 0;"><strong>🏢 Hosted by:</strong> ${clubName}</p>
                  </div>
                  <p>See you there!</p>
                  <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
                  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
                    <p style="color: #71717a; font-size: 12px; margin: 0;">
                      You received this email because you RSVP'd to this event.<br/>
                      <a href="https://zothub.app/unsubscribe?type=event_reminders" style="color: #3b82f6;">Unsubscribe from event reminders</a> | 
                      <a href="https://zothub.app/unsubscribe" style="color: #3b82f6;">Manage all preferences</a>
                    </p>
                    <p style="color: #a1a1aa; font-size: 11px; margin-top: 12px;">
                      ZotHub • University of California, Irvine • Irvine, CA 92697
                    </p>
                  </div>
                </div>
              `,
            });

            // Log the reminder
            await supabase.from("reminder_logs").insert({
              reminder_type: "event_reminder",
              target_id: event.id,
              user_id: studentProfile.user_id,
            });

            results.eventReminders++;
          } catch (emailError) {
            results.errors.push(`Event email error: ${emailError}`);
          }
        }
      }
    }

    // 2. Deadline reminders (opportunities with deadlines in next 24-48 hours)
    const { data: upcomingDeadlines, error: deadlinesError } = await supabase
      .from("opportunities")
      .select(`
        id, title, deadline,
        club_profiles:club_id(club_name)
      `)
      .eq("is_active", true)
      .gte("deadline", tomorrow.toISOString())
      .lte("deadline", in48Hours.toISOString());

    if (deadlinesError) {
      results.errors.push(`Deadlines query error: ${deadlinesError.message}`);
    } else if (upcomingDeadlines) {
      // Get all students who have bookmarked these opportunities
      for (const opportunity of upcomingDeadlines) {
        const clubName = (opportunity.club_profiles as unknown as { club_name: string })?.club_name || "Unknown Club";
        const { data: bookmarks } = await supabase
          .from("bookmarks")
          .select("user_id")
          .eq("opportunity_id", opportunity.id);

        if (!bookmarks) continue;

        for (const bookmark of bookmarks) {
          // Check if reminder already sent
          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("reminder_type", "deadline_reminder")
            .eq("target_id", opportunity.id)
            .eq("user_id", bookmark.user_id)
            .single();

          if (existingLog) continue;

          // Check notification preferences
          const { data: prefs } = await supabase
            .from("notification_preferences")
            .select("deadline_reminders")
            .eq("user_id", bookmark.user_id)
            .single();

          if (prefs && !prefs.deadline_reminders) continue;

          // Get student email
          const { data: student } = await supabase
            .from("student_profiles")
            .select("email, full_name")
            .eq("user_id", bookmark.user_id)
            .single();

          if (!student?.email) continue;

          try {
            await resend.emails.send({
              from: "ZotHub <notifications@zothub.app>",
              to: [student.email],
              subject: `Deadline Approaching: ${opportunity.title}`,
              html: `
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #1a1a2e;">Deadline Reminder ⏰</h1>
                  <p>Hi ${student.full_name || "there"},</p>
                  <p>The deadline for <strong>${opportunity.title}</strong> at <strong>${clubName}</strong> is approaching!</p>
                  <div style="margin: 24px 0; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                    <p style="margin: 0; font-weight: 600; color: #b45309;">
                      Deadline: ${new Date(opportunity.deadline!).toLocaleString()}
                    </p>
                  </div>
                  <p>Don't miss out on this opportunity!</p>
                  <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
                  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
                    <p style="color: #71717a; font-size: 12px; margin: 0;">
                      You received this email because you bookmarked this opportunity.<br/>
                      <a href="https://zothub.app/unsubscribe?type=deadline_reminders" style="color: #3b82f6;">Unsubscribe from deadline reminders</a> | 
                      <a href="https://zothub.app/unsubscribe" style="color: #3b82f6;">Manage all preferences</a>
                    </p>
                    <p style="color: #a1a1aa; font-size: 11px; margin-top: 12px;">
                      ZotHub • University of California, Irvine • Irvine, CA 92697
                    </p>
                  </div>
                </div>
              `,
            });

            // Log the reminder
            await supabase.from("reminder_logs").insert({
              reminder_type: "deadline_reminder",
              target_id: opportunity.id,
              user_id: bookmark.user_id,
            });

            results.deadlineReminders++;
          } catch (emailError) {
            results.errors.push(`Deadline email error: ${emailError}`);
          }
        }
      }
    }

    // 3. New club post notifications (opportunities/events created in last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    let newPostEmails = 0;

    // Check for new opportunities
    const { data: newOpportunities, error: oppError } = await supabase
      .from("opportunities")
      .select(`
        id, title,
        club_profiles:club_id(id, club_name)
      `)
      .eq("is_active", true)
      .gte("created_at", oneHourAgo.toISOString());

    if (oppError) {
      results.errors.push(`New opportunities query error: ${oppError.message}`);
    } else if (newOpportunities) {
      for (const opportunity of newOpportunities) {
        const clubProfile = opportunity.club_profiles as unknown as { id: string; club_name: string } | null;
        if (!clubProfile) continue;

        // Get followers of this club. "Following" is stored as a bookmark with
        // club_id set (the source of truth the whole app uses); club_followers is
        // never written by the app.
        const { data: followers } = await supabase
          .from("bookmarks")
          .select("user_id")
          .eq("club_id", clubProfile.id);

        if (!followers) continue;

        // A follower can have duplicate bookmark rows (no unique constraint);
        // de-duplicate so we only consider each follower once.
        const uniqueFollowerIds = [...new Set(followers.map((f) => f.user_id))];

        for (const followerId of uniqueFollowerIds) {
          // Check if email already sent
          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("reminder_type", "new_post_email")
            .eq("target_id", opportunity.id)
            .eq("user_id", followerId)
            .single();

          if (existingLog) continue;

          // Check notification preferences
          const { data: prefs } = await supabase
            .from("notification_preferences")
            .select("new_post_notifications")
            .eq("user_id", followerId)
            .single();

          if (prefs && !prefs.new_post_notifications) continue;

          // Get student email
          const { data: student } = await supabase
            .from("student_profiles")
            .select("email, full_name")
            .eq("user_id", followerId)
            .single();

          if (!student?.email) continue;

          try {
            await resend.emails.send({
              from: "ZotHub <notifications@zothub.app>",
              to: [student.email],
              subject: `New opportunity from ${clubProfile.club_name}`,
              html: `
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #1a1a2e;">New Opportunity 🎯</h1>
                  <p>Hi ${student.full_name || "there"},</p>
                  <p><strong>${clubProfile.club_name}</strong> just posted a new opportunity:</p>
                  <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
                    <h2 style="margin: 0 0 8px 0; color: #1a1a2e;">${opportunity.title}</h2>
                  </div>
                  <a href="https://zothub.app/opportunities/${opportunity.id}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">View Opportunity</a>
                  <p style="margin-top: 24px; color: #71717a; font-size: 14px;">— The ZotHub Team</p>
                  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
                    <p style="color: #71717a; font-size: 12px; margin: 0;">
                      You received this email because you follow ${clubProfile.club_name}.<br/>
                      <a href="https://zothub.app/unsubscribe?type=new_post_notifications" style="color: #3b82f6;">Unsubscribe from new posts</a> |
                      <a href="https://zothub.app/unsubscribe" style="color: #3b82f6;">Manage all preferences</a>
                    </p>
                    <p style="color: #a1a1aa; font-size: 11px; margin-top: 12px;">
                      ZotHub • University of California, Irvine • Irvine, CA 92697
                    </p>
                  </div>
                </div>
              `,
            });

            await supabase.from("reminder_logs").insert({
              reminder_type: "new_post_email",
              target_id: opportunity.id,
              user_id: followerId,
            });

            newPostEmails++;
          } catch (emailError) {
            results.errors.push(`New post email error: ${emailError}`);
          }
        }
      }
    }

    // Check for new events
    const { data: newEvents, error: eventsErr } = await supabase
      .from("events")
      .select(`
        id, title, event_date, location,
        club_profiles:club_id(id, club_name)
      `)
      .eq("is_active", true)
      .gte("created_at", oneHourAgo.toISOString());

    if (eventsErr) {
      results.errors.push(`New events query error: ${eventsErr.message}`);
    } else if (newEvents) {
      for (const event of newEvents) {
        const clubProfile = event.club_profiles as unknown as { id: string; club_name: string } | null;
        if (!clubProfile) continue;

        const { data: followers } = await supabase
          .from("bookmarks")
          .select("user_id")
          .eq("club_id", clubProfile.id);

        if (!followers) continue;

        const uniqueFollowerIds = [...new Set(followers.map((f) => f.user_id))];

        for (const followerId of uniqueFollowerIds) {
          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("reminder_type", "new_post_email")
            .eq("target_id", event.id)
            .eq("user_id", followerId)
            .single();

          if (existingLog) continue;

          const { data: prefs } = await supabase
            .from("notification_preferences")
            .select("new_post_notifications")
            .eq("user_id", followerId)
            .single();

          if (prefs && !prefs.new_post_notifications) continue;

          const { data: student } = await supabase
            .from("student_profiles")
            .select("email, full_name")
            .eq("user_id", followerId)
            .single();

          if (!student?.email) continue;

          try {
            await resend.emails.send({
              from: "ZotHub <notifications@zothub.app>",
              to: [student.email],
              subject: `New event from ${clubProfile.club_name}`,
              html: `
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #1a1a2e;">New Event 📅</h1>
                  <p>Hi ${student.full_name || "there"},</p>
                  <p><strong>${clubProfile.club_name}</strong> just posted a new event:</p>
                  <div style="margin: 24px 0; padding: 16px; background: #f4f4f5; border-radius: 8px;">
                    <h2 style="margin: 0 0 8px 0; color: #1a1a2e;">${event.title}</h2>
                    <p style="margin: 0;"><strong>📅</strong> ${new Date(event.event_date).toLocaleString()}</p>
                    ${event.location ? `<p style="margin: 4px 0 0 0;"><strong>📍</strong> ${event.location}</p>` : ''}
                  </div>
                  <a href="https://zothub.app/events/${event.id}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">View Event</a>
                  <p style="margin-top: 24px; color: #71717a; font-size: 14px;">— The ZotHub Team</p>
                  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
                    <p style="color: #71717a; font-size: 12px; margin: 0;">
                      You received this email because you follow ${clubProfile.club_name}.<br/>
                      <a href="https://zothub.app/unsubscribe?type=new_post_notifications" style="color: #3b82f6;">Unsubscribe from new posts</a> |
                      <a href="https://zothub.app/unsubscribe" style="color: #3b82f6;">Manage all preferences</a>
                    </p>
                    <p style="color: #a1a1aa; font-size: 11px; margin-top: 12px;">
                      ZotHub • University of California, Irvine • Irvine, CA 92697
                    </p>
                  </div>
                </div>
              `,
            });

            await supabase.from("reminder_logs").insert({
              reminder_type: "new_post_email",
              target_id: event.id,
              user_id: followerId,
            });

            newPostEmails++;
          } catch (emailError) {
            results.errors.push(`New event email error: ${emailError}`);
          }
        }
      }
    }

    results.newPostEmails = newPostEmails;
    console.log("Reminder results:", results);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-reminders function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
