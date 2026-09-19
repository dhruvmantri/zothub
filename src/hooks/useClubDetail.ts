import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { supabase } from "@/integrations/supabase/client";
import { clubKeys, eventKeys, opportunityKeys } from "@/lib/queryKeys";
import type { TeamMember } from "@/types";

/**
 * Everything a club's public page reads (UX15 wave 4a).
 *
 * The four reads used to run in SERIES inside one effect, so the page waited
 * for the slowest chain rather than the slowest request, and every visit paid
 * for all four again. They are four independent queries now.
 *
 * Their keys deliberately do NOT nest under one page prefix. The root of a key
 * is the TABLE the rows come from, never the page that renders them, because a
 * write is table-shaped: `CreateOpportunity` invalidates `opportunityKeys.all`
 * and must reach this page's open-roles list without knowing this page exists.
 * `invalidateClubSurface` below is the compensation for losing the one-prefix
 * convenience.
 */

export interface ClubDetailData {
  id: string;
  user_id: string | null;
  club_name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  discord_url: string | null;
  // ZotSpot-seed provenance (MB5). NULL across these = an organic ZotHub club.
  source: string | null;
  source_url: string | null;
  imported_at: string | null;
  claimed_at: string | null;
}

export interface ClubOpportunity {
  id: string;
  title: string;
  type: string;
  description: string | null;
  deadline: string | null;
}

export interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
}

export type ClubTeamMember = Pick<
  TeamMember,
  "id" | "name" | "role" | "display_order" | "user_id"
>;

/** Stable fallbacks — `?? []` allocates a new identity every render. */
const EMPTY_OPPORTUNITIES: ClubOpportunity[] = [];
const EMPTY_EVENTS: ClubEvent[] = [];
const EMPTY_TEAM: ClubTeamMember[] = [];

/**
 * One club's public row.
 *
 * `.maybeSingle()`, not `.single()`. With `.single()` a genuine 404 arrives as a
 * thrown PGRST116: `retry: 1` makes every missing club cost two round trips, and
 * "no such club" becomes indistinguishable from "the network failed" — so the
 * page cannot tell a dead link from an outage. `.maybeSingle()` returns `null`
 * for not-found and reserves `isError` for real failures.
 *
 * The `as unknown as` cast stays: the generated Supabase types predate the MB5
 * provenance columns, and `tsc` fails without it.
 */
async function fetchClubDetail(clubId: string): Promise<ClubDetailData | null> {
  // user_id is public (anon-granted for RLS) and also signals whether a seeded
  // club is still unclaimed (NULL owner); source_* / claimed_at back the
  // unclaimed treatment. All are on the public anon column allowlist
  // (migration 20260727000100), which must be APPLIED for this select to work.
  const { data, error } = (await supabase
    .from("club_profiles")
    .select(
      `id, club_name, category, description, logo_url, banner_url, website_url, linkedin_url, instagram_url, discord_url, user_id, source, source_url, imported_at, claimed_at`,
    )
    .eq("id", clubId)
    .maybeSingle()) as unknown as {
    data: ClubDetailData | null;
    error: { message: string } | null;
  };

  if (error) throw new Error(`Failed to load the club: ${error.message}`);
  return data;
}

