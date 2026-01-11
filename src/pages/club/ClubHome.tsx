import { Link } from "react-router-dom";
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
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useClubData } from "@/hooks/useClubData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function ClubHome() {
  const {
    opportunities,
    events,
    isLoading,
  } = useClubData();

  // Calculate stats from real data
  const totalViews = opportunities.reduce((sum, o) => sum + o.views, 0) + events.reduce((sum, e) => sum + e.views, 0);
  const totalApplications = opportunities.reduce((sum, o) => sum + o.applications_count, 0);
  const activeOpportunities = opportunities.filter(o => o.is_active && (!o.deadline || new Date(o.deadline) > new Date())).length;
  const upcomingEvents = events.filter(e => e.is_active && new Date(e.event_date) > new Date()).length;

  // Get recent items for quick view
  const recentOpportunities = opportunities.slice(0, 3);
  const recentEvents = events.filter(e => new Date(e.event_date) > new Date()).slice(0, 3);

  return (
    <ClubLayout>
    <div className="container mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

      {/* Quick Access Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Opportunities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Recent Opportunities
            </CardTitle>
            <Link to="/club/opportunities">
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
            <Link to="/club/events">
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
    </div>
    </ClubLayout>
  );
}
