import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { DiscoverToolbar } from "@/components/discover/DiscoverToolbar";
import { EmptyState } from "@/components/discover/EmptyState";
import { ErrorState } from "@/components/discover/ErrorState";
import { useDiscoverView } from "@/components/discover/ViewToggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubCard, type ClubCardData as Club } from "@/components/clubs/ClubCard";
import { ClubList } from "@/components/clubs/ClubList";
import { CLUB_CATEGORIES } from "@/lib/constants";
import { clubKeys, eventKeys, opportunityKeys, EMPTY_COUNT_MAP } from "@/lib/queryKeys";
import {
  fetchAllClubsPublic,
  fetchOpenOpportunityCountsByClub,
  fetchUpcomingEventCountsByClub,
} from "@/lib/queryFns";

type SortOption = "name-asc" | "name-desc" | "most-active";

const SORT_OPTIONS = [
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "most-active", label: "Most active" },
] as const;

/** Module-level so the fallback identity is stable — `?? []` allocates a new
 *  array every render and busts every useMemo below, silently cancelling the
 *  caching win this migration exists to deliver. */
const EMPTY_CLUBS: Club[] = [];
/** Same reason: a fresh `[]` default for the category selection would change
 *  identity every render and bust the filter memo. */
const NO_CATEGORIES: string[] = [];

