Verified the house style, the App.tsx defaults (staleTime 60s / gcTime 5m / retry 1), and the actual fetch bodies in Clubs, Landing, Events, Opportunities, useBookmarks and useNavigationCounts. Here is the contract.

---

# UX15 QUERY MIGRATION — UNIFIED CONTRACT

Scope: 9 files. Global defaults already shipped in `src/App.tsx:73-81` (`staleTime 60_000`, `gcTime 300_000`, `refetchOnWindowFocus: false`, `retry: 1`). `src/hooks/useProfileLookup.ts` is the only migrated surface today and is the house style: exported keys object + plain async resolver + declarative hook + stable imperative helpers.

---

## 1. UNIFIED_KEY_SCHEME

### Governing rules (these resolve most of the conflicts mechanically)

1. **Root segment = the table the rows come from, plural.** Not the page that shows them. A write is table-shaped, so `invalidateQueries({ queryKey: opportunityKeys.all })` must reach *every* cached read of `opportunities`, wherever it is rendered. This is why club-detail's open-roles list is keyed under `["opportunities", …]`, not under `["clubs","detail",id,…]`.
2. **Shape is `[root, discriminator, …identifiers]`**, matching `["profile","byUser",userId]`.
3. **Public and owner-scoped reads of the same table never share a key.** Dashboard reads are supersets (`status != declined`, no `is_active` filter) and would poison public caches. Namespace: `…,"public"` vs `…,"dashboard"`.
4. **Auth-variant selects carry the viewer id, not a boolean.** `["events","detail",id,"anon"|<userId>]`. The select *shape* only depends on authed-ness, but the embedded `rsvps` / `applications` arrays are RLS-filtered **per user**, so an `"auth"` bucket would serve user A's row visibility to user B after an account switch within `gcTime`.
5. **No wall-clock value ever enters a key.** `now` is computed inside the queryFn, always.
6. **Keys live in a dependency-free module.** `src/lib/queryKeys.ts` imports nothing. Six files that must invalidate each other's keys (`useBookmarks` ↔ `StudentDashboard`, `useNotifications` → `useNavigationCounts`) would otherwise form import cycles.

### File 1 — `src/lib/queryKeys.ts` (new, paste-ready, zero imports)

```ts
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
export const EMPTY_ARRAY: readonly never[] = Object.freeze([]);
export const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();
export const EMPTY_COUNT_MAP: Readonly<Record<string, number>> = Object.freeze({});
```

Then in `src/hooks/useProfileLookup.ts`, replace the local `profileKeys` declaration with a re-export so nothing drifts and no call site changes:

```ts
export { profileKeys } from "@/lib/queryKeys";
```

### File 2 — `src/lib/queryFns.ts` (new, paste-ready)

Contains `unwrap` plus **only the fetchers used by 2+ files**. Single-consumer fetchers stay colocated with their hook (house style).

```ts
import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { ClubCardData } from "@/components/clubs/ClubCard";
import type { BookmarkType } from "@/lib/queryKeys";

/**
 * supabase-js RESOLVES on a PostgREST error instead of rejecting. A queryFn that
 * copies the old `if (error) { console.error(...); return; }` shape produces a
 * query that is permanently "successful" with data === undefined — which in
 * TanStack v5 is also a runtime error. Every queryFn goes through unwrap.
 */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw res.error;
  if (res.data === null || res.data === undefined) {
    throw new Error("Query returned no data");
  }
  return res.data;
}

/** Same, for reads that may legitimately return no row (.maybeSingle()). */
export function unwrapMaybe<T>(res: { data: T | null; error: PostgrestError | null }): T | null {
  if (res.error) throw res.error;
  return res.data ?? null;
}

/** Same, for `count: "exact", head: true` reads — data is always null. */
export function unwrapCount(res: { count: number | null; error: PostgrestError | null }): number {
  if (res.error) throw res.error;
  return res.count ?? 0;
}

/* ------------------------------------------------------------------ clubs */

/** The RPC returns no counts; Clubs.tsx merges them in, Landing.tsx reads length. */
export type PublicClubRow = Omit<ClubCardData, "opportunity_count" | "event_count">;

/** Shared: src/pages/Clubs.tsx and src/pages/Landing.tsx (the only two callers). */
export async function fetchAllClubsPublic(): Promise<PublicClubRow[]> {
  const { data, error } = await supabase.rpc("get_all_clubs_public");
  if (error) throw error;
  return (data ?? []) as unknown as PublicClubRow[];
}

/** Stable `select` for Landing — must be module-level, not an inline arrow. */
export const selectClubCount = (rows: PublicClubRow[]): number => rows.length;

/* ----------------------------------------------------- student profile id */

/**
 * user_id -> student_profiles.id. Duplicated at 8 call sites today
 * (Opportunities, OpportunityDetail, ApplicationForm x2, StudentDashboard,
 * StudentProfile, StudentProfileEdit, useEventRSVP). Returns null for club
 * accounts and for students with no profile row — the two are deliberately
 * NOT collapsed downstream (see TRAPS).
 */
export async function resolveStudentProfileId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("student_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/* ------------------------------------------------------------- bookmarks */

/** Shared: useBookmarks (6 mount points) + StudentDashboard's unfollow path. */
export async function fetchBookmarkIds(
  userId: string,
  type: BookmarkType,
): Promise<string[]> {
  const columnName = `${type}_id` as "opportunity_id" | "event_id" | "club_id";
  const { data, error } = await supabase
    .from("bookmarks")
    .select(columnName)
    .eq("user_id", userId)
    .not(columnName, "is", null);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, string | null>>)
    .map((row) => row[columnName])
    .filter((id): id is string => Boolean(id));
}

/* ----------------------------------------------------------- applications */

/**
 * Every opportunity_id this student has applied to. ONE read serves both
 * Opportunities.tsx (applied-id Set) and OpportunityDetail.tsx (hasApplied).
 */
export async function fetchAppliedOpportunityIds(studentProfileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("opportunity_id")
    .eq("student_id", studentProfileId);
  if (error) throw error;
  return (data ?? []).map((row) => row.opportunity_id).filter(Boolean) as string[];
}

/* ------------------------------------------------------------ nav counts */

export async function fetchUnreadMessageCount(userId: string): Promise<number> {
  return unwrapCount(
    await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("is_read", false),
  );
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  return unwrapCount(
    await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false),
  );
}

/* --------------------------------------------------- per-club count maps */

/**
 * Clubs.tsx directory decoration. Kept as TWO independent queries, each under
 * its own table root, so CreateOpportunity/CreateEvent invalidate them via
 * opportunityKeys.all / eventKeys.all and never have to know the Clubs page
 * exists. Tolerant-by-construction: if one fails, its consumer falls back to
 * EMPTY_COUNT_MAP and the directory still renders (today's behaviour).
 * `now` is computed HERE, inside the fetcher — never in a key.
 */
export async function fetchOpenOpportunityCountsByClub(): Promise<Record<string, number>> {
  const now = new Date().toISOString();
  const rows = unwrap(
    await supabase
      .from("opportunities")
      .select("club_id")
      .eq("is_active", true)
      .or(`deadline.is.null,deadline.gte.${now}`),
  );
  return rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.club_id] = (acc[r.club_id] ?? 0) + 1;
    return acc;
  }, {});
}

export async function fetchUpcomingEventCountsByClub(): Promise<Record<string, number>> {
  const now = new Date().toISOString();
  const rows = unwrap(
    await supabase
      .from("events")
      .select("club_id")
      .eq("is_active", true)
      .gte("event_date", now),
  );
  return rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.club_id] = (acc[r.club_id] ?? 0) + 1;
    return acc;
  }, {});
}
```

