import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Bookmark, Heart } from "lucide-react";

import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { OpportunityCard } from "@/components/cards/OpportunityCard";
import { DiscoverList, type DiscoverListRow } from "@/components/discover/DiscoverList";
import { FilterChip } from "@/components/discover/FilterChip";
import { EmptyState } from "@/components/discover/EmptyState";
import { ErrorState } from "@/components/discover/ErrorState";
import { SignInToSaveState } from "@/components/discover/SignInToSaveState";
import { ViewToggle, useDiscoverView } from "@/components/discover/ViewToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatDeadline, normalizeOpportunityType, opportunityTypeLabel } from "@/lib/formatters";
import { OPPORTUNITY_TYPES } from "@/lib/constants";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useStudentProfileId } from "@/hooks/useStudentProfileId";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAppliedOpportunityIds } from "@/lib/queryFns";
import { applicationKeys, opportunityKeys, EMPTY_ID_SET } from "@/lib/queryKeys";

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

/**
 * The open-roles read.
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
async function fetchOpportunitiesList(): Promise<OpportunityRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
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
    .or(`deadline.is.null,deadline.gte.${now}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to load opportunities: ${error.message}`);
  return data ?? [];
}

/** Module-level, so TanStack can memoise the derived Set. An inline arrow would
 *  build a new Set on every render and bust every memo that depends on it. */
const selectAppliedIdSet = (ids: string[]): Set<string> => new Set(ids);

/**
 * Categories are the six real opportunity types plus All, Saved and Following.
 * The old list hard-coded four and the formatter silently coerced the other two
 * to "volunteer", so Committee and Other postings were both unfilterable and
 * mislabelled (Structure §3).
 *
 * "Following" is what used to be the separate /student/feed destination
 * (maintainer decision, 2026-07-25). A feed of clubs you follow is a *filter on
 * discovery*, not a fifth place to look — same cards, same sort, same actions.
 * The chip only exists once you actually follow a club, so it can never be a
 * filter that only ever returns nothing.
 */
const BASE_CATEGORIES = OPPORTUNITY_TYPES.map((t) => ({ value: t.value, label: t.label }));

