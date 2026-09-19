import { supabase } from "@/integrations/supabase/client";
import type { ClubCardData } from "@/components/clubs/ClubCard";

/**
 * Shared fetchers for reads with more than one consumer (UX15).
 *
 * A fetcher lives here only when two or more files read the same rows — a
 * single-consumer read stays beside the hook that owns it, matching the house
 * style in useProfileLookup.ts. The query KEYS all live in queryKeys.ts
 * regardless, because the writers that must invalidate them are always elsewhere.
 *
 * Two rules every fetcher here follows:
 *
 * 1. **`now` is computed INSIDE the function, never passed in.** A wall-clock
 *    value in a query key changes every render, so the key is never stable, the
 *    cache never hits, and the page still looks completely correct — a migration
 *    that reviews clean and does nothing.
 *
 * 2. **Throw on error.** supabase-js RESOLVES with `{data, error}`, so the old
 *    `if (error) { console.error(...); return; }` shape would cache `undefined`
 *    as a successful result: no retry, no `isError`, and an empty page that
 *    claims to have loaded fine.
 */

/** Throw on a supabase error so the query fails honestly instead of caching undefined. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data ?? []) as T;
}

/**
 * Every publicly visible club. ~725 rows, no arguments, no auth dependency.
 *
 * Shared by /clubs and the landing page, which are the only two callers of this
 * RPC. Before they shared a key, a Landing -> Clubs navigation fetched all 725
 * rows twice — once of them purely to read `.length`.
 */
export async function fetchAllClubsPublic(): Promise<ClubCardData[]> {
  const result = await supabase.rpc("get_all_clubs_public");
  return unwrap(result as never, "Failed to load clubs") as ClubCardData[];
}

/** Rows to a `club_id -> count` map. */
function countByClub(rows: Array<{ club_id: string }> | null): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows ?? []) {
    map[row.club_id] = (map[row.club_id] ?? 0) + 1;
  }
  return map;
}

/** club_id -> number of currently-open roles. Decorates the club directory. */
export async function fetchOpenOpportunityCountsByClub(): Promise<Record<string, number>> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("opportunities")
    .select("club_id")
    .eq("is_active", true)
    .or(`deadline.is.null,deadline.gte.${now}`);
  if (error) throw new Error(`Failed to load role counts: ${error.message}`);
  return countByClub(data);
}

/** club_id -> number of upcoming events. Decorates the club directory. */
export async function fetchUpcomingEventCountsByClub(): Promise<Record<string, number>> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .select("club_id")
    .eq("is_active", true)
    .gte("event_date", now);
  if (error) throw new Error(`Failed to load event counts: ${error.message}`);
  return countByClub(data);
}

/**
 * Every opportunity id this student has applied to.
 *
 * ONE read serves two consumers (contract C5): the Applied badge on the roles
 * list, and `hasApplied` on a role's detail page. They were two separate
 * queries against the same rows under the same RLS policy, so opening a role
 * from the list repeated a query the list had already made. Now the navigation
 * is a cache hit.
 *
 * `studentProfileId` is `student_profiles.id`, NOT `auth.users.id` — the
 * applications table keys on the former. Resolve it with `useStudentProfileId`.
 */
export async function fetchAppliedOpportunityIds(studentProfileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("opportunity_id")
    .eq("student_id", studentProfileId);
  if (error) throw new Error(`Failed to load your applications: ${error.message}`);
  return (data ?? []).map((row) => row.opportunity_id).filter(Boolean) as string[];
}
