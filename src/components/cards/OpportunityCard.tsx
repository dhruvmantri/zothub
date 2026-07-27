import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { opportunityTypeLabel } from "@/lib/formatters";

/**
 * ONE card anatomy for every item type, so a role and an event read as
 * siblings rather than as two unrelated components (Structure §1).
 *
 * Avatar-card layout: the tile is its own left column; title / club / meta /
 * tags / footer all live in one aligned right column, so every left edge
 * matches and footers line up across a row.
 *
 * The tile is the one intentional differentiator — a club logo for a role, a
 * mono date chip for an event. Different time semantics, signalled by
 * typography rather than by a second hue.
 *
 * Tags sit in a dedicated slot below the meta and never share the title's
 * line, so a card WITH a tag and one WITHOUT stay identical and a long title
 * never gets squeezed by a badge.
 *
 * Accessibility note: the mock draws the whole card as one clickable button
 * with buttons inside it. Nested interactive elements are invalid and
 * unusable with a keyboard, so here the title is the link and the footer
 * actions are real buttons; the card lifts on `group-hover` so it still feels
 * like one target.
 */

interface CardShellProps {
  tile: React.ReactNode;
  title: string;
  href: string;
  club: string;
  meta: React.ReactNode;
  tags?: React.ReactNode;
  footer: React.ReactNode;
}

function CardShell({ tile, title, href, club, meta, tags, footer }: CardShellProps) {
  return (
    <article
      className={cn(
        // `relative` anchors the title's stretched-link overlay, which makes
        // the whole card clickable while keeping exactly one link in the tab
        // order. Footer actions sit above it on z-10.
        "group relative flex gap-3 rounded-lg border border-line bg-surface p-4 shadow-e1",
        "transition-[box-shadow,transform,border-color] duration-base ease-zh",
        "hover:-translate-y-0.5 hover:border-line-2 hover:shadow-e3",
        "focus-within:border-line-2 focus-within:shadow-e3",
      )}
    >
      {tile}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-[18px] font-semibold leading-[1.18] tracking-[-0.018em]">
          <Link
            to={href}
            className="text-ink outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-accent-text focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-2"
          >
            {title}
          </Link>
        </h3>
        <p className="mt-[3px] text-[12.5px] font-semibold text-ink-2">{club}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-3">{meta}</p>
        {tags ? <div className="mt-2 flex flex-wrap gap-1.5">{tags}</div> : null}
        <div className="mt-auto flex gap-2 pt-4">{footer}</div>
      </div>
    </article>
  );
}

/** Square club logo — clubs are rounded-squares, people are circles. */
function ClubTile({ name, logo }: { name: string; logo?: string | null }) {
  return (
    <EntityAvatar
      name={name}
      src={logo}
      kind="org"
      size="md"
      className="size-[46px] shrink-0 text-[15px]"
    />
  );
}

/**
 * The mono date chip. This is what makes an event look different from a role
 * without introducing a second colour.
 */
function DateTile({ date }: { date: Date }) {
  return (
    <div
      aria-hidden
      className="flex size-[46px] shrink-0 flex-col items-center justify-center rounded-[11px] border border-line-2 bg-surface-2 font-mono [font-variant-numeric:tabular-nums]"
    >
      <span className="text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-accent-text">
        {format(date, "MMM")}
      </span>
      <span className="text-[18px] font-semibold leading-[1.2] text-ink">{format(date, "d")}</span>
    </div>
  );
}

