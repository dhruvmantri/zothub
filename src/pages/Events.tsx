import { useState } from "react";
import { Layout } from "@/components/Layout";
import { EventCard } from "@/components/cards/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calendar, X } from "lucide-react";

// Mock data for events
const mockEvents = [
  {
    id: "1",
    title: "Winter Career Fair 2025",
    clubName: "Career Center",
    date: "Jan 18, 2025",
    time: "10:00 AM - 4:00 PM",
    location: "Student Center Pacific Ballroom",
    attendees: 234,
    capacity: 500,
  },
  {
    id: "2",
    title: "Intro to Machine Learning Workshop",
    clubName: "Data Science UCI",
    date: "Jan 22, 2025",
    time: "6:00 PM - 8:00 PM",
    location: "DBH 1100",
    attendees: 45,
    capacity: 60,
  },
  {
    id: "3",
    title: "Networking Night with Alumni",
    clubName: "Anteater Blockchain",
    date: "Jan 25, 2025",
    time: "7:00 PM - 9:00 PM",
    location: "The Anteatery",
    attendees: 78,
    capacity: 100,
  },
  {
    id: "4",
    title: "Design Sprint Weekend",
    clubName: "Design at UCI",
    date: "Feb 1-2, 2025",
    time: "9:00 AM - 6:00 PM",
    location: "Humanities Hall 101",
    attendees: 28,
    capacity: 40,
  },
  {
    id: "5",
    title: "Hackathon Info Session",
    clubName: "Hack at UCI",
    date: "Feb 5, 2025",
    time: "5:00 PM - 6:30 PM",
    location: "ICS 180",
    attendees: 120,
    capacity: 200,
  },
  {
    id: "6",
    title: "Community Service Day",
    clubName: "Circle K International",
    date: "Feb 8, 2025",
    time: "8:00 AM - 2:00 PM",
    location: "Aldrich Park",
    attendees: 35,
    capacity: 50,
  },
];

const dateFilters = ["All", "This Week", "This Month", "Upcoming"];

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDateFilter, setSelectedDateFilter] = useState("All");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const filteredEvents = mockEvents.filter((event) => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.clubName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Layout>
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
                  {...event}
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
                Try adjusting your search or filters
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchQuery("");
                  setSelectedDateFilter("All");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