### File 3 — `src/hooks/useStudentProfileId.ts` (new; the highest-leverage shared hook)

```ts
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { studentProfileKeys } from "@/lib/queryKeys";
import { resolveStudentProfileId } from "@/lib/queryFns";

/**
 * The viewer's student_profiles.id, or null for club accounts / no profile row.
 * `isResolved` distinguishes "not a student" from "not loaded yet" — callers
 * must not collapse those (an un-resolved id renders Apply on a role the student
 * has already applied to).
 */
export function useStudentProfileId() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: studentProfileKeys.byUser(userId ?? "none"),
    queryFn: () => resolveStudentProfileId(userId!),
    enabled: Boolean(userId),
  });

  return {
    studentProfileId: query.data ?? null,
    isResolved: Boolean(userId) && query.isSuccess,
    isLoading: Boolean(userId) && query.isPending,
  };
}
```

### Per-key ownership table

| Key | Owner module | Fetcher | Consumers |
|---|---|---|---|
| `clubKeys.list()` | `queryFns.ts` | `fetchAllClubsPublic` | Clubs, Landing |
| `opportunityKeys.countsByClub()` | `queryFns.ts` | `fetchOpenOpportunityCountsByClub` | Clubs |
| `eventKeys.countsByClub()` | `queryFns.ts` | `fetchUpcomingEventCountsByClub` | Clubs |
| `opportunityKeys.openCount()` | local to Landing | inline | Landing |
| `eventKeys.upcomingCount()` | local to Landing | inline | Landing |
| `eventKeys.upcoming()` | local to Events page | `fetchUpcomingEvents` | Events |
| `eventKeys.detail(id,viewer)` | `src/hooks/useEventDetail.ts` | `fetchEventDetail(id, isAuthed)` | EventDetail |
| `eventKeys.byClubPublic(id)` | `src/hooks/useClubDetail.ts` | `fetchClubUpcomingEvents` | ClubDetail |
| `opportunityKeys.list()` | local to Opportunities page | `fetchOpportunitiesList` | Opportunities |
| `opportunityKeys.detail(id,viewer)` | `src/hooks/useOpportunityDetail.ts` | `fetchOpportunityDetail` | OpportunityDetail |
| `opportunityKeys.byClubPublic(id)` | `src/hooks/useClubDetail.ts` | `fetchClubOpenOpportunities` | ClubDetail |
| `clubKeys.detail(id)` / `teamPublic(id)` | `src/hooks/useClubDetail.ts` | `fetchClubDetail`, `fetchClubActiveTeam` | ClubDetail |
| `studentProfileKeys.byUser(uid)` | `queryFns.ts` + `useStudentProfileId.ts` | `resolveStudentProfileId` | Opportunities, OpportunityDetail, EventDetail/useEventRSVP, ApplicationForm, StudentDashboard, StudentProfile(+Edit) |
| `applicationKeys.byStudent(sid)` | `queryFns.ts` | `fetchAppliedOpportunityIds` | Opportunities, OpportunityDetail |
| `bookmarkKeys.byType(uid,type)` | `queryFns.ts` + `useBookmarks.ts` | `fetchBookmarkIds` | Events×2, Opportunities×2, EventDetail, OpportunityDetail, ClubDetail, StudentDashboard |
| `rsvpKeys.mine(eid,sid)` | `src/hooks/useEventRSVP.ts` | `fetchMyRsvp` | EventDetail |
| `navCountKeys.*` | `queryFns.ts` + `useNavigationCounts.ts` | `fetchUnread*Count` | StudentLayout, ClubLayout, (dead DashboardLayout) |

