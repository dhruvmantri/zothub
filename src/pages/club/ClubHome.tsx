import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Briefcase, 
  Eye, 
  Users, 
  Plus,
  ArrowRight,
} from "lucide-react";
import { ClubLayout } from "@/components/club/ClubLayout";
import { DashboardTabs } from "@/components/club/DashboardTabs";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useClubData } from "@/hooks/useClubData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageTransition, SlideUp } from "@/components/ui/page-transition";

// Import dashboard sub-components
import { OpportunityManagement } from "@/components/dashboard/OpportunityManagement";
import { EventManagement } from "@/components/dashboard/EventManagement";
import { ApplicationReview } from "@/components/dashboard/ApplicationReview";
import { TeamManagement } from "@/components/dashboard/TeamManagement";
import { ClubAnalytics as ClubAnalyticsComponent } from "@/components/dashboard/ClubAnalytics";

export default function ClubHome() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [applicationCount, setApplicationCount] = useState(0);
  
  const {
    clubId,
    opportunities,
    events,
    teamMembers,
    isLoading,
    deleteOpportunity,
    deleteEvent,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    refetchOpportunities,
    refetchEvents,
  } = useClubData();

  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === "/club/dashboard") return "overview";
    if (path.includes("/opportunities")) return "opportunities";
    if (path.includes("/events")) return "events";
    if (path.includes("/applications")) return "applications";
    if (path.includes("/team")) return "team";
    if (path.includes("/analytics")) return "analytics";
    return "overview";
  };

  const activeTab = getActiveTab();

  // Fetch pending application count
  useEffect(() => {
    if (!user) return;

    const fetchApplicationCount = async () => {
      const { data: clubProfile } = await supabase
        .from("club_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (clubProfile) {
        const { count } = await supabase
          .from("applications")
          .select("*, opportunities!inner(club_id)", { count: "exact", head: true })
          .eq("opportunities.club_id", clubProfile.id)
          .eq("status", "pending");

        setApplicationCount(count || 0);
      }
    };

    fetchApplicationCount();
  }, [user]);

  // Calculate stats from real data
  const totalViews = opportunities.reduce((sum, o) => sum + o.views, 0) + events.reduce((sum, e) => sum + e.views, 0);
  const totalApplications = opportunities.reduce((sum, o) => sum + o.applications_count, 0);
  const activeOpportunities = opportunities.filter(o => o.is_active && (!o.deadline || new Date(o.deadline) > new Date())).length;
  const upcomingEvents = events.filter(e => e.is_active && new Date(e.event_date) > new Date()).length;

  // Get recent items for quick view
  const recentOpportunities = opportunities.slice(0, 3);
  const recentEvents = events.filter(e => new Date(e.event_date) > new Date()).slice(0, 3);

  const renderContent = () => {
    switch (activeTab) {
      case "opportunities":
        return (
          <div className="container mx-auto px-4 py-6">
            <OpportunityManagement
              opportunities={opportunities}
              isLoading={isLoading}
              onDelete={deleteOpportunity}
            />
          </div>
        );
      
      case "events":
        return (
          <div className="container mx-auto px-4 py-6">
            <EventManagement
              events={events}
              isLoading={isLoading}
              onDelete={deleteEvent}
            />
          </div>
        );
      
      case "applications":
        return (
          <div className="container mx-auto px-4 py-6">
            <ApplicationReview />
          </div>
        );
      
      case "team":
        return (
          <div className="container mx-auto px-4 py-6">
            <TeamManagement
              teamMembers={teamMembers}
              onAddMember={addTeamMember}
              onUpdateMember={updateTeamMember}
              onRemoveMember={removeTeamMember}
            />
          </div>
        );
      
      case "analytics":
        return (
          <div className="container mx-auto px-4 py-6">
            <ClubAnalyticsComponent />
          </div>
        );
      
      default:
        return (
          <PageTransition className="container mx-auto px-4 py-6 space-y-8">
            {/* Header */}
            <SlideUp className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                  Overview of your club's activity
                </p>
              </div>
              <div className="flex gap-3">
                <Link to="/club/opportunities/new">
                  <Button variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Opportunity
                  </Button>
                </Link>
                <Link to="/club/events/new">
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                  New Event
                </Button>
              </Link>
            </div>
          </SlideUp>

          {/* Quick Stats */}
          <SlideUp delay={0.1} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard
                title="Total Views"
                value={totalViews.toLocaleString()}
                icon={Eye}
              />
              <StatsCard
                title="Applications"
                value={totalApplications.toString()}
                icon={Users}
              />
              <StatsCard
                title="Active Opportunities"
                value={activeOpportunities.toString()}
                icon={Briefcase}
              />
            <StatsCard
              title="Upcoming Events"
              value={upcomingEvents.toString()}
              icon={Calendar}
            />
          </SlideUp>

          {/* Quick Access Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent Opportunities */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-primary" />
                    Recent Opportunities
                  </CardTitle>
                  <Link to="/club/dashboard/opportunities">
                    <Button variant="ghost" size="sm" className="gap-1">
                      View All
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))
                  ) : recentOpportunities.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">
                      No opportunities yet. Create your first one!
                    </p>
                  ) : (
                    recentOpportunities.map((opp) => (
                      <Link
                        key={opp.id}
                        to={`/club/opportunities/${opp.id}/edit`}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{opp.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {opp.applications_count} applications · {opp.views} views
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Events */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Upcoming Events
                  </CardTitle>
                  <Link to="/club/dashboard/events">
                    <Button variant="ghost" size="sm" className="gap-1">
                      View All
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))
                  ) : recentEvents.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">
                      No upcoming events. Create one to engage your audience!
                    </p>
                  ) : (
                    recentEvents.map((event) => (
                      <Link
                        key={event.id}
                        to={`/club/events/${event.id}/edit`}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.event_date), "MMM d, yyyy")} · {event.rsvps_count} RSVPs
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </PageTransition>
        );
    }
  };

  return (
    <ClubLayout>
      <DashboardTabs applicationCount={applicationCount} />
      {renderContent()}
    </ClubLayout>
  );
}
