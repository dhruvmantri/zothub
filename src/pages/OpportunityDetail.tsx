import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Clock, Globe, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

import { RoleBasedLayout } from "@/components/RoleBasedLayout";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/discover/EmptyState";
import { ErrorState } from "@/components/discover/ErrorState";
import { useAuth } from "@/contexts/AuthContext";
import { useTrackView } from "@/hooks/useTrackView";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useOpportunityDetail } from "@/hooks/useOpportunityDetail";
import { ApplicationForm } from "@/components/ApplicationForm";
import { ShareButton } from "@/components/ShareButton";
import { SuccessModal } from "@/components/SuccessModal";
import { opportunityTypeLabel } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Bookmark, BookmarkCheck } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5 shadow-e1">
      <h2 className="text-[18px] font-semibold tracking-[-0.018em] text-ink">{title}</h2>
      <div className="mt-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  // Only for the success modal's two buttons. The READ no longer navigates:
  // a queryFn that redirects on a missing row teleports people mid-read, and
  // it runs on background refetches and retries too (O13).
  const navigate = useNavigate();
  const { user, role } = useAuth();

  // Stays an effect with its ref guard (M20): in a query a cache hit would
  // stop counting views; in a retrying mutation StrictMode would inflate them.
  useTrackView("opportunity", id);

  const { opportunity, isPending, isError, isFetching, refetch, hasApplied } =
    useOpportunityDetail(id);

  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { isBookmarked, toggleBookmark } = useBookmarks("opportunity");
  const isOpportunityBookmarked = id ? isBookmarked(id) : false;

  const handleApplicationSuccess = () => {
    // `hasApplied` is no longer local state — ApplicationForm patches the
    // shared applications cache and invalidates it (M3), which flips this page
    // AND the Applied badge on the roles list from the one write. Setting a
    // local flag here as well would be a second source of truth for the same
    // fact, and the two would disagree the moment the refetch disagreed.
    setShowApplicationForm(false);
    setShowSuccessModal(true);
  };

  const deadlinePassed = !!opportunity?.deadline && new Date(opportunity.deadline) < new Date();

  if (isPending) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <Skeleton className="mb-6 h-9 w-40 rounded-pill" />
          <Skeleton className="h-12 w-3/4" />
          <div className="mt-4 flex gap-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="mt-8 h-40 w-full rounded-lg" />
        </div>
      </RoleBasedLayout>
    );
  }

  // A failed load is NOT a closed role. Checked before the not-found branch so
  // a network hiccup can never tell a student that a posting has closed.
  if (isError) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <ErrorState noun="this role" onRetry={() => refetch()} isRetrying={isFetching} />
        </div>
      </RoleBasedLayout>
    );
  }

  if (!opportunity) {
    return (
      <RoleBasedLayout>
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <EmptyState
            title="That role isn't here —"
            signature="it may have closed."
            body="The posting was removed, or its deadline has passed and it's no longer listed."
            actions={
              <Button asChild>
                <Link to="/opportunities">Browse open roles</Link>
              </Button>
            }
          />
        </div>
      </RoleBasedLayout>
    );
  }

  const club = opportunity.club_profiles;
  const applicantCount = opportunity.applications_count;

  return (
    <RoleBasedLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="border-b border-line bg-surface">
          <div className="container mx-auto max-w-5xl px-4 py-6">
            <Button variant="ghost" size="sm" asChild className="-ml-3 mb-5">
              <Link to="/opportunities">
                <ArrowLeft className="size-4" />
                Discover
              </Link>
            </Button>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <EntityAvatar
                name={club?.club_name}
                src={club?.logo_url}
                kind="org"
                size="xl"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/clubs/${club?.id}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-2 hover:text-accent-text focus-visible:underline focus-visible:outline-none"
                >
                  {club?.club_name}
                </Link>
                <h1 className="mt-0.5 text-[clamp(26px,3.4vw,34px)] font-medium leading-tight tracking-[-0.026em] text-ink">
                  {opportunity.title}
                </h1>

                {/* Tags live in their own slot, never on the title's line. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Tag variant="neutral">{opportunityTypeLabel(opportunity.type)}</Tag>
                  {/* Hidden at zero as well as when the club turned it off: "0 people
                  have applied" on a new posting reads as a verdict rather than
                  a fact (maintainer decisions, 2026-09-20). */}
              {opportunity.show_application_count && applicantCount > 0 && (
                    <span className="text-[13px] text-ink-3">
                      <span className="font-data">{applicantCount}</span>{" "}
                      {applicantCount === 1 ? "person has" : "people have"} applied
                    </span>
                  )}
                  <span className="text-[13px] text-ink-3">
                    Posted{" "}
                    <span className="font-data">
                      {format(new Date(opportunity.created_at), "MMM d")}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {role === "student" && !hasApplied && !deadlinePassed && (
                <Button onClick={() => setShowApplicationForm(true)}>Apply</Button>
              )}
              {hasApplied && (
                <Button variant="secondary" disabled>
                  <CheckCircle2 className="size-4" />
                  Applied
                </Button>
              )}
              {deadlinePassed && !hasApplied && (
                <Button variant="secondary" disabled>
                  <Clock className="size-4" />
                  Closed
                </Button>
              )}
              {!user && (
                <Button asChild>
                  <Link to="/login">Log in to apply</Link>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => id && toggleBookmark(id)}
                aria-pressed={isOpportunityBookmarked}
                aria-label={
                  isOpportunityBookmarked
                    ? `Saved: ${opportunity.title}. Remove from saved`
                    : `Save ${opportunity.title}`
                }
              >
                {isOpportunityBookmarked ? (
                  <BookmarkCheck className="size-4" />
                ) : (
                  <Bookmark className="size-4" />
                )}
                {isOpportunityBookmarked ? "Saved" : "Save"}
              </Button>
              <ShareButton
                url={window.location.href}
                title={opportunity.title}
                description={`${opportunityTypeLabel(opportunity.type)} at ${club?.club_name}`}
                variant="outline"
              />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-4">
              {/* Deadline: accent means "act now", bad means the door is shut. */}
              <div
                className={cn(
                  "flex items-center gap-3 rounded-md border-l-[3px] px-4 py-3",
                  deadlinePassed
                    ? "border-l-bad bg-bad-wash"
                    : opportunity.deadline
                      ? "border-l-accent bg-accent-wash"
                      : "border-l-line-3 bg-surface-2",
                )}
              >
                <Clock
                  aria-hidden
                  className={cn(
                    "size-[18px] shrink-0",
                    deadlinePassed ? "text-bad" : opportunity.deadline ? "text-accent-text" : "text-ink-3",
                  )}
                />
                <p className="text-sm text-ink-2">
                  <span className="font-semibold text-ink">
                    {deadlinePassed
                      ? "Applications closed"
                      : opportunity.deadline
                        ? "Closes"
                        : "Rolling applications"}
                  </span>
                  {opportunity.deadline && (
                    <>
                      {" · "}
                      <span className="font-data">
                        {format(new Date(opportunity.deadline), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </>
                  )}
                  {!opportunity.deadline && " · no deadline, apply any time"}
                </p>
              </div>

              <Section title="About this role">
                {opportunity.description ? (
                  <div className="whitespace-pre-wrap">{opportunity.description}</div>
                ) : (
                  <p className="text-ink-3">The club hasn't added a description yet.</p>
                )}
              </Section>

              {opportunity.requirements && (
                <Section title="What they're looking for">
                  <div className="whitespace-pre-wrap">{opportunity.requirements}</div>
                </Section>
              )}

              {opportunity.application_questions && opportunity.application_questions.length > 0 && (
                <Section title="What you'll be asked">
                  <p className="mb-3 text-[13.5px] text-ink-3">
                    <span className="font-data">{opportunity.application_questions.length}</span>{" "}
                    {opportunity.application_questions.length === 1 ? "question" : "questions"}, so
                    you know before you start.
                  </p>
                  <ol className="flex flex-col gap-2">
                    {opportunity.application_questions.map((q, index) => (
                      <li key={q.id} className="flex gap-2.5 text-[15px]">
                        <span className="font-data shrink-0 text-ink-3">{index + 1}.</span>
                        <span className="text-ink">
                          {q.question}
                          {q.required && (
                            <span className="ml-1 text-bad" aria-label="required">
                              *
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </div>

            {/* About-the-club mini card */}
            <aside className="flex flex-col gap-4">
              <div className="rounded-lg border border-line bg-surface p-5 shadow-e1">
                <h2 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  About the club
                </h2>
                <div className="mt-3 flex items-center gap-3">
                  <EntityAvatar name={club?.club_name} src={club?.logo_url} kind="org" size="lg" />
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">
                    {club?.club_name}
                  </p>
                </div>
                {club?.description && (
                  <p className="mt-3 line-clamp-4 text-sm text-ink-2">{club.description}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link to={`/clubs/${club?.id}`}>View club</Link>
                  </Button>
                  {club?.website_url && (
                    <Button variant="ghost" size="icon-sm" asChild aria-label={`${club.club_name} website`}>
                      <a href={club.website_url} target="_blank" rel="noopener noreferrer">
                        <Globe className="size-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {role === "student" && !hasApplied && !deadlinePassed && (
                <div className="rounded-lg border border-accent-line bg-accent-wash p-5">
                  <p className="text-[15px] font-semibold text-ink">Ready to apply?</p>
                  <p className="mt-1 text-sm text-ink-2">
                    They see your name, year and major — nothing else from your profile.
                  </p>
                  <Button className="mt-4 w-full" onClick={() => setShowApplicationForm(true)}>
                    Start application
                  </Button>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {showApplicationForm && opportunity && (
        <ApplicationForm
          opportunity={opportunity}
          questions={opportunity.application_questions || []}
          onClose={() => setShowApplicationForm(false)}
          onSuccess={handleApplicationSuccess}
        />
      )}

      <SuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Application sent"
        description={`${club?.club_name} has your application for ${opportunity?.title}. You'll hear back either way — you can track it in Activity.`}
        primaryAction={{ label: "Track it in Activity", onClick: () => navigate("/activity") }}
        secondaryAction={{ label: "Keep browsing", onClick: () => navigate("/opportunities") }}
      />
    </RoleBasedLayout>
  );
}
