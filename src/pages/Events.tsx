import { useState, useEffect } from "react";
import { SmartLayout } from "@/components/SmartLayout";
import { EventCard } from "@/components/cards/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isAfter, isBefore, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { formatDate, formatTime } from "@/lib/formatters";

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

const dateFilters = ["All", "This Week", "This Month", "Upcoming"];

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDateFilter, setSelectedDateFilter] = useState("All");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchEvents();
    if (user) {
      fetchBookmarks();
    }
  }, [user]);

  const fetchEvents = async () => {
    try {
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
        .order("event_date", { ascending: true });

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

  const fetchBookmarks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("event_id")
        .eq("user_id", user.id)
        .not("event_id", "is", null);

      if (error) {
        console.error("Error fetching bookmarks:", error);
        return;
      }

      const ids = new Set(data?.map((b) => b.event_id).filter(Boolean) as string[]);
      setBookmarkedIds(ids);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const toggleBookmark = async (id: string) => {
    if (!user) {
      toast.error("Please log in to bookmark events");
      return;
    }

    const isBookmarked = bookmarkedIds.has(id);

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("event_id", id);

        if (error) throw error;

        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success("Bookmark removed");
      } else {
        const { error } = await supabase.from("bookmarks").insert({
          user_id: user.id,
          event_id: id,
        });

        if (error) throw error;

        setBookmarkedIds((prev) => new Set(prev).add(id));
        toast.success("Event bookmarked");
      }
    } catch (err) {
      console.error("Error toggling bookmark:", err);
      toast.error("Failed to update bookmark");
    }
  };

  const filterEventsByDate = (event: Event) => {
    const eventDate = new Date(event.event_date);
    const now = new Date();

    switch (selectedDateFilter) {
      case "This Week":
        return isAfter(eventDate, startOfWeek(now)) && isBefore(eventDate, endOfWeek(now));
      case "This Month":
        return isAfter(eventDate, startOfMonth(now)) && isBefore(eventDate, endOfMonth(now));
      case "Upcoming":
        return isAfter(eventDate, now);
      default:
        return true;
    }
  };

  const filteredEvents = events.filter((event) => {
    const clubName = event.club_profiles?.club_name || "";
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clubName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = filterEventsByDate(event);
    return matchesSearch && matchesDate;
  });


  return (
    <SmartLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-secondary/30 border-b border-border/50">
          <div className="container mx-auto px-4 py-12">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Events
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Discover workshops, socials, career fairs, and more from UCI clubs and organizations.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Date filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                {dateFilters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedDateFilter(filter)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedDateFilter === filter
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                  <Skeleton className="h-40 w-full" />
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-6 h-6 rounded-md" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Results count */}
              <p className="text-sm text-muted-foreground mb-6">
                Showing {filteredEvents.length} events
              </p>

              {/* Grid */}
              {filteredEvents.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      id={event.id}
                      title={event.title}
                      clubName={event.club_profiles?.club_name || "Unknown Club"}
                      clubLogo={event.club_profiles?.logo_url || undefined}
                      date={formatDate(event.event_date)}
                      time={formatTime(event.event_date)}
                      location={event.location || "TBD"}
                      bannerImage={event.banner_url || undefined}
                      attendees={event.rsvps?.length || 0}
                      capacity={event.capacity || undefined}
                      isBookmarked={bookmarkedIds.has(event.id)}
                      onBookmark={() => toggleBookmark(event.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                    No events found
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {events.length === 0
                      ? "No events have been posted yet. Check back later!"
                      : "Try adjusting your search or filters"}
                  </p>
                  {events.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedDateFilter("All");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </SmartLayout>
  );
}
