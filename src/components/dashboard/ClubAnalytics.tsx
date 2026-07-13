import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Eye, Briefcase, Calendar, Loader2, BarChart3, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface OpportunityStats {
  id: string;
  title: string;
  views: number;
  applicationCount: number;
}

interface EventStats {
  id: string;
  title: string;
  views: number;
  rsvpCount: number;
}

interface ApplicationStatusData {
  name: string;
  value: number;
  color: string;
}

export function ClubAnalytics() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [totalViews, setTotalViews] = useState(0);
  const [clubProfileViews, setClubProfileViews] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [totalRsvps, setTotalRsvps] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [opportunityStats, setOpportunityStats] = useState<OpportunityStats[]>([]);
  const [eventStats, setEventStats] = useState<EventStats[]>([]);
  const [applicationStatusData, setApplicationStatusData] = useState<ApplicationStatusData[]>([]);
  const [viewsOverTime, setViewsOverTime] = useState<{ date: string; views: number }[]>([]);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      // Get club profile
      const { data: clubProfile, error: clubError } = await supabase
        .from("club_profiles")
        .select("id, views")
        .eq("user_id", user.id)
        .maybeSingle();

      if (clubError || !clubProfile) {
        console.error("Error fetching club profile:", clubError);
        setIsLoading(false);
        return;
      }

      setClubProfileViews(clubProfile.views || 0);

      // Fetch opportunities with their stats
      const { data: opportunities, error: oppError } = await supabase
        .from("opportunities")
        .select("id, title, views")
        .eq("club_id", clubProfile.id);

      if (oppError) {
        console.error("Error fetching opportunities:", oppError);
      }

      // Fetch events with their stats
      const { data: events, error: eventError } = await supabase
        .from("events")
        .select("id, title, views")
        .eq("club_id", clubProfile.id);

      if (eventError) {
        console.error("Error fetching events:", eventError);
      }

      // Get all item IDs for page_views query
      const oppIds = opportunities?.map(o => o.id) || [];
      const eventIds = events?.map(e => e.id) || [];
      const allItemIds = [...oppIds, ...eventIds, clubProfile.id];

      // Fetch views over time (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: pageViewsData, error: pvError } = await supabase
        .from("page_views")
        .select("view_date, item_id")
        .in("item_id", allItemIds)
        .gte("view_date", sevenDaysAgo.toISOString().split('T')[0]);

      if (!pvError && pageViewsData) {
        // Group by date
        const viewsByDate: Record<string, number> = {};
        pageViewsData.forEach(pv => {
          const dateStr = pv.view_date;
          viewsByDate[dateStr] = (viewsByDate[dateStr] || 0) + 1;
        });

        // Create array for last 7 days
        const viewsTimeData = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          viewsTimeData.push({
            date: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }),
            views: viewsByDate[dateStr] || 0
          });
        }
        setViewsOverTime(viewsTimeData);
      }

      // Calculate opportunity stats with application counts
      const applicationsByOpp: Record<string, number> = {};
      const applicationsByStatus: Record<string, number> = {
        pending: 0,
        reviewed: 0,
        accepted: 0,
        rejected: 0
      };

      if (oppIds.length > 0) {
        const { data: applications, error: appError } = await supabase
          .from("applications")
          .select("opportunity_id, status")
          .in("opportunity_id", oppIds);

        if (!appError && applications) {
          applications.forEach(app => {
            applicationsByOpp[app.opportunity_id] = (applicationsByOpp[app.opportunity_id] || 0) + 1;
            const status = app.status || "pending";
            applicationsByStatus[status] = (applicationsByStatus[status] || 0) + 1;
          });
        }
      }

      // Calculate event stats with RSVP counts
      const rsvpsByEvent: Record<string, number> = {};

      if (eventIds.length > 0) {
        const { data: rsvps, error: rsvpError } = await supabase
          .from("rsvps")
          .select("event_id")
          .in("event_id", eventIds);

        if (!rsvpError && rsvps) {
          rsvps.forEach(rsvp => {
            rsvpsByEvent[rsvp.event_id] = (rsvpsByEvent[rsvp.event_id] || 0) + 1;
          });
        }
      }

      // Build opportunity stats
      const oppStatsData: OpportunityStats[] = (opportunities || []).map(opp => ({
        id: opp.id,
        title: opp.title,
        views: opp.views || 0,
        applicationCount: applicationsByOpp[opp.id] || 0
      }));

      // Build event stats
      const eventStatsData: EventStats[] = (events || []).map(evt => ({
        id: evt.id,
        title: evt.title,
        views: evt.views || 0,
        rsvpCount: rsvpsByEvent[evt.id] || 0
      }));

      // Calculate totals
      const totalOppViews = oppStatsData.reduce((sum, o) => sum + o.views, 0);
      const totalEventViews = eventStatsData.reduce((sum, e) => sum + e.views, 0);
      const totalApps = Object.values(applicationsByOpp).reduce((sum, count) => sum + count, 0);
      const totalRsvpCount = Object.values(rsvpsByEvent).reduce((sum, count) => sum + count, 0);

      setTotalViews(totalOppViews + totalEventViews + (clubProfile.views || 0));
      setTotalApplications(totalApps);
      setTotalRsvps(totalRsvpCount);
      setConversionRate(totalOppViews > 0 ? (totalApps / totalOppViews) * 100 : 0);
      setOpportunityStats(oppStatsData);
      setEventStats(eventStatsData);

      // Build application status pie chart data
      setApplicationStatusData([
        { name: 'Pending', value: applicationsByStatus.pending, color: 'hsl(38, 92%, 50%)' },
        { name: 'Reviewed', value: applicationsByStatus.reviewed, color: 'hsl(220, 9%, 46%)' },
        { name: 'Accepted', value: applicationsByStatus.accepted, color: 'hsl(142, 76%, 36%)' },
        { name: 'Rejected', value: applicationsByStatus.rejected, color: 'hsl(0, 84%, 60%)' },
      ]);

    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare chart data
  const opportunityChartData = opportunityStats.slice(0, 5).map(opp => ({
    name: opp.title.length > 15 ? opp.title.substring(0, 15) + '...' : opp.title,
    views: opp.views,
    applications: opp.applicationCount
  }));

  const eventChartData = eventStats.slice(0, 5).map(evt => ({
    name: evt.title.length > 15 ? evt.title.substring(0, 15) + '...' : evt.title,
    rsvps: evt.rsvpCount,
    views: evt.views
  }));

  // Combine top performing items
  const topPerforming = [
    ...opportunityStats.map(o => ({
      title: o.title,
      type: 'opportunity' as const,
      views: o.views,
      conversions: o.applicationCount,
      rate: o.views > 0 ? ((o.applicationCount / o.views) * 100).toFixed(1) + '%' : '0%'
    })),
    ...eventStats.map(e => ({
      title: e.title,
      type: 'event' as const,
      views: e.views,
      conversions: e.rsvpCount,
      rate: e.views > 0 ? ((e.rsvpCount / e.views) * 100).toFixed(1) + '%' : '0%'
    }))
  ].sort((a, b) => b.views - a.views).slice(0, 4);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasData = opportunityStats.length > 0 || eventStats.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-12 bg-card rounded-xl border border-border">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">
          No analytics data yet. Create opportunities and events to see your performance metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-3xl font-bold text-foreground">{totalViews.toLocaleString()}</p>
              </div>
              <Eye className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Profile Views</p>
                <p className="text-3xl font-bold text-foreground">{clubProfileViews.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Applications</p>
                <p className="text-3xl font-bold text-foreground">{totalApplications}</p>
              </div>
              <Briefcase className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Event RSVPs</p>
                <p className="text-3xl font-bold text-foreground">{totalRsvps}</p>
              </div>
              <Calendar className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-3xl font-bold text-foreground">{conversionRate.toFixed(1)}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Views Over Time */}
      {viewsOverTime.some(v => v.views > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Views Over Time (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={viewsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis 
                    dataKey="date"
                    tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(220, 13%, 91%)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stroke="hsl(222, 47%, 40%)" 
                    fill="hsl(222, 47%, 40%)" 
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Opportunity Performance */}
        {opportunityChartData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Opportunity Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={opportunityChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                    <XAxis 
                      type="number"
                      tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category"
                      tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                      width={120}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(0, 0%, 100%)',
                        border: '1px solid hsl(220, 13%, 91%)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar dataKey="views" name="Views" fill="hsl(222, 47%, 15%)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="applications" name="Applications" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm text-muted-foreground">Views</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent" />
                  <span className="text-sm text-muted-foreground">Applications</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Application Status */}
        {totalApplications > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Application Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={applicationStatusData.filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {applicationStatusData.filter(d => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(0, 0%, 100%)',
                        border: '1px solid hsl(220, 13%, 91%)',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {applicationStatusData.map((status) => (
                  <div key={status.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: status.color }} 
                    />
                    <span className="text-xs text-muted-foreground">{status.name}</span>
                    <span className="text-xs font-medium ml-auto">{status.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Event RSVPs */}
      {eventChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event RSVPs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis 
                    dataKey="name"
                    tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(220, 13%, 91%)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="views" name="Views" fill="hsl(222, 47%, 15%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rsvps" name="RSVPs" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">Views</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-sm text-muted-foreground">RSVPs</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Performing */}
      {topPerforming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Performing Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPerforming.map((item, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    {item.type === "event" ? (
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{item.title}</p>
                    <Badge variant="secondary" className="capitalize mt-1">{item.type}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{item.views} views</p>
                    <p className="text-sm text-muted-foreground">
                      {item.conversions} {item.type === "event" ? "RSVPs" : "apps"} ({item.rate})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
