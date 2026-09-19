/**
 * The single query-key registry (UX15).
 *
 * Deliberately imports NOTHING. Mutations in one file must invalidate keys read
 * in another (useBookmarks <-> StudentDashboard, useNotifications ->
 * useNavigationCounts), and hanging the keys off the hooks that read them would
 * make those imports cyclic.
 *
 * Shape follows profileKeys: [root, discriminator, ...identifiers]. The ROOT is
 * always the TABLE the rows come from, never the page that renders them — a
 * mutation is table-shaped, so invalidating a root must reach every cached read
 * of that table wherever it is displayed.
 */

/** Viewer segment for auth-variant selects. Never pass the User object. */
export const authScope = (userId: string | null | undefined): string => userId ?? "anon";

/** Grandfathered: not a table, a derived club-or-student lookup. */
export const profileKeys = {
  all: ["profile"] as const,
  byUser: (userId: string) => ["profile", "byUser", userId] as const,
};

export const studentProfileKeys = {
  all: ["studentProfiles"] as const,
  byUser: (userId: string) => ["studentProfiles", "byUser", userId] as const,
};

export const clubKeys = {
  all: ["clubs"] as const,
  /** The public directory RPC. Shared by Clubs.tsx and Landing.tsx. */
  list: () => ["clubs", "list"] as const,
  /** Prefix for one club's public surface. */
  detail: (clubId: string) => ["clubs", "detail", clubId] as const,
  /** club_team_members, status = 'active' only (public policy). */
  teamPublic: (clubId: string) => ["clubs", "detail", clubId, "team"] as const,
  /** RESERVED. Owner-scoped dashboard reads must namespace here, never reuse
   *  detail()/teamPublic() — useClubTeam selects status != 'declined', which is a
   *  superset the public page must not render. */
  dashboard: (clubId: string) => ["clubs", "dashboard", clubId] as const,
  teamDashboard: (clubId: string) => ["clubs", "dashboard", clubId, "team"] as const,
};

export const opportunityKeys = {
  all: ["opportunities"] as const,
  /** Public list: active, deadline null-or-future, newest 50. */
  list: () => ["opportunities", "list"] as const,
  /** Prefix over BOTH auth variants — use this to invalidate. */
  details: (opportunityId: string) => ["opportunities", "detail", opportunityId] as const,
  /** Exact entry — use this in useQuery. */
  detail: (opportunityId: string, viewer: string) =>
    ["opportunities", "detail", opportunityId, viewer] as const,
  /** ClubDetail's "open roles" list. */
  byClubPublic: (clubId: string) => ["opportunities", "byClub", clubId, "public"] as const,
  /** RESERVED for useClubOpportunities (owner-scoped superset). */
  byClubDashboard: (clubId: string) => ["opportunities", "byClub", clubId, "dashboard"] as const,
  /** Clubs.tsx: club_id -> open-role count, whole table. */
  countsByClub: () => ["opportunities", "countsByClub"] as const,
  /** Landing.tsx hero: head-only exact count. */
  openCount: () => ["opportunities", "count", "open"] as const,
};

export const eventKeys = {
  all: ["events"] as const,
  list: () => ["events", "list"] as const,
  upcoming: () => ["events", "list", "upcoming"] as const,
  details: (eventId: string) => ["events", "detail", eventId] as const,
  detail: (eventId: string, viewer: string) => ["events", "detail", eventId, viewer] as const,
  byClubPublic: (clubId: string) => ["events", "byClub", clubId, "public"] as const,
  byClubDashboard: (clubId: string) => ["events", "byClub", clubId, "dashboard"] as const,
  countsByClub: () => ["events", "countsByClub"] as const,
  upcomingCount: () => ["events", "count", "upcoming"] as const,
};

export const rsvpKeys = {
  all: ["rsvps"] as const,
  mine: (eventId: string, studentProfileId: string) =>
    ["rsvps", "mine", eventId, studentProfileId] as const,
  byEvent: (eventId: string) => ["rsvps", "byEvent", eventId] as const,
  byStudent: (studentProfileId: string) => ["rsvps", "byStudent", studentProfileId] as const,
};

export const applicationKeys = {
  all: ["applications"] as const,
  /** The viewer's own applications. ONE key serves both the list page's
   *  applied-id Set and the detail page's hasApplied — see CONFLICTS #5. */
  byStudent: (studentProfileId: string) =>
    ["applications", "byStudent", studentProfileId] as const,
  /** RESERVED for the club-side applicant review surface. */
  byOpportunity: (opportunityId: string) =>
    ["applications", "byOpportunity", opportunityId] as const,
};

export type BookmarkType = "opportunity" | "event" | "club";

export const bookmarkKeys = {
  all: ["bookmarks"] as const,
  byType: (userId: string, type: BookmarkType) => ["bookmarks", type, userId] as const,
};

export const navCountKeys = {
  all: ["navCounts"] as const,
  messages: (userId: string) => ["navCounts", "messages", userId] as const,
  notifications: (userId: string) => ["navCounts", "notifications", userId] as const,
};

/** StudentDashboard's saved/followed activity roll-up (not yet migrated, but
 *  useBookmarks must be able to invalidate it — hence declared here now). */
export const studentActivityKeys = {
  all: ["studentActivity"] as const,
  byUser: (userId: string) => ["studentActivity", userId] as const,
};

/**
 * Module-level empty sentinels. `data ?? []` allocates a new array every render
 * and busts every downstream useMemo, which silently cancels the caching win.
 */
export const EMPTY_ARRAY: readonly never[] = Object.freeze([] as never[]);
export const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();
export const EMPTY_COUNT_MAP: Readonly<Record<string, number>> = Object.freeze({});