---

## 2. INVALIDATION_MAP

`qc` = `useQueryClient()`. **`invalidateQueries` matches by prefix** — `{ queryKey: opportunityKeys.all }` reaches `list`, `detail` (both viewer variants), `byClub` and `countsByClub` in one call.

| # | Mutation (file:line) | Invalidate | Notes |
|---|---|---|---|
| M1 | `useBookmarks.ts:62-105` toggle (insert/delete) | `bookmarkKeys.byType(userId, type)`; `studentActivityKeys.byUser(userId)` | `onSuccess`: `setQueryData` to patch the id in/out, **then** invalidate. Do **not** invalidate `eventKeys`/`opportunityKeys` — saved-ness is not a column on those rows; doing so refetches 50 rows per heart-tap. Keep the 23505-is-success branch (`:96`). |
| M2 | **CROSS-FILE** `StudentDashboard.tsx:255-276` `handleUnfollow` — deletes a club bookmark **bypassing the hook entirely** | `bookmarkKeys.byType(userId,"club")`; `studentActivityKeys.byUser(userId)` | **This defect is created by the migration if missed.** Today ClubDetail refetches on mount, masking it; after caching, unfollowing on the dashboard leaves ClubDetail rendering "Following" for up to 5 min. Must ship in the same PR as `useBookmarks`. |
| M3 | **CROSS-FILE** `ApplicationForm.tsx:130-140` application insert | `applicationKeys.byStudent(sid)` (`setQueryData` append first, then invalidate); `opportunityKeys.details(opportunityId)`; `opportunityKeys.list()` | The single most load-bearing cross-file invalidation. Without it the Applied badge and applicant counts are stale on both the list and the detail page — already broken today, and `staleTime: 60s` removes the "reload fixes it" escape hatch. |
| M4 | `CreateOpportunity.tsx:117` insert | `opportunityKeys.all` | One call covers `list`, `byClubPublic`, `countsByClub` (the Clubs directory decoration). |
| M5 | `EditOpportunity.tsx:135` update | `opportunityKeys.all` | Fires **before** `navigate()` at `:156`, otherwise the detail page it lands on serves the pre-edit row. |
| M6 | `useClubOpportunities.ts:58` delete / toggle | `opportunityKeys.all` | |
| M7 | `CreateEvent.tsx:103` insert | `eventKeys.all` | Covers `upcoming`, `byClubPublic`, `countsByClub`. |
| M8 | `EditEvent.tsx:119-120` update (incl. `is_active`) | `eventKeys.all` | |
| M9 | `useEventRSVP.ts:147-157` cancel | `rsvpKeys.mine(eventId, sid)`; `rsvpKeys.byStudent(sid)`; `eventKeys.details(eventId)`; `eventKeys.upcoming()` | `eventKeys.details(id)` is the **prefix** — must mark both viewer variants stale. |
| M10 | `useEventRSVP.ts:173-204` upsert | same as M9 | **Also invalidate on the error path (`:185-195`).** A `capacity full` rejection from the DB trigger is proof the cached count is wrong; leaving the stale number on screen after the rejection is the worst of both. |
| M11 | **CROSS-FILE** `RSVPForm.tsx:82-94` upsert-with-answers | same as M9 | Decide ownership explicitly: either RSVPForm keeps its write and gains its own `useMutation` + invalidation, or it becomes presentational and hands `answers` up. Write and invalidation must not end up in different files. The `requires_approval ? "pending" : "confirmed"` expression currently exists in **three** places (`RSVPForm.tsx:77`, `useEventRSVP.ts:166`, `:217`) — the mutation owner computes it once. |
| M12 | **CROSS-FILE** `RSVPReview.tsx:203, :264` club approve/decline | `rsvpKeys.byEvent(eventId)`; `eventKeys.byClubDashboard(clubId)` | Cannot target the *student's* `rsvpKeys.mine` — different browser. The student learns via the `rsvp-status-${eventId}-${studentProfileId}` channel; that is the realtime path, and it is why M13's handler must invalidate rather than rely on staleness. |
| M13 | `useEventRSVP.ts:108-113` **realtime handler** (not a mutation, but the read half of M12) | `rsvpKeys.mine(eventId, sid)`; `eventKeys.details(eventId)` | Must call `invalidateQueries`, not merely mark dirty. With `staleTime: 60s`, nothing else refetches for a minute. |
| M14 | **CROSS-FILE** `useNotifications.ts:115-136, 138-159, 161-180, 182-203, 205-221` (5 mutations) | `navCountKeys.notifications(userId)` | Today these rely entirely on a realtime echo, which the per-navigation refetch was masking. TanStack dedupes the direct invalidation and the echo into one refetch. |
| M15 | **CROSS-FILE** `useMessages.ts:157-162, 361-364` mark-thread-read | `navCountKeys.messages(userId)` | |
| M16 | `useMessages.ts:183-196` send, `:237-246` delete | **nothing** | Listed so nobody adds one reflexively: the count filters `receiver_id = me`, so the sender's own badge is unaffected. The recipient learns on their own channel. |
| M17 | **CROSS-FILE** `ClubProfileSetup.tsx:138-139` upsert `club_profiles` | `clubKeys.list()`; `clubKeys.detail(clubId)` | |
| M18 | `ClubClaimBanner.tsx:62` `submit-club-claim` | **nothing, deliberately** | A claim is pending admin approval; `claimed_at` does not change synchronously. Invalidating `clubKeys.detail(id)` here refetches an unchanged row and makes the flow look broken. |
| M19 | `ContactClubDialog.tsx:38-44` message insert | **nothing on ClubDetail** | Later, the recipient's thread keys when `useMessages` migrates. |
| M20 | `useTrackView.ts:21` `track_page_view` RPC | **nothing, ever** | Must stay an effect with its `useRef` guard. Wrapping it in a query means a cache hit stops counting views; wrapping it in a retrying mutation inflates them under StrictMode. |
| M21 | **NEW REQUIREMENT** `AuthContext.tsx:204-208` `signOut` | `queryClient.clear()` | Nothing clears the cache on sign-out today — `clearProfileCache` (`useProfileLookup.ts:179`) is exported with **zero callers**. Every user-scoped key added by this migration survives sign-out for `gcTime` (5 min) in the same tab. Per-user keys prevent cross-account *reads*, but the previous account's rows stay resident. This is in scope; it is the only thing making the new user-scoped caches safe. |