type SortOption = "newest" | "deadline" | "popular";

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const { studentProfileId, isLoading: isStudentProfileLoading } = useStudentProfileId();
  const { isBookmarked, toggleBookmark } = useBookmarks("opportunity");
  const { bookmarkedIds: followedClubIds } = useBookmarks("club");
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    // /student/feed redirects here, so an old bookmark still lands on the
    // student's followed clubs instead of a 404.
    searchParams.get("filter") === "following" ? "following" : "all",
  );
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [view, setView] = useDiscoverView("discover");

  // None of the UI state above may enter the key: putting `searchQuery` in it
  // would turn every keystroke into a network round trip. Filtering and sorting
  // stay client-side over the cached rows, which is what makes them instant.
  const opportunitiesQuery = useQuery({
    queryKey: opportunityKeys.list(),
    queryFn: fetchOpportunitiesList,
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

  const selectCategory = (value: string) => {
    setSelectedCategory(value);
    // Only "following" is worth keeping in the URL — it is the one filter a
    // student arrives at by link rather than by tapping a chip.
    if (value === "following") setSearchParams({ filter: "following" }, { replace: true });
    else if (searchParams.has("filter")) setSearchParams({}, { replace: true });
  };

  const categories = useMemo(
    () => [
      { value: "all", label: "All" },
      ...(followedClubIds.size > 0
        ? [{ value: "following", label: "Following" }]
        : []),
      { value: "saved", label: "Saved" },
      ...BASE_CATEGORIES,
    ],
    [followedClubIds],
  );

  const filteredOpportunities = useMemo(() => {
    return opportunities
      .filter((opp) => {
        const clubName = opp.club_profiles?.club_name || "";
        const matchesSearch =
          opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          clubName.toLowerCase().includes(searchQuery.toLowerCase());

        if (selectedCategory === "saved") {
          return matchesSearch && isBookmarked(opp.id);
        }

        if (selectedCategory === "following") {
          return matchesSearch && followedClubIds.has(opp.club_id);
        }

        const matchesCategory =
          selectedCategory === "all" ||
          normalizeOpportunityType(opp.type) === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        switch (sortOption) {
          case "deadline":
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          case "popular":
            // Reads the trigger-maintained counter. Sorting on the embedded
            // array made "Most applied to" a no-op for logged-out visitors —
            // every row was 0, so the order never changed.
            return b.applications_count - a.applications_count;
          case "newest":
          default:
            return 0;
        }
      });
  }, [opportunities, searchQuery, selectedCategory, sortOption, isBookmarked, followedClubIds]);

  const activeCategory = categories.find((c) => c.value === selectedCategory);
  const hasFilters = searchQuery !== "" || selectedCategory !== "all";

  // A signed-out visitor tapping "Saved" cannot have saved anything, so the
  // ordinary empty state would blame them for not doing something they were
  // never able to do. Maintainer decision, 2026-09-19 — docs/BACKLOG.md UX22.
  const needsAccountToSave = selectedCategory === "saved" && !user;

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
      saved: isBookmarked(opp.id),
      onSave: () => toggleBookmark(opp.id),
      action: applied
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
              Discover
            </h1>
            <p className="mt-2 max-w-2xl text-ink-2">
              Roles and events from UCI clubs — find one, apply, show up.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="sticky top-[60px] z-40 border-b border-line bg-surface">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <label htmlFor="discover-search" className="sr-only">
                  Search roles by title or club
                </label>
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
                />
                <Input
                  id="discover-search"
                  type="search"
                  placeholder="Search roles or clubs…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-11"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-pill text-ink-3 hover:bg-surface-3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                  <SelectTrigger className="w-full md:w-[190px]" aria-label="Sort roles">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="deadline">Closing soonest</SelectItem>
                    <SelectItem value="popular">Most applied to</SelectItem>
                  </SelectContent>
                </Select>
                <ViewToggle view={view} onChange={setView} className="hidden sm:inline-flex" />
              </div>
            </div>

            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {categories.map((category) => (
                <FilterChip
                  key={category.value}
                  active={selectedCategory === category.value}
                  onClick={() => selectCategory(category.value)}
                >
                  {category.value === "saved" && <Bookmark className="size-3.5" aria-hidden />}
                  {category.value === "following" && <Heart className="size-3.5" aria-hidden />}
                  {category.label}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>

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
            <>
              <p className="mb-5 text-sm text-ink-3">
                <span className="font-data text-ink-2">{filteredOpportunities.length}</span>{" "}
                {filteredOpportunities.length === 1 ? "role" : "roles"}
                {selectedCategory === "following"
                  ? " from clubs you follow"
                  : selectedCategory === "saved"
                    ? " saved"
                    : selectedCategory !== "all" && activeCategory
                      ? ` in ${activeCategory.label}`
                      : ""}
              </p>

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
                      />
                    ))}
                  </div>
                ) : (
                  <DiscoverList rows={listRows} />
                )
              ) : (
                /* The empty state describes the QUERY, never the product's stage. */
                <EmptyState
                  title={
                    selectedCategory === "following"
                      ? "Quiet from your clubs —"
                      : hasFilters
                        ? "Nothing matches that yet —"
                        : "No open roles right now —"
                  }
                  signature={
                    selectedCategory === "following"
                      ? "the rest of campus is open."
                      : hasFilters
                        ? "try a wider net."
                        : "events are worth a look."
                  }
                  body={
                    hasFilters
                      ? selectedCategory === "saved"
                        ? "You haven't saved any roles yet. Save one from a card and it'll wait for you here."
                        : selectedCategory === "following"
                          ? "The clubs you follow have nothing open right now. New postings from them show up here first."
                          : "No roles match those filters. Clearing them shows everything that's open."
                      : "Clubs post roles throughout the term. Following a club puts its new postings in front of you."
                  }
                  actions={
                    hasFilters ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery("");
                          selectCategory("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button variant="outline" asChild>
                        <Link to="/clubs">Browse clubs</Link>
                      </Button>
                    )
                  }
                />
              )}
            </>
          )}
        </div>
      </div>
    </RoleBasedLayout>
  );
}