export default function ClubsPage() {
  // Genuine UI state. None of it may enter a query key: putting `searchQuery`
  // in the key would turn every keystroke into a 725-row network round trip.
  //
  // The sort stays CLIENT-side here, unlike Opportunities and Events. That is
  // not an inconsistency: `get_all_clubs_public` returns every club in one
  // call with no cap, so re-ordering in the browser sees the whole set and is
  // always correct. The other two pages cap at 50 rows, which is exactly why
  // their sort had to move to the database (contract O3).
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(NO_CATEGORIES);
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [view, setView] = useDiscoverView("clubs");

  /** How many clubs are DRAWN at once. Search, filters and sort still run over
   *  all 725 — only the rendering is paged, so nothing becomes unfindable.
   *  (Maintainer decision, 2026-09-21.) Rendering the lot cost 12,454 DOM nodes
   *  and a page 60,640px tall, which old phones do not enjoy. */
  const CLUBS_PER_PAGE = 60;
  const [shownCount, setShownCount] = useState(CLUBS_PER_PAGE);

  const clubsQuery = useQuery({
    queryKey: clubKeys.list(),
    queryFn: fetchAllClubsPublic,
  });

  // Deliberately two queries rather than one merged read: if the counts fail,
  // the directory still renders (undecorated) instead of going blank. That
  // tolerance is the existing behaviour and is preserved here — a single merged
  // fetcher would have had to swallow errors to keep it, which reintroduces the
  // "permanently successful query" bug this migration is trying to avoid.
  const oppCountsQuery = useQuery({
    queryKey: opportunityKeys.countsByClub(),
    queryFn: fetchOpenOpportunityCountsByClub,
  });
  const eventCountsQuery = useQuery({
    queryKey: eventKeys.countsByClub(),
    queryFn: fetchUpcomingEventCountsByClub,
  });

  const clubs = useMemo<Club[]>(() => {
    const rows = clubsQuery.data;
    if (!rows) return EMPTY_CLUBS;
    const opps = oppCountsQuery.data ?? EMPTY_COUNT_MAP;
    const events = eventCountsQuery.data ?? EMPTY_COUNT_MAP;
    return rows.map((club) => ({
      ...club,
      opportunity_count: opps[club.id] ?? 0,
      event_count: events[club.id] ?? 0,
    }));
  }, [clubsQuery.data, oppCountsQuery.data, eventCountsQuery.data]);

  // `isPending`, not `isFetching`: with a warm cache this is false immediately,
  // so the skeleton never reappears on a background refetch. Gating on
  // `isFetching` would reintroduce UX1 in a new form.
  const isLoading = clubsQuery.isPending;

  // Only the categories some club actually uses, so the menu can never offer a
  // filter that returns nothing.
  const categoryOptions = useMemo(() => {
    const used = new Set(clubs.map((c) => c.category).filter(Boolean) as string[]);
    return CLUB_CATEGORIES.filter((c) => used.has(c)).map((c) => ({ value: c, label: c }));
  }, [clubs]);

  const filteredAndSortedClubs = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    const result = clubs.filter((club) => {
      const matchesSearch =
        club.club_name.toLowerCase().includes(needle) ||
        (club.description?.toLowerCase().includes(needle) ?? false);
      // An empty selection means "every category", not "no category".
      const matchesCategory =
        selectedCategories.length === 0 ||
        (club.category !== null && selectedCategories.includes(club.category));
      return matchesSearch && matchesCategory;
    });

    switch (sortBy) {
      case "name-asc":
        result.sort((a, b) => a.club_name.localeCompare(b.club_name));
        break;
      case "name-desc":
        result.sort((a, b) => b.club_name.localeCompare(a.club_name));
        break;
      case "most-active":
        result.sort(
          (a, b) =>
            b.opportunity_count + b.event_count - (a.opportunity_count + a.event_count),
        );
        break;
    }

    return result;
  }, [clubs, searchQuery, selectedCategories, sortBy]);

  const recruitingCount = clubs.filter((c) => c.opportunity_count > 0).length;
  // Narrowing the search while scrolled deep into "load more" would otherwise
  // leave a page-2 window over a 3-result list.
  useEffect(() => {
    setShownCount(CLUBS_PER_PAGE);
  }, [searchQuery, selectedCategories, sortBy]);

  const visibleClubs = filteredAndSortedClubs.slice(0, shownCount);
  const remaining = filteredAndSortedClubs.length - visibleClubs.length;

  const hasFilters = searchQuery !== "" || selectedCategories.length > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategories(NO_CATEGORIES);
  };

  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto px-4 py-9">
            <h1 className="text-[clamp(30px,4vw,40px)] font-medium tracking-[-0.03em] text-ink">
              Clubs
            </h1>
            {/* Honest asymmetry: most clubs are not recruiting at any given
                moment, and saying so is more useful than implying they all are. */}
            <p className="mt-2 text-ink-2">
              <span className="font-data">{clubs.length}</span>{" "}
              {clubs.length === 1 ? "club" : "clubs"} ·{" "}
              <span className="font-data">{recruitingCount}</span> recruiting right now
            </p>
          </div>
        </div>

        <DiscoverToolbar
          searchId="clubs-search"
          searchLabel="Search clubs by name or description"
          searchPlaceholder="Search clubs…"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterGroups={[
            {
              id: "category",
              label: "Category",
              mode: "multi",
              options: categoryOptions,
              selected: selectedCategories,
              onChange: setSelectedCategories,
            },
          ]}
          sort={{
            value: sortBy,
            onChange: (v) => setSortBy(v as SortOption),
            options: SORT_OPTIONS,
            label: "Sort clubs",
          }}
          view={view}
          onViewChange={setView}
        />

        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-line bg-surface p-5">
                  <Skeleton className="size-[52px] shrink-0 rounded-[13px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3.5 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : clubsQuery.isError ? (
            // A failed load is NOT an empty directory. Checked before the
            // empty branch so a network failure can never render "No clubs yet".
            <ErrorState
              noun="the clubs"
              onRetry={() => clubsQuery.refetch()}
              isRetrying={clubsQuery.isFetching}
            />
          ) : filteredAndSortedClubs.length > 0 ? (
            <>
              {/* Only once something is actually filtered. The header above
                  already states the unfiltered total, and printing "725 clubs"
                  twice on one screen reads as a mistake. Opportunities and
                  Events have no count in their header, so theirs always
                  shows. */}
              {hasFilters && (
                <p className="mb-5 text-sm text-ink-3">
                  <span className="font-data text-ink-2">{filteredAndSortedClubs.length}</span>{" "}
                  {filteredAndSortedClubs.length === 1 ? "club" : "clubs"} matching
                </p>
              )}
              {view === "cards" ? (
                <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {visibleClubs.map((club) => (
                    <ClubCard key={club.id} club={club} />
                  ))}
                </div>
              ) : (
                <ClubList clubs={visibleClubs} />
              )}

              {remaining > 0 && (
                <div className="mt-8 flex flex-col items-center gap-3">
                  <p className="text-sm text-ink-3">
                    Showing <span className="font-data text-ink-2">{visibleClubs.length}</span> of{" "}
                    <span className="font-data text-ink-2">{filteredAndSortedClubs.length}</span> clubs
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setShownCount((n) => n + CLUBS_PER_PAGE)}
                  >
                    Show {Math.min(remaining, CLUBS_PER_PAGE)} more
                  </Button>
                </div>
              )}
            </>
          ) : (
            /* UX17b. The unfiltered branch used to read "No clubs yet —
               check back soon" + "Clubs are being onboarded… as they join":
               three separate descriptions of the product's STAGE, which the
               design system forbids outright (Foundation rule 2).
               It is also all but unreachable — there are 722 clubs — so an
               empty directory is not a young product, it is something having
               gone wrong. The copy now says that, and offers the retry. */
            <EmptyState
              title={hasFilters ? "No clubs match that —" : "No clubs to show —"}
              signature={hasFilters ? "try a wider search." : "that's unusual."}
              body={
                hasFilters
                  ? "Nothing here matches those filters. Clearing them shows every club."
                  : "The directory came back empty, which shouldn't happen. Trying again normally sorts it."
              }
              actions={
                hasFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => clubsQuery.refetch()}
                    disabled={clubsQuery.isFetching}
                  >
                    {clubsQuery.isFetching ? "Trying…" : "Try again"}
                  </Button>
                )
              }
            />
          )}
        </div>
      </div>
    </RoleBasedLayout>
  );
}
