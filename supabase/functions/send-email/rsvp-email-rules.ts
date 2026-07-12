// Pure, dependency-free authorization rules for RSVP emails, extracted so every
// (type, caller-role, authoritative-status) combination can be unit-tested
// without the Deno/Resend/Supabase runtime. The send-email handler resolves the
// caller's role (isClub/isStudent) and the RSVP's authoritative status from the
// database and delegates the decision here — no client-supplied status/actor is
// ever trusted.

export type RsvpEmailType = "rsvp_confirmation" | "rsvp_declined";

export type RsvpEmailDecision =
  | { ok: true }
  | { ok: false; code: number; error: string };

/**
 * Decide whether an RSVP email of `type` may be sent, given whether the
 * authenticated caller is the owning club and/or the RSVP's student, and the
 * authoritative RSVP status. Fail-closed for any mismatch.
 *
 * Rules:
 *  - Caller must be the owning club or the RSVP's student (else 403).
 *  - rsvp_declined: only the owning club, the RSVP must be `cancelled`, AND the
 *    recorded actor of that cancellation must be the club (`transitionActorIsClub`).
 *    A student self-cancel also lands on `cancelled` but recorded the student as
 *    the actor, so the club cannot later send a misleading "declined by the
 *    organizer" email for it.
 *  - rsvp_confirmation:
 *      - from the club   -> approval; status must be `confirmed`.
 *      - from the student -> initial acknowledgment; status must be `pending`
 *        or `confirmed`.
 *
 * `transitionActorIsClub` is whether the RSVP's persisted `status_updated_by`
 * equals the owning club's user id; it is only consulted for `rsvp_declined`.
 */
export function validateRsvpEmailRequest(
  type: RsvpEmailType,
  isClub: boolean,
  isStudent: boolean,
  status: string,
  transitionActorIsClub: boolean,
): RsvpEmailDecision {
  if (!isClub && !isStudent) {
    return { ok: false, code: 403, error: "Forbidden" };
  }

  if (type === "rsvp_declined") {
    if (!isClub) {
      return { ok: false, code: 403, error: "Only the owning club can send a decline email" };
    }
    if (status !== "cancelled") {
      return { ok: false, code: 409, error: "RSVP is not in a declined/cancelled state" };
    }
    if (!transitionActorIsClub) {
      return { ok: false, code: 409, error: "RSVP was not cancelled by the organizer" };
    }
    return { ok: true };
  }

  // rsvp_confirmation
  if (isClub) {
    if (status !== "confirmed") {
      return { ok: false, code: 409, error: "RSVP is not confirmed" };
    }
    return { ok: true };
  }

  // student caller (initial RSVP acknowledgment)
  if (status !== "pending" && status !== "confirmed") {
    return { ok: false, code: 409, error: "RSVP is not in a confirmable state" };
  }
  return { ok: true };
}
