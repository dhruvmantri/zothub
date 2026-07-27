import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
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
  Cell,
} from "recharts";
import { Eye, Briefcase, Calendar, Loader2, BarChart3, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getStatus } from "@/lib/status";

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
  key: string;
  name: string;
  value: number;
}

interface ChartColors {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  ink: string;
  accent: string;
  ok: string;
  warn: string;
  bad: string;
  muted: string;
}

const FALLBACK_COLORS: ChartColors = {
  grid: "hsl(210 22.7% 91.4%)",
  axis: "hsl(204.5 13.9% 31%)",
  tooltipBg: "hsl(0 0% 100%)",
  tooltipBorder: "hsl(210 22.7% 91.4%)",
  ink: "hsl(200 31.6% 7.5%)",
  accent: "hsl(208.6 83.6% 35.9%)",
  ok: "hsl(154.9 76.6% 26.9%)",
  warn: "hsl(37.3 85.2% 29.2%)",
  bad: "hsl(5.6 72.1% 40.8%)",
  muted: "hsl(205.7 10% 41.4%)",
};

/** Read the live token triplets so charts match the theme — and re-read when
 *  the theme flips. Recharts renders SVG with concrete fill/stroke strings, so
 *  it can't consume Tailwind classes; this is the one place the app resolves
 *  `var(--token)` to a value by hand. */
function readChartColors(): ChartColors {
  if (typeof window === "undefined") return FALLBACK_COLORS;
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => {
    const raw = s.getPropertyValue(name).trim();
    return raw ? `hsl(${raw})` : fallback;
  };
  return {
    grid: v("--line", FALLBACK_COLORS.grid),
    axis: v("--ink-2", FALLBACK_COLORS.axis),
    tooltipBg: v("--surface", FALLBACK_COLORS.tooltipBg),
    tooltipBorder: v("--line", FALLBACK_COLORS.tooltipBorder),
    ink: v("--ink", FALLBACK_COLORS.ink),
    accent: v("--accent", FALLBACK_COLORS.accent),
    ok: v("--ok", FALLBACK_COLORS.ok),
    warn: v("--warn", FALLBACK_COLORS.warn),
    bad: v("--bad", FALLBACK_COLORS.bad),
    muted: v("--ink-3", FALLBACK_COLORS.muted),
  };
}

function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(FALLBACK_COLORS);
  useEffect(() => {
    setColors(readChartColors());
  }, [resolvedTheme]);
  return colors;
}

