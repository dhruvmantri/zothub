import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Bookmark, Heart } from "lucide-react";
import { isAfter, isBefore, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { EventCard } from "@/components/cards/OpportunityCard";
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
import { formatDate, formatTime } from "@/lib/formatters";
import { useAuth } from "@/contexts/AuthContext";
import { useBookmarks } from "@/hooks/useBookmarks";
import { eventKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  capacity: number | null;
  banner_url: string | null;
  club_id: string;
  club_profiles: {
    club_name: string;
    logo_url: string | null;
  };
  /** Maintained by a database trigger (O5-counts). CONFIRMED RSVPs only, which
   *  matches `enforce_rsvp_capacity` — the authority on who holds a seat.
   *  Replaces counting an embedded `rsvps` array that RLS filtered to the
   *  viewer's own rows, so "spots left" was computed from 0 for a logged-out
   *  visitor: a FULL event advertised every seat as still available. */
  confirmed_rsvps_count: number;
}

/** Module-level so the fallback identity is stable. `data ?? []` allocates a
 *  fresh array every render, which busts the filter memo below and silently
 *  cancels the caching win this migration exists to deliver (contract T5). */
const EMPTY_EVENTS: EventRow[] = [];
/** Same reason, for the date-window selection. */
const NO_WINDOW: string[] = [];

export type EventSort = "soonest" | "popular";

const SORT_OPTIONS = [
  { value: "soonest", label: "Soonest first" },
  { value: "popular", label: "Most popular" },
] as const;

/**
 * The upcoming-events read.
 *
 * Events gained a sort on 2026-09-21 (maintainer decision), and it is applied
 * by the DATABASE with the choice in the query key — which is precisely what
 * contract O3 reserved. The query is capped at 50 rows, so the order decides
 * WHICH 50 come back: "most popular" has to mean the 50 best-attended events
 * on campus, not the best-attended among the next 50 by date. A client sort
 * would have been instant and wrong.
 *
 * `now` is computed HERE, inside the fetcher, and never enters the query key
 * (contract T1). A key containing a fresh `new Date().toISOString()` is unique
 * on every render: permanent cache miss, a request per render, and the page
 * still looks completely correct.
 *
 * It THROWS rather than logging and returning (contract T2). supabase-js
 * RESOLVES with `{data, error}`, so copying the old
 * `if (error) { console.error(); return; }` shape would cache `undefined` as a
 * SUCCESSFUL result for 60 seconds — no retry, no error state, and an empty
 * page that confidently claims there are no events. No toast in here either
 * (T8): with `retry: 1` it would fire twice per failure and again on every
 * background refetch. Failure is surfaced from render, via `isError`.
 */
async function fetchUpcomingEvents(sort: EventSort): Promise<EventRow[]> {
  const now = new Date().toISOString();
  let query = supabase
    .from("events")
    .select(`
      id,
      title,
      description,
      event_date,
      location,
      capacity,
      banner_url,
      club_id,
      confirmed_rsvps_count,
      club_profiles (
        club_name,
        logo_url
      )
    `)
    .eq("is_active", true)
    .gte("event_date", now);

  if (sort === "popular") {
    query = query.order("confirmed_rsvps_count", { ascending: false });
  }
  // Also the tiebreak for "most popular": two equally-attended events are
  // ordered by which happens first, which is the only answer a student cares
  // about. It doubles as the whole ordering for "soonest first".
  query = query.order("event_date", { ascending: true });

  const { data, error } = await query.limit(50);

  if (error) throw new Error(`Failed to load events: ${error.message}`);
  return data ?? [];
}

/**
 * The date windows are SINGLE-select, unlike the role types on Opportunities.
 * "This week" is contained in "This month", so ticking both is meaningless —
 * the intersection is always the narrower one and the union always the wider.
 */
const WHEN_OPTIONS = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
] as const;

/**
 * Events is a pre-filtered entry point into the one discovery surface
 * (Structure §2) — same card, same toolbar, same view toggle as Opportunities,
 * with the mono date chip doing the work of telling you it is an event.
 */