---

## 3. SHARED_VS_LOCAL

**Shared module (`queryFns.ts` / a shared hook) — 2+ consumers:**

- `fetchAllClubsPublic` — Clubs, Landing. The only two callers of that RPC; the whole point of the shared key.
- `resolveStudentProfileId` / `useStudentProfileId` — 8 call sites. Highest-leverage item in the migration: it collapses the opportunity-detail + apply flow from three identical reads to one.
- `fetchBookmarkIds` — 6 mount points across 5 pages (Events and Opportunities each mount the hook twice).
- `fetchAppliedOpportunityIds` — Opportunities + OpportunityDetail.
- `fetchUnreadMessageCount` / `fetchUnreadNotificationCount` — the hook plus the new `<NavigationCountsSync />`.
- `fetchOpenOpportunityCountsByClub` / `fetchUpcomingEventCountsByClub` — one consumer today (Clubs), but they live under table roots that four writers invalidate, so they belong beside the keys.
- **All keys, unconditionally.** Even single-consumer keys go in `queryKeys.ts`, because the *writers* are always in other files.

**Stay local to one file (colocate the resolver with its hook, house style):**

- `fetchUpcomingEvents` (Events) — the 50-row select with embedded club + rsvps. Do **not** collapse with `Clubs.tsx`'s `select("club_id")` count read; different shapes, different keys.
- `fetchOpportunitiesList` (Opportunities) — same reasoning.
- Landing's two `head: true` counts — the predicates overlap the list pages but the shapes do not; sharing a key would mean one cache entry serving a scalar and an array.
- `fetchEventDetail`, `fetchOpportunityDetail` — one consumer each, but export them next to their keys so a later prefetch-on-hover can use `queryClient.fetchQuery`.
- `fetchClubDetail`, `fetchClubOpenOpportunities`, `fetchClubUpcomingEvents`, `fetchClubActiveTeam` — ClubDetail only; put all four in a new `src/hooks/useClubDetail.ts`.
- `fetchMyRsvp` — `useEventRSVP.ts` only.
- The `ClubDetailData` / `ClubOpportunity` / `ClubEvent` interfaces (`ClubDetail.tsx:23-56`) move into `useClubDetail.ts` and are imported back by the page.

---

## 4. CONFLICTS (each resolved)

**C1 — Club namespace: `["clubs"]` vs `["club"]`.** Clubs.tsx/Landing proposed `["clubs","list"]`; ClubDetail proposed `["club","detail",id]`. These are different roots, so `invalidateQueries({queryKey:["clubs"]})` after a club profile edit would **not** reach the detail page. **Ruling: `["clubs"]`, plural, everywhere.** ClubDetail's `clubKeys.detail(id)` becomes `["clubs","detail",id]`.

**C2 — Where per-club counts live.** Clubs.tsx proposed `["clubs","activeCounts"]` for two reads that come from the `opportunities` and `events` tables. That forces `CreateOpportunity` and `CreateEvent` to know the Clubs page exists and invalidate a *clubs* key. **Ruling: `opportunityKeys.countsByClub()` and `eventKeys.countsByClub()`.** Root = source table. `opportunityKeys.all` now covers the directory decoration for free.

**C3 — One merged counts query vs two.** Clubs.tsx recommended merging into one `queryFn` returning `{opportunities, events}` to preserve tolerant semantics (a count failure must not blank the directory). **Ruling: two separate queries.** Tolerance is *better* preserved by separation — one failing query leaves the other's data intact, and each consumer falls back to `EMPTY_COUNT_MAP`. The merged version would have required a `queryFn` that swallows errors, which reintroduces the "permanently successful query" bug. Merge them into the merged `Club[]` in a `useMemo` in the page.

**C4 — ClubDetail's page-prefix nesting.** ClubDetail wanted `["club","detail",id,"opportunities"]` etc. so one prefix invalidation covers the whole page. C2's ruling breaks that convenience. **Compensation:** add to `useClubDetail.ts`:
```ts
export function invalidateClubSurface(qc: QueryClient, clubId: string) {
  qc.invalidateQueries({ queryKey: clubKeys.detail(clubId) });
  qc.invalidateQueries({ queryKey: opportunityKeys.byClubPublic(clubId) });
  qc.invalidateQueries({ queryKey: eventKeys.byClubPublic(clubId) });
}
```
Team stays under `clubKeys.detail(id)` (it is `club_team_members`, read nowhere else publicly), so the first call covers it.

