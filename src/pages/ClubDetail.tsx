import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Globe, 
  Linkedin, 
  Instagram, 
  MessageSquare, 
  Calendar, 
  Briefcase,
  ArrowLeft,
  Users,
  Clock
} from "lucide-react";
import { format } from "date-fns";

interface Club {
  id: string;
  club_name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  discord_url: string | null;
}

interface Opportunity {
  id: string;
  title: string;
  type: string;
  description: string | null;
  deadline: string | null;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
}

const ClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClubData = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        // Fetch club profile
        const { data: clubData, error: clubError } = await supabase
          .from("club_profiles")
          .select("*")
          .eq("id", id)
          .single();

        if (clubError) throw clubError;
        setClub(clubData);

        // Fetch active opportunities
        const { data: oppsData, error: oppsError } = await supabase
          .from("opportunities")
          .select("id, title, type, description, deadline")
          .eq("club_id", id)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (!oppsError) setOpportunities(oppsData || []);

        // Fetch upcoming events
        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("id, title, description, event_date, location")
          .eq("club_id", id)
          .eq("is_active", true)
          .gte("event_date", new Date().toISOString())
          .order("event_date", { ascending: true });

        if (!eventsError) setEvents(eventsData || []);
      } catch (error) {
        console.error("Error fetching club data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClubData();
  }, [id]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full mb-6 rounded-xl" />
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-4 w-2/3 mb-8" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!club) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Club not found</h1>
          <p className="text-muted-foreground mb-6">
            The club you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <Link to="/clubs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Clubs
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Back button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/clubs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clubs
          </Link>
        </Button>

        {/* Banner */}
        {club.banner_url && (
          <div className="relative h-48 md:h-64 rounded-xl overflow-hidden mb-6">
            <img
              src={club.banner_url}
              alt={`${club.club_name} banner`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Club header */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {club.logo_url && (
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0">
              <img
                src={club.logo_url}
                alt={`${club.club_name} logo`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{club.club_name}</h1>
              {club.category && (
                <Badge variant="secondary">{club.category}</Badge>
              )}
            </div>
            {club.description && (
              <p className="text-muted-foreground">{club.description}</p>
            )}
          </div>
        </div>

        {/* Social links */}
        <div className="flex flex-wrap gap-3 mb-8">
          {club.website_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={club.website_url} target="_blank" rel="noopener noreferrer">
                <Globe className="mr-2 h-4 w-4" />
                Website
              </a>
            </Button>
          )}
          {club.linkedin_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={club.linkedin_url} target="_blank" rel="noopener noreferrer">
                <Linkedin className="mr-2 h-4 w-4" />
                LinkedIn
              </a>
            </Button>
          )}
          {club.instagram_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={club.instagram_url} target="_blank" rel="noopener noreferrer">
                <Instagram className="mr-2 h-4 w-4" />
                Instagram
              </a>
            </Button>
          )}
          {club.discord_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={club.discord_url} target="_blank" rel="noopener noreferrer">
                <MessageSquare className="mr-2 h-4 w-4" />
                Discord
              </a>
            </Button>
          )}
        </div>

        {/* Opportunities and Events */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Opportunities */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Open Opportunities</h2>
            </div>
            {opportunities.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No open opportunities at this time</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <Card key={opp.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{opp.title}</CardTitle>
                        <Badge variant="outline">{opp.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {opp.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {opp.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        {opp.deadline && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Due {format(new Date(opp.deadline), "MMM d, yyyy")}
                          </span>
                        )}
                        <Button size="sm" asChild>
                          <Link to={`/opportunities/${opp.id}`}>View</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Events */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Upcoming Events</h2>
            </div>
            {events.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No upcoming events scheduled</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <Card key={event.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{event.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {event.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(event.event_date), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                        <Button size="sm" asChild>
                          <Link to={`/events/${event.id}`}>View</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ClubDetail;