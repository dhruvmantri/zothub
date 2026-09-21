import { Link } from "react-router-dom";

import { EntityAvatar } from "@/components/ui/avatar";
import type { ClubCardData } from "@/components/clubs/ClubCard";
import { cn } from "@/lib/utils";

/**
 * The dense view of the club directory (UX13, maintainer decision 2026-09-21).
 *
 * Clubs is the longest list in the app — ~725 rows — and was the only list
 * with no card/list toggle, so finding a club you could not already name meant
 * scrolling three-up cards forever.
 *
 * Deliberately NOT `DiscoverList`. That component groups rows BY CLUB and
 * gives every row a primary verb; a club's club is itself, and there is no
 * verb here beyond opening the profile. Forcing these rows through it would
 * have meant a club header above a single row of itself.
 *
 * One tap target per row, covering the whole row via the title's `::after`,
 * so the row behaves like a link without nesting interactive elements inside
 * one another.
 */
export function ClubList({ clubs }: { clubs: ClubCardData[] }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-line bg-surface shadow-e1">
      {clubs.map((club, index) => (
        <li
          key={club.id}
          className={cn(
            "group relative flex items-center gap-3 px-4 py-3 transition-colors duration-fast ease-zh hover:bg-surface-2",
            index > 0 && "border-t border-line",
          )}
        >
          <EntityAvatar name={club.club_name} src={club.logo_url} kind="org" size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">
              <Link
                to={`/clubs/${club.id}`}
                className="text-ink after:absolute after:inset-0 after:content-[''] group-hover:text-accent-text focus-visible:underline focus-visible:outline-none"
              >
                {club.club_name}
              </Link>
            </p>
            <p className="mt-0.5 truncate text-[12px] text-ink-3">
              {club.category ? `${club.category} · ` : ""}
              {club.opportunity_count > 0 ? (
                <span className="font-semibold text-accent-text">
                  <span className="font-data">{club.opportunity_count}</span>{" "}
                  {club.opportunity_count === 1 ? "role" : "roles"}
                </span>
              ) : (
                "Not recruiting"
              )}
              {club.event_count > 0 && (
                <>
                  {" · "}
                  <span className="font-data">{club.event_count}</span>{" "}
                  {club.event_count === 1 ? "event" : "events"}
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
