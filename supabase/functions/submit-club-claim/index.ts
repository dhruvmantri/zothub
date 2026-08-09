// Public, LOGGED-OUT-ONLY endpoint: a person on an UNCLAIMED (ZotSpot-seeded) club
// page submits a claim with a dedicated club email. Writes a pending row into
// club_claim_requests for admin review; runs with the service role (bypasses RLS)
// so the table is never client-writable. No account is created here — approval
// always creates a SEPARATE club account for the submitted email.
//
// Anti-enumeration: never reveals whether an email already has a ZotHub account.
// Abuse control: an ATOMIC per-email rate limit + Cloudflare Turnstile (the edge
// runtime has no trusted client IP, and x-forwarded-for is caller-spoofable).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

// Cloudflare Turnstile — FAIL CLOSED. Captcha is mandatory unless a deployment
// explicitly opts out with CAPTCHA_DISABLED=true (local/dev only). A missing
// TURNSTILE_SECRET_KEY in any other environment is a misconfiguration, not a
// licence to skip bot checks, so it returns 503 rather than letting traffic through.
// Rollout secrets: TURNSTILE_SECRET_KEY (edge) + VITE_TURNSTILE_SITE_KEY (client) —
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { clubId, email, note, turnstileToken } = await req.json();
    if (!clubId) return json({ error: "A club is required." }, 400);

    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    if (!normalizedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // LOGGED-OUT ONLY. A bearer that resolves to a real user means the submitter is
    // signed in — reject. (The anon and service keys resolve to no user, so normal
    // logged-out traffic passes.) The UI hides the CTA from signed-in users; this is
    // the authoritative enforcement.
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (bearer) {
      const { data: { user } } = await supabase.auth.getUser(bearer);
      if (user) {
        return json(
          { error: "Club claims must be submitted while signed out, using the club's own email address. Please sign out and try again." },
          403,
        );
      }
    }

    const captcha = await verifyTurnstile(turnstileToken);
    if (!captcha.ok) {
      return json({ error: captcha.error ?? "Captcha verification failed." }, captcha.status ?? 400);
    }

    // Claimable = a PUBLISHED, unclaimed ZotSpot-seeded listing.
    const { data: club, error: clubErr } = await supabase
      .from("club_profiles")
      .select("id, club_name, user_id, source, published, claimed_at")
      .eq("id", clubId)
      .maybeSingle();
    if (clubErr) return json({ error: "Could not look up that club." }, 500);
    if (!club) return json({ error: "That club could not be found." }, 404);
    if (club.source !== "zotspot" || club.published !== true || club.user_id || club.claimed_at) {
      return json({ error: "This club can't be claimed." }, 409);
    }

    // Idempotent: an existing pending claim for this exact (club, email) is a no-op
    // (and does NOT consume rate-limit budget).
    const { data: dupe } = await supabase
      .from("club_claim_requests")
      .select("id")
      .eq("club_id", clubId)
      .eq("status", "pending")
      .ilike("claimant_email", normalizedEmail)
      .maybeSingle();
    if (dupe) return json({ ok: true, alreadyPending: true }, 200);

    // ATOMIC per-email rate limit (not keyed on an untrusted IP). If the check
    // itself fails we CANNOT know whether the caller is over the limit, so fail
    // closed with 503 rather than admitting unmetered traffic.
    const { data: limited, error: limitErr } = await supabase.rpc("rate_limit_hit", {
      p_bucket: `claim_submit:email:${normalizedEmail}`,
      p_max: 5,
      p_window_seconds: 60 * 60,
    });
    if (limitErr) {
      console.error("rate_limit_hit failed:", limitErr);
      return json({ error: "Service temporarily unavailable. Please try again." }, 503);
    }
    if (limited === true) {
      return json({ error: "Too many claim requests. Please try again later." }, 429);
    }

    const { error: insErr } = await supabase.from("club_claim_requests").insert({
      club_id: clubId,
      claimant_email: normalizedEmail,
      note: note ? String(note).slice(0, 2000) : null,
    });
    if (insErr) {
      // Race against the unique partial index → treat as already pending.
      if (String(insErr.message).includes("club_claim_requests_pending_uniq")) {
        return json({ ok: true, alreadyPending: true }, 200);
      }
      return json({ error: "Could not submit your claim. Please try again." }, 500);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
