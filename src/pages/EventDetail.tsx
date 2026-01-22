import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackView } from "@/hooks/useTrackView";
import { useBookmarks } from "@/hooks/useBookmarks";
import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RSVPForm } from "@/components/RSVPForm";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { ShareButton } from "@/components/ShareButton";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Clock, 
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle,
  XCircle,
  HourglassIcon
} from "lucide-react";
import { format } from "date-fns";
import type { FormQuestion } from "@/types";

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  capacity: number | null;
  banner_url: string | null;
  views: number | null;
  rsvp_questions: FormQuestion[] | null;
  requires_approval: boolean | null;
  club_profiles: {
    id: string;
    club_name: string;
    logo_url: string | null;
  };
  rsvps: { id: string; student_id: string; status: string | null }[];
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  
  // Track page view
  useTrackView('event', id);
  
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasRSVP, setHasRSVP] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [studentProfileId, setStudentProfileId] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [showRSVPForm, setShowRSVPForm] = useState(false);

  // Use centralized bookmark hook
  const { isBookmarked, toggleBookmark } = useBookmarks("event");
  const isEventBookmarked = id ? isBookmarked(id) : false;

  useEffect(() => {
    if (id) {
      fetchEvent();
      if (user) {
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
          rsvps (id, student_id, status)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Parse rsvp_questions from JSON
      const eventData: EventDetail = {
        ...data,
        rsvp_questions: Array.isArray(data.rsvp_questions) 
          ? (data.rsvp_questions as unknown as FormQuestion[]) 
          : null,
      };
      
      setEvent(eventData);
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
        .select("id, status")
        .eq("event_id", id)
        .eq("student_id", profileId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setHasRSVP(data.status !== "cancelled");
        setRsvpStatus(data.status);
      } else {
        setHasRSVP(false);
        setRsvpStatus(null);
      }
    } catch (error) {
      console.error("Error checking RSVP:", error);
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

    if (!studentProfileId || !id || !event) return;

    // If event has RSVP questions, show the form
    if (event.rsvp_questions && event.rsvp_questions.length > 0 && !hasRSVP) {
      setShowRSVPForm(true);
      return;
    }

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
        setRsvpStatus("cancelled");
        toast.success("RSVP cancelled");
        fetchEvent();
      } else {
        // Check capacity
        const confirmedRsvps = event.rsvps.filter(r => r.status === "confirmed").length;
        if (event.capacity && confirmedRsvps >= event.capacity) {
          toast.error("This event is at full capacity");
          return;
        }

        const status = event.requires_approval ? "pending" : "confirmed";

        const { error } = await supabase
          .from("rsvps")
          .insert({ 
            event_id: id, 
            student_id: studentProfileId,
            status,
            answers: [],
          });

        if (error) throw error;
        setHasRSVP(true);
        setRsvpStatus(status);
        
        if (event.requires_approval) {
          toast.success("RSVP submitted! Awaiting approval.");
        } else {
          toast.success("RSVP confirmed!");
        }
        fetchEvent();
      }
    } catch (error) {
      console.error("Error handling RSVP:", error);
      toast.error("Failed to process RSVP");
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleRSVPFormSuccess = () => {
    setShowRSVPForm(false);
    setHasRSVP(true);
    setRsvpStatus(event?.requires_approval ? "pending" : "confirmed");
    fetchEvent();
  };

  const formatEventDate = (date: string) => {
    return format(new Date(date), "EEEE, MMMM d, yyyy");
  };

  const formatEventTime = (date: string) => {
    return format(new Date(date), "h:mm a");
  };

  const isEventPast = event ? new Date(event.event_date) < new Date() : false;
  const confirmedRsvps = event?.rsvps.filter(r => r.status === "confirmed").length ?? 0;
  const spotsLeft = event?.capacity ? event.capacity - confirmedRsvps : null;
  const eventUrl = typeof window !== "undefined" ? window.location.href : "";

  if (loading) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-64 w-full rounded-lg mb-6" />
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-4 w-1/2 mb-8" />
          <Skeleton className="h-32 w-full" />
        </div>
      </RoleBasedLayout>
    );
  }

  if (!event) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Event Not Found</h1>
          <Button onClick={() => navigate("/events")}>Back to Events</Button>
        </div>
      </RoleBasedLayout>
    );
  }

  return (
    <RoleBasedLayout>
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
              <div className="flex items-center gap-2 shrink-0">
                <ShareButton url={eventUrl} title={event.title} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => id && toggleBookmark(id)}
                >
                  {isEventBookmarked ? (
                    <BookmarkCheck className="w-5 h-5 text-primary" />
                  ) : (
                    <Bookmark className="w-5 h-5" />
                  )}
                </Button>
              </div>
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
                    {confirmedRsvps} attending
                    {event.capacity && ` • ${spotsLeft} spots left`}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Add to Calendar */}
            {!isEventPast && hasRSVP && rsvpStatus === "confirmed" && (
              <div className="mb-6">
                <AddToCalendarButton
                  event={{
                    title: event.title,
                    description: event.description || "",
                    location: event.location || "",
                    startDate: new Date(event.event_date),
                    endDate: new Date(new Date(event.event_date).getTime() + 2 * 60 * 60 * 1000),
                  }}
                />
              </div>
            )}

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
                    {hasRSVP && rsvpStatus === "confirmed" ? (
                      <div className="text-center mb-4">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <p className="font-semibold text-foreground">You're registered!</p>
                        <p className="text-sm text-muted-foreground">We'll see you there</p>
                      </div>
                    ) : hasRSVP && rsvpStatus === "pending" ? (
                      <div className="text-center mb-4">
                        <HourglassIcon className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                        <p className="font-semibold text-foreground">RSVP Pending</p>
                        <p className="text-sm text-muted-foreground">Awaiting approval from the organizer</p>
                      </div>
                    ) : (
                      <div className="text-center mb-4">
                        <p className="text-lg font-semibold text-foreground mb-1">
                          {event.capacity ? `${spotsLeft} spots left` : "Open registration"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatEventDate(event.event_date)} at {formatEventTime(event.event_date)}
                        </p>
                        {event.requires_approval && (
                          <Badge variant="secondary" className="mt-2">Requires Approval</Badge>
                        )}
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

      {/* RSVP Form Modal */}
      {showRSVPForm && event && studentProfileId && (
        <RSVPForm
          event={{
            id: event.id,
            title: event.title,
            requires_approval: event.requires_approval ?? false,
            club_profiles: event.club_profiles,
          }}
          questions={event.rsvp_questions || []}
          studentProfileId={studentProfileId}
          onClose={() => setShowRSVPForm(false)}
          onSuccess={handleRSVPFormSuccess}
        />
      )}
    </RoleBasedLayout>
  );
}