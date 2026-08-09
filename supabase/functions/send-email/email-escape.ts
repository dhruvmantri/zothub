// Pure helpers for building safe email HTML. Extracted so they can be unit-tested
// under `deno test` without the Resend/Supabase runtime (see email-escape.test.ts).
//
// Every dynamic value interpolated into an email template MUST go through esc()
// (text/attribute context) or safeUrl() (href context). Templates send from the
// verified zothub.app domain, so unescaped attacker-controlled data would be an
// HTML-injection / phishing vector.

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** HTML-escape any value for safe use in text or a double-quoted attribute. */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);
}

/**
 * Return a value only if it is a plain http(s) URL, otherwise "#". Blocks
 * javascript:, data:, and other script-bearing schemes, and neutralises quotes so
 * the result is safe inside an href="...". Use for every link built from data.
 */
export function safeUrl(value: unknown): string {
  if (value === null || value === undefined) return "#";
  const raw = String(value).trim();
  if (!/^https?:\/\//i.test(raw)) return "#";
  // Escape characters that could break out of the attribute or the URL.
  return raw.replace(/["'<>`\s]/g, encodeURIComponent);
}
