import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyOTPRequest {
  email: string;
  code: string;
  password: string;
}

// Hash function matching send-otp
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code, password }: VerifyOTPRequest = await req.json();

    if (!email || !code || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, code, password" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the verification record
    const { data: verification, error: fetchError } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching verification:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to verify code. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!verification) {
      return new Response(
        JSON.stringify({ error: "No pending verification found. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if code is expired
    if (new Date(verification.expires_at) < new Date()) {
      // Delete expired verification
      await supabase
        .from("email_verifications")
        .delete()
        .eq("id", verification.id);

      return new Response(
        JSON.stringify({ error: "Verification code has expired. Please request a new one." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check attempt limit (max 5 attempts)
    if (verification.attempts >= 5) {
      // Delete the verification record
      await supabase
        .from("email_verifications")
        .delete()
        .eq("id", verification.id);

      return new Response(
        JSON.stringify({ error: "Too many incorrect attempts. Please request a new code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify the code
    if (verification.code !== code) {
      // Increment attempt counter
      await supabase
        .from("email_verifications")
        .update({ attempts: verification.attempts + 1 })
        .eq("id", verification.id);

      const remainingAttempts = 4 - verification.attempts;
      return new Response(
        JSON.stringify({ 
          error: `Incorrect code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.` 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify password matches what was originally submitted
    const passwordHash = await hashPassword(password);
    if (passwordHash !== verification.password_hash) {
      return new Response(
        JSON.stringify({ error: "Password mismatch. Please try signing up again." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create the Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true, // Auto-confirm since we verified via OTP
    });

    if (authError) {
      console.error("Error creating user:", authError);
      
      if (authError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "This email is already registered. Please log in instead." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to create account. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = authData.user.id;
    const role = verification.role;

    // Create user role
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: role,
    });

    if (roleError) {
      console.error("Error creating user role:", roleError);
      // Continue anyway - role can be added later
    }

    // Add to waitlist
    const { error: waitlistError } = await supabase.from("waitlist").insert({
      user_id: userId,
      email: email.toLowerCase(),
      role: role,
      status: "pending",
    });

    if (waitlistError) {
      console.error("Error adding to waitlist:", waitlistError);
      // Continue anyway
    }

    // Create profile based on role
    if (role === "student") {
      const { error: profileError } = await supabase.from("student_profiles").insert({
        user_id: userId,
        email: email.toLowerCase(),
      });
      if (profileError) {
        console.error("Error creating student profile:", profileError);
      }
    } else {
      const { error: profileError } = await supabase.from("club_profiles").insert({
        user_id: userId,
        email: email.toLowerCase(),
        club_name: email.split("@")[0], // Temporary placeholder
      });
      if (profileError) {
        console.error("Error creating club profile:", profileError);
      }
    }

    // Send waitlist confirmation email
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          type: "waitlist_confirmation",
          to: email,
          data: { role },
        }),
      });
    } catch (emailError) {
      console.error("Error sending waitlist confirmation:", emailError);
      // Non-fatal, continue
    }

    // Delete the verification record
    await supabase
      .from("email_verifications")
      .delete()
      .eq("id", verification.id);

    console.log("Account created successfully for:", email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Account created successfully!",
        userId,
        role
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in verify-otp function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