/** `now` is computed here, inside the fetcher — never in a key (contract T1). */
async function fetchClubOpenOpportunities(clubId: string): Promise<ClubOpportunity[]> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("id, title, type, description, deadline")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load open roles: ${error.message}`);
  return data ?? [];
}

async function fetchClubUpcomingEvents(clubId: string): Promise<ClubEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, event_date, location")
    .eq("club_id", clubId)
    .eq("is_active", true)
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true });

  if (error) throw new Error(`Failed to load upcoming events: ${error.message}`);
  return data ?? [];
}

/** Public roster: `status = 'active'` only, which is all the public policy allows. */
async function fetchClubActiveTeam(clubId: string): Promise<ClubTeamMember[]> {
  const { data, error } = await supabase
    .from("club_team_members")
    .select("id, name, role, display_order, user_id")
    .eq("club_id", clubId)
    .eq("status", "active")
    .order("display_order", { ascending: true });

  if (error) throw new Error(`Failed to load the members list: ${error.message}`);
  return data ?? [];
}

export function useClubDetail(clubId: string | undefined) {
  const enabled = Boolean(clubId);

  const clubQuery = useQuery({
    queryKey: clubKeys.detail(clubId ?? ""),
    queryFn: () => fetchClubDetail(clubId!),
    enabled,
  });

  const opportunitiesQuery = useQuery({
    queryKey: opportunityKeys.byClubPublic(clubId ?? ""),
    queryFn: () => fetchClubOpenOpportunities(clubId!),
    enabled,
  });

  const eventsQuery = useQuery({
    queryKey: eventKeys.byClubPublic(clubId ?? ""),
    queryFn: () => fetchClubUpcomingEvents(clubId!),
    enabled,
  });

  const teamQuery = useQuery({
    queryKey: clubKeys.teamPublic(clubId ?? ""),
    queryFn: () => fetchClubActiveTeam(clubId!),
    enabled,
  });

  const queries = [clubQuery, opportunitiesQuery, eventsQuery, teamQuery];

  return {
    club: clubQuery.data ?? null,
    opportunities: opportunitiesQuery.data ?? EMPTY_OPPORTUNITIES,
    events: eventsQuery.data ?? EMPTY_EVENTS,
    team: teamQuery.data ?? EMPTY_TEAM,

    /**
     * One skeleton for the whole page, not four that pop in separately
     * (maintainer decision on O12, 2026-09-19). `Boolean(clubId) &&` matters:
     * with `enabled` false `isPending` stays true forever, so a route with no
     * id would render a skeleton that never resolves.
     *
     * The four run in PARALLEL, so waiting for all of them is the slowest
     * single request — not the sum, which is what the old serial effect cost.
     */
    isPending: enabled && queries.some((q) => q.isPending),

    /** Only the club row failing is a page failure. A companion that fails is
     *  reported in its own section, so the rest of the page still renders. */
    isClubError: clubQuery.isError,
    isOpportunitiesError: opportunitiesQuery.isError,
    isEventsError: eventsQuery.isError,
    isTeamError: teamQuery.isError,

    isRefetching: queries.some((q) => q.isFetching),
    refetchClub: clubQuery.refetch,
    refetchOpportunities: opportunitiesQuery.refetch,
    refetchEvents: eventsQuery.refetch,
  };
}

/**
 * Everything on one club's public page, in one call.
 *
 * The page's reads live under three different table roots by design (see the
 * note at the top), so no single prefix covers them. Anything that changes a
 * club "as a whole" — a profile edit, an admin approval — calls this rather
 * than trying to remember the three keys. The team roster sits UNDER
 * `clubKeys.detail(id)`, so the first call reaches it too.
 */
export function invalidateClubSurface(qc: QueryClient, clubId: string) {
  qc.invalidateQueries({ queryKey: clubKeys.detail(clubId) });
  qc.invalidateQueries({ queryKey: opportunityKeys.byClubPublic(clubId) });
  qc.invalidateQueries({ queryKey: eventKeys.byClubPublic(clubId) });
}

/**
 * Refresh the roster from the realtime handler.
 *
 * It must INVALIDATE, not merely mark dirty: with `staleTime: 60s`, staleness
 * alone does not refetch, so a member added or removed would not appear for a
 * minute even though the change arrived instantly on the socket (contract T10).
 */
export function useInvalidateClubTeam(clubId: string | undefined) {
  const qc = useQueryClient();
  return useCallback(() => {
    if (!clubId) return;
    qc.invalidateQueries({ queryKey: clubKeys.teamPublic(clubId) });
  }, [qc, clubId]);
}
