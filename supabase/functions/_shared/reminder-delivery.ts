// The ordering rule that makes a reminder safe to send, extracted so it can be
// PROVEN rather than reasoned about. Plain TS, no runtime APIs — imported by
// the Deno edge function and unit-tested from Node, exactly like
// `email-result.ts` next to it.
//
// R1, the defect this encodes against: the old job sent first and logged after.
// Resend RESOLVES with `{ error }` on an API failure instead of throwing, so the
// try/catch never fired, the log row was written regardless, and the
// `unique_reminder` constraint then made that reminder PERMANENTLY unsendable.
// One bad minute at the provider cost a student that email forever, with no
// retry possible for the life of the row.
//
// The order below is the fix, and every step of it is load-bearing:
//   preference -> CLAIM -> send -> RELEASE if the send failed.
// Claiming first also makes overlapping cron runs safe: the unique constraint
// decides which run owns the send, instead of both sending.

export interface ReminderDeps {
  /** False when the recipient has switched this kind of email off. */
  wants: (userId: string, prefColumn: string) => Promise<boolean>;
  /** Write the log row. `claimed: false` + no error means someone else has it. */
  claim: (
    reminderType: string,
    targetId: string,
    userId: string,
  ) => Promise<{ claimed: boolean; error?: string }>;
  /** Judge delivery honestly — a 200 is not proof (see email-result.ts). */
  send: () => Promise<{ ok: boolean; error?: string }>;
  /** Give the claim back. Returns an error string if it could not be released. */
  release: (reminderType: string, targetId: string, userId: string) => Promise<string | null>;
}

export interface ReminderTarget {
  reminderType: string;
  targetId: string;
  userId: string;
  prefColumn: string;
}

export type ReminderOutcome =
  | { status: "sent" }
  | { status: "skipped"; reason: "opted-out" | "already-claimed" }
  | { status: "failed"; error: string; retryable: boolean };

export async function deliverReminder(
  deps: ReminderDeps,
  target: ReminderTarget,
): Promise<ReminderOutcome> {
  const { reminderType, targetId, userId, prefColumn } = target;

  // Cheapest check first, and the only one that must never be bypassed: an
  // opted-out recipient is not a failure and must not consume a claim.
  if (!(await deps.wants(userId, prefColumn))) {
    return { status: "skipped", reason: "opted-out" };
  }

  const claimed = await deps.claim(reminderType, targetId, userId);
  if (!claimed.claimed) {
    if (claimed.error) {
      // A claim that failed for a REAL reason (not a duplicate) is retryable:
      // nothing was written, so the next run starts clean.
      return { status: "failed", error: `claim failed: ${claimed.error}`, retryable: true };
    }
    return { status: "skipped", reason: "already-claimed" };
  }

  const sent = await deps.send();
  if (sent.ok) return { status: "sent" };

  const releaseError = await deps.release(reminderType, targetId, userId);
  if (releaseError) {
    // The one shape that reproduces the original bug: the send failed AND the
    // claim is stuck, so this reminder will never be retried. It is reported as
    // NOT retryable precisely so it reads as the serious case it is.
    return {
      status: "failed",
      error: `send failed (${sent.error ?? "unknown"}) and the claim could not be released: ${releaseError}`,
      retryable: false,
    };
  }
  return { status: "failed", error: sent.error ?? "unknown send failure", retryable: true };
}