**C5 — "have I applied" key.** Opportunities proposed `["applications","byStudent",sid]` (a Set); OpportunityDetail proposed `["application","mine",oppId,sid]` (one row). Two roots, two reads, two things for `ApplicationForm` to invalidate. **Ruling: one key, `applicationKeys.byStudent(sid)`, for both.** The detail page derives `hasApplied = appliedIds.has(id)`. Same RLS policy, same rows, strictly fewer requests, and the navigation list→detail is now a cache hit. `applicationKeys.byOpportunity` is reserved for the club-side review surface, which reads a genuinely different row set.

**C6 — Bookmark key argument order.** Three orderings were proposed: `["bookmarks",userId,type]`, `["bookmarks",type,userId]`, `["bookmarks","opportunity",userId]`. **Ruling: `["bookmarks", type, userId]`** — discriminator-then-identifier, matching `["profile","byUser",userId]` and `["navCounts","messages",userId]`. Per-user bulk clearing is handled by M21's `queryClient.clear()`, not by key ordering.

**C7 — One bookmarks query for all three types, or one per type?** Flagged as an open judgement call by the `useBookmarks` surveyor. **Ruling: one key per type, for this migration.** It mirrors the existing SQL exactly, so nothing about the query's behaviour needs re-verification, and the two-instances-per-page cost is halved anyway by cache sharing the moment both instances key identically. The unified single-read variant (`select` deriving three Sets) is a follow-up backlog item, not this change — it needs a stable `select` identity to avoid re-creating Sets every render.

**C8 — Auth segment: `user?.id` vs `"auth"|"anon"`.** EventDetail proposed the viewer id; OpportunityDetail proposed the boolean-ish literal. **Ruling: `authScope(user?.id)` — the viewer id.** Correct for both reasons: the select *shape* varies with authed-ness, **and** the embedded `rsvps` / `applications` arrays are RLS-shaped per viewer. A `"auth"` bucket would serve account A's cached row to account B within `gcTime`. Invalidate with the `details(id)` prefix so both variants are hit.

**C9 — `studentProfileKeys` vs reusing `profileKeys` with an `!isClub` guard.** EventDetail suggested reusing `profileKeys.byUser` and deriving. **Ruling: a dedicated `studentProfileKeys.byUser(userId)`.** `resolveProfile` checks `club_profiles` **first**, so a club account's `club_profiles.id` would be handed to RSVP/application code as a student id if the guard is ever dropped or copied wrong. The extra cost is one `select("id")` cached once per session for the whole app. Correctness over a saved round trip.

**C10 — Landing's clubs read: share `["clubs","list"]` or add a count-only read?** Landing downloads ~725 rows to read `.length`. **Ruling: share the key**, with the module-level `selectClubCount`. A `head: true` count would be cheaper for Landing alone but shares nothing with `/clubs`, and a new count RPC is a backend migration — out of scope for a frontend change and the maintainer's call. See OUT_OF_SCOPE O1: UX5 may delete this read entirely.

**C11 — `isLoading` vs `isPending` for skeletons.** Surveyors split. **Ruling, precise:** for an **always-enabled** query use `isPending` (this is the UX1 fix — a warm cache makes it false immediately, so the skeleton never reappears on a background refetch). For a query with `enabled:`, `isPending` stays `true` forever while disabled — use `Boolean(gate) && query.isPending`, which exactly reproduces today's behaviour. `useBookmarks` **must** return `isLoading: Boolean(userId) && query.isPending`, or `ClubDetail.tsx:274`'s `disabled={isFollowLoading}` permanently disables the Follow button for signed-out visitors and kills the log-in-to-follow path.

**C12 — Clubs.tsx `.single()` vs `.maybeSingle()` on club detail.** ClubDetail's surveyor recommended switching `ClubDetail.tsx:106` to `.maybeSingle()`. **Ruling: accept.** With `.single()`, a genuine 404 is a thrown PGRST116, `retry: 1` makes every missing club cost two round trips, and not-found becomes indistinguishable from a network failure. `.maybeSingle()` gives `null` for not-found and reserves `isError` for real failures. Same for `EventDetail` if it can be done without changing the not-found branch's copy. **Keep the `as unknown as` cast at `ClubDetail.tsx:106-109`** — the generated Supabase types lack the MB5 provenance columns and `npx tsc -p tsconfig.app.json --noEmit` fails without it.

---

## 5. ORDERING

**Wave 0 — Foundation (one PR, no page changes).** `src/lib/queryKeys.ts`, `src/lib/queryFns.ts`, the `profileKeys` re-export, and **M21 (`queryClient.clear()` in `signOut`)**. Nothing else can land safely before M21, because every subsequent wave adds user-scoped cache entries.

**Wave 1 — Shared hooks. Nothing in Waves 2-4 may start before this lands.**
- 1a. `useStudentProfileId` (new hook; no consumers yet, so it is independently mergeable).
- 1b. `useBookmarks` **+ `StudentDashboard.handleUnfollow` (M2) in the same PR.** Splitting them ships a stale-Following bug.
- 1c. `useNavigationCounts` + the new `<NavigationCountsSync />` + M14 + M15 in one PR. The hook migration alone does **not** fix the channel churn — the subscriptions must be hoisted out of the layouts into a component mounted once in `App.tsx:121`, inside `<AuthProvider>` and outside `<Routes>`.

