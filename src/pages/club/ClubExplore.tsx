import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ClubLayout } from "@/components/club/ClubLayout";
import { OpportunityCard } from "@/components/cards/OpportunityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, X, Compass, Calendar, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDeadline, normalizeOpportunityType } from "@/lib/formatters";
import { useBookmarks } from "@/hooks/useBookmarks";
import { format } from "date-fns";

interface Opportunity {
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
  applications: { id: string }[];
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  club_id: string;
  club_profiles: {
    club_name: string;
    logo_url: string | null;
  };
  rsvps: { id: string }[];
}

interface Club {
  id: string;
  club_name: string;
  description: string | null;
  logo_url: string | null;
  category: string | null;
}

export default function ClubExplore() {
  const { isBookmarked, toggleBookmark } = useBookmarks("opportunity");
  const [activeTab, setActiveTab] = useState("opportunities");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all data in parallel
      const [oppsResult, eventsResult, clubsResult] = await Promise.all([
        supabase
          .from("opportunities")
          .select(`
            id,
            title,
            type,
            description,
            deadline,
            club_id,
            club_profiles (club_name, logo_url),
            applications (id)
          `)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("events")
          .select(`
            id,
            title,
            description,
            event_date,
            location,
            club_id,
            club_profiles (club_name, logo_url),
            rsvps (id)
          `)
          .eq("is_active", true)
          .gte("event_date", new Date().toISOString())
          .order("event_date", { ascending: true }),
        supabase
          .from("club_profiles")
          .select("id, club_name, description, logo_url, category")
          .order("club_name", { ascending: true }),
      ]);

      if (oppsResult.error) {
        console.error("Error fetching opportunities:", oppsResult.error);
      } else {
        setOpportunities(oppsResult.data || []);
      }

      if (eventsResult.error) {
        console.error("Error fetching events:", eventsResult.error);
      } else {
        setEvents(eventsResult.data || []);
      }

      if (clubsResult.error) {
        console.error("Error fetching clubs:", clubsResult.error);
      } else {
        setClubs(clubsResult.data || []);
      }
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOpportunities = opportunities.filter((opp) => {
    const clubName = opp.club_profiles?.club_name || "";
    return (
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clubName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredEvents = events.filter((event) => {
    const clubName = event.club_profiles?.club_name || "";
    return (
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clubName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.location?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );
  });

  const filteredClubs = clubs.filter((club) => {
    return (
      club.club_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (club.category?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    );
  });

  return (
    <ClubLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="bg-secondary/30 border-b border-border/50">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Compass className="w-6 h-6 text-primary" />
              </div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                Explore
              </h1>
            </div>
            <p className="text-muted-foreground">
              Discover opportunities, events, and clubs across the community
            </p>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50">
          <div className="container mx-auto px-4 py-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search opportunities, events, or clubs..."
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

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="opportunities">
                  Opportunities ({filteredOpportunities.length})
                </TabsTrigger>
                <TabsTrigger value="events">
                  Events ({filteredEvents.length})
                </TabsTrigger>
                <TabsTrigger value="clubs">
                  Clubs ({filteredClubs.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-6 rounded-2xl bg-card border border-border/50">
                  <Skeleton className="h-10 w-10 rounded-lg mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <Tabs value={activeTab}>
              {/* Opportunities Tab */}
              <TabsContent value="opportunities">
                {filteredOpportunities.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredOpportunities.map((opportunity) => (
                      <OpportunityCard
                        key={opportunity.id}
                        id={opportunity.id}
                        title={opportunity.title}
                        clubName={opportunity.club_profiles?.club_name || "Unknown Club"}
                        clubLogo={opportunity.club_profiles?.logo_url || undefined}
                        type={normalizeOpportunityType(opportunity.type)}
                        deadline={formatDeadline(opportunity.deadline)}
                        description={opportunity.description || "No description provided"}
                        applicants={opportunity.applications?.length || 0}
                        isBookmarked={isBookmarked(opportunity.id)}
                        onBookmark={() => toggleBookmark(opportunity.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState type="opportunities" searchQuery={searchQuery} onClear={() => setSearchQuery("")} />
                )}
              </TabsContent>

              {/* Events Tab */}
              <TabsContent value="events">
                {filteredEvents.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map((event) => (
                      <Link key={event.id} to={`/events/${event.id}`}>
                        <Card className="hover:shadow-lg transition-shadow h-full">
                          <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={event.club_profiles?.logo_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {event.club_profiles?.club_name?.charAt(0) || "C"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-muted-foreground">
                                {event.club_profiles?.club_name}
                              </span>
                            </div>
                            <h3 className="font-semibold text-lg mb-2 line-clamp-2">{event.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                              {event.description || "No description"}
                            </p>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(event.event_date), "MMM d, yyyy 'at' h:mm a")}
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <MapPin className="w-4 h-4" />
                                  {event.location}
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Users className="w-4 h-4" />
                                {event.rsvps?.length || 0} RSVPs
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState type="events" searchQuery={searchQuery} onClear={() => setSearchQuery("")} />
                )}
              </TabsContent>

              {/* Clubs Tab */}
              <TabsContent value="clubs">
                {filteredClubs.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClubs.map((club) => (
                      <Link key={club.id} to={`/clubs/${club.id}`}>
                        <Card className="hover:shadow-lg transition-shadow h-full">
                          <CardContent className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                              <Avatar className="h-14 w-14">
                                <AvatarImage src={club.logo_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                                  {club.club_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-lg truncate">{club.club_name}</h3>
                                {club.category && (
                                  <Badge variant="secondary" className="text-xs">
                                    {club.category}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {club.description || "No description available"}
                            </p>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState type="clubs" searchQuery={searchQuery} onClear={() => setSearchQuery("")} />
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </ClubLayout>
  );
}

function EmptyState({ 
  type, 
  searchQuery, 
  onClear 
}: { 
  type: string; 
  searchQuery: string; 
  onClear: () => void;
}) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
        <Search className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground mb-2">
        No {type} found
      </h3>
      <p className="text-muted-foreground mb-6">
        {searchQuery ? "Try adjusting your search" : `No ${type} available yet`}
      </p>
      {searchQuery && (
        <Button variant="outline" onClick={onClear}>
          Clear search
        </Button>
      )}
    </div>
  );
}
