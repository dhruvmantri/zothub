/**
 * The posting door's RULES — pure functions, no database, no network.
 *
 * Kept free of Deno and remote imports so the same file runs in the edge runtime
 * and under `node --experimental-strip-types --test` (rules.test.ts). Every rule
 * here is a reason a post can be refused, and each refusal carries a sentence a
 * person can read in the daily report.
 *
 * Standing rule (maintainer, 2026-11-19): when the automation is not confident,
 * it does not post — it reports. So these checks refuse rather than repair: a
 * malformed date is refused, never guessed at.
 */

/** Mirrors OPPORTUNITY_TYPE_VALUES (src/lib/constants.ts) and the DB check. */
export const OPPORTUNITY_TYPES = [
  "leadership",
  "project",
  "internship",
  "volunteer",
  "committee",
  "other",
] as const;

export const ZONE = "America/Los_Angeles";
export const MAX_POSTS_PER_CALL = 50;
export const LIMITS = {
  title: { min: 3, max: 120 },
  description: 5000,
  requirements: 3000,
  location: 300,
  url: 2048,
  sourceKey: 200,
  clubName: 200,
} as const;
/** How far ahead a date may be before it is treated as a typo (e.g. 2027 for 2026). */
export const MAX_DAYS_AHEAD = 366;

export type Kind = "event" | "opportunity";

/** One sheet row, as the automation sends it. Times are PACIFIC wall-clock. */
export interface IncomingPost {
  source_key?: unknown;
  kind?: unknown;
  status?: unknown; // "active" (default) | "cancelled"
  club_id?: unknown;
  club_name?: unknown; // must match the club's name — a guard against a wrong id
  title?: unknown;
  description?: unknown;
  external_url?: unknown;
  source_url?: unknown;
  image_url?: unknown;
  // events
  starts_at?: unknown; // "YYYY-MM-DD HH:MM" Pacific
  location?: unknown;
  // opportunities
  type?: unknown;
  deadline?: unknown; // "YYYY-MM-DD HH:MM" or "YYYY-MM-DD" (end of that day) Pacific
  requirements?: unknown;
}

/** The checked, normalised post — exactly the fields the door may write. */
export interface CleanPost {
  source_key: string;
  kind: Kind;
  status: "active" | "cancelled";
  club_id: string;
  club_name: string;
  title: string;
  description: string | null;
  external_url: string;
  source_url: string | null;
  image_url: string | null;
  event_date?: string; // ISO instant
  location?: string | null;
  type?: (typeof OPPORTUNITY_TYPES)[number];
  deadline?: string | null; // ISO instant
  requirements?: string | null;
}

export type Checked = { ok: true; post: CleanPost } | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Text

/** Trim, drop control characters (keeping newlines and tabs), normalise newlines. */
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Case-, accent-, spacing- and punctuation-insensitive form, for comparing names. */
export function normaliseName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Does the sheet's club name match the club's real name? Exact after normalising. */
export function clubNameMatches(given: string, actual: string): boolean {
  const a = normaliseName(given);
  return a.length > 0 && a === normaliseName(actual);
}

/**
 * Are two titles "the same post"? Used to avoid posting what a club already posted
 * itself. Word-set overlap (Jaccard) ≥ 0.75, or identical once normalised.
 */
export function titlesLookAlike(a: string, b: string): boolean {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wa = new Set(na.split(" "));
  const wb = new Set(nb.split(" "));
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  const union = wa.size + wb.size - shared;
  return union > 0 && shared / union >= 0.75;
}

// ---------------------------------------------------------------------------
// Links

/**
 * A plain public https link, or a reason it is not. Refuses javascript:/data:,
 * plain http, credentials in the URL, raw IP addresses and local names — the door
 * fetches image links, so this also keeps it from being pointed at internal hosts.
 */
export function checkHttpsUrl(value: unknown, label: string): { ok: true; url: string } | { ok: false; reason: string } {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { ok: false, reason: `${label} is missing.` };
  if (raw.length > LIMITS.url) return { ok: false, reason: `${label} is too long.` };
  if (/\s/.test(raw)) return { ok: false, reason: `${label} contains spaces.` };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: `${label} is not a valid web address.` };
  }
  if (u.protocol !== "https:") return { ok: false, reason: `${label} must start with https://.` };
  if (u.username || u.password) return { ok: false, reason: `${label} must not contain a username or password.` };
  const host = u.hostname.toLowerCase();
  if (
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^[0-9.]+$/.test(host) ||
    host.startsWith("[")
  ) {
    return { ok: false, reason: `${label} must be a public website address.` };
  }
  return { ok: true, url: u.toString() };
}

// ---------------------------------------------------------------------------
// Pacific time

const pad = (n: number) => String(n).padStart(2, "0");

/** The wall-clock parts of an instant in a zone. */
function wallClockIn(zone: string, instantMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instantMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

/**
 * A Pacific wall-clock time → the UTC instant (ISO string), or null if that time
 * does not exist (the hour skipped when clocks go forward) or is malformed.
 * During the repeated hour in November the EARLIER occurrence is used.
 *
 * Accepts "YYYY-MM-DD HH:MM" or "YYYY-MM-DDTHH:MM". With `dateOnlyEndOfDay`, a bare
 * "YYYY-MM-DD" means 23:59 that day (a deadline "by Friday").
 */
export function pacificToInstant(value: unknown, dateOnlyEndOfDay = false): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  let m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(raw);
  if (!m && dateOnlyEndOfDay) {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (d) m = [raw, d[1], d[2], d[3], "23", "59"] as unknown as RegExpExecArray;
  }
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;

  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Try the two offsets Pacific can have (PST -8h, PDT -7h); keep the ones whose
  // wall clock round-trips exactly. Earliest instant wins in the repeated hour.
  const candidates = [7, 8]
    .map((hours) => asIfUtc + hours * 3600_000)
    .filter((ms) => {
      const w = wallClockIn(ZONE, ms);
      return w.y === y && w.m === mo && w.d === d && w.h === h && w.mi === mi;
    })
    .sort((a, b) => a - b);
  if (candidates.length === 0) return null;
  return new Date(candidates[0]).toISOString();
}

