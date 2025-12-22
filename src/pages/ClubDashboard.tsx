import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Calendar, 
  Briefcase, 
  Users, 
  Eye, 
  TrendingUp,
  MoreHorizontal,
  Edit,
  Trash2,
  Clock
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { OpportunityManagement } from "@/components/dashboard/OpportunityManagement";
import { EventManagement } from "@/components/dashboard/EventManagement";
import { ApplicationReview } from "@/components/dashboard/ApplicationReview";
import { ClubAnalytics } from "@/components/dashboard/ClubAnalytics";

export default function ClubDashboard() {
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
            value="2,847"
            change="+12.5%"
            trend="up"
            icon={Eye}
          />
          <StatsCard
            title="Applications"
            value="156"
            change="+8.2%"
            trend="up"
            icon={Users}
          />
          <StatsCard
            title="Active Opportunities"
            value="8"
            change="+2"
            trend="up"
            icon={Briefcase}
          />
          <StatsCard
            title="Upcoming Events"
            value="5"
            change="+1"
            trend="up"
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
              <Badge variant="accent" className="ml-1 px-1.5 py-0 text-[10px]">12</Badge>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities">
            <OpportunityManagement />
          </TabsContent>

          <TabsContent value="events">
            <EventManagement />
          </TabsContent>

          <TabsContent value="applications">
            <ApplicationReview />
          </TabsContent>

          <TabsContent value="analytics">
            <ClubAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
