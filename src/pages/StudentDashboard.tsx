import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Bookmark, Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StudentLayout } from "@/components/student/StudentLayout";
import { EmptyState } from "@/components/discover/EmptyState";
import { Button } from "@/components/ui/button";
import { EntityAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  StudentApplicationData as ApplicationData,
  StudentRSVPData as RsvpData,
  BookmarkedOpportunity,
  BookmarkedEvent,
  FollowedClub,
} from "@/types";

/**
 * Activity — everything the student has *done*, in one place: what they applied
 * to, what they're going to, what they saved, who they follow.
 *
 * This replaces the old "Welcome back 👋" dashboard, which was four vanity stat
 * cards over five-item previews whose "view all" links went to /opportunities —
 * a page that never showed your applications at all. Every list here is the
 * real list, and every row goes where its label says it goes.
 *
 * Status wording comes from lib/status with audience="student", which is where
 * a rejection finally reads "Not selected" to the person who was not selected,
 * while the club's own queue still says "Declined".
 */

type Section = "applications" | "going" | "saved" | "following";

export default function StudentActivity() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [section, setSection] = useState<Section>("applications");
  const [applications, setApplications] = useState<ApplicationData[]>([]);
  const [rsvps, setRsvps] = useState<RsvpData[]>([]);
  const [bookmarkedOpportunities, setBookmarkedOpportunities] = useState<BookmarkedOpportunity[]>([]);
  const [bookmarkedEvents, setBookmarkedEvents] = useState<BookmarkedEvent[]>([]);
  const [followedClubs, setFollowedClubs] = useState<FollowedClub[]>([]);
  const [unfollowing, setUnfollowing] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchActivity();
    }
  }, [user]);

  const fetchActivity = async () => {
    if (!user) return;

    try {
      const { data: studentProfile, error: profileError } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError || !studentProfile) {
        console.error("Error fetching student profile:", profileError);
        setIsLoading(false);
        return;
      }

      // Same queries as before, with two deliberate changes: RSVPs now select
      // `status` (a student who is only waitlisted must not be told they are
      // going), and the five-row preview caps are gone because this page is
      // now the full list rather than a teaser for one.
      const [
        applicationsRes,
        rsvpsRes,
        bookmarkedOppsRes,
        bookmarkedEventsRes,
        followsRes,
      ] = await Promise.all([
        supabase
          .from("applications")
          .select(`
            id,
            status,
            created_at,
            opportunity:opportunities!inner (
              id,
              title,
              club:club_profiles!inner (
                club_name,
                logo_url
              )
            )
          `)
          .eq("student_id", studentProfile.id)
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("rsvps")
          .select(`
            id,
            status,
            event:events!inner (
              id,
              title,
              event_date,
              location,
              club:club_profiles!inner (
                club_name,
                logo_url
              )
            )
          `)
          .eq("student_id", studentProfile.id)
          .gte("event.event_date", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("bookmarks")
          .select(`
            opportunity:opportunities!inner (
              id, title, deadline,
              club:club_profiles!inner (club_name, logo_url)
            )
          `)
          .eq("user_id", user.id)
          .not("opportunity_id", "is", null)
          .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`, {
            foreignTable: "opportunities",
          })
          .limit(100),

        supabase
          .from("bookmarks")
          .select(`
            event:events!inner (
              id, title, event_date,
              club:club_profiles!inner (club_name, logo_url)
            )
          `)
          .eq("user_id", user.id)
          .not("event_id", "is", null)
          .gte("event.event_date", new Date().toISOString())
          .limit(100),

        supabase
          .from("bookmarks")
          .select("club_id")
          .eq("user_id", user.id)
          .not("club_id", "is", null),
      ]);

      if (applicationsRes.error) {
        console.error("Error fetching applications:", applicationsRes.error);
      } else {
        setApplications(
          (applicationsRes.data || []).map((app) => ({
            id: app.id,
            status: app.status || "pending",
            created_at: app.created_at,
            opportunity: {
              id: app.opportunity.id,
              title: app.opportunity.title,
              club: {
                club_name: app.opportunity.club.club_name,
                logo_url: app.opportunity.club.logo_url,
              },
            },
          })),
        );
      }

      if (rsvpsRes.error) {
        console.error("Error fetching RSVPs:", rsvpsRes.error);
      } else {
        setRsvps(
          (rsvpsRes.data || []).map((rsvp) => ({
            id: rsvp.id,
            status: rsvp.status || "confirmed",
            event: {
              id: rsvp.event.id,
              title: rsvp.event.title,
              event_date: rsvp.event.event_date,
              location: rsvp.event.location,
              club: {
                club_name: rsvp.event.club.club_name,
                logo_url: rsvp.event.club.logo_url,
              },
            },
          })),
        );
      }

      if (!bookmarkedOppsRes.error && bookmarkedOppsRes.data) {
        setBookmarkedOpportunities(
          bookmarkedOppsRes.data.map((item) => ({
            id: item.opportunity.id,
            title: item.opportunity.title,
            deadline: item.opportunity.deadline,
            club: {
              club_name: item.opportunity.club.club_name,
              logo_url: item.opportunity.club.logo_url,
            },
          })),
        );
      }

      if (!bookmarkedEventsRes.error && bookmarkedEventsRes.data) {
        setBookmarkedEvents(
          bookmarkedEventsRes.data.map((item) => ({
            id: item.event.id,
            title: item.event.title,
            event_date: item.event.event_date,
            club: {
              club_name: item.event.club.club_name,
              logo_url: item.event.club.logo_url,
            },
          })),
        );
      }

      // Followed clubs used to live on /student/feed. The feed became a filter
      // on Discover, so the list of who you follow — and the only place to
      // unfollow — moved here rather than disappearing.
      if (!followsRes.error) {
        const clubIds = (followsRes.data || [])
          .map((b) => b.club_id)
          .filter(Boolean) as string[];

        if (clubIds.length > 0) {
          const { data: clubs } = await supabase
            .from("club_profiles")
            .select("id, club_name, logo_url")
            .in("id", clubIds);
          setFollowedClubs(clubs || []);
        } else {
          setFollowedClubs([]);
        }
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfollow = async (clubId: string) => {
    if (!user) return;
    setUnfollowing(clubId);
    try {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("club_id", clubId);

      if (error) throw error;

      setFollowedClubs((prev) => prev.filter((c) => c.id !== clubId));
      toast.success("Unfollowed");
    } catch (err) {
      console.error("Error unfollowing:", err);
      toast.error("Failed to unfollow club");
    } finally {
      setUnfollowing(null);
    }
  };

  const savedCount = bookmarkedOpportunities.length + bookmarkedEvents.length;

  /**
   * A saved role you already applied to must not offer "Apply" again — the app
   * does not stop a duplicate application, so an inviting button here is a trap.
   * Both sets come from data already on this page; no extra queries.
   */
  const appliedStatusByOpportunity = useMemo(
    () => new Map(applications.map((a) => [a.opportunity.id, a.status])),
    [applications],
  );
  const rsvpStatusByEvent = useMemo(
    () => new Map(rsvps.map((r) => [r.event.id, r.status])),
    [rsvps],
  );

  const sections: Array<{ value: Section; label: string; count: number }> = useMemo(
    () => [
      { value: "applications", label: "Applications", count: applications.length },
      { value: "going", label: "Going", count: rsvps.length },
      { value: "saved", label: "Saved", count: savedCount },
      { value: "following", label: "Following", count: followedClubs.length },
    ],
    [applications.length, rsvps.length, savedCount, followedClubs.length],
  );

  const total = applications.length + rsvps.length + savedCount;

  return (
    <StudentLayout>
      <div className="min-h-screen">
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto max-w-4xl px-4 py-9">
            <h1 className="text-[clamp(30px,4vw,40px)] font-medium tracking-[-0.03em] text-ink">
              Activity
            </h1>
            <p className="mt-2 max-w-2xl text-ink-2">
              {/* Describes what is here, not how the product is doing. */}
              Everything you've applied to, said yes to, and saved.
            </p>
          </div>
        </div>

        <div className="sticky top-[60px] z-40 border-b border-line bg-surface">
          <div className="container mx-auto max-w-4xl px-4 py-3">
            <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
              <TabsList className="max-w-full justify-start overflow-x-auto">
                {sections.map((s) => (
                  <TabsTrigger key={s.value} value={s.value} className="gap-2">
                    {s.label}
                    {/* A count is only shown when there is something to count —
                        a row of zeros is noise, not information. */}
                    {s.count > 0 && (
                      <span className="font-data text-[12px] tabular-nums opacity-70">
                        {s.count}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="container mx-auto max-w-4xl px-4 py-8">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4"
                >
                  <Skeleton className="size-[38px] shrink-0 rounded-[10px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-pill" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {section === "applications" &&
                (applications.length > 0 ? (
                  <List>
                    {applications.map((app) => (
                      <Row
                        key={app.id}
                        href={`/opportunities/${app.opportunity.id}`}
                        title={app.opportunity.title}
                        clubName={app.opportunity.club.club_name}
                        clubLogo={app.opportunity.club.logo_url}
                        meta={
                          <>
                            Applied{" "}
                            <span className="font-data">
                              {format(new Date(app.created_at), "MMM d")}
                            </span>
                          </>
                        }
                        trailing={
                          <StatusBadge
                            domain="application"
                            status={app.status}
                            audience="student"
                          />
                        }
                      />
                    ))}
                  </List>
                ) : (
                  <EmptyState
                    title="No applications yet —"
                    signature="clubs are hiring."
                    body="Once you apply to a role, it lands here and you can watch its status change."
                    actions={
                      <Button variant="accent" asChild>
                        <Link to="/opportunities">Browse roles</Link>
                      </Button>
                    }
                  />
                ))}

              {section === "going" &&
                (rsvps.length > 0 ? (
                  <List>
                    {rsvps.map((rsvp) => (
                      <Row
                        key={rsvp.id}
                        href={`/events/${rsvp.event.id}`}
                        title={rsvp.event.title}
                        clubName={rsvp.event.club.club_name}
                        clubLogo={rsvp.event.club.logo_url}
                        meta={
                          <>
                            <span className="font-data">
                              {format(new Date(rsvp.event.event_date), "EEE MMM d · h:mm a")}
                            </span>
                            {rsvp.event.location ? ` · ${rsvp.event.location}` : ""}
                          </>
                        }
                        trailing={
                          <StatusBadge domain="rsvp" status={rsvp.status} audience="student" />
                        }
                      />
                    ))}
                  </List>
                ) : (
                  <EmptyState
                    title="Nothing on the calendar —"
                    signature="something's on this week."
                    body="Events you RSVP to show up here, with the date and where to go."
                    actions={
                      <Button variant="accent" asChild>
                        <Link to="/events">Browse events</Link>
                      </Button>
                    }
                  />
                ))}

              {section === "saved" &&
                (savedCount > 0 ? (
                  <div className="space-y-8">
                    {bookmarkedOpportunities.length > 0 && (
                      <section>
                        <SectionHeading>
                          Roles · <span className="font-data">{bookmarkedOpportunities.length}</span>
                        </SectionHeading>
                        <List>
                          {bookmarkedOpportunities.map((opp) => (
                            <Row
                              key={opp.id}
                              href={`/opportunities/${opp.id}`}
                              title={opp.title}
                              clubName={opp.club.club_name}
                              clubLogo={opp.club.logo_url}
                              meta={
                                opp.deadline ? (
                                  <>
                                    Closes{" "}
                                    <span className="font-data">
                                      {format(new Date(opp.deadline), "MMM d")}
                                    </span>
                                  </>
                                ) : (
                                  "No deadline"
                                )
                              }
                              trailing={
                                appliedStatusByOpportunity.has(opp.id) ? (
                                  <StatusBadge
                                    domain="application"
                                    status={appliedStatusByOpportunity.get(opp.id)}
                                    audience="student"
                                  />
                                ) : (
                                  <Button variant="ink" size="sm" asChild className="relative z-10">
                                    <Link to={`/opportunities/${opp.id}`}>Apply</Link>
                                  </Button>
                                )
                              }
                            />
                          ))}
                        </List>
                      </section>
                    )}

                    {bookmarkedEvents.length > 0 && (
                      <section>
                        <SectionHeading>
                          Events · <span className="font-data">{bookmarkedEvents.length}</span>
                        </SectionHeading>
                        <List>
                          {bookmarkedEvents.map((event) => (
                            <Row
                              key={event.id}
                              href={`/events/${event.id}`}
                              title={event.title}
                              clubName={event.club.club_name}
                              clubLogo={event.club.logo_url}
                              meta={
                                <span className="font-data">
                                  {format(new Date(event.event_date), "EEE MMM d · h:mm a")}
                                </span>
                              }
                              trailing={
                                rsvpStatusByEvent.has(event.id) ? (
                                  <StatusBadge
                                    domain="rsvp"
                                    status={rsvpStatusByEvent.get(event.id)}
                                    audience="student"
                                  />
                                ) : (
                                  <Button variant="ink" size="sm" asChild className="relative z-10">
                                    <Link to={`/events/${event.id}`}>RSVP</Link>
                                  </Button>
                                )
                              }
                            />
                          ))}
                        </List>
                      </section>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="Nothing saved yet —"
                    signature="save one and it waits here."
                    body={
                      <>
                        Tap the <Bookmark className="inline size-3.5 align-[-2px]" aria-hidden />{" "}
                        bookmark on any role or event to keep it.
                      </>
                    }
                    actions={
                      <Button variant="outline" asChild>
                        <Link to="/opportunities">Browse roles</Link>
                      </Button>
                    }
                  />
                ))}

              {section === "following" &&
                (followedClubs.length > 0 ? (
                  <>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-ink-3">
                        <span className="font-data text-ink-2">{followedClubs.length}</span>{" "}
                        {followedClubs.length === 1 ? "club" : "clubs"}
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/opportunities?filter=following">See what they've posted</Link>
                      </Button>
                    </div>
                    <List>
                      {followedClubs.map((club) => (
                        <Row
                          key={club.id}
                          href={`/clubs/${club.id}`}
                          title={club.club_name}
                          clubLogo={club.logo_url}
                          clubName={club.club_name}
                          hideClubLine
                          trailing={
                            <Button
                              variant="outline"
                              size="sm"
                              className="relative z-10"
                              disabled={unfollowing === club.id}
                              onClick={() => handleUnfollow(club.id)}
                            >
                              {unfollowing === club.id ? (
                                <>
                                  <Loader2 className="size-4 animate-spin" aria-hidden />
                                  <span className="sr-only">Unfollowing {club.club_name}</span>
                                </>
                              ) : (
                                "Unfollow"
                              )}
                            </Button>
                          }
                        />
                      ))}
                    </List>
                  </>
                ) : (
                  <EmptyState
                    title="Not following anyone yet —"
                    signature="follow a club, see its posts first."
                    body="Following a club puts its new roles and events in a filter on Discover."
                    actions={
                      <Button variant="accent" asChild>
                        <Link to="/clubs">Browse clubs</Link>
                      </Button>
                    }
                  />
                ))}

              {/* One honest line about the whole page, not a stat card wall. */}
              {total > 0 && (
                <p className="mt-8 text-center text-[13px] text-ink-3">
                  <span className="font-data">{total}</span>{" "}
                  {total === 1 ? "thing" : "things"} tracked here.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </StudentLayout>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">
      {children}
    </h2>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-e1">
      {children}
    </ul>
  );
}

/**
 * One activity row. The whole row is the hit area via a stretched link on the
 * title (`relative` here anchors it); anything interactive on the right sits
 * above it on z-10 so Unfollow and Apply stay separately clickable.
 */
function Row({
  href,
  title,
  clubName,
  clubLogo,
  meta,
  trailing,
  hideClubLine = false,
}: {
  href: string;
  title: string;
  clubName: string;
  clubLogo?: string | null;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  hideClubLine?: boolean;
}) {
  return (
    <li
      className={cn(
        "relative flex items-center gap-3 px-4 py-3",
        "transition-colors duration-fast ease-zh hover:bg-surface-2",
      )}
    >
      <EntityAvatar
        name={clubName}
        src={clubLogo}
        kind="org"
        size="sm"
        className="size-[38px] shrink-0"
      />
      <div className="min-w-0 flex-1">
        <Link
          to={href}
          className="block truncate text-[15px] font-semibold text-ink after:absolute after:inset-0 after:content-[''] hover:text-accent-text focus-visible:underline focus-visible:outline-none"
        >
          {title}
        </Link>
        <p className="truncate text-[13px] text-ink-3">
          {!hideClubLine && clubName}
          {!hideClubLine && meta ? " · " : ""}
          {meta}
        </p>
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </li>
  );
}
