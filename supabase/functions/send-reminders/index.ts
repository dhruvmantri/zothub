import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { checkEmailResult } from "../_shared/email-result.ts";
import { deliverReminder } from "../_shared/reminder-delivery.ts";

/**
 * The hourly reminder job.
 *
 * Two defects this rewrite exists to close, both of which only bite once real
 * people are using the product — which is why it is due before the first real
 * user rather than before launch.
 *
 * S5 — it used to build HTML here and hand it straight to Resend, interpolating
 * club names, titles, locations and student names RAW. 724 of those club names
 * were scraped from ZotSpot: third-party text nobody sanitised, going out from
 * the verified zothub.app domain. Every send now goes through `send-email`,
 * whose templates escape every interpolation and which owns the allowlist.
 *
 * R1 — it used to send, then log. Resend's SDK RESOLVES with `{ error }` on an
 * API failure rather than throwing, so the try/catch never fired, the log row
 * was written anyway, and the `unique_reminder` constraint then made that
 * reminder PERMANENTLY unsendable. The student silently never got it, and no
 * retry was possible for the life of the row. It is now claim-before-send: the
 * log row is written FIRST as a claim, the send is judged by `checkEmailResult`,
 * and the claim is RELEASED if delivery failed, so the next hourly run retries.
 * That ordering also makes two overlapping cron runs safe — the unique
 * constraint decides who owns the send instead of both sending.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Supa = ReturnType<typeof createClient>;

/** Postgres unique-violation: somebody already claimed this exact reminder. */
const UNIQUE_VIOLATION = "23505";

interface Recipient {
  userId: string;
  email: string;
  fullName: string | null;
}

/**
 * Claim a reminder by writing its log row BEFORE sending.
 *
 * Returns false when the row already exists, which means it was already sent
 * (or is being sent right now by an overlapping run) — either way this run must
 * not send it.
 */
async function claim(
  supabase: Supa,
  reminderType: string,
  targetId: string,
  userId: string,
): Promise<{ claimed: boolean; error?: string }> {
  const { error } = await supabase
    .from("reminder_logs")
    .insert({ reminder_type: reminderType, target_id: targetId, user_id: userId });
  if (!error) return { claimed: true };
  if (error.code === UNIQUE_VIOLATION) return { claimed: false };
  return { claimed: false, error: error.message };
}

/**
 * Give the claim back after a failed send, so the next run can try again.
 *
 * If this delete itself fails the reminder stays unsendable — the one case the
 * old code produced for EVERY failure — so it is reported loudly rather than
 * swallowed.
 */
async function release(
  supabase: Supa,
  reminderType: string,
  targetId: string,
  userId: string,
): Promise<string | null> {
  const { error } = await supabase
    .from("reminder_logs")
    .delete()
    .eq("reminder_type", reminderType)
    .eq("target_id", targetId)
    .eq("user_id", userId);
  return error ? error.message : null;
}

/** Send through `send-email`, which escapes. A 200 is not proof of delivery. */
async function sendVia(
  supabase: Supa,
  type: string,
  to: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: res, error } = await supabase.functions.invoke("send-email", {
      body: { type, to, data },
    });
    return checkEmailResult(error, res);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send-email threw" };
  }
}

/** Is this user opted in to `prefColumn`? Absent row means yes (the DB default). */
async function wants(supabase: Supa, userId: string, prefColumn: string): Promise<boolean> {
  const { data } = await supabase
    .from("notification_preferences")
    .select(prefColumn)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return true;
  const value = (data as Record<string, unknown>)[prefColumn];
  return value !== false;
}

async function studentFor(supabase: Supa, userId: string): Promise<Recipient | null> {
  const { data } = await supabase
    .from("student_profiles")
    .select("email, full_name")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as { email?: string; full_name?: string } | null;
  if (!row?.email) return null;
  return { userId, email: row.email, fullName: row.full_name ?? null };
}

/**
 * Wire the real implementations into the shared ordering rule.
 *
 * The RULE lives in `_shared/reminder-delivery.ts` and is unit-tested from Node
 * (`src/lib/reminderDelivery.test.ts`) — this function is only the wiring, so
 * the part that can silently lose a student's email forever is the part under
 * test rather than the part buried in a Deno handler nothing can run here.
 */
