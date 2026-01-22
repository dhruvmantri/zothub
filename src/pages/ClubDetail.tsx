import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { requireSession } from "@/lib/requireSession";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackView } from "@/hooks/useTrackView";
import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactClubDialog } from "@/components/ContactClubDialog";
import { 
  Globe, 
  Linkedin, 
  Instagram, 
  MessageSquare, 
  Calendar, 
  Briefcase,
  ArrowLeft,
  Users,
  Clock,
  Heart,
  Mail
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { TeamMember } from "@/types";

interface ClubDetailData {
  id: string;
  user_id: string;
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

interface ClubOpportunity {
  id: string;
  title: string;
  type: string;
  description: string | null;
  deadline: string | null;
}

interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
}

const ClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  
  // Track page view
  useTrackView('club', id);
  
  const [club, setClub] = useState<ClubDetailData | null>(null);
  const [opportunities, setOpportunities] = useState<ClubOpportunity[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [teamMembers, setTeamMembers] = useState<Pick<TeamMember, 'id' | 'name' | 'role' | 'display_order' | 'user_id'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  const fetchTeamMembers = async () => {
    if (!id) return;
    const { data: teamData, error: teamError } = await supabase
      .from("club_team_members")
      .select("id, name, role, display_order, user_id")
      .eq("club_id", id)
      .eq("status", "active")
      .order("display_order", { ascending: true });

    if (!teamError) setTeamMembers(teamData || []);
  };

  useEffect(() => {
    const fetchClubData = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        // Fetch club profile (including user_id for messaging)
        const { data: clubData, error: clubError } = await supabase
          .from("club_profiles")
          .select("id, user_id, club_name, category, description, logo_url, banner_url, website_url, linkedin_url, instagram_url, discord_url")
          .eq("id", id)
          .single();

        if (clubError) throw clubError;
        setClub(clubData);

        // Fetch active opportunities (excluding expired ones)
        const { data: oppsData, error: oppsError } = await supabase
          .from("opportunities")
          .select("id, title, type, description, deadline")
          .eq("club_id", id)
          .eq("is_active", true)
          .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`)
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

        // Fetch active team members (public visibility), ordered by display_order
        await fetchTeamMembers();

      } catch (error) {
        console.error("Error fetching club data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClubData();
  }, [id]);

  // Subscribe to realtime changes on team members for this club
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`club-team-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_team_members",
          filter: `club_id=eq.${id}`,
        },
        () => {
          // Refetch team members when any change occurs
          fetchTeamMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Check if user is following this club
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user || !id) return;

      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("club_id", id)
        .maybeSingle();

      setIsFollowing(!!data);
    };

    checkFollowStatus();
  }, [user, id]);

  const handleFollowToggle = async () => {
    if (!user) {
      toast.error("Please log in to follow clubs");
      navigate("/login", { state: { from: `/clubs/${id}` } });
      return;
    }

    if (!id) return;

    setIsFollowLoading(true);
    try {
      // Ensure we have a valid session before making writes
      await requireSession();

      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("club_id", id);

        if (error) throw error;
        setIsFollowing(false);
        toast.success("Unfollowed club");
      } else {
        // Follow
        const { error } = await supabase
          .from("bookmarks")
          .insert({ user_id: user.id, club_id: id });

        if (error) throw error;
        setIsFollowing(true);
        toast.success("Following club!");
      }
    } catch (error: any) {
      console.error("Error toggling follow:", error);
      if (error.message?.includes("Session expired")) {
        toast.error("Session expired. Please log in again.");
        navigate("/login", { state: { from: `/clubs/${id}` } });
      } else {
        toast.error("Failed to update follow status");
      }
    } finally {
      setIsFollowLoading(false);
    }
  };

  if (isLoading) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full mb-6 rounded-xl" />
          <Skeleton className="h-8 w-1/3 mb-4" />
          <Skeleton className="h-4 w-2/3 mb-8" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </RoleBasedLayout>
    );
  }

  if (!club) {
    return (
      <RoleBasedLayout>
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
      </RoleBasedLayout>
    );
  }

  const hasSocialLinks = club.website_url || club.linkedin_url || club.instagram_url || club.discord_url;

  return (
    <RoleBasedLayout>
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
        <div className="flex flex-col md:flex-row gap-6 mb-6">
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

        {/* Activity Stats */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50">
            <Briefcase className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {opportunities.length} Open {opportunities.length === 1 ? "Opportunity" : "Opportunities"}
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {events.length} Upcoming {events.length === 1 ? "Event" : "Events"}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          {/* Follow button - only for students */}
          {user && role === "student" && (
            <Button
              variant={isFollowing ? "secondary" : "default"}
              onClick={handleFollowToggle}
              disabled={isFollowLoading}
            >
              <Heart className={`mr-2 h-4 w-4 ${isFollowing ? "fill-current" : ""}`} />
              {isFollowing ? "Following" : "Follow"}
            </Button>
          )}

          {/* Contact button - only for students */}
          {user && role === "student" && (
            <Button variant="outline" onClick={() => setContactDialogOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Contact Club
            </Button>
          )}

          {/* Social links */}
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

        {/* Team Members Section */}
        {teamMembers.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Team</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border"
                >
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      {member.name?.charAt(0) || "?"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.name || "Team Member"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                  {/* Message button - only show for students and if team member has a user_id */}
                  {user && role === "student" && member.user_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => navigate(`/messages?to=${member.user_id}`)}
                      title={`Message ${member.name || "team member"}`}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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

      {/* Contact Dialog */}
      {club && (
        <ContactClubDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          clubName={club.club_name}
          clubUserId={club.user_id}
        />
      )}
    </RoleBasedLayout>
  );
};

export default ClubDetail;
