/**
 * How well a club matches a search — so a club officer typing their own club's
 * name, or the acronym everyone actually uses, finds it FIRST (audit G2-07,
 * maintainer decision 2026-10-11).
 *
 * The directory used to keep every club whose name OR description contained
 * the text and then sort A–Z, so "swe" put description matches above Society of
 * Women Engineers (which contains no "swe" at all), and a partial name landed
 * 3rd–6th. All ~720 clubs are already in the browser, so ranking them here is
 * correct — the server-side-sort rule (CLAUDE.md) is about capped lists.
 *
 * Lower tier = better. `null` = not a match.
 *   0  the name, exactly
 *   1  an acronym written in the name ("ACM", "(VSA)")
 *   2  the name's initials ("swe" → Society of Women Engineers) — below 1, so
 *      "acm" finds the Association for Computing Machinery (- ACM) before
 *      Acts College Ministry, whose initials merely happen to spell it
 *   3  the name starts with it
 *   4  a word in the name starts with it
 *   5  the name contains it
 *   6  only the description contains it
 */
export type MatchTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const STOP_WORDS = new Set(["of", "at", "the", "and", "for", "in", "a", "an", "to", "on"]);

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function initials(words: string[]): string {
  return words.map((w) => w[0]).join("");
}

/** Acronyms written in capitals in the name itself: "ACM", "(VSA)", "IEEE". */
function acronymsIn(name: string): Set<string> {
  return new Set((name.match(/\b[A-Z][A-Z0-9]{1,7}\b/g) ?? []).map((a) => a.toLowerCase()));
}

export function clubMatchTier(name: string, description: string | null, query: string): MatchTier | null {
  const q = normalise(query);
  if (!q) return null;
  const n = normalise(name);
  if (n === q) return 0;

  const words = n.split(" ").filter(Boolean);
  if (!q.includes(" ") && q.length >= 2) {
    const significant = words.filter((w) => !STOP_WORDS.has(w));
    if (acronymsIn(name).has(q)) return 1;
    if (initials(significant) === q || initials(words) === q) return 2;
  }

  if (n.startsWith(q)) return 3;
  if (words.some((w) => w.startsWith(q)) || n.includes(` ${q}`)) return 4;
  if (n.includes(q)) return 5;
  if (description && normalise(description).includes(q)) return 6;
  return null;
}
