import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, Bookmark, Heart } from "lucide-react";
import { isAfter, isBefore, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { EventCard } from "@/components/cards/OpportunityCard";
import { DiscoverList, type DiscoverListRow } from "@/components/discover/DiscoverList";
import { FilterChip } from "@/components/discover/FilterChip";
import { EmptyState } from "@/components/discover/EmptyState";
import { ViewToggle, useDiscoverView } from "@/components/discover/ViewToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDate, formatTime } from "@/lib/formatters";
import { useBookmarks } from "@/hooks/useBookmarks";

interface Event {
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
  rsvps: { id: string }[];
}

/** "Following" is inserted after All when the student actually follows a club. */
const BASE_FILTERS = [
  { value: "saved", label: "Saved" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

/**
 * Events is a pre-filtered entry point into the one discovery surface
 * (Structure §2) — same card, same chips, same view toggle as Discover, with
 * the mono date chip doing the work of telling you it is an event.
 */
export default function EventsPage() {
  const { isBookmarked, toggleBookmark } = useBookmarks("event");
  const { bookmarkedIds: followedClubIds } = useBookmarks("club");
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDateFilter, setSelectedDateFilter] = useState(
    searchParams.get("filter") === "following" ? "following" : "all",
  );
  const [view, setView] = useDiscoverView("discover");

  useEffect(() => {
    fetchEvents();
  }, []);

  const selectFilter = (value: string) => {
    setSelectedDateFilter(value);
    if (value === "following") setSearchParams({ filter: "following" }, { replace: true });
    else if (searchParams.has("filter")) setSearchParams({}, { replace: true });
  };

  const dateFilters = useMemo(
    () => [
      { value: "all", label: "All" },
      ...(followedClubIds.size > 0 ? [{ value: "following", label: "Following" }] : []),
      ...BASE_FILTERS,
    ],
    [followedClubIds],
  );

  const fetchEvents = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
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
          club_profiles (
            club_name,
            logo_url
          ),
          rsvps (
            id
          )
        `)
        .eq("is_active", true)
        .gte("event_date", now)
        .order("event_date", { ascending: true })
        .limit(50);

      if (error) {
        console.error("Error fetching events:", error);
        toast.error("Failed to load events");
        return;
      }

      setEvents(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const clubName = event.club_profiles?.club_name || "";
      const matchesSearch =
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clubName.toLowerCase().includes(searchQuery.toLowerCase());

      if (selectedDateFilter === "saved") {
        return matchesSearch && isBookmarked(event.id);
      }

      if (selectedDateFilter === "following") {
        return matchesSearch && followedClubIds.has(event.club_id);
      }

      const eventDate = new Date(event.event_date);
      const now = new Date();
      let matchesDate = true;

      switch (selectedDateFilter) {
        case "week":
          matchesDate = isAfter(eventDate, startOfWeek(now)) && isBefore(eventDate, endOfWeek(now));
          break;
        case "month":
          matchesDate =
            isAfter(eventDate, startOfMonth(now)) && isBefore(eventDate, endOfMonth(now));
          break;
        default:
          matchesDate = true;
      }

      return matchesSearch && matchesDate;
    });
  }, [events, searchQuery, selectedDateFilter, isBookmarked, followedClubIds]);

  const hasFilters = searchQuery !== "" || selectedDateFilter !== "all";

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
    saved: isBookmarked(event.id),
    onSave: () => toggleBookmark(event.id),
    action: { label: "RSVP" },
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

        <div className="sticky top-[60px] z-40 border-b border-line bg-surface">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <label htmlFor="events-search" className="sr-only">
                  Search events by title or club
                </label>
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
                />
                <Input
                  id="events-search"
                  type="search"
                  placeholder="Search events or clubs…"
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
              <ViewToggle view={view} onChange={setView} className="hidden sm:inline-flex" />
            </div>

            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {dateFilters.map((filter) => (
                <FilterChip
                  key={filter.value}
                  active={selectedDateFilter === filter.value}
                  onClick={() => selectFilter(filter.value)}
                >
                  {filter.value === "saved" && <Bookmark className="size-3.5" aria-hidden />}
                  {filter.value === "following" && <Heart className="size-3.5" aria-hidden />}
                  {filter.label}
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
          ) : (
            <>
              <p className="mb-5 text-sm text-ink-3">
                <span className="font-data text-ink-2">{filteredEvents.length}</span>{" "}
                {filteredEvents.length === 1 ? "event" : "events"}
                {selectedDateFilter === "following"
                  ? " from clubs you follow"
                  : selectedDateFilter === "saved"
                    ? " saved"
                    : ""}
              </p>

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
                        attendees={event.rsvps?.length || 0}
                        capacity={event.capacity ?? undefined}
                        isBookmarked={isBookmarked(event.id)}
                        onBookmark={() => toggleBookmark(event.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <DiscoverList rows={listRows} />
                )
              ) : (
                <EmptyState
                  title={
                    selectedDateFilter === "following"
                      ? "Quiet from your clubs —"
                      : hasFilters
                        ? "Nothing on that date —"
                        : "No events coming up —"
                  }
                  signature={
                    selectedDateFilter === "following"
                      ? "the rest of campus is busy."
                      : hasFilters
                        ? "try a wider window."
                        : "roles are open though."
                  }
                  body={
                    hasFilters
                      ? selectedDateFilter === "saved"
                        ? "You haven't saved any events yet. Save one from a card and it'll wait for you here."
                        : selectedDateFilter === "following"
                          ? "The clubs you follow have nothing scheduled. Their next event shows up here first."
                          : "No events fall in that window. Clearing the filter shows everything upcoming."
                      : "Clubs schedule events throughout the term. Following a club puts its next one in front of you."
                  }
                  actions={
                    hasFilters ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery("");
                          selectFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button variant="outline" asChild>
                        <a href="/opportunities">Browse roles</a>
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
