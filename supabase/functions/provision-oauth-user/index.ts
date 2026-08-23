import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // enforce_uci_email() already guaranteed this at INSERT time; re-checking is
    // cheap and keeps the rule readable at the point it is relied upon.
    if (!email.endsWith("@uci.edu") && !ADMIN_ALLOWED_EMAILS.includes(email)) {
      console.error("provision-oauth-user: non-UCI email reached provisioning", email);
      return json({ error: "Signups are restricted to @uci.edu email addresses" }, 403);
    }

    // ── 4. Idempotency ───────────────────────────────────────────────────────
    // Supabase fires onAuthStateChange more than once per sign-in, and `waitlist`
    // has no unique constraint on user_id, so without this guard a single OAuth
    // sign-in can produce duplicate waitlist rows and a duplicate signup email.
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
    let autoApproved = role === "student";

    if (autoApproved) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (roleError) {
        // Fail safe, not open — same reasoning as verify-otp:213-222. Without a
        // role row the account is authenticated but unauthorized, and an
        // "approved" waitlist row would wave it past ProtectedRoute into a
        // dashboard it cannot populate. Fall back to the admin queue.
        console.error("Error granting student role, falling back to queue:", roleError);
        autoApproved = false;
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

    if (waitlistError) {
      console.error("Error adding to waitlist:", waitlistError);
      // Non-fatal: the role grant above is what actually gates access.
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
      if (profileError) {
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
      if (profileError) {
        console.error("Error creating club profile:", profileError);
      }
    }

    // ── 8. Send the email that matches what actually happened ────────────────
    // Auto-approved users get the welcome/approved email; queued users get
    // "you're on the list." Telling an already-admitted student they are on a
    // waitlist would be actively confusing (verify-otp:267-270).
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
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
    } catch (emailError) {
      console.error("Error sending signup email:", emailError);
      // Non-fatal, continue.
    }

    console.log("provision-oauth-user: provisioned", role, "autoApproved:", autoApproved);

    return json({
      success: true,
      role,
      // Lets the client route without re-querying: auto-approved users go
      // straight to their dashboard, queued users to /waitlist.
      autoApproved,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in provision-oauth-user function:", message);
    return json({ error: message }, 500);
  }
};

serve(handler);