async function deliver(
  supabase: Supa,
  opts: {
    reminderType: string;
    targetId: string;
    recipient: Recipient;
    prefColumn: string;
    emailType: string;
    data: Record<string, unknown>;
  },
  errors: string[],
): Promise<boolean> {
  const outcome = await deliverReminder(
    {
      wants: (userId, prefColumn) => wants(supabase, userId, prefColumn),
      claim: (t, id, u) => claim(supabase, t, id, u),
      send: () => sendVia(supabase, opts.emailType, opts.recipient.email, opts.data),
      release: (t, id, u) => release(supabase, t, id, u),
    },
    {
      reminderType: opts.reminderType,
      targetId: opts.targetId,
      userId: opts.recipient.userId,
      prefColumn: opts.prefColumn,
    },
  );

  if (outcome.status === "sent") return true;
  if (outcome.status === "failed") {
    errors.push(
      outcome.retryable
        ? `${opts.reminderType} failed, will retry next run: ${outcome.error}`
        : `${opts.reminderType} WILL NOT BE RETRIED: ${outcome.error}`,
    );
  }
  return false;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    // --- 1. Events happening in the next 24–48 hours ------------------------
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
    } else {
      for (const event of upcomingEvents ?? []) {
        const clubName =
          (event.club_profiles as unknown as { club_name: string })?.club_name ?? "Unknown Club";
        for (const rsvp of (event.rsvps as unknown as Array<Record<string, unknown>>) ?? []) {
          if (rsvp.status !== "confirmed") continue;
          const sp = rsvp.student_profiles as
            | { user_id: string; email: string; full_name: string }
            | null;
          if (!sp?.email || !sp?.user_id) continue;

          const ok = await deliver(
            supabase,
            {
              reminderType: "event_reminder",
              targetId: event.id as string,
              recipient: { userId: sp.user_id, email: sp.email, fullName: sp.full_name ?? null },
              prefColumn: "event_reminders",
              emailType: "rsvp_reminder",
              data: {
                studentName: sp.full_name || "there",
                eventTitle: event.title,
                eventDate: new Date(event.event_date as string).toLocaleString(),
                location: event.location ?? "TBD",
                clubName,
              },
            },
            results.errors,
          );
          if (ok) results.eventReminders++;
        }
      }
    }

    // --- 2. Bookmarked opportunities closing in the next 24–48 hours --------
    const { data: upcomingDeadlines, error: deadlinesError } = await supabase
      .from("opportunities")
      .select(`id, title, deadline, club_profiles:club_id(club_name)`)
      .eq("is_active", true)
      .gte("deadline", tomorrow.toISOString())
      .lte("deadline", in48Hours.toISOString());

    if (deadlinesError) {
      results.errors.push(`Deadlines query error: ${deadlinesError.message}`);
    } else {
      for (const opportunity of upcomingDeadlines ?? []) {
        const clubName =
          (opportunity.club_profiles as unknown as { club_name: string })?.club_name ??
          "Unknown Club";
        const { data: bookmarks } = await supabase
          .from("bookmarks")
          .select("user_id")
          .eq("opportunity_id", opportunity.id);

        for (const userId of [...new Set((bookmarks ?? []).map((b) => b.user_id as string))]) {
          const recipient = await studentFor(supabase, userId);
          if (!recipient) continue;

          const ok = await deliver(
            supabase,
            {
              reminderType: "deadline_reminder",
              targetId: opportunity.id as string,
              recipient,
              prefColumn: "deadline_reminders",
              emailType: "deadline_reminder",
              data: {
                studentName: recipient.fullName || "there",
                opportunityTitle: opportunity.title,
                clubName,
                deadline: new Date(opportunity.deadline as string).toLocaleString(),
              },
            },
            results.errors,
          );
          if (ok) results.deadlineReminders++;
        }
      }
    }

    // --- 3 & 4. New posts from followed clubs, in the last hour -------------
    // NOTE (R2): this one-hour lookback is why the cron schedule matters. A
    // paused job does not delay these emails, it SKIPS them permanently — the
    // window has moved on by the time it resumes.
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    for (const kind of ["opportunity", "event"] as const) {
      const table = kind === "opportunity" ? "opportunities" : "events";
      const { data: posts, error: postsErr } = await supabase
        .from(table)
        .select(`id, title, club_profiles:club_id(id, club_name)`)
        .eq("is_active", true)
        .gte("created_at", oneHourAgo.toISOString());

      if (postsErr) {
        results.errors.push(`New ${kind} query error: ${postsErr.message}`);
        continue;
      }

      for (const post of posts ?? []) {
        const club = post.club_profiles as unknown as { id: string; club_name: string } | null;
        if (!club) continue;

        const { data: followers } = await supabase
          .from("bookmarks")
          .select("user_id")
          .eq("club_id", club.id);

        // A follower can hold duplicate bookmark rows, so de-duplicate before
        // the loop rather than relying on the claim to absorb it.
        for (const userId of [...new Set((followers ?? []).map((f) => f.user_id as string))]) {
          const recipient = await studentFor(supabase, userId);
          if (!recipient) continue;

          const ok = await deliver(
            supabase,
            {
              reminderType: "new_post_email",
              targetId: post.id as string,
              recipient,
              prefColumn: "new_post_notifications",
              emailType: "new_club_post",
              data: {
                clubName: club.club_name,
                title: post.title,
                type: kind,
                link: `https://zothub.app/${kind === "opportunity" ? "opportunities" : "events"}/${post.id}`,
              },
            },
            results.errors,
          );
          if (ok) results.newPostEmails++;
        }
      }
    }

    // The only caller is pg_net, from the hourly cron, and pg_net DISCARDS the
    // response body — so returning this summary told nobody anything. Before
    // this line the function's entire log output for a run was "booted",
    // "Listening" and "shutdown": a run that sent five reminders and a run that
    // silently sent none were indistinguishable in the dashboard. Logged as one
    // line so a scan of the logs answers "is this working?".
    console.log(
      `send-reminders: ${results.eventReminders} event, ${results.deadlineReminders} deadline, ` +
        `${results.newPostEmails} new-post; ${results.errors.length} error(s)` +
        (results.errors.length ? ` — ${results.errors.join(" | ")}` : ""),
    );

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Likewise: a thrown error became a 500 that pg_net dropped on the floor,
    // so a total failure looked exactly like a quiet hour.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`send-reminders: RUN FAILED — ${message}`);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

serve(handler);
