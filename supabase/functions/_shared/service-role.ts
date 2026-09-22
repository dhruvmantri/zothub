/**
 * Is this request from a trusted server holding the service key?
 *
 * Its own module, and unit-tested, because getting it wrong fails in the two
 * worst ways available: too strict and every server-to-server email silently
 * stops; too loose and any visitor can send official ZotHub mail.
 *
 * The subtlety that actually bit us on 2026-09-22: supabase-js only sets an
 * `Authorization: Bearer <key>` header when the key is a JWT. Under Supabase's
 * NEW key format the service key is `sb_secret_…` — not a JWT — so the client
 * sends it as `apikey` and omits the bearer ENTIRELY. `send-email` checked only
 * the bearer, so every `functions.invoke` from another edge function arrived
 * with no bearer at all and was refused. Club-claim approvals and every
 * reminder email had been failing; `verify-otp` kept working purely because it
 * uses a raw `fetch` that sets the header by hand.
 *
 * Accepting `apikey` grants nothing new: browsers send the PUBLISHABLE key
 * there, which never equals the secret, so only a holder of the secret can
 * match. The trust boundary is unchanged — the header it arrives in is not.
 */
export function isServiceRoleCaller(
  getHeader: (name: string) => string | null | undefined,
  serviceKey: string | undefined | null,
): boolean {
  // An unset key must never make everything "authorised" by matching "".
  if (!serviceKey) return false;

  const bearer = (getHeader("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apiKey = (getHeader("apikey") ?? "").trim();

  return bearer === serviceKey || apiKey === serviceKey;
}