/** The Pacific calendar date ("YYYY-MM-DD") an instant falls on. */
export function pacificDate(instant: string | Date): string {
  const ms = instant instanceof Date ? instant.getTime() : Date.parse(instant);
  const w = wallClockIn(ZONE, ms);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`;
}

// ---------------------------------------------------------------------------
// The row check

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_KEY = /^[A-Za-z0-9._:-]+$/;

/** Check one incoming row. `now` is injected so tests are deterministic. */
export function checkPost(input: IncomingPost, now: Date): Checked {
  const fail = (reason: string): Checked => ({ ok: false, reason });

  const source_key = typeof input.source_key === "string" ? input.source_key.trim() : "";
  if (!source_key) return fail("The row has no id (source_key).");
  if (source_key.length > LIMITS.sourceKey || !SOURCE_KEY.test(source_key)) {
    return fail("The row id may only use letters, digits and . _ : - (max 200).");
  }

  const kind = input.kind;
  if (kind !== "event" && kind !== "opportunity") return fail('Kind must be "event" or "opportunity".');

  const status = input.status === undefined || input.status === null || input.status === "" ? "active" : input.status;
  if (status !== "active" && status !== "cancelled") return fail('Status must be "active" or "cancelled".');

  const club_id = typeof input.club_id === "string" ? input.club_id.trim() : "";
  if (!UUID.test(club_id)) return fail("The club id is missing or not a valid id.");
  const club_name = cleanText(input.club_name);
  if (!club_name || club_name.length > LIMITS.clubName) return fail("The club name is missing.");

  // A cancellation needs only identity: it hides what the door already posted.
  if (status === "cancelled") {
    return {
      ok: true,
      post: {
        source_key, kind, status, club_id, club_name,
        title: cleanText(input.title), description: null, external_url: "", source_url: null, image_url: null,
      },
    };
  }

  const title = cleanText(input.title).replace(/\s+/g, " ");
  if (title.length < LIMITS.title.min) return fail("The title is missing or too short.");
  if (title.length > LIMITS.title.max) return fail(`The title is longer than ${LIMITS.title.max} characters.`);

  const description = cleanText(input.description);
  if (description.length > LIMITS.description) {
    return fail(`The description is longer than ${LIMITS.description} characters.`);
  }

  const ext = checkHttpsUrl(input.external_url, "The Apply/RSVP link");
  if (!ext.ok) return fail(ext.reason);

  let source_url: string | null = null;
  if (input.source_url !== undefined && input.source_url !== null && input.source_url !== "") {
    const s = checkHttpsUrl(input.source_url, "The original post link");
    if (!s.ok) return fail(s.reason);
    source_url = s.url;
  }

  let image_url: string | null = null;
  if (input.image_url !== undefined && input.image_url !== null && input.image_url !== "") {
    const s = checkHttpsUrl(input.image_url, "The image link");
    if (!s.ok) return fail(s.reason);
    image_url = s.url;
  }

  const latest = now.getTime() + MAX_DAYS_AHEAD * 86_400_000;
  const base: CleanPost = {
    source_key, kind, status, club_id, club_name, title,
    description: description || null,
    external_url: ext.url,
    source_url,
    image_url,
  };

  if (kind === "event") {
    const event_date = pacificToInstant(input.starts_at);
    if (!event_date) {
      return fail('The event time is missing, malformed, or does not exist (use "YYYY-MM-DD HH:MM", Pacific).');
    }
    const t = Date.parse(event_date);
    if (t <= now.getTime()) return fail("The event has already started or is in the past.");
    if (t > latest) return fail("The event is more than a year away — likely a typo in the year.");
    const location = cleanText(input.location).replace(/\s+/g, " ");
    if (location.length > LIMITS.location) return fail("The location is too long.");
    return { ok: true, post: { ...base, event_date, location: location || null } };
  }

  // opportunity
  const type = typeof input.type === "string" ? input.type.trim().toLowerCase() : "";
  if (!(OPPORTUNITY_TYPES as readonly string[]).includes(type)) {
    return fail(`The role type must be one of: ${OPPORTUNITY_TYPES.join(", ")}.`);
  }
  let deadline: string | null = null;
  if (input.deadline !== undefined && input.deadline !== null && input.deadline !== "") {
    deadline = pacificToInstant(input.deadline, true);
    if (!deadline) return fail('The deadline is malformed (use "YYYY-MM-DD" or "YYYY-MM-DD HH:MM", Pacific).');
    const t = Date.parse(deadline);
    if (t <= now.getTime()) return fail("The deadline has already passed.");
    if (t > latest) return fail("The deadline is more than a year away — likely a typo in the year.");
  }
  const requirements = cleanText(input.requirements);
  if (requirements.length > LIMITS.requirements) return fail("The requirements text is too long.");
  return {
    ok: true,
    post: { ...base, type: type as CleanPost["type"], deadline, requirements: requirements || null },
  };
}

// ---------------------------------------------------------------------------
// Auth

/** Constant-time string comparison, so the key cannot be guessed by timing. */
export function keysMatch(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || expected.length < 32 || typeof given !== "string") return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}