export function ClubAnalytics() {
  const { user } = useAuth();
  const colors = useChartColors();
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
      const oppIds = opportunities?.map((o) => o.id) || [];
      const eventIds = events?.map((e) => e.id) || [];
      const allItemIds = [...oppIds, ...eventIds, clubProfile.id];

      // Fetch views over time (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: pageViewsData, error: pvError } = await supabase
        .from("page_views")
        .select("view_date, item_id")
        .in("item_id", allItemIds)
        .gte("view_date", sevenDaysAgo.toISOString().split("T")[0]);

      if (!pvError && pageViewsData) {
        // Group by date
        const viewsByDate: Record<string, number> = {};
        pageViewsData.forEach((pv) => {
          const dateStr = pv.view_date;
          viewsByDate[dateStr] = (viewsByDate[dateStr] || 0) + 1;
        });

        // Create array for last 7 days
        const viewsTimeData = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split("T")[0];
          viewsTimeData.push({
            date: new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" }),
            views: viewsByDate[dateStr] || 0,
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
        rejected: 0,
      };

      if (oppIds.length > 0) {
        const { data: applications, error: appError } = await supabase
          .from("applications")
          .select("opportunity_id, status")
          .in("opportunity_id", oppIds);

        if (!appError && applications) {
          applications.forEach((app) => {
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
          rsvps.forEach((rsvp) => {
            rsvpsByEvent[rsvp.event_id] = (rsvpsByEvent[rsvp.event_id] || 0) + 1;
          });
        }
      }

      // Build opportunity stats
      const oppStatsData: OpportunityStats[] = (opportunities || []).map((opp) => ({
        id: opp.id,
        title: opp.title,
        views: opp.views || 0,
        applicationCount: applicationsByOpp[opp.id] || 0,
      }));

      // Build event stats
      const eventStatsData: EventStats[] = (events || []).map((evt) => ({
        id: evt.id,
        title: evt.title,
        views: evt.views || 0,
        rsvpCount: rsvpsByEvent[evt.id] || 0,
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

      // Build application status pie chart data. Colours are applied at render
      // from the live tokens; labels use the club vocabulary (New / Declined).
      setApplicationStatusData(
        (["pending", "reviewed", "accepted", "rejected"] as const).map((key) => ({
          key,
          name: getStatus("application", key, "club").label,
          value: applicationsByStatus[key],
        })),
      );
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Colour a pie slice by its status meaning, from the live tokens.
  const statusColor = (key: string): string => {
    switch (key) {
      case "accepted":
        return colors.ok;
      case "reviewed":
        return colors.warn;
      case "rejected":
        return colors.bad;
      default:
        return colors.muted; // pending / new — neutral in the mix
    }
  };

  // Recharts tooltip styling shared across every chart.
  const tooltipStyle = {
    backgroundColor: colors.tooltipBg,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: "12px",
    color: colors.ink,
    boxShadow: "var(--e2)",
  };

  // Prepare chart data
  const opportunityChartData = opportunityStats.slice(0, 5).map((opp) => ({
    name: opp.title.length > 15 ? opp.title.substring(0, 15) + "..." : opp.title,
    views: opp.views,
    applications: opp.applicationCount,
  }));

  const eventChartData = eventStats.slice(0, 5).map((evt) => ({
    name: evt.title.length > 15 ? evt.title.substring(0, 15) + "..." : evt.title,
    rsvps: evt.rsvpCount,
    views: evt.views,
  }));

  // Combine top performing items
  const topPerforming = [
    ...opportunityStats.map((o) => ({
      title: o.title,
      type: "opportunity" as const,
      views: o.views,
      conversions: o.applicationCount,
      rate: o.views > 0 ? ((o.applicationCount / o.views) * 100).toFixed(1) + "%" : "0%",
    })),
    ...eventStats.map((e) => ({
      title: e.title,
      type: "event" as const,
      views: e.views,
      conversions: e.rsvpCount,
      rate: e.views > 0 ? ((e.rsvpCount / e.views) * 100).toFixed(1) + "%" : "0%",
    })),
  ]
    .sort((a, b) => b.views - a.views)
    .slice(0, 4);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-ink-3" />
      </div>
    );
  }

  const hasData = opportunityStats.length > 0 || eventStats.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-lg border border-line bg-surface py-12 text-center">
        <BarChart3 className="w-12 h-12 mx-auto text-ink-3 mb-4" />
        <p className="text-ink-2">
          No analytics data yet. Post opportunities and events to see your performance metrics.
        </p>
      </div>
    );
  }

  const summaryCards = [
    { label: "Total views", value: totalViews.toLocaleString(), icon: Eye },
    { label: "Profile views", value: clubProfileViews.toLocaleString(), icon: Users },
    { label: "Applications", value: totalApplications.toString(), icon: Briefcase },
    { label: "Event RSVPs", value: totalRsvps.toString(), icon: Calendar },
    { label: "Conversion rate", value: `${conversionRate.toFixed(1)}%`, icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink-2">{card.label}</p>
                  <p className="font-data text-3xl font-semibold text-ink">{card.value}</p>
                </div>
                <card.icon className="w-8 h-8 text-ink-3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Views Over Time */}
      {viewsOverTime.some((v) => v.views > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-text" />
              Views over time (last 7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={viewsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: colors.axis, fontSize: 12 }}
                    axisLine={{ stroke: colors.grid }}
                  />
                  <YAxis
                    tick={{ fill: colors.axis, fontSize: 12 }}
                    axisLine={{ stroke: colors.grid }}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: colors.ink }} />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke={colors.accent}
                    fill={colors.accent}
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
              <CardTitle className="text-lg">Opportunity performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={opportunityChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis
                      type="number"
                      tick={{ fill: colors.axis, fontSize: 12 }}
                      axisLine={{ stroke: colors.grid }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fill: colors.axis, fontSize: 12 }}
                      axisLine={{ stroke: colors.grid }}
                      width={120}
                    />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: colors.ink }} />
                    <Bar dataKey="views" name="Views" fill={colors.ink} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="applications" name="Applications" fill={colors.accent} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <LegendSwatch color={colors.ink} label="Views" />
                <LegendSwatch color={colors.accent} label="Applications" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Application Status */}
        {totalApplications > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Application status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={applicationStatusData.filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {applicationStatusData
                        .filter((d) => d.value > 0)
                        .map((entry) => (
                          <Cell key={entry.key} fill={statusColor(entry.key)} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: colors.ink }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {applicationStatusData.map((status) => (
                  <div key={status.key} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: statusColor(status.key) }}
                    />
                    <span className="text-xs text-ink-2">{status.name}</span>
                    <span className="font-data text-xs font-medium text-ink ml-auto">{status.value}</span>
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
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: colors.axis, fontSize: 12 }}
                    axisLine={{ stroke: colors.grid }}
                  />
                  <YAxis
                    tick={{ fill: colors.axis, fontSize: 12 }}
                    axisLine={{ stroke: colors.grid }}
                  />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: colors.ink }} />
                  <Bar dataKey="views" name="Views" fill={colors.ink} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rsvps" name="RSVPs" fill={colors.ok} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <LegendSwatch color={colors.ink} label="Views" />
              <LegendSwatch color={colors.ok} label="RSVPs" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Performing */}
      {topPerforming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top performing listings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPerforming.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 rounded-lg border border-line bg-surface-2 p-4"
                >
                  <div className="flex size-9 items-center justify-center rounded-md bg-surface-3">
                    {item.type === "event" ? (
                      <Calendar className="w-4 h-4 text-ink-2" />
                    ) : (
                      <Briefcase className="w-4 h-4 text-ink-2" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">{item.title}</p>
                    <Tag variant="neutral" className="mt-1">
                      {item.type}
                    </Tag>
                  </div>
                  <div className="text-right">
                    <p className="font-data font-semibold text-ink">{item.views} views</p>
                    <p className="font-data text-sm text-ink-2">
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

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm text-ink-2">{label}</span>
    </div>
  );
}
