import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Globe, Heart, Instagram, Linkedin, Mail, MessageSquare } from "lucide-react";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackView } from "@/hooks/useTrackView";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useClubDetail, useInvalidateClubTeam } from "@/hooks/useClubDetail";
import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/discover/EmptyState";
import { ErrorState } from "@/components/discover/ErrorState";
import { ContactClubDialog } from "@/components/ContactClubDialog";
import { ClubClaimBanner } from "@/components/clubs/ClubClaimBanner";
import { toast } from "sonner";
import { opportunityTypeLabel } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const ClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();

  // Stays an effect with its own ref guard, deliberately: wrapping a view
  // counter in a query means a cache hit stops counting views, and wrapping it
  // in a retrying mutation inflates them under StrictMode (contract M20).
  useTrackView("club", id);

  const {
    club,
    opportunities,
    events,
    team,
    isPending,
    isClubError,
    isOpportunitiesError,
    isEventsError,
    isRefetching,
    refetchClub,
    refetchOpportunities,
    refetchEvents,
  } = useClubDetail(id);

  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  const { isBookmarked, toggleBookmark, isLoading: isFollowLoading } = useBookmarks("club");
  const isFollowing = id ? isBookmarked(id) : false;

  // Realtime team roster. The handler INVALIDATES rather than refetching by
  // hand — and invalidating matters: with `staleTime: 60s` merely marking the
  // data stale would not refetch, so a member added or removed would not appear
  // for a minute despite the change arriving instantly on the socket (T10).
  const invalidateTeam = useInvalidateClubTeam(id);
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`club-team-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_team_members", filter: `club_id=eq.${id}` },
        () => invalidateTeam(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, invalidateTeam]);

  const handleFollowToggle = () => {
    if (!user) {
      toast.error("Log in to follow clubs");
      navigate("/login", { state: { from: `/clubs/${id}` } });
      return;
    }
    if (id) toggleBookmark(id);
  };

  if (isPending) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="mt-6 h-10 w-1/3" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>
      </RoleBasedLayout>
    );
  }

  // A failed load is NOT a missing club. Checked first, so an outage can never
  // tell someone their club's page was removed.
  if (isClubError) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <ErrorState
            noun="this club"
            onRetry={() => refetchClub()}
            isRetrying={isRefetching}
          />
        </div>
      </RoleBasedLayout>
    );
  }

  if (!club) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <EmptyState
            title="That club isn't here —"
            signature="plenty of others are."
            body="The page was removed, or the link is wrong."
            actions={
              <Button asChild>
                <Link to="/clubs">Browse clubs</Link>
              </Button>
            }
          />
        </div>
      </RoleBasedLayout>
    );
  }

  // A ZotSpot-seeded club that no one has claimed yet. It appears like any other
  // club in the directory; here on its own page it gets the claim treatment.
  const isUnclaimed = !!club.source && !club.claimed_at;

  const socials = [
    { url: club.website_url, Icon: Globe, name: "Website" },
    { url: club.instagram_url, Icon: Instagram, name: "Instagram" },
    { url: club.linkedin_url, Icon: Linkedin, name: "LinkedIn" },
    { url: club.discord_url, Icon: MessageSquare, name: "Discord" },
  ].filter((s) => s.url);

  const isRecruiting = opportunities.length > 0;

  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto max-w-5xl px-4 py-6">
            <Button variant="ghost" size="sm" asChild className="-ml-3 mb-5">
              <Link to="/clubs">
                <ArrowLeft className="size-4" />
                Clubs
              </Link>
            </Button>

            {club.banner_url && (
              <img
                src={club.banner_url}
                alt=""
                aria-hidden
                className="mb-5 h-40 w-full rounded-lg border border-line object-cover md:h-52"
              />
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <EntityAvatar
                name={club.club_name}
                src={club.logo_url}
                kind="org"
                size="xxl"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-[clamp(26px,3.4vw,34px)] font-medium leading-tight tracking-[-0.026em] text-ink">
                  {club.club_name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {club.category && <Tag variant="neutral">{club.category}</Tag>}
                  {/* Recruiting status is derived from real open roles, never
                      declared — a club can't accidentally advertise itself as
                      recruiting with nothing posted. */}
                  {isRecruiting && (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ok">
                      <span aria-hidden className="size-[7px] rounded-full bg-current" />
                      Recruiting now
                    </span>
                  )}
                </div>
                {club.description && (
                  <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
                    {club.description}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {user && role === "student" && (
                <Button
                  variant={isFollowing ? "secondary" : "default"}
                  onClick={handleFollowToggle}
                  disabled={isFollowLoading}
                  aria-pressed={isFollowing}
                >
                  <Heart className={cn("size-4", isFollowing && "fill-current")} />
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              )}
              {user && role === "student" && club.user_id && (
                <Button variant="outline" onClick={() => setContactDialogOpen(true)}>
                  <Mail className="size-4" />
                  Message club
                </Button>
              )}
              {socials.map(({ url, Icon, name }) => (
                <Button key={name} variant="outline" size="sm" asChild>
                  <a href={url!} target="_blank" rel="noopener noreferrer">
                    <Icon className="size-4" />
                    {name}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-5xl px-4 py-8">
          {/* Claims are logged-out-only, so the banner is rendered only for signed-out
              visitors — gated here too so no empty spacer is left behind. */}
          {isUnclaimed && !user && (
            <div className="mb-6">
              <ClubClaimBanner
                clubName={club.club_name}
                clubId={club.id}
                sourceUrl={club.source_url}
                importedAt={club.imported_at}
              />
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-6">
              <section>
                <h2 className="mb-3 text-[18px] font-semibold tracking-[-0.018em] text-ink">
                  Open roles
                </h2>
                {isOpportunitiesError ? (
                  /* Never render "Not recruiting right now" for a read that
                     failed — that is a claim about the club, not about us. */
                  <ErrorState
                    noun="this club's open roles"
                    onRetry={() => refetchOpportunities()}
                    isRetrying={isRefetching}
                  />
                ) : opportunities.length === 0 ? (
                  isUnclaimed ? (
                    <EmptyState
                      title="Not on ZotHub yet —"
                      signature="this is an imported listing."
                      body={`${club.club_name} hasn't claimed its page, so it can't post roles or events here yet.`}
                    />
                  ) : (
                    <EmptyState
                      title="Not recruiting right now —"
                      signature="follow to hear first."
                      body={`${club.club_name} has no open roles. Following them puts their next posting in front of you.`}
                    />
                  )
                ) : (
                  <ul className="flex flex-col gap-3">
                    {opportunities.map((opp) => (
                      <li
                        key={opp.id}
                        className="group relative flex items-center gap-3 rounded-lg border border-line bg-surface p-4 shadow-e1 transition-[box-shadow,border-color] duration-base ease-zh hover:border-line-2 hover:shadow-e2"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[16px] font-semibold text-ink">
                            <Link
                              to={`/opportunities/${opp.id}`}
                              className="after:absolute after:inset-0 after:content-[''] group-hover:text-accent-text focus-visible:underline focus-visible:outline-none"
                            >
                              {opp.title}
                            </Link>
                          </h3>
                          <p className="mt-0.5 text-[12.5px] text-ink-3">
                            {opportunityTypeLabel(opp.type)}
                            {opp.deadline && (
                              <>
                                {" · due "}
                                <span className="font-data">
                                  {format(new Date(opp.deadline), "MMM d")}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        {/* A club browsing another club cannot apply. */}
                        <Button
                          variant={role === "club" ? "outline" : "ink"}
                          size="sm"
                          asChild
                          className="relative z-10 shrink-0"
                        >
                          <Link to={`/opportunities/${opp.id}`}>
                            {role === "club" ? "View" : "Apply"}
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {(events.length > 0 || isEventsError) && (
                <section>
                  <h2 className="mb-3 text-[18px] font-semibold tracking-[-0.018em] text-ink">
                    Upcoming events
                  </h2>
                  {isEventsError && (
                    <ErrorState
                      noun="this club's events"
                      onRetry={() => refetchEvents()}
                      isRetrying={isRefetching}
                    />
                  )}
                  <ul className="flex flex-col gap-3">
                    {events.map((event) => {
                      const date = new Date(event.event_date);
                      return (
                        <li
                          key={event.id}
                          className="group relative flex items-center gap-3 rounded-lg border border-line bg-surface p-4 shadow-e1 transition-[box-shadow,border-color] duration-base ease-zh hover:border-line-2 hover:shadow-e2"
                        >
                          <div
                            aria-hidden
                            className="flex size-[46px] shrink-0 flex-col items-center justify-center rounded-[11px] border border-line-2 bg-surface-2 font-mono [font-variant-numeric:tabular-nums]"
                          >
                            <span className="text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-accent-text">
                              {format(date, "MMM")}
                            </span>
                            <span className="text-[18px] font-semibold leading-[1.2] text-ink">
                              {format(date, "d")}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[16px] font-semibold text-ink">
                              <Link
                                to={`/events/${event.id}`}
                                className="after:absolute after:inset-0 after:content-[''] group-hover:text-accent-text focus-visible:underline focus-visible:outline-none"
                              >
                                {event.title}
                              </Link>
                            </h3>
                            <p className="mt-0.5 text-[12.5px] text-ink-3">
                              <span className="font-data">{format(date, "h:mm a")}</span>
                              {event.location ? ` · ${event.location}` : ""}
                            </p>
                          </div>
                          <Button
                            variant={role === "club" ? "outline" : "ink"}
                            size="sm"
                            asChild
                            className="relative z-10 shrink-0"
                          >
                            <Link to={`/events/${event.id}`}>
                              {role === "club" ? "View" : "RSVP"}
                            </Link>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>

            {/* Members — people are circles, so the roster reads as people
                next to the club's own square mark. */}
            {/* No error state for the roster, deliberately. A missing aside
                asserts nothing; "Not recruiting right now" on a failed read
                would assert something false about the club. That is the line. */}
            {team.length > 0 && (
              <aside>
                <div className="rounded-lg border border-line bg-surface p-5 shadow-e1">
                  <h2 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                    Members
                  </h2>
                  <ul className="mt-3 flex flex-col gap-3">
                    {team.map((member) => (
                      <li key={member.id} className="flex items-center gap-3">
                        <EntityAvatar name={member.name} kind="person" size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {member.name || "Member"}
                          </p>
                          <p className="truncate text-[12px] capitalize text-ink-3">{member.role}</p>
                        </div>
                        {user && role === "student" && member.user_id && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            asChild
                            aria-label={`Message ${member.name || "member"}`}
                          >
                            {/* Was `/messages?to=…`, a route that does not exist
                                — every one of these 404'd. Points at the real
                                student inbox; the `?to=` handler that opens the
                                thread lands with Messages. */}
                            <Link to={`/messages?to=${member.user_id}`}>
                              <MessageSquare className="size-4" />
                            </Link>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      {club && club.user_id && (
        <ContactClubDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          clubName={club.club_name}
          clubUserId={club.user_id}
        />
      )}
    </RoleBasedLayout>
  );
};

export default ClubDetail;
