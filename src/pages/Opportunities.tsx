import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Bookmark, Heart } from "lucide-react";

import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { OpportunityCard } from "@/components/cards/OpportunityCard";
import { DiscoverList, type DiscoverListRow } from "@/components/discover/DiscoverList";
import { DiscoverToolbar } from "@/components/discover/DiscoverToolbar";
import { EmptyState } from "@/components/discover/EmptyState";
import { ErrorState } from "@/components/discover/ErrorState";
import { NothingYetState } from "@/components/discover/NothingYetState";
import { SignInToSaveState } from "@/components/discover/SignInToSaveState";
import { useDiscoverView } from "@/components/discover/ViewToggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDeadline, normalizeOpportunityType, opportunityTypeLabel } from "@/lib/formatters";
import { OPPORTUNITY_TYPES } from "@/lib/constants";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useStudentProfileId } from "@/hooks/useStudentProfileId";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAppliedOpportunityIds } from "@/lib/queryFns";
import { applicationKeys, opportunityKeys, EMPTY_ID_SET } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

interface OpportunityRow {
  id: string;
  title: string;
  type: string;
  description: string | null;
  deadline: string | null;
  club_id: string;
  club_profiles: {
    club_name: string;
    logo_url: string | null;
  };
  /** Maintained by a database trigger (O5-counts). Every application ever
   *  submitted, including rejected ones — the honest measure of competition,
   *  and it never goes down. Replaces counting an embedded `applications`
   *  array, which RLS filtered to the viewer's own rows: a logged-out visitor
   *  saw 0 on every card however busy the role was. */
  applications_count: number;
  /** The club's "show applicant count" switch. Defaults to false in the
   *  database, so a null means the club never opted in. */
  show_application_count: boolean | null;
}

/** Module-level so the fallback identity is stable. `data ?? []` allocates a
 *  fresh array every render, busting the filter/sort memo below and silently
 *  cancelling the caching win (contract T5). */
const EMPTY_OPPORTUNITIES: OpportunityRow[] = [];
/** Same reason, for the type selection. */
const NO_TYPES: string[] = [];

export type OpportunitySort = "newest" | "deadline" | "popular";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "deadline", label: "Closing soonest" },
  { value: "popular", label: "Most applied to" },
] as const;

/**
 * The open-roles read.
 *
 * The SORT is applied by the DATABASE, and is part of the query key
 * (maintainer decision, 2026-09-21). It has to be: the query is capped at 50
 * rows, so ordering server-side changes which 50 rows come back —
 * "closing soonest" returns the 50 soonest-closing roles, not a reshuffle of
 * the 50 newest. Re-ordering in the browser looked identical while there were
 * fewer than 50 open roles and would have started silently lying in a busy
 * term. Contract O3 flagged this for Events; it applied here too.
 *
 * `now` is computed HERE, inside the fetcher, and never enters the query key
 * (contract T1) — a key holding a fresh timestamp is unique per render, so the
 * page would issue a request per render while looking perfectly correct.
 *
 * It THROWS rather than logging and returning (contract T2): supabase-js
 * RESOLVES with `{data, error}`, so the old
 * `if (error) { console.error(); return; }` shape would have cached `undefined`
 * as a SUCCESSFUL result for 60 seconds — no retry, no error state, and a page
 * confidently announcing that no club is recruiting. And no toast in here (T8):
 * with `retry: 1` it fires twice per failure and again on every background
 * refetch. Failure is surfaced from render, via `isError`.
 */
async function fetchOpportunitiesList(sort: OpportunitySort): Promise<OpportunityRow[]> {
  const now = new Date().toISOString();
  let query = supabase
    .from("opportunities")
    .select(`
      id,
      title,
      type,
      description,
      deadline,
      club_id,
      applications_count,
      show_application_count,
      club_profiles (
        club_name,
        logo_url
      )
    `)
    .eq("is_active", true)
    .or(`deadline.is.null,deadline.gte.${now}`);

  if (sort === "deadline") {
    // Nulls LAST: a role with no deadline is not closing soonest, it is not
    // closing at all, so it belongs after every dated one. Postgres already
    // does this for an ASCENDING order — verified against production, where
    // `deadline.asc` and `deadline.asc.nullslast` return byte-identical
    // orders — so the modifier is documentation, not a fix. It is stated
    // explicitly because the default flips for DESC, and a future "closing
    // latest" would silently lead with the undated roles.
    query = query.order("deadline", { ascending: true, nullsFirst: false });
  } else if (sort === "popular") {
    query = query.order("applications_count", { ascending: false });
  }
  // Always the final key, so ties resolve the same way every time. Without a
  // deterministic tiebreak the same sort can return rows in a different order
  // on each fetch, which reads as the list jumping about by itself.
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query.limit(50);

  if (error) throw new Error(`Failed to load opportunities: ${error.message}`);
  return data ?? [];
}

