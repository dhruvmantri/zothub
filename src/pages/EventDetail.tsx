import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SmartLayout } from "@/components/SmartLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Clock, 
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  capacity: number | null;
  banner_url: string | null;
  views: number | null;
  club_profiles: {
    id: string;
    club_name: string;
    logo_url: string | null;
  };
  rsvps: { id: string; student_id: string }[];
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [hasRSVP, setHasRSVP] = useState(false);
  const [studentProfileId, setStudentProfileId] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEvent();
      if (user) {
        checkBookmark();
        fetchStudentProfile();
      }
    }
  }, [id, user]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          club_profiles (id, club_name, logo_url),
          rsvps (id, student_id)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setEvent(data);
    } catch (error) {
      console.error("Error fetching event:", error);
      toast.error("Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("student_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setStudentProfileId(data.id);
        checkRSVP(data.id);
      }
    } catch (error) {
      console.error("Error fetching student profile:", error);
    }
  };

  const checkRSVP = async (profileId: string) => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from("rsvps")
        .select("id")
        .eq("event_id", id)
        .eq("student_id", profileId)
        .maybeSingle();

      if (error) throw error;
      setHasRSVP(!!data);
    } catch (error) {
      console.error("Error checking RSVP:", error);
    }
  };

  const checkBookmark = async () => {
    if (!user || !id) return;
    
    try {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", id)
        .maybeSingle();

      if (error) throw error;
      setIsBookmarked(!!data);
    } catch (error) {
      console.error("Error checking bookmark:", error);
    }
  };

  const toggleBookmark = async () => {
    if (!user || !id) {
      toast.error("Please log in to bookmark events");
      return;
    }

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("event_id", id);

        if (error) throw error;
        setIsBookmarked(false);
        toast.success("Bookmark removed");
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ user_id: user.id, event_id: id });

        if (error) throw error;
        setIsBookmarked(true);
        toast.success("Event bookmarked");
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      toast.error("Failed to update bookmark");
    }
  };

  const handleRSVP = async () => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }

    if (role !== "student") {
      toast.error("Only students can RSVP to events");
      return;
    }

    if (!studentProfileId || !id) return;

    setRsvpLoading(true);
    try {
      if (hasRSVP) {
        // Cancel RSVP - need to update status since we can't delete
        const { error } = await supabase
          .from("rsvps")
          .update({ status: "cancelled" })
          .eq("event_id", id)
          .eq("student_id", studentProfileId);

        if (error) throw error;
        setHasRSVP(false);
        toast.success("RSVP cancelled");
        fetchEvent();
      } else {
        // Check capacity
        if (event?.capacity && event.rsvps.length >= event.capacity) {
          toast.error("This event is at full capacity");
          return;
        }

        const { error } = await supabase
          .from("rsvps")
          .insert({ 
            event_id: id, 
            student_id: studentProfileId,
            status: "confirmed"
          });

        if (error) throw error;
        setHasRSVP(true);
        toast.success("RSVP confirmed!");
        fetchEvent();
      }
    } catch (error) {
      console.error("Error handling RSVP:", error);
      toast.error("Failed to process RSVP");
    } finally {
      setRsvpLoading(false);
    }
  };

  const formatEventDate = (date: string) => {
    return format(new Date(date), "EEEE, MMMM d, yyyy");
  };

  const formatEventTime = (date: string) => {
    return format(new Date(date), "h:mm a");
  };

  const isEventPast = event ? new Date(event.event_date) < new Date() : false;
  const spotsLeft = event?.capacity ? event.capacity - event.rsvps.filter(r => r.student_id).length : null;

  if (loading) {
    return (
      <SmartLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-64 w-full rounded-lg mb-6" />
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-4 w-1/2 mb-8" />
          <Skeleton className="h-32 w-full" />
        </div>
      </SmartLayout>
    );
  }

  if (!event) {
    return (
      <SmartLayout>
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Event Not Found</h1>
          <Button onClick={() => navigate("/events")}>Back to Events</Button>
        </div>
      </SmartLayout>
    );
  }

  return (
    <SmartLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/events")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Events
        </Button>

        {event.banner_url && (
          <div className="relative h-64 md:h-80 rounded-lg overflow-hidden mb-6">
            <img
              src={event.banner_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-3xl font-bold text-foreground">{event.title}</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleBookmark}
                className="shrink-0"
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-5 h-5 text-primary" />
                ) : (
                  <Bookmark className="w-5 h-5" />
                )}
              </Button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              {event.club_profiles.logo_url ? (
                <img
                  src={event.club_profiles.logo_url}
                  alt={event.club_profiles.club_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold">
                    {event.club_profiles.club_name.charAt(0)}
                  </span>
                </div>
              )}
              <span className="text-muted-foreground">
                Hosted by <span className="text-foreground font-medium">{event.club_profiles.club_name}</span>
              </span>
            </div>

            <Card className="mb-6">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3 text-foreground">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span>{formatEventDate(event.event_date)}</span>
                </div>
                <div className="flex items-center gap-3 text-foreground">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>{formatEventTime(event.event_date)}</span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-3 text-foreground">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span>{event.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-foreground">
                  <Users className="w-5 h-5 text-primary" />
                  <span>
                    {event.rsvps.length} attending
                    {event.capacity && ` • ${spotsLeft} spots left`}
                  </span>
                </div>
              </CardContent>
            </Card>

            {event.description && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-3">About this event</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </div>

          <div className="md:w-80">
            <Card className="sticky top-24">
              <CardContent className="p-6">
                {isEventPast ? (
                  <div className="text-center">
                    <Badge variant="secondary" className="mb-3">Event Ended</Badge>
                    <p className="text-muted-foreground text-sm">This event has already taken place.</p>
                  </div>
                ) : (
                  <>
                    {hasRSVP ? (
                      <div className="text-center mb-4">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <p className="font-semibold text-foreground">You're registered!</p>
                        <p className="text-sm text-muted-foreground">We'll see you there</p>
                      </div>
                    ) : (
                      <div className="text-center mb-4">
                        <p className="text-lg font-semibold text-foreground mb-1">
                          {event.capacity ? `${spotsLeft} spots left` : "Open registration"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatEventDate(event.event_date)} at {formatEventTime(event.event_date)}
                        </p>
                      </div>
                    )}

                    {role === "student" && (
                      <Button
                        className="w-full"
                        variant={hasRSVP ? "outline" : "default"}
                        onClick={handleRSVP}
                        disabled={rsvpLoading || (!hasRSVP && spotsLeft !== null && spotsLeft <= 0)}
                      >
                        {rsvpLoading ? (
                          "Processing..."
                        ) : hasRSVP ? (
                          <>
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancel RSVP
                          </>
                        ) : spotsLeft !== null && spotsLeft <= 0 ? (
                          "Event Full"
                        ) : (
                          "RSVP Now"
                        )}
                      </Button>
                    )}

                    {!user && (
                      <Button className="w-full" onClick={() => navigate("/login")}>
                        Log in to RSVP
                      </Button>
                    )}

                    {role === "club" && (
                      <p className="text-center text-sm text-muted-foreground">
                        Clubs cannot RSVP to events
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SmartLayout>
  );
}