// THE single shared email-result check, used by BOTH the Deno edge functions and
// the browser client (imported directly by src/lib — plain TS, no runtime APIs).
//
// Why this exists: `send-email` returns the Resend response verbatim with HTTP 200,
// and Resend signals failure IN THE BODY (`{ error: ... }`) rather than with a
// non-2xx status. A bare `if (!error)` on a supabase-js invoke — or a bare
// `response.ok` on a fetch — therefore reports "sent" for mail that never left.
// Every caller must funnel its result through checkEmailResult() and report
// delivery honestly.

export interface EmailResult {
  /** True only when the message was accepted for delivery (or deliberately skipped). */
  ok: boolean;
  /** Set when ok === false. Human-readable reason. */
  error?: string;
  /** True when the send was intentionally not performed (e.g. preference disabled). */
  skipped?: boolean;
  /** Present for bulk sends (event_cancelled). */
  sent?: number;
  failed?: number;
}

/** Narrow an unknown body to a record without throwing. */
function asRecord(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
}

/**
 * Interpret a send-email response.
 *
 * @param invokeError transport/HTTP error from supabase-js `functions.invoke` (or null)
 * @param body        parsed response body (may be null)
 * @param httpStatus  HTTP status when the caller used raw `fetch` (optional)
 */
export function checkEmailResult(
  invokeError: { message?: string } | null | undefined,
  body: unknown,
  httpStatus?: number,
): EmailResult {
  if (invokeError) {
    return { ok: false, error: invokeError.message ?? "email transport error" };
  }
  if (typeof httpStatus === "number" && (httpStatus < 200 || httpStatus >= 300)) {
    const rec = asRecord(body);
    const detail = rec?.error ? String(rec.error) : `HTTP ${httpStatus}`;
    return { ok: false, error: detail };
  }

  const rec = asRecord(body);
  if (!rec) {
    // No body to inspect. Only trust this when the HTTP status said 2xx.
    return typeof httpStatus === "number"
      ? { ok: true }
      : { ok: false, error: "no email response to verify" };
  }

  // HTTP 200 carrying { error: ... } — the Resend false-success case.
  if (rec.error !== undefined && rec.error !== null && rec.error !== "") {
    return { ok: false, error: String(rec.error) };
  }
  // Explicit failure flag (bulk sends set ok:false when some recipients failed).
  if (rec.ok === false) {
    const errs = Array.isArray(rec.errors) ? (rec.errors as unknown[]).join("; ") : undefined;
    return {
      ok: false,
      error: errs || "email delivery failed",
      sent: typeof rec.sent === "number" ? rec.sent : undefined,
      failed: typeof rec.failed === "number" ? rec.failed : undefined,
    };
  }
  // Deliberate no-send (preference disabled / already sent / unresolved recipient).
  if (rec.skipped === true) {
    return { ok: true, skipped: true, error: rec.reason ? String(rec.reason) : undefined };
  }

  return {
    ok: true,
    sent: typeof rec.sent === "number" ? rec.sent : undefined,
    failed: typeof rec.failed === "number" ? rec.failed : undefined,
  };
}
