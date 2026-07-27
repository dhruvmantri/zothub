/**
 * THE status map. One presentation vocabulary and one colour semantic across
 * every workflow (Structure §4).
 *
 * Database values are unchanged and untouched — this is a presentation layer
 * over them. `pending` is still `pending` in Postgres; it just reads as
 * "Applied" to the student who sent it and "New" to the club that has to act
 * on it.
 *
 * Audience matters because the same row means different things to the two
 * sides of the marketplace. The clearest case is a rejection: the club sees
 * "Declined" (what they did), the student sees "Not selected" (what happened)
 * — direct, never euphemistic, and never chirpy.
 */
export type StatusTone = "new" | "ok" | "warn" | "bad" | "idle";

export type StatusDomain =
  | "application"
  | "rsvp"
  | "posting"
  | "event"
  | "team"
  | "waitlist";

export type Audience = "student" | "club";

export interface StatusPresentation {
  label: string;
  tone: StatusTone;
}

const FALLBACK: StatusPresentation = { label: "Unknown", tone: "idle" };

type Entry = StatusPresentation | { student: StatusPresentation; club: StatusPresentation };

const MAP: Record<StatusDomain, Record<string, Entry>> = {
  application: {
    // The club's work queue calls it New because it demands action now; the
    // student who sent it calls it Applied, which is calm and factual.
    pending: {
      student: { label: "Applied", tone: "idle" },
      club: { label: "New", tone: "new" },
    },
    reviewed: { label: "Reviewed", tone: "warn" },
    accepted: { label: "Accepted", tone: "ok" },
    rejected: {
      student: { label: "Not selected", tone: "bad" },
      club: { label: "Declined", tone: "bad" },
    },
  },

  rsvp: {
    pending: {
      student: { label: "Awaiting approval", tone: "warn" },
      club: { label: "Pending", tone: "warn" },
    },
    confirmed: {
      student: { label: "Going", tone: "ok" },
      club: { label: "Confirmed", tone: "ok" },
    },
    cancelled: { label: "Cancelled", tone: "bad" },
  },

  // Derived, not stored: see getPostingStatus below.
  posting: {
    active: { label: "Live", tone: "ok" },
    closed: { label: "Closed", tone: "idle" },
    draft: { label: "Draft", tone: "idle" },
  },

  event: {
    upcoming: { label: "Upcoming", tone: "ok" },
    ongoing: { label: "Today", tone: "new" },
    past: { label: "Past", tone: "idle" },
    draft: { label: "Draft", tone: "idle" },
  },

  team: {
    pending: { label: "Invited", tone: "warn" },
    active: { label: "Active", tone: "ok" },
    inactive: { label: "Inactive", tone: "idle" },
    declined: { label: "Declined", tone: "bad" },
  },

  waitlist: {
    pending: { label: "Pending", tone: "warn" },
    approved: { label: "Approved", tone: "ok" },
    rejected: { label: "Rejected", tone: "bad" },
  },
};

export function getStatus(
  domain: StatusDomain,
  value: string | null | undefined,
  audience: Audience = "student",
): StatusPresentation {
  const entry = MAP[domain]?.[(value || "").toLowerCase()];
  if (!entry) return { ...FALLBACK, label: value || FALLBACK.label };
  return "label" in entry ? entry : entry[audience];
}

/** Opportunity status is derived from `is_active` + `deadline`, not stored. */
export function getPostingStatus(o: { is_active?: boolean | null; deadline?: string | null }) {
  if (!o.is_active) return "draft" as const;
  if (o.deadline && new Date(o.deadline) < new Date()) return "closed" as const;
  return "active" as const;
}

/** Event status is derived from `is_active` + `event_date`. */
export function getEventStatus(e: { is_active?: boolean | null; event_date: string }) {
  if (!e.is_active) return "draft" as const;
  const d = new Date(e.event_date);
  const now = new Date();
  if (d < now) return "past" as const;
  if (d.toDateString() === now.toDateString()) return "ongoing" as const;
  return "upcoming" as const;
}
