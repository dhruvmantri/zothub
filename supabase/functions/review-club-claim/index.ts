// Admin-only: approve, reject, or resend a club claim request.
//
// Claims are LOGGED-OUT ONLY, so approval ALWAYS creates a SEPARATE club account
// for the submitted dedicated club email (no existing-account binding).
//
// approve → create the club account (any email, via a one-time signup
//   authorization), bind the seeded club_profiles row to it (saving the approved
//   email), grant the 'club' role, email a set-password link, mark approved, and
//   auto-reject sibling pending claims.
// reject  → mark rejected with a reason and email the claimant.
// resend  → re-issue the approval (approved claim) or rejection (rejected claim) email.
//
// Safety:
//   • The admin is verified from the caller's JWT; all writes use the service role.
//   • approve AND reject share ONE transactional lock (a conditional transition of
//     the request out of 'pending'), so the two can never race into a split state.
//   • Concurrent same-club approvals are additionally serialized by a conditional
//     (WHERE user_id IS NULL) ownership bind; the loser cleans up its created user.
//   • Every auth/DB/link/email result is checked; email delivery is reported
//     truthfully (email_status) and is retryable via `resend`.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkEmailResult } from "../_shared/email-result.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://zothub.app";

    // send-email server-to-server (service role → accepts claim_* templates).
    // Delivery is judged by the ONE shared checker, which treats an HTTP 200
    // carrying { error } (Resend's false-success shape) as a failure.
    const sendClaimEmail = async (
      type: "claim_approved" | "claim_rejected",
      to: string,
      data: Record<string, unknown>,
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const { data: res, error } = await supabase.functions.invoke("send-email", {
          body: { type, to, data },
        });
        return checkEmailResult(error, res);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "send-email threw" };
      }
    };

    // --- admin guard ---
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Not authenticated." }, 401);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return json({ error: "Not authenticated." }, 401);
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ error: "Admin only." }, 403);

    const { requestId, action, reason } = await req.json();
    if (!requestId || !["approve", "reject", "resend"].includes(action)) {
      return json({ error: "requestId and a valid action are required." }, 400);
    }

    const { data: reqRow, error: reqErr } = await supabase
      .from("club_claim_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr || !reqRow) return json({ error: "Claim request not found." }, 404);

    const { data: club } = await supabase
      .from("club_profiles")
      .select("id, club_name, user_id, source, published, claimed_at")
      .eq("id", reqRow.club_id)
      .maybeSingle();
    if (!club) return json({ error: "The club for this claim no longer exists." }, 404);

    const now = new Date().toISOString();
    const email = String(reqRow.claimant_email).toLowerCase();

    // ---------------- resend (terminal claims; retry a failed email) ----------------
    if (action === "resend") {
      if (reqRow.status === "approved" && reqRow.created_user_id) {
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: `${siteUrl}/reset-password` },
        });
        const actionLink = linkData?.properties?.action_link;
        if (linkErr || !actionLink) {
          return json({ error: `Could not generate a new set-password link: ${linkErr?.message ?? "unknown"}` }, 500);
        }
        const emailRes = await sendClaimEmail("claim_approved", email, {
          clubName: club.club_name,
          isNewAccount: true,
          actionLink,
        });
        await supabase.from("club_claim_requests").update({ email_status: emailRes.ok ? "sent" : "failed" }).eq("id", requestId);
        if (!emailRes.ok) return json({ error: `Email failed: ${emailRes.error}` }, 502);
        return json({ ok: true, status: "resent", emailSent: true }, 200);
      }
      if (reqRow.status === "rejected") {
        const emailRes = await sendClaimEmail("claim_rejected", email, {
          clubName: club.club_name,
          reason: reqRow.rejection_reason ?? "",
        });
        await supabase.from("club_claim_requests").update({ email_status: emailRes.ok ? "sent" : "failed" }).eq("id", requestId);
        if (!emailRes.ok) return json({ error: `Email failed: ${emailRes.error}` }, 502);
        return json({ ok: true, status: "resent", emailSent: true }, 200);
      }
      return json({ error: "Nothing to resend for this claim." }, 409);
    }

    // ---------------- unified lock: claim the pending request atomically -------------
    // BOTH approve and reject acquire this lock first: a conditional stamp of
    // processing_at guarded by status='pending'. Whichever call wins owns the
    // outcome; a concurrent approve/reject sees the row already locked (or no longer
    // pending) → 409. This single state machine prevents approve/reject races and
    // partial states. The staleness clause lets a crashed run be retried.
    const staleIso = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: locked } = await supabase
      .from("club_claim_requests")
      .update({ processing_at: now })
      .eq("id", requestId)
      .eq("status", "pending")
      .or(`processing_at.is.null,processing_at.lt.${staleIso}`)
      .select("*");
    if (!locked?.length) {
      return json({ error: "This claim is already being processed or was already reviewed." }, 409);
    }
    const releaseLock = () =>
      supabase.from("club_claim_requests").update({ processing_at: null }).eq("id", requestId);

    // ---------------- reject ----------------
    if (action === "reject") {
      const { error: updErr } = await supabase
        .from("club_claim_requests")
        .update({ status: "rejected", rejection_reason: reason ?? null, reviewed_at: now, reviewed_by: user.id })
        .eq("id", requestId);
      if (updErr) {
        await releaseLock();
        return json({ error: `Could not reject the claim: ${updErr.message}` }, 500);
      }
      const emailRes = await sendClaimEmail("claim_rejected", email, {
        clubName: club.club_name,
        reason: reason ?? "",
      });
      await supabase.from("club_claim_requests").update({ email_status: emailRes.ok ? "sent" : "failed" }).eq("id", requestId);
      return json({ ok: true, status: "rejected", emailSent: emailRes.ok, emailError: emailRes.ok ? undefined : emailRes.error }, 200);
    }

    // ---------------- approve ----------------
    // Undo a partially-completed approval, in reverse order of creation. EVERY
    // cleanup step is checked: a silent cleanup failure would leave an orphaned
    // account or a half-owned club behind, so failures are collected and surfaced
    // to the admin rather than swallowed.
    const rollbackApproval = async (
      ownerId: string,
      opts: { unbindClub: boolean; dropRole: boolean },
    ): Promise<string[]> => {
      const problems: string[] = [];
      if (opts.dropRole) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", ownerId)
          .eq("role", "club");
        if (error) problems.push(`role cleanup failed: ${error.message}`);
      }
      if (opts.unbindClub) {
        const { data, error } = await supabase
          .from("club_profiles")
          .update({ user_id: null, claimed_at: null, email: null })
          .eq("id", club.id)
          .eq("user_id", ownerId)
          .select("id");
        if (error) problems.push(`club unbind failed: ${error.message}`);
        else if (!data?.length) problems.push("club unbind affected no rows");
      }
      const { error: delErr } = await supabase.auth.admin.deleteUser(ownerId);
      if (delErr) problems.push(`account cleanup failed: ${delErr.message}`);

      const { error: lockErr } = await supabase
        .from("club_claim_requests")
        .update({ processing_at: null })
        .eq("id", requestId);
      if (lockErr) problems.push(`lock release failed: ${lockErr.message}`);

      if (problems.length) console.error("Approval rollback problems:", problems);
      return problems;
    };

    // Claimable must still be a PUBLISHED, unclaimed ZotSpot listing.
    if (club.source !== "zotspot" || club.published !== true || club.user_id || club.claimed_at) {
      await releaseLock();
      return json({ error: "This club can no longer be claimed." }, 409);
    }

    // Mint the one-time signup authorization (lets the DB trigger admit a non-UCI
    // club email), then create the SEPARATE club account.
    const { error: authzErr } = await supabase.from("signup_email_authorizations").insert({
      email,
      reason: "club_claim",
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    if (authzErr) {
      await releaseLock();
      return json({ error: `Could not authorize account creation: ${authzErr.message}` }, 500);
    }
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      await releaseLock();
      if (String(createErr?.message ?? "").toLowerCase().includes("already")) {
        return json({ error: "This email already has a ZotHub account and can't be used for a new club account. Reject this claim and ask for a dedicated club email." }, 409);
      }
      return json({ error: `Could not create the club account: ${createErr?.message ?? "unknown"}` }, 500);
    }
    const ownerId = created.user.id;

    // ATOMIC ownership bind — only if the club is still unowned. Also SAVE the
    // approved email onto the club profile.
    const { data: bound, error: bindErr } = await supabase
      .from("club_profiles")
      .update({ user_id: ownerId, claimed_at: now, email })
      .eq("id", club.id)
      .is("user_id", null)
      .is("claimed_at", null)
      .select("id");
    if (bindErr) {
      const problems = await rollbackApproval(ownerId, { unbindClub: false, dropRole: false });
      const dup = bindErr.code === "23505" || String(bindErr.message).includes("club_profiles_user_id");
      return json({
        error: dup ? "That account already owns a club." : `Could not bind the club: ${bindErr.message}`,
        cleanupProblems: problems.length ? problems : undefined,
      }, 409);
    }
    if (!bound?.length) {
      // Lost the race — another approval claimed this club. Clean up + reject this one.
      const problems = await rollbackApproval(ownerId, { unbindClub: false, dropRole: false });
      const { error: rejErr } = await supabase
        .from("club_claim_requests")
        .update({ status: "rejected", rejection_reason: "Another claim for this club was approved.", reviewed_at: now, reviewed_by: user.id })
        .eq("id", requestId);
      if (rejErr) problems.push(`could not mark superseded claim rejected: ${rejErr.message}`);
      return json({
        error: "This club was just claimed by another approval.",
        cleanupProblems: problems.length ? problems : undefined,
      }, 409);
    }

    // Grant the club role (idempotent). Essential — roll everything back on failure.
    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: ownerId, role: "club" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleErr) {
      const problems = await rollbackApproval(ownerId, { unbindClub: true, dropRole: false });
      return json({
        error: `Could not grant the club role: ${roleErr.message}`,
        cleanupProblems: problems.length ? problems : undefined,
      }, 500);
    }

    // Mark approved + record the owner. This is the LAST step that can fail before
    // the approval is durable, and it must be checked: without it the account,
    // ownership and role would exist while the request still reads 'pending' — an
    // invisible half-approved state. `.select()` also catches the affected-0-rows
    // case (e.g. the request was deleted mid-flight), which returns no error.
    const { data: approvedRow, error: approveErr } = await supabase
      .from("club_claim_requests")
      .update({ status: "approved", created_user_id: ownerId, reviewed_at: now, reviewed_by: user.id })
      .eq("id", requestId)
      .select("id");
    if (approveErr || !approvedRow?.length) {
      const problems = await rollbackApproval(ownerId, { unbindClub: true, dropRole: true });
      return json({
        error: `Could not finalize the approval: ${approveErr?.message ?? "the claim request could not be updated"}. Nothing was applied — try again.`,
        cleanupProblems: problems.length ? problems : undefined,
      }, 500);
    }

    // Auto-reject sibling pending claims for the same club.
    await supabase
      .from("club_claim_requests")
      .update({ status: "rejected", rejection_reason: "Another claim for this club was approved.", reviewed_at: now, reviewed_by: user.id })
      .eq("club_id", club.id)
      .eq("status", "pending")
      .neq("id", requestId);

    // Single-use set-password (recovery) link → the /reset-password page.
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/reset-password` },
    });
    const actionLink = linkData?.properties?.action_link;
    if (linkErr || !actionLink) {
      await supabase.from("club_claim_requests").update({ email_status: "failed" }).eq("id", requestId);
      return json(
        { ok: true, status: "approved", clubId: club.id, userId: ownerId, emailSent: false, emailError: "Could not generate the set-password link — use Resend." },
        200,
      );
    }
    const emailRes = await sendClaimEmail("claim_approved", email, {
      clubName: club.club_name,
      isNewAccount: true,
      actionLink,
    });
    await supabase.from("club_claim_requests").update({ email_status: emailRes.ok ? "sent" : "failed" }).eq("id", requestId);

    return json(
      { ok: true, status: "approved", clubId: club.id, userId: ownerId, emailSent: emailRes.ok, emailError: emailRes.ok ? undefined : emailRes.error },
      200,
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error." }, 500);
  }
});
