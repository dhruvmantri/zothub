import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Briefcase, 
  Users, 
  Eye, 
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { OpportunityManagement } from "@/components/dashboard/OpportunityManagement";
import { EventManagement } from "@/components/dashboard/EventManagement";
import { ApplicationReview } from "@/components/dashboard/ApplicationReview";
import { ClubAnalytics } from "@/components/dashboard/ClubAnalytics";
import { TeamManagement } from "@/components/dashboard/TeamManagement";
import { useClubData } from "@/hooks/useClubData";

export default function ClubDashboard() {
  const {
    opportunities,
    events,
    teamMembers,
    isLoading,
    deleteOpportunity,
    deleteEvent,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
  } = useClubData();

  // Calculate stats from real data
  const totalViews = opportunities.reduce((sum, o) => sum + o.views, 0) + events.reduce((sum, e) => sum + e.views, 0);
  const totalApplications = opportunities.reduce((sum, o) => sum + o.applications_count, 0);
  const activeOpportunities = opportunities.filter(o => o.is_active && (!o.deadline || new Date(o.deadline) > new Date())).length;
  const upcomingEvents = events.filter(e => e.is_active && new Date(e.event_date) > new Date()).length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage your club's opportunities, events, and applications
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/club/opportunities/new">
              <Button variant="outline" className="gap-2">
                <Briefcase className="w-4 h-4" />
                Post Opportunity
              </Button>
            </Link>
            <Link to="/club/events/new">
              <Button className="gap-2">
                <Calendar className="w-4 h-4" />
                Create Event
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

        {/* Main Content Tabs */}
        <Tabs defaultValue="opportunities" className="space-y-6">
          <TabsList className="bg-secondary/50 p-1">
            <TabsTrigger value="opportunities" className="gap-2">
              <Briefcase className="w-4 h-4" />
              Opportunities
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2">
              <Calendar className="w-4 h-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="applications" className="gap-2">
              <Users className="w-4 h-4" />
              Applications
              {totalApplications > 0 && (
                <Badge variant="accent" className="ml-1 px-1.5 py-0 text-[10px]">
                  {totalApplications}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Team
              {teamMembers.length > 0 && (
                <Badge variant="muted" className="ml-1 px-1.5 py-0 text-[10px]">
                  {teamMembers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities">
            <OpportunityManagement 
              opportunities={opportunities}
              onDelete={deleteOpportunity}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="events">
            <EventManagement 
              events={events}
              onDelete={deleteEvent}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="applications">
            <ApplicationReview />
          </TabsContent>

          <TabsContent value="team">
            <TeamManagement 
              teamMembers={teamMembers}
              onAddMember={addTeamMember}
              onUpdateMember={updateTeamMember}
              onRemoveMember={removeTeamMember}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <ClubAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
