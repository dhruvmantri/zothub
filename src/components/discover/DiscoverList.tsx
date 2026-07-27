import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { EntityAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface DiscoverListRow {
  id: string;
  href: string;
  title: string;
  meta: React.ReactNode;
  tag?: { label: string; urgent?: boolean };
  clubId: string;
  clubName: string;
  clubLogo?: string | null;
  saved?: boolean;
  onSave?: () => void;
  /** Primary verb, already resolved by the caller (Apply / RSVP / Applied…). */
  action: { label: string; disabled?: boolean };
}

/**
 * The denser, club-grouped power view. Grouping rides on a **surface**, not on
 * a hairline — the hairline measured 1.23:1 and was the only thing tying roles
 * to their club, which is not a grouping cue anyone can see. The line stays as
 * reinforcement.
 *
 * Fixed grid tracks so the columns align across every row regardless of which
 * action a row happens to show.
 */
export function DiscoverList({ rows }: { rows: DiscoverListRow[] }) {
  const groups = rows.reduce<Record<string, DiscoverListRow[]>>((acc, row) => {
    (acc[row.clubId] ||= []).push(row);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(groups).map(([clubId, clubRows]) => {
        const { clubName, clubLogo } = clubRows[0];
        return (
          <section
            key={clubId}
            className="overflow-hidden rounded-lg border border-line bg-surface shadow-e1"
          >
            <div className="flex items-center gap-2.5 border-b border-line bg-surface-2 px-4 py-2.5">
              <EntityAvatar name={clubName} src={clubLogo} kind="org" size="sm" />
              <Link
                to={`/clubs/${clubId}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-ink hover:text-accent-text focus-visible:underline focus-visible:outline-none"
              >
                {clubName}
              </Link>
              <span className="font-data text-[12px] text-ink-3">
                {clubRows.length} open
              </span>
            </div>

            <ul className="divide-y divide-line">
              {clubRows.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    // `relative` anchors the title's stretched link, so the hit
                    // region is the whole ~56px row rather than a 23px line of
                    // text. Actions sit above it on z-10.
                    "relative grid items-center gap-3 px-4 py-3",
                    "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(150px,1fr)_190px_120px_170px]",
                    "transition-colors duration-fast ease-zh hover:bg-surface-2",
                  )}
                >
                  <div className="min-w-0">
                    <Link
                      to={row.href}
                      className="block truncate text-[15px] font-semibold text-ink after:absolute after:inset-0 after:content-[''] hover:text-accent-text focus-visible:underline focus-visible:outline-none"
                    >
                      {row.title}
                    </Link>
                    <p className="truncate text-[13px] text-ink-3 md:hidden">{row.meta}</p>
                  </div>

                  <p className="hidden truncate text-[13px] text-ink-3 md:block">{row.meta}</p>

                  <div className="hidden md:block">
                    {row.tag && (
                      <Tag variant={row.tag.urgent ? "accent" : "neutral"}>{row.tag.label}</Tag>
                    )}
                  </div>

                  <div className="relative z-10 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-pressed={row.saved}
                      aria-label={row.saved ? `Saved: ${row.title}. Remove from saved` : `Save ${row.title}`}
                      onClick={row.onSave}
                    >
                      {row.saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
                    </Button>
                    {row.action.disabled ? (
                      <Button variant="secondary" size="sm" disabled>
                        {row.action.label}
                      </Button>
                    ) : (
                      <Button variant="ink" size="sm" asChild>
                        <Link to={row.href}>{row.action.label}</Link>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
