import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  FileText, 
  Bell, 
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Loader2,
  Inbox,
  MessageSquare,
  Users,
  Bookmark,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { StudentLayout } from "@/components/student/StudentLayout";

interface ApplicationData {
  id: string;
  status: string;
  created_at: string;
  opportunity: {
    title: string;
    club: {
      club_name: string;
    };
  };
}

interface RsvpData {
  id: string;
  event: {
    id: string;
    title: string;
    event_date: string;
    club: {
      club_name: string;
    };
  };
}

interface BookmarkedOpportunity {
  id: string;
  title: string;
  deadline: string | null;
  club: { club_name: string };
}

interface BookmarkedEvent {
  id: string;
  title: string;
  event_date: string;
  club: { club_name: string };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [studentProfileId, setStudentProfileId] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationData[]>([]);
  const [rsvps, setRsvps] = useState<RsvpData[]>([]);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [bookmarkedOpportunities, setBookmarkedOpportunities] = useState<BookmarkedOpportunity[]>([]);
  const [bookmarkedEvents, setBookmarkedEvents] = useState<BookmarkedEvent[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();

      // Subscribe to real-time notifications
      const channel = supabase
        .channel("student-notifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Refetch notification count on change
            supabase
              .from("notifications")
              .select("id")
              .eq("user_id", user.id)
              .eq("is_read", false)
              .then(({ data }) => {
                setNotificationCount(data?.length || 0);
              });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Get student profile
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

      setStudentProfileId(studentProfile.id);

      // Fetch all data in parallel
      const [applicationsRes, rsvpsRes, bookmarksRes, notificationsRes, messagesRes, bookmarkedOppsRes, bookmarkedEventsRes] = await Promise.all([
        // Fetch applications
        supabase
          .from("applications")
          .select(`
            id,
            status,
            created_at,
            opportunity:opportunities!inner (
              title,
              club:club_profiles!inner (
                club_name
              )
            )
          `)
          .eq("student_id", studentProfile.id)
          .order("created_at", { ascending: false })
          .limit(5),
        
        // Fetch RSVPs with upcoming events only
        supabase
          .from("rsvps")
          .select(`
            id,
            event:events!inner (
              id,
              title,
              event_date,
              club:club_profiles!inner (
                club_name
              )
            )
          `)
          .eq("student_id", studentProfile.id)
          .gte("event.event_date", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(5),
        
        // Fetch bookmark count
        supabase
          .from("bookmarks")
          .select("id, opportunity_id, event_id, club_id")
          .eq("user_id", user.id),
        
        // Fetch unread notifications count
        supabase
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_read", false),

        // Fetch unread messages count
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .eq("is_read", false),

        // Fetch bookmarked opportunities with details (exclude expired)
        supabase
          .from("bookmarks")
          .select(`
            opportunity:opportunities!inner (
              id, title, deadline,
              club:club_profiles!inner (club_name)
            )
          `)
          .eq("user_id", user.id)
          .not("opportunity_id", "is", null)
          .or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`, { foreignTable: 'opportunities' })
          .limit(5),

        // Fetch bookmarked events with details (exclude past events)
        supabase
          .from("bookmarks")
          .select(`
            event:events!inner (
              id, title, event_date,
              club:club_profiles!inner (club_name)
            )
          `)
          .eq("user_id", user.id)
          .not("event_id", "is", null)
          .gte('event.event_date', new Date().toISOString())
          .limit(5)
      ]);

      if (applicationsRes.error) {
        console.error("Error fetching applications:", applicationsRes.error);
      } else {
        const transformedApps: ApplicationData[] = (applicationsRes.data || []).map((app: any) => ({
          id: app.id,
          status: app.status || "pending",
          created_at: app.created_at,
          opportunity: {
            title: app.opportunity.title,
            club: {
              club_name: app.opportunity.club.club_name
            }
          }
        }));
        setApplications(transformedApps);
      }

      if (rsvpsRes.error) {
        console.error("Error fetching RSVPs:", rsvpsRes.error);
      } else {
        const transformedRsvps: RsvpData[] = (rsvpsRes.data || []).map((rsvp: any) => ({
          id: rsvp.id,
          event: {
            id: rsvp.event.id,
            title: rsvp.event.title,
            event_date: rsvp.event.event_date,
            club: {
              club_name: rsvp.event.club.club_name
            }
          }
        }));
        setRsvps(transformedRsvps);
      }

      if (!bookmarksRes.error) {
        const bookmarks = bookmarksRes.data || [];
        setBookmarkCount(bookmarks.length);
        // Count club follows separately
        const clubFollows = bookmarks.filter((b: any) => b.club_id !== null);
        setFollowingCount(clubFollows.length);
      }

      if (!notificationsRes.error) {
        setNotificationCount(notificationsRes.data?.length || 0);
      }

      if (!messagesRes.error) {
        setUnreadMessageCount(messagesRes.count || 0);
      }

      // Process bookmarked opportunities
      if (!bookmarkedOppsRes.error && bookmarkedOppsRes.data) {
        const opps = bookmarkedOppsRes.data.map((item: any) => ({
          id: item.opportunity.id,
          title: item.opportunity.title,
          deadline: item.opportunity.deadline,
          club: { club_name: item.opportunity.club.club_name }
        }));
        setBookmarkedOpportunities(opps);
      }

      // Process bookmarked events
      if (!bookmarkedEventsRes.error && bookmarkedEventsRes.data) {
        const evts = bookmarkedEventsRes.data.map((item: any) => ({
          id: item.event.id,
          title: item.event.title,
          event_date: item.event.event_date,
          club: { club_name: item.event.club.club_name }
        }));
        setBookmarkedEvents(evts);
      }

    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="accent"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "accepted":
        return <Badge variant="default" className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" />Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "reviewed":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Reviewed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Calculate stats
  const stats = [
    { label: "Applications", value: applications.length, icon: FileText, color: "text-accent" },
    { label: "Following", value: followingCount, icon: Users, color: "text-primary", link: "/student/feed" },
    { label: "Messages", value: unreadMessageCount, icon: MessageSquare, color: "text-emerald-500", link: "/student/messages" },
    { label: "Notifications", value: notificationCount, icon: Bell, color: "text-amber-500", link: "/notifications" },
  ];

  if (isLoading) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Welcome back! 👋
          </h1>
          <p className="text-muted-foreground">
            Track your applications, saved items, and upcoming events.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => {
            const content = (
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-secondary ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            );

            return (
              <Card key={stat.label} className={(stat as any).link ? "hover:bg-secondary/50 transition-colors cursor-pointer" : ""}>
                {(stat as any).link ? (
                  <Link to={(stat as any).link}>{content}</Link>
                ) : (
                  content
                )}
              </Card>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Recent Applications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                Recent Applications
              </CardTitle>
              <CardDescription>Track your application status</CardDescription>
            </CardHeader>
            <CardContent>
              {applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div 
                      key={app.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground">{app.opportunity.title}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {app.opportunity.club.club_name}
                        </p>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No applications yet</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/opportunities">Browse opportunities</Link>
                  </Button>
                </div>
              )}
              {applications.length > 0 && (
                <Button variant="ghost" className="w-full mt-4" asChild>
                  <Link to="/opportunities">View all opportunities</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                Upcoming Events
              </CardTitle>
              <CardDescription>Events you've RSVP'd to</CardDescription>
            </CardHeader>
            <CardContent>
              {rsvps.length > 0 ? (
                <div className="space-y-4">
                  {rsvps.map((rsvp) => (
                    <Link 
                      key={rsvp.id} 
                      to={`/events/${rsvp.event.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors block"
                    >
                      <div>
                        <p className="font-medium text-foreground">{rsvp.event.title}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {rsvp.event.club.club_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">
                          {format(new Date(rsvp.event.event_date), "MMM d, yyyy")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(rsvp.event.event_date), "h:mm a")}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming events</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/events">Explore events</Link>
                  </Button>
                </div>
              )}
              {rsvps.length > 0 && (
                <Button variant="ghost" className="w-full mt-4" asChild>
                  <Link to="/events">View all events</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bookmarked Items */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Saved Opportunities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-primary" />
                Saved Opportunities
              </CardTitle>
              <CardDescription>Opportunities you've bookmarked</CardDescription>
            </CardHeader>
            <CardContent>
              {bookmarkedOpportunities.length > 0 ? (
                <div className="space-y-3">
                  {bookmarkedOpportunities.map((opp) => (
                    <Link 
                      key={opp.id} 
                      to={`/opportunities/${opp.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors block"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{opp.title}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{opp.club.club_name}</span>
                        </p>
                      </div>
                      {opp.deadline && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
                          <Clock className="w-3 h-3" />
                          {format(new Date(opp.deadline), "MMM d")}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bookmark className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No saved opportunities</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/opportunities">Browse opportunities</Link>
                  </Button>
                </div>
              )}
              {bookmarkedOpportunities.length > 0 && (
                <Button variant="ghost" className="w-full mt-4 gap-2" asChild>
                  <Link to="/opportunities">
                    View all saved
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Saved Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-primary" />
                Saved Events
              </CardTitle>
              <CardDescription>Events you've bookmarked</CardDescription>
            </CardHeader>
            <CardContent>
              {bookmarkedEvents.length > 0 ? (
                <div className="space-y-3">
                  {bookmarkedEvents.map((event) => (
                    <Link 
                      key={event.id} 
                      to={`/events/${event.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors block"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{event.title}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{event.club.club_name}</span>
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-sm font-medium text-foreground">
                          {format(new Date(event.event_date), "MMM d")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.event_date), "h:mm a")}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bookmark className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No saved events</p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/events">Explore events</Link>
                  </Button>
                </div>
              )}
              {bookmarkedEvents.length > 0 && (
                <Button variant="ghost" className="w-full mt-4 gap-2" asChild>
                  <Link to="/events">
                    View all saved
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </StudentLayout>
  );
}
