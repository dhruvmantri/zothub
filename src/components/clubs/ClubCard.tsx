import { Link } from "react-router-dom";
import { Globe, Instagram, Linkedin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/ui/avatar";

export interface ClubCardData {
  id: string;
  club_name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  opportunity_count: number;
  event_count: number;
}

/**
 * One club tile for the Clubs directory. Deliberately owner-agnostic: it renders
 * purely from public club fields, so a ZotSpot-seeded (unclaimed) club is
 * INDISTINGUISHABLE here from a claimed one (maintainer decision) — a missing
 * logo falls back to the initials avatar, a missing description reads
 * "No description yet.", and zero postings read "Not recruiting". The unclaimed
 * distinction (claim banner + source line) lives only on the club's profile page.
 *
 * The card title is `truncate`, so its min-content width is the WHOLE club
 * name — and a grid item defaults to `min-width: auto`, which refuses to
 * shrink below that. Any grid holding these cards must therefore declare a
 * base `grid-cols-1` (Tailwind expands it to `minmax(0, 1fr)`); without it a
 * single implicit column sizes to the longest club name and the page scrolls
 * sideways on a phone. That is not hypothetical: it shipped, and the Clubs
 * directory measured 1357px wide inside a 390px viewport.
 */
export function ClubCard({ club }: { club: ClubCardData }) {
  return (
    <article className="group relative flex flex-col rounded-lg border border-line bg-surface p-5 shadow-e1 transition-[box-shadow,transform,border-color] duration-base ease-zh hover:-translate-y-0.5 hover:border-line-2 hover:shadow-e3">
      <div className="flex gap-3">
        <EntityAvatar
          name={club.club_name}
          src={club.logo_url}
          kind="org"
          size="lg"
          className="size-[52px] shrink-0 text-[19px]"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[18px] font-semibold leading-tight tracking-[-0.018em]">
            <Link
              to={`/clubs/${club.id}`}
              className="text-ink after:absolute after:inset-0 after:content-[''] group-hover:text-accent-text focus-visible:underline focus-visible:outline-none"
            >
              {club.club_name}
            </Link>
          </h2>
          {club.category && (
            <div className="mt-1.5">
              <Tag variant="neutral">{club.category}</Tag>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-ink-2">
        {club.description || "No description yet."}
      </p>

      <p className="mt-3 text-[12.5px] text-ink-3">
        {club.opportunity_count > 0 ? (
          <span className="font-semibold text-accent-text">
            <span className="font-data">{club.opportunity_count}</span> open{" "}
            {club.opportunity_count === 1 ? "role" : "roles"}
          </span>
        ) : (
          "Not recruiting"
        )}
        {/* Hidden at zero, matching ClubList and the 2026-09-20 decision that
            a count of zero is noise rather than information. The card used to
            read "Not recruiting · 0 events", which is the same nothing said
            twice — and it disagreed with the list view of the same club. */}
        {club.event_count > 0 && (
          <>
            {" · "}
            <span className="font-data">{club.event_count}</span>{" "}
            {club.event_count === 1 ? "event" : "events"}
          </>
        )}
      </p>

      {(club.website_url || club.instagram_url || club.linkedin_url) && (
        <div className="relative z-10 mt-auto flex gap-1 pt-4">
          {[
            { url: club.website_url, Icon: Globe, name: "website" },
            { url: club.instagram_url, Icon: Instagram, name: "Instagram" },
            { url: club.linkedin_url, Icon: Linkedin, name: "LinkedIn" },
          ]
            .filter((l) => l.url)
            .map(({ url, Icon, name }) => (
              <Button
                key={name}
                variant="ghost"
                size="icon-sm"
                asChild
                aria-label={`${club.club_name} ${name}`}
              >
                <a href={url!} target="_blank" rel="noopener noreferrer">
                  <Icon className="size-4" />
                </a>
              </Button>
            ))}
        </div>
      )}
    </article>
  );
}