function SaveButton({
  saved,
  onToggle,
  label,
}: {
  saved?: boolean;
  onToggle?: () => void;
  label: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="relative z-10 flex-1"
      aria-pressed={saved}
      // Icon-only controls must be labelled; this one previously had no
      // accessible name at all and was a 28px target.
      aria-label={saved ? `Saved: ${label}. Remove from saved` : `Save ${label}`}
      onClick={onToggle}
    >
      {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}

/* ------------------------------- roles -------------------------------- */

export interface OpportunityCardProps {
  id: string;
  title: string;
  clubName: string;
  clubLogo?: string;
  type: string;
  deadline: string;
  /** Raw deadline, used for the "Closing soon" tag. */
  deadlineAt?: string | null;
  description?: string;
  applicants?: number;
  showApplicants?: boolean;
  isBookmarked?: boolean;
  onBookmark?: () => void;
  hasApplied?: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

export function OpportunityCard({
  id,
  title,
  clubName,
  clubLogo,
  type,
  deadline,
  deadlineAt,
  applicants,
  showApplicants = true,
  isBookmarked,
  onBookmark,
  hasApplied,
}: OpportunityCardProps) {
  const closesAt = deadlineAt ? new Date(deadlineAt) : null;
  const closed = !!closesAt && closesAt.getTime() < Date.now();
  const closingSoon = !!closesAt && !closed && closesAt.getTime() - Date.now() < 7 * DAY;

  return (
    <CardShell
      tile={<ClubTile name={clubName} logo={clubLogo} />}
      title={title}
      href={`/opportunities/${id}`}
      club={clubName}
      meta={
        <>
          {deadline}
          {showApplicants && applicants !== undefined && (
            <>
              {" · "}
              <span className="font-data">{applicants}</span> applied
            </>
          )}
        </>
      }
      tags={
        <>
          {closingSoon && <Tag variant="accent">Closing soon</Tag>}
          <Tag variant="neutral">{opportunityTypeLabel(type)}</Tag>
        </>
      }
      footer={
        <>
          <SaveButton saved={isBookmarked} onToggle={onBookmark} label={title} />
          {hasApplied ? (
            <Button variant="secondary" size="sm" className="relative z-10 flex-1" disabled>
              Applied
            </Button>
          ) : closed ? (
            <Button variant="secondary" size="sm" className="relative z-10 flex-1" disabled>
              Closed
            </Button>
          ) : (
            /* The in-app primary verb is ink, not accent — blue is reserved for
               "demands action now", and a list of these would drown in it. */
            <Button variant="ink" size="sm" className="relative z-10 flex-1" asChild>
              <Link to={`/opportunities/${id}`}>Apply</Link>
            </Button>
          )}
        </>
      }
    />
  );
}

/* ------------------------------- events -------------------------------- */

export interface EventCardProps {
  id: string;
  title: string;
  clubName: string;
  clubLogo?: string;
  /** ISO date — the card formats it, so the chip and meta cannot disagree. */
  eventDate: string;
  location: string;
  attendees?: number;
  capacity?: number;
  isBookmarked?: boolean;
  onBookmark?: () => void;
  hasRSVP?: boolean;
}

export function EventCard({
  id,
  title,
  clubName,
  eventDate,
  location,
  attendees,
  capacity,
  isBookmarked,
  onBookmark,
  hasRSVP,
}: EventCardProps) {
  const date = new Date(eventDate);
  const soon = date.getTime() - Date.now() < 3 * DAY && date.getTime() > Date.now();
  const spotsLeft = capacity !== undefined && attendees !== undefined ? capacity - attendees : null;
  const full = spotsLeft !== null && spotsLeft <= 0;

  return (
    <CardShell
      tile={<DateTile date={date} />}
      title={title}
      href={`/events/${id}`}
      club={clubName}
      meta={
        <>
          <span className="font-data">{format(date, "h:mm a")}</span>
          {location ? ` · ${location}` : ""}
          {spotsLeft !== null && (
            <>
              {" · "}
              <span className="font-data">{Math.max(spotsLeft, 0)}</span> left
            </>
          )}
        </>
      }
      tags={
        <>
          {soon && <Tag variant="accent">Starting soon</Tag>}
          <Tag variant="neutral">Event</Tag>
        </>
      }
      footer={
        <>
          <SaveButton saved={isBookmarked} onToggle={onBookmark} label={title} />
          {hasRSVP ? (
            <Button variant="secondary" size="sm" className="relative z-10 flex-1" disabled>
              Going
            </Button>
          ) : full ? (
            <Button variant="secondary" size="sm" className="relative z-10 flex-1" disabled>
              Full
            </Button>
          ) : (
            <Button variant="ink" size="sm" className="relative z-10 flex-1" asChild>
              <Link to={`/events/${id}`}>RSVP</Link>
            </Button>
          )}
        </>
      }
    />
  );
}