/** Module-level, so TanStack can memoise the derived Set. An inline arrow would
 *  build a new Set on every render and bust every memo that depends on it. */
const selectAppliedIdSet = (ids: string[]): Set<string> => new Set(ids);

/**
 * The six real opportunity types. The old list hard-coded four and the
 * formatter silently coerced the other two to "volunteer", so Committee and
 * Other postings were both unfilterable and mislabelled (Structure §3).
 *
 * These are MULTI-select (maintainer decision, 2026-09-21): a student looking
 * for something to do wants Leadership *or* Creative, and the old single-select
 * chip row made them look twice.
 */
const TYPE_OPTIONS = OPPORTUNITY_TYPES.map((t) => ({ value: t.value, label: t.label }));

export default function OpportunitiesPage() {
  const { user, role } = useAuth();
  const { studentProfileId, isLoading: isStudentProfileLoading } = useStudentProfileId();
  // A club can browse but cannot apply, RSVP or save — those all need a student
  // profile. The cards render a neutral "View" instead of dead controls, and
  // the Saved filter is dropped rather than left as another dead end.
  const isViewOnly = role === "club";
  const { isBookmarked, toggleBookmark } = useBookmarks("opportunity");
  const { bookmarkedIds: followedClubIds } = useBookmarks("club");
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  // Saved and Following are independent SCOPES, not categories: turning both
  // on means "saved roles from clubs I follow", which the old single-select
  // chip row could not express at all.
  const [savedOnly, setSavedOnly] = useState(false);
  const [followingOnly, setFollowingOnly] = useState(
    // /student/feed redirects here, so an old bookmark still lands on the
    // student's followed clubs instead of a 404.
    searchParams.get("filter") === "following",
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(NO_TYPES);
  const [sortOption, setSortOption] = useState<OpportunitySort>("newest");
  const [view, setView] = useDiscoverView("discover");

  // The SORT is in the key; the search box and the filters are not. Putting
  // `searchQuery` in the key would turn every keystroke into a network round
  // trip. Filtering stays client-side over the cached rows, which is what makes
  // it instant — and unlike the sort it is safe there, because filtering can
  // only ever narrow the rows already in hand, never reveal rows the 50-row cap
  // left behind.
  const opportunitiesQuery = useQuery({
    queryKey: opportunityKeys.listSorted(sortOption),
    queryFn: () => fetchOpportunitiesList(sortOption),
    // Switching sort is now a network round trip. Without this the page would
    // drop straight back to the six grey skeletons — a full-page flash for what
    // reads as a local re-ordering. The previous rows stay on screen, dimmed,
    // until the new order arrives.
    placeholderData: keepPreviousData,
  });

  // ONE key serves both the Applied badge here and `hasApplied` on the detail
  // page (contract C5) — same RLS policy, same rows, and list -> detail is now a
  // cache hit rather than a repeat of the same query. Keyed on the
  // student_profiles id, which is NOT auth.users.id; `useStudentProfileId`
  // resolves and caches that once per session for the whole app.
  const appliedQuery = useQuery({
    queryKey: applicationKeys.byStudent(studentProfileId ?? "anon"),
    queryFn: () => fetchAppliedOpportunityIds(studentProfileId!),
    enabled: Boolean(studentProfileId),
    select: selectAppliedIdSet,
  });

  const opportunities = opportunitiesQuery.data ?? EMPTY_OPPORTUNITIES;
  const appliedOpportunityIds = appliedQuery.data ?? EMPTY_ID_SET;
  /** True while a newly-chosen sort is still in flight and the rows on screen
   *  are the PREVIOUS order. */
  const isReordering = opportunitiesQuery.isPlaceholderData;

  // UX23. "Not applied" and "we don't know yet" are different answers, and
  // collapsing them renders a live Apply on a role the student already applied
  // to — tap it and the unique constraint answers with a raw 23505. A cold
  // signed-in load runs two serialised reads (student_profiles -> applications)
  // before the truth is in, so the window is real, not theoretical.
  //
  // Only signed-in viewers have an unknown: a visitor has applied to nothing,
  // and a club account resolves to no student profile — both are settled
  // answers, not pending ones. An ERRORED read also counts as settled: we
  // cannot do better than letting them try, and a permanently dead button
  // would be worse than a rare duplicate-apply message.
  const isApplicationStatePending =
    Boolean(user) &&
    (isStudentProfileLoading || (Boolean(studentProfileId) && appliedQuery.isPending));

  // `isPending`, not `isFetching`: with a warm cache this is false immediately,
  // so the skeleton never reappears on a background refetch (the UX1 fix). It
  // deliberately does NOT wait on `appliedQuery` — that only decorates a button,
  // and holding the whole list behind it would make a signed-in student wait
  // longer than a visitor for the same rows.
  const isLoading = opportunitiesQuery.isPending;

  const toggleFollowing = () => {
    const next = !followingOnly;
    setFollowingOnly(next);
    // Only "following" is worth keeping in the URL — it is the one filter a
    // student arrives at by link rather than by tapping a chip.
    if (next) setSearchParams({ filter: "following" }, { replace: true });
    else if (searchParams.has("filter")) setSearchParams({}, { replace: true });
  };

  const filteredOpportunities = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    return opportunities.filter((opp) => {
      const clubName = opp.club_profiles?.club_name || "";
      const matchesSearch =
        opp.title.toLowerCase().includes(needle) || clubName.toLowerCase().includes(needle);
      if (!matchesSearch) return false;
      if (savedOnly && !isBookmarked(opp.id)) return false;
      if (followingOnly && !followedClubIds.has(opp.club_id)) return false;
      // An empty selection means "every type", not "no type".
      if (
        selectedTypes.length > 0 &&
        !selectedTypes.includes(normalizeOpportunityType(opp.type))
      ) {
        return false;
      }
      return true;
    });
    // No `.sort()` here on purpose — the order arrives from the database, see
    // fetchOpportunitiesList. Re-sorting a capped page in the browser is the
    // bug this page just stopped having.
  }, [opportunities, searchQuery, savedOnly, followingOnly, selectedTypes, isBookmarked, followedClubIds]);

  const hasFilters =
    searchQuery !== "" || savedOnly || followingOnly || selectedTypes.length > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setSavedOnly(false);
    setSelectedTypes(NO_TYPES);
    if (followingOnly) toggleFollowing();
  };

  // A signed-out visitor tapping "Saved" cannot have saved anything, so the
  // ordinary empty state would blame them for not doing something they were
  // never able to do. Maintainer decision, 2026-09-19 — docs/BACKLOG.md UX22.
  const needsAccountToSave = savedOnly && !user;

  const listRows: DiscoverListRow[] = filteredOpportunities.map((opp) => {
    const applied = appliedOpportunityIds.has(opp.id);
    return {
      id: opp.id,
      href: `/opportunities/${opp.id}`,
      title: opp.title,
      // Hidden at zero, and hidden when the club turned the count off
      // (maintainer decisions, 2026-09-20). A brand-new posting should look
      // new, not ignored — and at launch nearly every card is at zero.
      meta:
        opp.show_application_count && opp.applications_count > 0
          ? `Due ${formatDeadline(opp.deadline)} · ${opp.applications_count} applied`
          : `Due ${formatDeadline(opp.deadline)}`,
      tag: { label: opportunityTypeLabel(opp.type) },
      clubId: opp.club_id,
      clubName: opp.club_profiles?.club_name || "Unknown club",
      clubLogo: opp.club_profiles?.logo_url,
      saved: isViewOnly ? undefined : isBookmarked(opp.id),
      onSave: isViewOnly ? undefined : () => toggleBookmark(opp.id),
      action: isViewOnly
        ? { label: "View" }
        : applied
          ? { label: "Applied", disabled: true }
          : { label: "Apply", disabled: isApplicationStatePending },
    };
  });

  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto px-4 py-9">
            <h1 className="text-[clamp(30px,4vw,40px)] font-medium tracking-[-0.03em] text-ink">
              Opportunities
            </h1>
            <p className="mt-2 max-w-2xl text-ink-2">
              {/* A club can browse but not apply, so it is not told to. */}
              {isViewOnly
                ? "Roles from UCI clubs — see what the rest of campus is recruiting for."
                : "Roles from UCI clubs — find one, apply, show up."}
            </p>
          </div>
        </div>

        <DiscoverToolbar
          searchId="discover-search"
          searchLabel="Search roles by title or club"
          searchPlaceholder="Search roles or clubs…"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          scopes={[
            // A club account has no student profile, so it cannot save. The
            // chip is dropped rather than left as another dead end.
            ...(isViewOnly
              ? []
              : [
                  {
                    value: "saved",
                    label: "Saved",
                    icon: Bookmark,
                    active: savedOnly,
                    onToggle: () => setSavedOnly((v) => !v),
                  },
                ]),
            // Only once they actually follow a club, so it can never be a
            // filter that only ever returns nothing.
            ...(followedClubIds.size > 0
              ? [
                  {
                    value: "following",
                    label: "Following",
                    icon: Heart,
                    active: followingOnly,
                    onToggle: toggleFollowing,
                  },
                ]
              : []),
          ]}
          filterGroups={[
            {
              id: "type",
              label: "Type",
              mode: "multi",
              options: TYPE_OPTIONS,
              selected: selectedTypes,
              onChange: setSelectedTypes,
            },
          ]}
          sort={{
            value: sortOption,
            onChange: (v) => setSortOption(v as OpportunitySort),
            options: SORT_OPTIONS,
            label: "Sort roles",
          }}
          view={view}
          onViewChange={setView}
        />

        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
                  <Skeleton className="size-[46px] shrink-0 rounded-[11px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="mt-4 h-9 w-full rounded-pill" />
                  </div>
                </div>
              ))}
            </div>
          ) : opportunitiesQuery.isError ? (
            // A failed load is NOT an empty board. Checked before the empty
            // branch so a network hiccup can never render "No open roles right
            // now" — which would be the app confidently telling a student that
            // no club on campus is recruiting.
            <ErrorState
              noun="the roles"
              onRetry={() => opportunitiesQuery.refetch()}
              isRetrying={opportunitiesQuery.isFetching}
            />
          ) : needsAccountToSave ? (
            <SignInToSaveState noun="roles" />
          ) : (
            <div
              aria-busy={isReordering}
              className={cn(
                "transition-opacity duration-base ease-zh",
                isReordering && "pointer-events-none opacity-60",
              )}
            >
              {/* Hidden at zero: the empty state directly below says it
                  better, and "0 roles" above it is just the same
                  bad news twice. */}
              {filteredOpportunities.length > 0 && (
                <p className="mb-5 text-sm text-ink-3">
                  <span className="font-data text-ink-2">{filteredOpportunities.length}</span>{" "}
                  {filteredOpportunities.length === 1 ? "role" : "roles"}
                  {savedOnly ? " saved" : ""}
                  {followingOnly ? " from clubs you follow" : ""}
                  {selectedTypes.length === 1
                    ? ` in ${TYPE_OPTIONS.find((t) => t.value === selectedTypes[0])?.label}`
                    : selectedTypes.length > 1
                      ? ` across ${selectedTypes.length} types`
                      : ""}
                </p>
              )}

              {filteredOpportunities.length > 0 ? (
                view === "cards" ? (
                  <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredOpportunities.map((opportunity) => (
                      <OpportunityCard
                        key={opportunity.id}
                        id={opportunity.id}
                        title={opportunity.title}
                        clubName={opportunity.club_profiles?.club_name || "Unknown club"}
                        clubLogo={opportunity.club_profiles?.logo_url || undefined}
                        type={opportunity.type}
                        deadline={`Due ${formatDeadline(opportunity.deadline)}`}
                        deadlineAt={opportunity.deadline}
                        applicants={opportunity.applications_count}
                        showApplicants={opportunity.show_application_count ?? false}
                        isBookmarked={isBookmarked(opportunity.id)}
                        onBookmark={() => toggleBookmark(opportunity.id)}
                        hasApplied={appliedOpportunityIds.has(opportunity.id)}
                        isApplicationStatePending={isApplicationStatePending}
                        viewOnly={isViewOnly}
                      />
                    ))}
                  </div>
                ) : (
                  <DiscoverList rows={listRows} />
                )
              ) : (
                /* The empty state describes the QUERY, never the product's stage. */
                !hasFilters ? (
                  /* Nothing open anywhere — which is launch day. Its own
                     component because Events needs the identical thing, and
                     because it reads the live club count (UX17a). */
                  <NothingYetState kind="roles" />
                ) : (
                  <EmptyState
                    title={followingOnly ? "Quiet from your clubs —" : "Nothing matches that yet —"}
                    signature={
                      followingOnly ? "the rest of campus is open." : "try a wider net."
                    }
                    body={
                      savedOnly
                        ? "You haven't saved any roles yet. Save one from a card and it'll wait for you here."
                        : followingOnly
                          ? "The clubs you follow have nothing open right now. New postings from them show up here first."
                          : "No roles match those filters. Clearing them shows everything that's open."
                    }
                    actions={
                      <Button variant="outline" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </RoleBasedLayout>
  );
}
