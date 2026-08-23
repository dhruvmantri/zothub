import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkEmailResult } from "../_shared/email-result.ts";

// Provision a brand-new Google-OAuth account (backlog A1).
//
// Why this function has to exist at all
// ─────────────────────────────────────
// The browser used to do this itself, in AuthContext.handleNewOAuthUser: insert a
// `waitlist` row, then insert the `student_profiles` / `club_profiles` row. The
// profile insert was ALWAYS rejected, silently:
//
//   * student_profiles / club_profiles INSERT policies require
//     has_role(auth.uid(), 'student'|'club')   (20251223013805:73, :108)
//   * the caller has no role yet — that is the entire point of a new signup, and
//     the client cannot grant itself one either, because the self-insert policy on
//     user_roles was deliberately dropped as a privilege-escalation fix (S1,
//     20260723000100).
//
// So the RLS policies are correct and must NOT be loosened. The provisioning has
// to happen server-side, with the service role, exactly as verify-otp already does
// for the OTP signup path. This function is that path's OAuth twin.
//
// Access model — identical to verify-otp:190-207, for identical reasons
// ────────────────────────────────────────────────────────────────────
// Students are auto-approved; clubs go to the /admin queue.
//
// Reaching this function already proves the caller controls an @uci.edu mailbox:
// the BEFORE INSERT trigger on auth.users (20260709000300) is the authoritative
// gate and it let this account be created, and Google OAuth is restricted to the
// UCI workspace on top of that. Manual approval for a student adds latency, not a
// security property.
//
// Clubs stay gated: a club account can post opportunities and collect student
// applications, so it warrants a human look.
//
// Trust boundary
// ──────────────
// `role` is the ONLY client-supplied input, and it comes from localStorage, so it
// is untrusted. That is safe here because neither value grants anything the caller
// could not already have:
//   * "club"    → status 'pending', published=false, no role. Strictly MORE
//                 restricted, and a human reviews it.
//   * "student" → auto-approved, but only on the strength of the @uci.edu proof
//                 above, which the database already enforced.
// The user id and email are NEVER read from the body — both are derived from the
// caller's own JWT.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Keep in sync with ADMIN_ALLOWED_EMAILS in src/lib/constants.ts and the
// allowlist inside enforce_uci_email() (20260709000300).
const ADMIN_ALLOWED_EMAILS = ["zothub.uci@gmail.com"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Authenticate the caller and derive identity from the JWT ──────────
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!bearer) {
      return json({ error: "Not authenticated" }, 401);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
    const authUser = authData?.user;
    if (authError || !authUser?.email) {
      return json({ error: "Not authenticated" }, 401);
    }

    const userId = authUser.id;
    const email = authUser.email.toLowerCase();

    // ── 2. Validate the one piece of client input ────────────────────────────
    let requestedRole: unknown;
    try {
      requestedRole = (await req.json())?.role;
    } catch {
      requestedRole = undefined;
    }

    if (requestedRole !== "student" && requestedRole !== "club") {
      return json({ error: "role must be 'student' or 'club'" }, 400);
    }
    const role: "student" | "club" = requestedRole;

    // ── 3. Defence in depth on the email domain ─────────────────────────────
    // This MIRRORS the authoritative BEFORE INSERT trigger on auth.users. That
    // trigger admits three cases, not two (enforce_uci_email in
    // 20260727000200_signup_email_gate, which SUPERSEDED 20260709000300):
    //
    //   1. an @uci.edu address, or
    //   2. the admin allowlist, or
    //   3. any address with a live signup_email_authorizations row — the
    //      service-issued, one-time escape hatch used for club OTP signups and
    //      approved club claims, since many clubs have no uci.edu address
    //      (verify-otp, review-club-claim).
    //
    // Case 3 is why this check must NOT be a bare domain test: the trigger
    // *consumes* the authorization at account-creation time, so by the time we
    // run, a legitimately-admitted club shows only a consumed row. Checking for
    // the row's existence (consumed or not) is the correct mirror — the account
    // exists, so the trigger already passed it, and the row is the evidence.
    //
    // Getting this wrong is not theoretical: a bare domain test 403s a
    // legitimately-created non-UCI club account.
    const domainAllowed =
      email.endsWith("@uci.edu") || ADMIN_ALLOWED_EMAILS.includes(email);

    if (!domainAllowed) {
      // NOTE: ILIKE treats % and _ as WILDCARDS, and both are legal in an email
      // local part (john_doe@… is ordinary). An unescaped value would therefore
      // let one address match a DIFFERENT address's authorization row. Escape
      // them so this is a case-insensitive exact match, not a pattern match.
      //
      // This is not currently privilege-escalating — a non-UCI account can only
      // exist if the trigger consumed an authorization for its exact address, so
      // a false positive here only re-admits an account that already passed the
      // authoritative gate. But relying on that reasoning to keep a pattern match
      // safe is exactly how a real hole gets introduced later, so: escape it.
      const emailPattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);

      const { data: authorization } = await supabase
        .from("signup_email_authorizations")
        .select("id")
        .ilike("email", emailPattern)
        .limit(1)
        .maybeSingle();

      if (!authorization) {
        console.error(
          "provision-oauth-user: no UCI domain and no signup authorization for",
          email,
        );
        return json({ error: "Signups are restricted to @uci.edu email addresses" }, 403);
      }
    }

    // ── 4. Idempotency ───────────────────────────────────────────────────────
    // Supabase fires onAuthStateChange more than once per sign-in, so this can be
    // called repeatedly for one signup.
    //
    // What actually prevents duplicate ROWS is the database, not this guard:
    // waitlist.user_id, student_profiles.user_id and club_profiles.user_id are all
    // UNIQUE, and user_roles is UNIQUE (user_id, role). This early return exists to
    // avoid a duplicate *signup email* and to give repeat callers a correct answer
    // cheaply — it is a fast path, not the integrity mechanism. It is also
    // inherently racy: two simultaneous first-calls both pass it, which is why
    // step 5 below must treat a unique violation as success rather than failure.
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRole) {
      return json({
        success: true,
        alreadyProvisioned: true,
        role: existingRole.role,
        autoApproved: true,
      });
    }

    const { data: existingWaitlist } = await supabase
      .from("waitlist")
      .select("status, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingWaitlist) {
      return json({
        success: true,
        alreadyProvisioned: true,
        role: existingWaitlist.role,
        autoApproved: existingWaitlist.status === "approved",
      });
    }

    // ── 5. Grant the role (students only) ────────────────────────────────────
    // Concurrency matters here. Because step 4's guard is racy, several calls can
    // reach this point for the same brand-new student. Exactly one wins the insert;
    // the rest hit user_roles_user_id_role_key.
    //
    // A unique violation is SUCCESS, not failure — it means a sibling call granted
    // the very role we wanted. Treating it as failure (as the first version of this
    // function did) produced two bugs at once: losing callers were told
    // autoApproved:false and got routed to /waitlist despite holding the role, and
    // whichever caller happened to win the waitlist insert could write status
    // 'pending' alongside a granted role — a contradictory state that also parked a
    // phantom student in the admin queue. Both were reproduced under concurrency.
    //
    // So: decide autoApproved from whether the role is actually PRESENT afterwards,
    // never from which insert won the race.
    let autoApproved = false;

    if (role === "student") {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (!roleError) {
        autoApproved = true;
      } else if (roleError.code === "23505") {
        // Unique violation — a concurrent call already granted it. Fine.
        autoApproved = true;
      } else {
        // A real failure. Fail safe, not open — same reasoning as
        // verify-otp:213-222: without a role row the account is authenticated but
        // unauthorized, and an "approved" waitlist row would wave it past
        // ProtectedRoute into a dashboard it cannot populate. Fall back to the
        // admin queue so a human can finish the job.
        console.error("Error granting student role, falling back to queue:", roleError);

        // Confirm against the table rather than trusting the error: a transient
        // failure on a row that does in fact exist must not demote the user.
        const { data: existing } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        autoApproved = existing?.role === "student";
      }
    }

    // ── 6. Waitlist row (audit trail, even for auto-approved students) ───────
    const { error: waitlistError } = await supabase.from("waitlist").insert({
      user_id: userId,
      email,
      role,
      status: autoApproved ? "approved" : "pending",
      // reviewed_by stays null: no human reviewed this one.
      reviewed_at: autoApproved ? new Date().toISOString() : null,
    });

    if (waitlistError && waitlistError.code !== "23505") {
      // 23505 = a concurrent call already wrote the row (waitlist.user_id is
      // UNIQUE). Not an error; anything else is worth logging.
      console.error("Error adding to waitlist:", waitlistError);
      // Non-fatal either way: the role grant above is what actually gates access.
    }

    // ── 7. Profile row ───────────────────────────────────────────────────────
    if (role === "student") {
      // Google hands us a verified display name and avatar for free. Taking them
      // from user_metadata (server-side, not from the body) is the one place a
      // student profile picture currently gets populated at all — see MB2.
      const metadata = authUser.user_metadata ?? {};
      const { error: profileError } = await supabase.from("student_profiles").insert({
        user_id: userId,
        email,
        full_name: metadata.full_name ?? metadata.name ?? null,
        avatar_url: metadata.avatar_url ?? metadata.picture ?? null,
      });
      // 23505 = a concurrent call already created it (user_id is UNIQUE).
      if (profileError && profileError.code !== "23505") {
        console.error("Error creating student profile:", profileError);
      }
    } else {
      // Pending club → published=false: it must NOT appear in the public
      // directory until an admin approves (the waitlist-approval trigger
      // publishes it). The club_name placeholder matches verify-otp:259 so both
      // signup paths share one behaviour — and one tracked wart (DP6).
      const { error: profileError } = await supabase.from("club_profiles").insert({
        user_id: userId,
        email,
        club_name: email.split("@")[0],
        published: false,
      });
      // 23505 = a concurrent call already created it (user_id is UNIQUE).
      if (profileError && profileError.code !== "23505") {
        console.error("Error creating club profile:", profileError);
      }
    }

    // ── 8. Send the email that matches what actually happened ────────────────
    // Auto-approved users get the welcome/approved email; queued users get
    // "you're on the list." Telling an already-admitted student they are on a
    // waitlist would be actively confusing (verify-otp:267-270).
    // A 200 is not proof of delivery — Resend signals failure in the BODY, so the
    // result goes through the one shared checker (CLAUDE.md: "never show
    // sent/notified without it"). verify-otp:271-283 still discards its result;
    // that is logged as E1 and is not a reason to repeat the mistake here.
    let emailDelivered = false;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          type: autoApproved ? "waitlist_approved" : "waitlist_confirmation",
          to: email,
          data: { role },
        }),
      });

      const body = await res.json().catch(() => null);
      const result = checkEmailResult(null, body, res.status);
      emailDelivered = result.ok;

      if (!result.ok) {
        console.error("Signup email NOT delivered:", result.error);
      }
    } catch (emailError) {
      console.error("Error sending signup email:", emailError);
    }
    // Non-fatal: the account is provisioned either way, and the role grant is what
    // gates access. Reported so the client never claims an email that did not send.

    console.log("provision-oauth-user: provisioned", role, "autoApproved:", autoApproved);

    return json({
      success: true,
      role,
      // Lets the client route without re-querying: auto-approved users go
      // straight to their dashboard, queued users to /waitlist.
      autoApproved,
      // Honest about the email, per the shared checker — never asserted, reported.
      emailDelivered,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in provision-oauth-user function:", message);
    return json({ error: message }, 500);
  }
};

serve(handler);
