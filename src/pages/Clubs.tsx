import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";

import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { FilterChip } from "@/components/discover/FilterChip";
import { EmptyState } from "@/components/discover/EmptyState";
import { ErrorState } from "@/components/discover/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ClubCard, type ClubCardData as Club } from "@/components/clubs/ClubCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLUB_CATEGORIES } from "@/lib/constants";
import { clubKeys, eventKeys, opportunityKeys, EMPTY_COUNT_MAP } from "@/lib/queryKeys";
import {
  fetchAllClubsPublic,
  fetchOpenOpportunityCountsByClub,
  fetchUpcomingEventCountsByClub,
} from "@/lib/queryFns";

type SortOption = "name-asc" | "name-desc" | "most-active";

/** Module-level so the fallback identity is stable — `?? []` allocates a new
 *  array every render and busts every useMemo below, silently cancelling the
 *  caching win this migration exists to deliver. */
const EMPTY_CLUBS: Club[] = [];

export default function ClubsPage() {
  // Genuine UI state. None of it may enter a query key: putting `searchQuery`
  // in the key would turn every keystroke into a 725-row network round trip.
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");

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

  const categories = useMemo(() => {
    const used = new Set(clubs.map((c) => c.category).filter(Boolean) as string[]);
    return [
      { value: "all", label: "All" },
      ...CLUB_CATEGORIES.filter((c) => used.has(c)).map((c) => ({ value: c, label: c })),
    ];
  }, [clubs]);

  const filteredAndSortedClubs = useMemo(() => {
    const result = clubs.filter((club) => {
      const matchesSearch =
        club.club_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (club.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesCategory = selectedCategory === "all" || club.category === selectedCategory;
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
  }, [clubs, searchQuery, selectedCategory, sortBy]);

  const recruitingCount = clubs.filter((c) => c.opportunity_count > 0).length;
  const hasFilters = searchQuery !== "" || selectedCategory !== "all";

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

        <div className="sticky top-[60px] z-40 border-b border-line bg-surface">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <label htmlFor="clubs-search" className="sr-only">
                  Search clubs by name or description
                </label>
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
                />
                <Input
                  id="clubs-search"
                  type="search"
                  placeholder="Search clubs…"
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

              <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
                <SelectTrigger className="w-full md:w-[190px]" aria-label="Sort clubs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name A–Z</SelectItem>
                  <SelectItem value="name-desc">Name Z–A</SelectItem>
                  <SelectItem value="most-active">Most active</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {categories.length > 1 && (
              <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {categories.map((category) => (
                  <FilterChip
                    key={category.value}
                    active={selectedCategory === category.value}
                    onClick={() => setSelectedCategory(category.value)}
                  >
                    {category.label}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedClubs.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={hasFilters ? "No clubs match that —" : "No clubs yet —"}
              signature={hasFilters ? "try a wider search." : "check back soon."}
              body={
                hasFilters
                  ? "Nothing here matches those filters. Clearing them shows every club."
                  : "Clubs are being onboarded. Roles and events appear here as they join."
              }
              actions={
                hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="outline" asChild>
                    <Link to="/opportunities">Browse roles</Link>
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
