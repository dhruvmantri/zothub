import { useState, useEffect, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { Briefcase, Calendar, Eye, Users, ArrowRight, Pencil, ExternalLink } from "lucide-react";

import { ClubLayout } from "@/components/club/ClubLayout";
import { ClubSectionNav } from "@/components/club/ClubSectionNav";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { useClubData } from "@/hooks/useClubData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountIdentity } from "@/hooks/useAccountIdentity";

// Section sub-components (each destination shows only its own).
import { OpportunityManagement } from "@/components/dashboard/OpportunityManagement";
import { EventManagement } from "@/components/dashboard/EventManagement";
import { ApplicationReview } from "@/components/dashboard/ApplicationReview";
import { RSVPReview } from "@/components/dashboard/RSVPReview";
import { TeamManagement } from "@/components/dashboard/TeamManagement";
// Analytics is the only screen that pulls recharts (~400KB), and only the
// Analytics sub-tab needs it — so it loads on demand, not on every dashboard view.
const ClubAnalyticsComponent = lazy(() =>
  import("@/components/dashboard/ClubAnalytics").then((m) => ({ default: m.ClubAnalytics })),
);

/**
 * The club's four destinations all render through this one page — the top nav
 * is Postings · Responses · Messages · My Club (Structure §5), and everything
 * except Messages lives here. Which section shows is driven entirely by the
 * URL, so `<ClubSectionNav>` and the content stay in lockstep.
 *
 * The important IA change from the old dashboard (maintainer decision,
 * 2026-07-25): `/club/dashboard` now lands on the **Responses** work queue, not
 * a stats page. The old overview — stat cards and recent-item lists — was not
 * deleted; it moved into **My Club → Overview**, where a club's own numbers
 * belong.
 */

type Section =
  | "opportunities"
  | "events"
  | "applications"
  | "rsvps"
  | "overview"
  | "team"
  | "analytics";

function getSection(pathname: string): Section {
  if (pathname.startsWith("/club/dashboard/opportunities")) return "opportunities";
  if (pathname.startsWith("/club/dashboard/events")) return "events";
  if (pathname.startsWith("/club/dashboard/rsvps")) return "rsvps";
  if (pathname.startsWith("/club/dashboard/overview")) return "overview";
  if (pathname.startsWith("/club/dashboard/team")) return "team";
  if (pathname.startsWith("/club/dashboard/analytics")) return "analytics";
  // Bare /club/dashboard and /club/dashboard/applications both land on the queue.
  return "applications";
}

const HEADERS: Record<Section, { title: string; subtitle: string }> = {
  opportunities: {
    title: "Postings",
    subtitle: "Everything you've posted — opportunities students apply to, events they RSVP to.",
  },
  events: {
    title: "Postings",
    subtitle: "Everything you've posted — opportunities students apply to, events they RSVP to.",
  },
  applications: {
    title: "Responses",
    subtitle: "Applications and RSVPs waiting on your decision.",
  },
  rsvps: {
    title: "Responses",
    subtitle: "Applications and RSVPs waiting on your decision.",
  },
  overview: {
    title: "My Club",
    subtitle: "Your public profile, your team, and how your postings are doing.",
  },
  team: {
    title: "My Club",
    subtitle: "Your public profile, your team, and how your postings are doing.",
  },
  analytics: {
    title: "My Club",
    subtitle: "Your public profile, your team, and how your postings are doing.",
  },
};

export default function ClubHome() {
  const { user } = useAuth();
  const location = useLocation();
  const { displayName, avatarUrl, isLoading: identityLoading } = useAccountIdentity();
  const [applicationCount, setApplicationCount] = useState(0);
  const [rsvpCount, setRsvpCount] = useState(0);

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
    swapTeamMemberOrder,
  } = useClubData();

  const section = getSection(location.pathname);
  const header = HEADERS[section];

  // Pending applications + pending RSVPs — the counts that ride on the
  // Responses sub-tabs. Same queries the layout already runs for the nav badge.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchCounts = async () => {
      const { data: clubProfile } = await supabase
        .from("club_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!clubProfile || cancelled) return;

      const [{ count: appCount }, { count: pendingRsvps }] = await Promise.all([
        supabase
          .from("applications")
          .select("*, opportunities!inner(club_id)", { count: "exact", head: true })
          .eq("opportunities.club_id", clubProfile.id)
          .eq("status", "pending"),
        supabase
          .from("rsvps")
          .select("*, events!inner(club_id)", { count: "exact", head: true })
          .eq("events.club_id", clubProfile.id)
          .eq("status", "pending"),
      ]);

      if (cancelled) return;
      setApplicationCount(appCount || 0);
      setRsvpCount(pendingRsvps || 0);
    };

    fetchCounts();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Overview stats — computed from the club's own data.
  const totalViews =
    opportunities.reduce((sum, o) => sum + o.views, 0) + events.reduce((sum, e) => sum + e.views, 0);
  const totalApplications = opportunities.reduce((sum, o) => sum + o.applications_count, 0);
  const activeOpportunities = opportunities.filter(
    (o) => o.is_active && (!o.deadline || new Date(o.deadline) > new Date()),
  ).length;
  const upcomingEvents = events.filter((e) => e.is_active && new Date(e.event_date) > new Date()).length;

  const recentOpportunities = opportunities.slice(0, 3);
  const recentEvents = events.filter((e) => new Date(e.event_date) > new Date()).slice(0, 3);

  const renderContent = () => {
    switch (section) {
      case "opportunities":
        return (
          <OpportunityManagement
            opportunities={opportunities}
            isLoading={isLoading}
            onDelete={deleteOpportunity}
          />
        );

      case "events":
        return <EventManagement events={events} isLoading={isLoading} onDelete={deleteEvent} />;

      case "applications":
        return <ApplicationReview />;

      case "rsvps":
        return <RSVPReview />;

      case "team":
        return (
          <TeamManagement
            teamMembers={teamMembers}
            onAddMember={addTeamMember}
            onUpdateMember={updateTeamMember}
            onRemoveMember={removeTeamMember}
            onSwapOrder={swapTeamMemberOrder}
          />
        );

      case "analytics":
        return (
          <Suspense
            fallback={
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            }
          >
            <ClubAnalyticsComponent />
          </Suspense>
        );

      case "overview":
      default:
        return (
          <div className="space-y-8">
            {/* Club identity — who this dashboard belongs to, with the two things
                a club actually does from here: see its public page, edit it. */}
            <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {identityLoading ? (
                  <Skeleton className="size-16 rounded-[26%]" />
                ) : (
                  <EntityAvatar kind="org" name={displayName} src={avatarUrl} size="xl" />
                )}
                <div>
                  {identityLoading ? (
                    <Skeleton className="h-6 w-36" />
                  ) : (
                    <p className="text-lg font-semibold text-ink">{displayName}</p>
                  )}
                  <p className="text-sm text-ink-2">Club</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {clubId && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/clubs/${clubId}`}>
                      <ExternalLink className="size-4" />
                      View public page
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link to="/club/profile">
                    <Pencil className="size-4" />
                    Edit profile
                  </Link>
                </Button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatsCard title="Total views" value={totalViews.toLocaleString()} icon={Eye} />
              <StatsCard title="Applications" value={totalApplications.toString()} icon={Users} />
              <StatsCard
                title="Active opportunities"
                value={activeOpportunities.toString()}
                icon={Briefcase}
              />
              <StatsCard title="Upcoming events" value={upcomingEvents.toString()} icon={Calendar} />
            </div>

            {/* Recent items — quick jumps back into the two Postings queues. */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-ink">
                    <Briefcase className="size-5 text-ink-2" />
                    Recent opportunities
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/club/dashboard/opportunities">
                      View all
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                  ) : recentOpportunities.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-3">
                      No opportunities yet. Post your first one.
                    </p>
                  ) : (
                    recentOpportunities.map((opp) => (
                      <Link
                        key={opp.id}
                        to={`/club/opportunities/${opp.id}/edit`}
                        className="flex items-center justify-between rounded-md border border-line px-3 py-2.5 transition-colors hover:bg-surface-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">{opp.title}</p>
                          <p className="font-data text-xs text-ink-3">
                            {opp.applications_count} applications · {opp.views} views
                          </p>
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-ink">
                    <Calendar className="size-5 text-ink-2" />
                    Upcoming events
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/club/dashboard/events">
                      View all
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
                  ) : recentEvents.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-3">
                      No upcoming events. Create one to bring people together.
                    </p>
                  ) : (
                    recentEvents.map((event) => (
                      <Link
                        key={event.id}
                        to={`/club/events/${event.id}/edit`}
                        className="flex items-center justify-between rounded-md border border-line px-3 py-2.5 transition-colors hover:bg-surface-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">{event.title}</p>
                          <p className="font-data text-xs text-ink-3">
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
        );
    }
  };

  return (
    <ClubLayout>
      {/* Page header band — mirrors the student Activity header so both sides of
          the app share one shape. */}
      <div className="border-b border-line bg-surface">
        <div className="container mx-auto max-w-6xl px-4 py-9">
          <h1 className="text-[clamp(30px,4vw,40px)] font-medium tracking-[-0.03em] text-ink">
            {header.title}
          </h1>
          <p className="mt-2 max-w-2xl text-ink-2">{header.subtitle}</p>
        </div>
      </div>

      <ClubSectionNav counts={{ applications: applicationCount, rsvps: rsvpCount }} />

      <div className="container mx-auto max-w-6xl px-4 py-8">{renderContent()}</div>
    </ClubLayout>
  );
}
