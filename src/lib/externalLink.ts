/**
 * The "Apply Externally" / "RSVP Externally" link on a post (CP1).
 *
 * The database already refuses anything but an https URL
 * (`events_external_url_https`, `opportunities_external_url_https`), so this is
 * defence in depth for the one place the value becomes an `href`: a stored value
 * that somehow is not plain https is treated as "no external link" rather than
 * rendered. Its own module — no `@/` imports — so Node can unit-test it.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * What a club types into the optional link field. Empty is fine (no link);
 * otherwise it must be a full https address. Returns the value to save, or the
 * sentence to show under the field.
 */
export function checkExternalLinkInput(raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: true, value: null };
  if (/^http:\/\//i.test(value)) return { ok: false, error: "Use the secure link — it starts with https://." };
  const safe = safeExternalUrl(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  if (!safe) return { ok: false, error: "That doesn't look like a web address. Paste the full link, e.g. https://forms.gle/…" };
  if (safe.length > 2048) return { ok: false, error: "That link is too long." };
  return { ok: true, value: safe };
}