1a, 1b and 1c touch disjoint files and **may run in parallel.**

**Wave 2 — Clubs + Landing. Must be ONE PR.** They share `clubKeys.list()`; migrating either alone leaves the 725-row RPC firing twice on a Landing→Clubs navigation and makes the change look like a no-op win. Include M17 (`ClubProfileSetup`).

**Wave 3 — The two list pages. Parallel-safe with each other.**
- 3a. `Events.tsx` + M7 + M8 (`CreateEvent`, `EditEvent`).
- 3b. `Opportunities.tsx` + M4 + M5 + M6 (`CreateOpportunity`, `EditOpportunity`, `useClubOpportunities`).
Both depend on Wave 1b; neither depends on the other.

**Wave 4 — The three detail pages.**
- 4a. `ClubDetail.tsx` (+ the realtime handler → `invalidateQueries`). Depends on Wave 2 for `clubKeys`, Wave 3 for `opportunityKeys.byClubPublic` / `eventKeys.byClubPublic`.
- 4b. `OpportunityDetail.tsx` + `ApplicationForm` (M3). Depends on 1a + 3b.
- 4c. `EventDetail.tsx` + `useEventRSVP` + `RSVPForm` (M9-M13). Depends on 1a + 3a.

**Must NOT be migrated in parallel:**

| Pair | Why |
|---|---|
| Clubs ↔ Landing | Share `clubKeys.list()`. Same PR, not parallel PRs. |
| `useBookmarks` ↔ StudentDashboard's `handleUnfollow` | Second writer on the same key, outside the hook. |
| `useNavigationCounts` ↔ `useNotifications` / `useMessages` | The counts have no writer of their own; the five notification mutations and two message mark-read paths are the only things that change them. |
| `EventDetail` ↔ `useEventRSVP` ↔ `RSVPForm` | One mutation cluster over `rsvpKeys.mine` + `eventKeys.details`, with a realtime subscription in the middle. Three PRs here will produce a double-write and a lost optimistic update. |
| `OpportunityDetail` ↔ `ApplicationForm` | `hasApplied` becomes cache-derived in the same change that makes the insert write the cache. Split, and the Applied button visibly reverts to Apply after submit. |
| Any Wave 3/4 page ↔ Wave 1b | Every one of them mounts `useBookmarks`. |

---

## 6. TRAPS — ranked by likelihood of a silent regression

**T1. `now` in a query key = a migration that ships, reviews clean, and caches nothing.** Six reads interpolate a fresh `new Date().toISOString()` (`Clubs.tsx:46,:57`, `Events.tsx:81`, `Opportunities.tsx:92`, `ClubDetail.tsx:119,:129`, `Landing.tsx:25`). A key containing it is unique per render: permanent cache miss, a request per render, and the page still *looks* correct. Every one of these is computed inside its `queryFn` in the fetchers above. **Verify by navigating away and back within 60s and confirming no network request** — not by reading the diff.

**T2. A `queryFn` that copies the old error handling is permanently "successful".** supabase-js *resolves* `{data, error}`. The current bodies do `if (error) { console.error(...); return; }`. Copied verbatim, that caches `undefined` for 60s, never retries, never sets `isError` — and in `useBookmarks`' case silently empties every heart icon after one transient failure. **Every `queryFn` goes through `unwrap`/`unwrapMaybe`/`unwrapCount`.** The one deliberate exception is `useBookmarks`' 23505-duplicate branch (`useBookmarks.ts:96`), which must still resolve successfully.

**T3. Missing auth segment on the two detail keys — a correctness bug, not a perf bug.** `EventDetail.tsx:74` includes `rsvp_questions` only when authed; `OpportunityDetail.tsx:89` includes `application_questions` only when authed (anon has no column grant). Browse logged-out, then log in: the anon-shaped entry is served for up to 5 minutes, `hasQuestions` (`useEventRSVP.ts:137`) reads false, and the student **RSVPs with `answers: []` to an event whose club requires answers**; on the opportunity side, `questions={[]}` is passed at `OpportunityDetail.tsx:461` and an application submits with zero answers. Use `authScope(user?.id)`.

**T4. `isPending` on a disabled query.** See C11. Concretely: `useBookmarks` returning bare `query.isPending` permanently disables ClubDetail's Follow button for signed-out visitors (`ClubDetail.tsx:274`), killing the log-in-to-follow path at `:164-170`. And `EventDetail`/`ClubDetail` gating a skeleton on `isPending` with `enabled: Boolean(id)` renders a forever-skeleton on a route with no `id`. **Test signed out, in the browser.**

**T5. `data ?? []` / `new Set()` fallbacks silently cancel the win.** A fresh array or Set identity every render busts `Clubs.tsx:94` and `:102`, `Events.tsx:153`, `Opportunities.tsx:201`. Use the module-level `EMPTY_ARRAY` / `EMPTY_ID_SET` / `EMPTY_COUNT_MAP` sentinels. Related and already broken today: `isBookmarked` (`useBookmarks.ts:107`) is a fresh arrow every render and sits in two `useMemo` dep arrays — wrap it in `useCallback([bookmarkedIds])`, or depend on the Set instead of the function.