export default function EventsPage() {
  const { user, role } = useAuth();
  // See the note in Opportunities.tsx — a club browses, it does not act.
  const isViewOnly = role === "club";
  const { isBookmarked, toggleBookmark } = useBookmarks("event");
  const { bookmarkedIds: followedClubIds } = useBookmarks("club");
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [followingOnly, setFollowingOnly] = useState(
    searchParams.get("filter") === "following",
  );
  const [dateWindow, setDateWindow] = useState<string[]>(NO_WINDOW);
  const [sortOption, setSortOption] = useState<EventSort>("soonest");
  const [view, setView] = useDiscoverView("discover");

  // The SORT is in the key; the search box and the filters are not. Putting
  // `searchQuery` in the key would turn every keystroke into a network round
  // trip. Filtering stays client-side over the cached rows, which is what makes
  // it instant — and unlike the sort it is safe there, because filtering can
  // only narrow the rows already in hand.
  const eventsQuery = useQuery({
    queryKey: eventKeys.upcomingSorted(sortOption),
    queryFn: () => fetchUpcomingEvents(sortOption),
    // Switching sort is a network round trip. Without this the page drops back
    // to six grey skeletons for what reads as a local re-ordering.
    placeholderData: keepPreviousData,
  });

  const events = eventsQuery.data ?? EMPTY_EVENTS;
  /** True while a newly-chosen sort is still in flight and the rows on screen
   *  are the PREVIOUS order. */
  const isReordering = eventsQuery.isPlaceholderData;

  // `isPending`, not `isFetching`: with a warm cache this is false immediately,
  // so the skeleton never reappears on a background refetch. That is the UX1
  // fix — gating on `isFetching` would reintroduce it in a new form.
  const isLoading = eventsQuery.isPending;

  const toggleFollowing = () => {
    const next = !followingOnly;
    setFollowingOnly(next);
    if (next) setSearchParams({ filter: "following" }, { replace: true });
    else if (searchParams.has("filter")) setSearchParams({}, { replace: true });
  };

  const filteredEvents = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    const window = dateWindow[0];
    return events.filter((event) => {
      const clubName = event.club_profiles?.club_name || "";
      const matchesSearch =
        event.title.toLowerCase().includes(needle) || clubName.toLowerCase().includes(needle);
      if (!matchesSearch) return false;
      if (savedOnly && !isBookmarked(event.id)) return false;
      if (followingOnly && !followedClubIds.has(event.club_id)) return false;

      if (window) {
        const eventDate = new Date(event.event_date);
        const now = new Date();
        if (window === "week") {
          return isAfter(eventDate, startOfWeek(now)) && isBefore(eventDate, endOfWeek(now));
        }
        if (window === "month") {
          return isAfter(eventDate, startOfMonth(now)) && isBefore(eventDate, endOfMonth(now));
        }
      }
      return true;
    });
    // No `.sort()` here on purpose — the order arrives from the database.
  }, [events, searchQuery, savedOnly, followingOnly, dateWindow, isBookmarked, followedClubIds]);

  const hasFilters = searchQuery !== "" || savedOnly || followingOnly || dateWindow.length > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setSavedOnly(false);
    setDateWindow(NO_WINDOW);
    if (followingOnly) toggleFollowing();
  };

  // A signed-out visitor tapping "Saved" cannot have saved anything, so the
  // ordinary empty state ("you haven't saved any events yet") would blame them
  // for not doing something they were never able to do. Maintainer decision,
  // 2026-09-19 — see docs/BACKLOG.md UX22.
  const needsAccountToSave = savedOnly && !user;

  const listRows: DiscoverListRow[] = filteredEvents.map((event) => ({
    id: event.id,
    href: `/events/${event.id}`,
    title: event.title,
    meta: `${formatDate(event.event_date)} · ${formatTime(event.event_date)}${
      event.location ? ` · ${event.location}` : ""
    }`,
    tag: { label: "Event" },
    clubId: event.club_id,
    clubName: event.club_profiles?.club_name || "Unknown club",
    clubLogo: event.club_profiles?.logo_url,
    saved: isViewOnly ? undefined : isBookmarked(event.id),
    onSave: isViewOnly ? undefined : () => toggleBookmark(event.id),
    action: isViewOnly ? { label: "View" } : { label: "RSVP" },
  }));

  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto px-4 py-9">
            <h1 className="text-[clamp(30px,4vw,40px)] font-medium tracking-[-0.03em] text-ink">
              Events
            </h1>
            <p className="mt-2 max-w-2xl text-ink-2">
              Workshops, socials and info sessions from UCI clubs.
            </p>
          </div>
        </div>

        <DiscoverToolbar
          searchId="events-search"
          searchLabel="Search events by title or club"
          searchPlaceholder="Search events or clubs…"
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          scopes={[
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
              id: "when",
              label: "When",
              mode: "single",
              options: WHEN_OPTIONS,
              selected: dateWindow,
              onChange: setDateWindow,
            },
          ]}
          sort={{
            value: sortOption,
            onChange: (v) => setSortOption(v as EventSort),
            options: SORT_OPTIONS,
            label: "Sort events",
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
          ) : eventsQuery.isError ? (
            // A failed load is NOT an empty calendar. Checked before the empty
            // branch so a network hiccup can never render "No events coming up".
            <ErrorState
              noun="the events"
              onRetry={() => eventsQuery.refetch()}
              isRetrying={eventsQuery.isFetching}
            />
          ) : needsAccountToSave ? (
            <SignInToSaveState noun="events" />
          ) : (
            <div
              aria-busy={isReordering}
              className={cn(
                "transition-opacity duration-base ease-zh",
                isReordering && "pointer-events-none opacity-60",
              )}
            >
              {/* Hidden at zero: the empty state directly below says it
                  better, and "0 events" above it is just the same
                  bad news twice. */}
              {filteredEvents.length > 0 && (
                <p className="mb-5 text-sm text-ink-3">
                  <span className="font-data text-ink-2">{filteredEvents.length}</span>{" "}
                  {filteredEvents.length === 1 ? "event" : "events"}
                  {savedOnly ? " saved" : ""}
                  {followingOnly ? " from clubs you follow" : ""}
                  {dateWindow[0]
                    ? ` ${WHEN_OPTIONS.find((w) => w.value === dateWindow[0])?.label.toLowerCase()}`
                    : ""}
                </p>
              )}

              {filteredEvents.length > 0 ? (
                view === "cards" ? (
                  <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        id={event.id}
                        title={event.title}
                        clubName={event.club_profiles?.club_name || "Unknown club"}
                        clubLogo={event.club_profiles?.logo_url || undefined}
                        eventDate={event.event_date}
                        location={event.location || ""}
                        attendees={event.confirmed_rsvps_count}
                        capacity={event.capacity ?? undefined}
                        isBookmarked={isBookmarked(event.id)}
                        onBookmark={() => toggleBookmark(event.id)}
                        viewOnly={isViewOnly}
                      />
                    ))}
                  </div>
                ) : (
                  <DiscoverList rows={listRows} />
                )
              ) : (
                !hasFilters ? (
                  /* It used to say "roles are open though" and link to the
                     roles list. After the test-data purge there are none —
                     two empty pages promising each other (UX17a). */
                  <NothingYetState kind="events" />
                ) : (
                  <EmptyState
                    title={followingOnly ? "Quiet from your clubs —" : "Nothing on that date —"}
                    signature={
                      followingOnly ? "the rest of campus is busy." : "try a wider window."
                    }
                    body={
                      savedOnly
                        ? "You haven't saved any events yet. Save one from a card and it'll wait for you here."
                        : followingOnly
                          ? "The clubs you follow have nothing scheduled. Their next event shows up here first."
                          : "No events fall in that window. Clearing the filter shows everything upcoming."
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
