import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Bookmark, BookmarkCheck, Calendar, Clock, MapPin, Users } from "lucide-react";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackView } from "@/hooks/useTrackView";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useEventRSVP } from "@/hooks/useEventRSVP";
import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/discover/EmptyState";
import { toast } from "sonner";
import { RSVPForm } from "@/components/RSVPForm";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { ShareButton } from "@/components/ShareButton";
import { cn } from "@/lib/utils";
import type { FormQuestion } from "@/types";

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  capacity: number | null;
  banner_url: string | null;
  rsvp_questions: FormQuestion[] | null;
  requires_approval: boolean | null;
  club_profiles: {
    id: string;
    club_name: string;
    logo_url: string | null;
  };
  rsvps: { id: string; student_id: string; status: string | null }[];
}

/**
 * Event detail is bucket B — the mocks never drew it. Built by extending the
 * opportunity-detail pattern rather than inventing a second one, so the two
 * halves of Discover lead somewhere that feels like the same product: same
 * header shape, same about-the-club mini-card, same sidebar action panel.
 *
 * The one intentional difference is the mono date block, which is the same
 * device the cards use to say "event" without a second colour.
 */
export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  useTrackView("event", id);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const { isBookmarked, toggleBookmark } = useBookmarks("event");
  const isEventBookmarked = id ? isBookmarked(id) : false;

  const fetchEvent = useCallback(async () => {
    if (!id) return;

    try {
      // rsvp_questions is only needed by the (auth-only) RSVP form, so it is
      // requested only when logged in — anon has no column grant for it.
      const { data, error } = (await supabase
        .from("events")
        .select(
          `id, title, description, event_date, location, capacity, banner_url, requires_approval, ${user ? "rsvp_questions, " : ""}club_profiles (id, club_name, logo_url), rsvps (id, student_id, status)`
        )
        .eq("id", id)
        .single()) as unknown as {
          data: (Omit<EventDetail, "rsvp_questions"> & { rsvp_questions?: unknown }) | null;
          error: { message: string } | null;
        };

      if (error) throw error;
      if (!data) throw new Error("Event not found");

      setEvent({
        ...data,
        rsvp_questions: Array.isArray(data.rsvp_questions)
          ? (data.rsvp_questions as unknown as FormQuestion[])
          : null,
      });
    } catch (error) {
      console.error("Error fetching event:", error);
      toast.error("Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const {
    studentProfileId,
    hasRSVP,
    rsvpStatus,
    rsvpLoading,
    showRSVPForm,
    setShowRSVPForm,
    handleRSVP,
    handleRSVPFormSuccess,
    confirmedRsvps,
    spotsLeft,
  } = useEventRSVP(id, event, fetchEvent);

  if (loading) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <Skeleton className="mb-6 h-9 w-40 rounded-pill" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="mt-8 h-40 w-full rounded-lg" />
        </div>
      </RoleBasedLayout>
    );
  }

  if (!event) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <EmptyState
            title="That event isn't here —"
            signature="something else might be."
            body="It was removed, or the link is wrong."
            actions={
              <Button asChild>
                <Link to="/events">Browse events</Link>
              </Button>
            }
          />
        </div>
      </RoleBasedLayout>
    );
  }

  const date = new Date(event.event_date);
  const isPast = date < new Date();
  const club = event.club_profiles;
  const full = spotsLeft !== null && spotsLeft <= 0;

  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto max-w-5xl px-4 py-6">
            <Button variant="ghost" size="sm" asChild className="-ml-3 mb-5">
              <Link to="/events">
                <ArrowLeft className="size-4" />
                Events
              </Link>
            </Button>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {/* The mono date block — same device the cards use. */}
              <div
                aria-hidden
                className="flex size-16 shrink-0 flex-col items-center justify-center rounded-[16px] border border-line-2 bg-surface-2 font-mono [font-variant-numeric:tabular-nums]"
              >
                <span className="text-[10px] font-bold uppercase leading-none tracking-[0.1em] text-accent-text">
                  {format(date, "MMM")}
                </span>
                <span className="text-[26px] font-semibold leading-tight text-ink">
                  {format(date, "d")}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  to={`/clubs/${club?.id}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-2 hover:text-accent-text focus-visible:underline focus-visible:outline-none"
                >
                  {club?.club_name}
                </Link>
                <h1 className="mt-0.5 text-[clamp(26px,3.4vw,34px)] font-medium leading-tight tracking-[-0.026em] text-ink">
                  {event.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Tag variant="neutral">Event</Tag>
                  {event.requires_approval && <Tag variant="accent">Approval needed</Tag>}
                  {isPast && <Tag variant="neutral">Ended</Tag>}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => id && toggleBookmark(id)}
                aria-pressed={isEventBookmarked}
                aria-label={
                  isEventBookmarked
                    ? `Saved: ${event.title}. Remove from saved`
                    : `Save ${event.title}`
                }
              >
                {isEventBookmarked ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                {isEventBookmarked ? "Saved" : "Save"}
              </Button>
              <ShareButton
                url={typeof window !== "undefined" ? window.location.href : ""}
                title={event.title}
                description={`Event at ${club?.club_name}`}
                variant="outline"
              />
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-5xl px-4 py-8">
          {event.banner_url && (
            <img
              src={event.banner_url}
              alt=""
              aria-hidden
              className="mb-6 h-56 w-full rounded-lg border border-line object-cover md:h-72"
            />
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-4">
              <section className="rounded-lg border border-line bg-surface p-5 shadow-e1">
                <dl className="flex flex-col gap-3 text-[15px]">
                  {/* Data voice is decided by what the value IS, not by who
                      typed it — a club types the date, the time, the capacity
                      AND the room, so authorship cannot be the discriminator.
                      Mono + tabular-nums earns its place on values that get
                      scanned, compared or stacked, because equal-width digits
                      stop "1 going" → "10 going" from shifting the layout.
                      Location is free text (these events contain "DBH 111" and
                      "idk"), and arbitrary prose set in mono reads as code. */}
                  {[
                    { Icon: Calendar, label: "Date", value: format(date, "EEEE, MMMM d, yyyy"), data: true },
                    { Icon: Clock, label: "Time", value: format(date, "h:mm a"), data: true },
                    ...(event.location
                      ? [{ Icon: MapPin, label: "Location", value: event.location, data: false }]
                      : []),
                    {
                      Icon: Users,
                      label: "Attending",
                      value:
                        event.capacity !== null
                          ? `${confirmedRsvps} going · ${Math.max(spotsLeft ?? 0, 0)} spots left`
                          : `${confirmedRsvps} going`,
                      data: true,
                    },
                  ].map(({ Icon, label, value, data }) => (
                    <div key={label} className="flex items-center gap-3">
                      <Icon aria-hidden className="size-[18px] shrink-0 text-ink-3" />
                      <dt className="sr-only">{label}</dt>
                      <dd className={cn("text-ink", data && "font-data")}>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="rounded-lg border border-line bg-surface p-5 shadow-e1">
                <h2 className="text-[18px] font-semibold tracking-[-0.018em] text-ink">
                  About this event
                </h2>
                <div className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">
                  {event.description || (
                    <span className="text-ink-3">The club hasn't added a description yet.</span>
                  )}
                </div>
              </section>
            </div>

            <aside className="flex flex-col gap-4">
              {/* RSVP panel — every state offers the next action. */}
              <div
                className={cn(
                  "rounded-lg border p-5",
                  isPast
                    ? "border-line bg-surface-2"
                    : hasRSVP
                      ? "border-line bg-surface shadow-e1"
                      : "border-accent-line bg-accent-wash",
                )}
              >
                {isPast ? (
                  <>
                    <p className="text-[15px] font-semibold text-ink">This event has ended</p>
                    <p className="mt-1 text-sm text-ink-2">
                      {club?.club_name} may post another — following them puts it in front of you.
                    </p>
                    <Button variant="outline" className="mt-4 w-full" asChild>
                      <Link to={`/clubs/${club?.id}`}>View club</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    {hasRSVP && rsvpStatus ? (
                      <div className="flex items-center gap-2">
                        <StatusBadge domain="rsvp" status={rsvpStatus} audience="student" />
                      </div>
                    ) : (
                      <p className="text-[15px] font-semibold text-ink">
                        {event.capacity !== null
                          ? `${Math.max(spotsLeft ?? 0, 0)} spots left`
                          : "Open registration"}
                      </p>
                    )}

                    <p className="mt-2 text-sm text-ink-2">
                      {hasRSVP && rsvpStatus === "confirmed"
                        ? "You're on the list. Add it to your calendar so it doesn't sneak up on you."
                        : hasRSVP && rsvpStatus === "pending"
                          ? `${club?.club_name} approves each RSVP — you'll hear back.`
                          : event.requires_approval
                            ? "The club approves each RSVP, so this isn't instant."
                            : "RSVP takes one tap. You can cancel any time."}
                    </p>

                    {role === "student" && (
                      <Button
                        className="mt-4 w-full"
                        variant={hasRSVP ? "outline" : "default"}
                        onClick={handleRSVP}
                        disabled={rsvpLoading || (!hasRSVP && full)}
                      >
                        {rsvpLoading
                          ? "Working…"
                          : hasRSVP
                            ? "Cancel RSVP"
                            : full
                              ? "Event full"
                              : "RSVP"}
                      </Button>
                    )}

                    {!user && (
                      <Button className="mt-4 w-full" asChild>
                        <Link to="/login">Log in to RSVP</Link>
                      </Button>
                    )}

                    {role === "club" && (
                      <p className="mt-4 text-sm text-ink-3">
                        Clubs can't RSVP — this is how students see your event.
                      </p>
                    )}

                    {hasRSVP && rsvpStatus === "confirmed" && (
                      <div className="mt-3">
                        <AddToCalendarButton
                          className="w-full"
                          event={{
                            title: event.title,
                            description: event.description || "",
                            location: event.location || "",
                            startDate: date,
                            endDate: new Date(date.getTime() + 2 * 60 * 60 * 1000),
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-lg border border-line bg-surface p-5 shadow-e1">
                <h2 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  Hosted by
                </h2>
                <div className="mt-3 flex items-center gap-3">
                  <EntityAvatar name={club?.club_name} src={club?.logo_url} kind="org" size="lg" />
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                    {club?.club_name}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                  <Link to={`/clubs/${club?.id}`}>View club</Link>
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </div>

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