**T6. Sorting the cached array in place.** `Clubs.tsx:111-124` calls `result.sort(...)`, safe today only because `.filter()` at `:103` returns a fresh array. Refactor the memo to sort `query.data` directly and it **mutates the shared cache object**, corrupting Landing and every future consumer of `["clubs","list"]`. `Opportunities.tsx:187-200` has the same shape. Copy before sorting.

**T7. Keying on the `user` object instead of `user.id`.** `AuthContext.tsx:34` and `:57` call `setUser(session?.user ?? null)` on every `onAuthStateChange`, including `TOKEN_REFRESHED` — a new object identity with the same id. Four files list `user` in an effect dep array today and refetch on token refresh. Putting `user.id` (a string) in the key fixes it for free; putting `user` in it thrashes the cache instead.

**T8. `toast.error` inside a `queryFn`.** With `retry: 1` it fires twice per failure, and again on every background refetch. Throw from the `queryFn` and surface the failure from render (`isError`), or from a single `useEffect` keyed on the error object. v5 has no `onError` on `useQuery`.

**T9. Dropping the optimistic bookmark/RSVP updates.** `useBookmarks.ts:80-84,:98` and `useEventRSVP.ts:154-155,:196-197,:216-217` patch local state deliberately. Naively deriving from the query makes every tap wait a round trip (bookmarks) or visibly revert (RSVP, Applied badge). Reimplement as `onMutate` + `setQueryData` + rollback in `onError` — not as surviving `useState`, and not as nothing. Note the bookmark patch is currently *post*-await, so a straight `onSuccess` `setQueryData` is behaviour-preserving; making it truly optimistic is an improvement the maintainer should sign off on.

**T10. `invalidateQueries` in a realtime handler is not optional.** With `staleTime: 60s`, marking data stale does not refetch an inactive query, and a re-render will not pick up fresh data for a minute. `useEventRSVP.ts:108-113` and the hoisted nav-count handlers must invalidate (which does refetch active observers immediately). And **do not compute count deltas from the realtime payload** — neither `messages` nor `notifications` has `REPLICA IDENTITY FULL` (`20260710000200_add_messages_to_realtime.sql:15` says so explicitly), so `payload.old` carries only the PK and you cannot tell a false→true `is_read` flip from an already-read row.

**T11. Hoisting the nav-count subscriptions is the actual fix; migrating the reads is not.** `useNavigationCounts` is called from layouts that render *inside each page component*, so a route change runs the cleanup at `:104-107`. Also rename the channels: `"nav-counts-messages"` and `"nav-counts-notifications"` are global constants on one shared socket, and with `v7_startTransition` (`App.tsx:119`) two instances can be mounted at once — both join the same Phoenix topic, and the outgoing one's `removeChannel` can leave the survivor with a dead subscription, so counts silently stop updating. Use `nav-counts-messages:${userId}`.

**T12. Do not seed `clubKeys.detail(id)` from the Clubs list.** `get_all_clubs_public` returns no `user_id`, `source`, `source_url`, `imported_at` or `claimed_at` (`20260727000100_mb5_seedable_clubs.sql:69-73`). A seeded row makes `isUnclaimed` false, hides the Message-club button (`ClubDetail.tsx:281`) and means `ClubClaimBanner` **never renders for seeded clubs**. Same reason not to use those rows as `placeholderData`.

**T13. Time-boundary drift is now a real behaviour change.** Cached `gte(now)` lists can outlive their boundary by up to 60s active / 5m across a remount: an event that just started stays listed, a role whose deadline just passed stays visible. Judged acceptable (the detail pages re-check with `deadlinePassed`), but it follows from caching, not from a bug — state it in the backlog rather than let it be discovered.

**T14. Do not derive `hasRSVP` from the embedded `rsvps` array to save a query.** The SELECT policy (`20251224045225_10d4c255….sql:80-95`) returns only the viewer's own rows plus the owning club's. It would appear to work for students and be wrong for everyone else. Keep `rsvpKeys.mine` as its own query.

**T15. TypeScript, not vibes.** `useBookmarks`' `columnName` is a template literal fed to `.select()/.eq()/.not()` and used to index rows — the generated types do not narrow it to a column union, and the existing code leans on loose inference. `ClubDetail.tsx:106-109`'s `as unknown as` cast must survive the extraction. Run `npx tsc -p tsconfig.app.json --noEmit` for 0 errors after every wave, not at the end.

**Verification gate for every wave** (per CLAUDE.md — verify by running): `npx tsc -p tsconfig.app.json --noEmit`, `npm run build`, the two node test files, and `bash tests/e2e/run.sh` (needs a Docker daemon — `sudo dockerd` in a cloud session — or 24/115 assertions do not execute and the suite exits 1). Plus a browser pass on each migrated page: navigate away and back within 60s and confirm **no skeleton and no network request**, in both themes, at mobile width, signed out and signed in.

---

## 7. OUT_OF_SCOPE — do not scope-creep

