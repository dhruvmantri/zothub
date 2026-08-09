import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkEmailResult } from "../_shared/email-result.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendOTPRequest {
  email: string;
  password: string;
  role: "student" | "club";
  turnstileToken?: string;
}

// Generate a cryptographically secure 6-digit code
function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = (array[0] % 1000000).toString().padStart(6, "0");
  return code;
}

// Simple hash function for temporary password storage
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Cloudflare Turnstile — the bot/abuse control the platform IP can't provide: the
// Supabase edge runtime has no TRUSTED client IP (x-forwarded-for is caller-spoofable),
// so IP limits alone are bypassable. FAIL CLOSED: captcha is mandatory unless a
// deployment explicitly opts out with CAPTCHA_DISABLED=true (local/dev only); a
// missing secret anywhere else is a misconfiguration → 503, never a silent bypass.
// Rollout secrets: TURNSTILE_SECRET_KEY (edge fn) + VITE_TURNSTILE_SITE_KEY (client) —
// BOTH are required in production.
async function verifyTurnstile(token?: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    if (Deno.env.get("CAPTCHA_DISABLED") === "true") return { ok: true };
    return { ok: false, status: 503, error: "Captcha is not configured. Please try again later." };
  }
  if (!token) return { ok: false, status: 400, error: "Captcha verification is required." };
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    return data?.success ? { ok: true } : { ok: false, status: 400, error: "Captcha verification failed." };
  } catch {
    // Can't reach the verifier → fail closed (503), never open.
    return { ok: false, status: 503, error: "Captcha verification is unavailable. Please try again." };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, role, turnstileToken }: SendOTPRequest = await req.json();

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, role" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!["student", "club"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be 'student' or 'club'" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Role-aware UCI email fail-fast. The AUTHORITATIVE gate is the DB trigger
    // enforce_uci_email (migration 20260727000200), which blocks any non-UCI
    // auth.users insert unless a service-issued one-time authorization exists.
    // We repeat the STUDENT rule here so a doomed signup fails before we store a
    // verification / send an email. Clubs may use any email; a club's non-UCI
    // account is only ever created after admin review, which mints the one-time
    // authorization. Keep in sync with ADMIN_ALLOWED_EMAILS in src/lib/constants.ts.
    const normalizedEmail = email.toLowerCase();
    const ADMIN_ALLOWED_EMAILS = ["zothub.uci@gmail.com"];
    if (
      role === "student" &&
      !normalizedEmail.endsWith("@uci.edu") &&
      !ADMIN_ALLOWED_EMAILS.includes(normalizedEmail)
    ) {
      return new Response(
        JSON.stringify({ error: "Students must sign up with an @uci.edu email address." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Bot control (see verifyTurnstile). Fails closed.
    const captcha = await verifyTurnstile(turnstileToken);
    if (!captcha.ok) {
      return new Response(
        JSON.stringify({ error: captcha.error ?? "Captcha verification failed." }),
        { status: captcha.status ?? 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ATOMIC rate limit keyed on the NORMALIZED EMAIL (not an untrusted client IP):
    // caps OTP requests per email per hour. rate_limit_hit serializes the check so
    // it cannot be raced. If the CHECK ITSELF fails we cannot know whether the caller
    // is over the limit → fail closed with 503 instead of sending unmetered mail.
    const { data: limited, error: limitErr } = await supabase.rpc("rate_limit_hit", {
      p_bucket: `otp_request:email:${normalizedEmail}`,
      p_max: 3,
      p_window_seconds: 60 * 60,
    });
    if (limitErr) {
      console.error("rate_limit_hit failed:", limitErr);
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable. Please try again." }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (limited === true) {
      return new Response(
        JSON.stringify({ error: "Too many verification attempts. Please try again in an hour." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // NOTE: we deliberately do NOT pre-check whether the email already has an
    // account (that leaks account existence / enumerates users). If it is already
    // registered, verify-otp's createUser fails with a clear message AFTER the
    // requester proves control of the mailbox — so it is not an oracle.

    // Replace any existing pending verification for this email.
    await supabase.from("email_verifications").delete().eq("email", normalizedEmail);

    const code = generateOTP();
    const passwordHash = await hashPassword(password);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const { error: insertError } = await supabase.from("email_verifications").insert({
      email: normalizedEmail,
      code,
      role,
      password_hash: passwordHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Error inserting verification:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send OTP email via send-email (server-to-server: service role → accepts the
    // SERVICE_ROLE_ONLY email_otp template).
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ type: "email_otp", to: email, data: { code } }),
    });

    // A 200 from send-email is NOT proof of delivery: on a Resend-side failure it
    // returns 200 with an { error } body. The ONE shared checker inspects BOTH the
    // HTTP status and the body; on failure we delete the now-unusable OTP record so
    // the user isn't stranded with a code that was never delivered.
    const emailBody = await emailResponse.json().catch(() => null);
    const emailResult = checkEmailResult(null, emailBody, emailResponse.status);
    if (!emailResult.ok) {
      console.error("Error sending OTP email:", emailResult.error, emailBody);
      await supabase.from("email_verifications").delete().eq("email", normalizedEmail);
      return new Response(
        JSON.stringify({ error: "Failed to send verification email. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("OTP sent successfully to:", email);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification code sent to your email",
        expiresAt,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-otp function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