| # | Item | Where flagged | Why it is separate |
|---|---|---|---|
| O1 | **UX5: delete the Landing live-counts strip** (`docs/BACKLOG.md:193` — `Landing.tsx:153-158` + the `useLiveCounts` hook) | Landing | UX5 deletes 100% of what the Landing migration touches. **Sequencing must go to the maintainer before Wave 2 starts** — if UX5 ships first, Landing needs no query work at all beyond deleting the hook. Asking costs one question; guessing costs the whole Wave 2 Landing half. |
| O2 | **MB3: server-side search / debounce** on Clubs and Opportunities (~725 rows re-scanned per keystroke) | Clubs, Opportunities | Filtering stays client-side. The optional orthogonal fix is `useDeferredValue(searchQuery)` feeding the memo while the Input stays bound to raw state — do **not** let it become a server-side-search redesign. |
| O3 ✅ | **RESOLVED 2026-09-21 — done exactly as reserved, and the same fault was found on Opportunities and fixed with it.** Events sorts server-side on `eventKeys.upcomingSorted(sort)`; Opportunities on `opportunityKeys.listSorted(sort)`. Both keep a prefix key (`upcoming()` / `list()`) so existing invalidations still reach every variant, and both use `placeholderData: keepPreviousData` so switching sort does not flash the skeletons. Original note follows. **UX13: adding a sort control to Events** | Events | When it lands it must be **server-side and in the key** (`eventKeys.list({sort})`) — a client sort only reorders an arbitrary "soonest 50" window. Flagged now so it does not ship as a client sort by default. |
| O4 | **Pagination / the `.limit(50)` truncation** on Events and Opportunities — "Saved"/"Following"/"This month" only search the first 50 rows | Events, Opportunities, useBookmarks | Pre-existing product bug. Caching makes the truncated window *persist* rather than be re-rolled, so it will feel more fixed than it is. Log it; do not paper over it. |
| O5 | **RLS-shaped counts are wrong today.** The embedded `rsvps` attendee count (`Events.tsx:275`, `EventDetail.tsx:253,:310`) reads 0 signed-out and 0-or-1 for a student; the embedded `applications` count (`Opportunities.tsx:212`, `OpportunityDetail.tsx:230`) is the same shape | Events, EventDetail, Opportunities, OpportunityDetail | Verified by reading `20251224045225_10d4c255….sql:80-95`, **not** by querying the database. Do not change the selects inside a caching change, and do not treat a non-incrementing count after M3 as a migration regression. Decide the count bug before wiring polish around it. |
| O6 | **UX17c: no page has a distinct error state.** Every list and detail page renders "No X yet" for what is actually a network failure | all 6 pages | The migration *exposes* `isError` and makes the wrong-and-confident empty state more visible. The error-state **copy** is a maintainer decision (`AskUserQuestion`), not an implementer's invention. Minimum safe behaviour for this migration: keep the existing toast, move it to the component reading `query.isError`, change nothing visual. |
| O7 | **URL-param desync** — `selectedCategory` / `selectedDateFilter` seeded from `?filter=` only at mount and never resynced on back/forward; `setSearchParams({})` wipes *all* params on the route | Events `:55-57,:67`, Opportunities `:66-70,:86-87` | Pre-existing, unrelated to data fetching. Fixing it inside a query migration makes the diff unreviewable. |
| O8 | **Unified single-read `useBookmarks`** (one query, three Sets via `select`) | useBookmarks | See C7. Follow-up, not this change. |
| O9 | **`RoleBasedLayout` gates the entire Landing page** (including the LCP hero) behind `useAuth().isLoading` (`RoleBasedLayout.tsx:22-30`) | Landing | Caching the counts will not make Landing feel faster until this is addressed. Do not touch it here; do not attribute the win to this migration. |
| O10 | **Hardcoded realtime channel names elsewhere** — `"notifications-realtime"` (`useNotifications.ts:94`), `"messages-realtime"` (`useMessages.ts:344`) collide across tabs | useNavigationCounts, Events, OpportunityDetail | Only the two nav-count channels are in scope (T11). The other two are a separate backlog item. |
| O11 | **`DashboardLayout.tsx` is dead code** — no importer outside itself; the third `useNavigationCounts` call site | useNavigationCounts | It typechecks as long as the hook's return shape `{unreadMessageCount, notificationCount, isLoading, refetch}` is preserved (which it must be anyway — the two live layouts destructure only the counts). Log it; do not delete it here. |
| O12 | **`ClubDetail` progressive fill vs one skeleton.** Four serialized reads become four parallel queries; the "Recruiting now" pill and Members aside would pop in after the header | ClubDetail | A visible design change to a shipped page. **Maintainer decision via `AskUserQuestion`, recorded in `docs/BACKLOG.md` *Decisions made* before building.** |
| O13 | **`OpportunityDetail`'s `navigate("/opportunities")` on a missing row** (`:121`) races a fully-designed not-found EmptyState at `:210-227` | OpportunityDetail | A `queryFn` must not navigate, so this has to move — but *where it moves to* (redirect vs stay on the EmptyState) is a product call. Ask; do not guess. |
| O14 | **Live "spots left" freshness.** With `staleTime: 60s` the client-side capacity pre-check (`useEventRSVP.ts:160-161`) can be a minute old | EventDetail | The DB trigger `enforce_rsvp_capacity` is authoritative and the error branch already presents its rejection cleanly, so nothing breaks. Whether this one key should override `staleTime` (e.g. 30s, or `refetchOnMount: "always"`) is a product question about how live the number must feel. |
| O15 | **Raising `staleTime` on any RLS-shaped detail key** above the 60s global default | OpportunityDetail, EventDetail | Needs the maintainer's call; those entries hold per-viewer data. |

---

**Decisions requiring the maintainer before implementation starts:** O1 (UX5 sequencing — blocks Wave 2), O6 (error-state copy — touches all six pages), O12 (ClubDetail skeleton behaviour), O13 (missing-opportunity redirect). Per CLAUDE.md these go via `AskUserQuestion`, recommended option first, and the answers are written into `docs/BACKLOG.md` *Decisions made* with the date **before** anything is built on them.