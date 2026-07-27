import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * The club's secondary navigation. Replaces the old flat seven-tab
 * `DashboardTabs`: now that the top bar is four destinations
 * (Postings · Responses · Messages · My Club, Structure §5), the sub-tabs are
 * scoped to whichever destination you are in. You never see "Analytics" sitting
 * next to "Applications" again — each destination shows only its own sections.
 *
 * Path-driven, not state-driven, because every section is a real route the club
 * can bookmark and land on. The pill styling matches the student Activity tabs
 * so both sides of the app speak one language.
 */

const isPrefix = (pathname: string, ...prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

interface SubTab {
  to: string;
  label: string;
  count?: number;
  active: (pathname: string) => boolean;
}

export interface ClubSectionNavProps {
  /** Pending counts for the Responses queues. Only shown when > 0. */
  counts?: { applications?: number; rsvps?: number };
}

function getTabs(pathname: string, counts?: ClubSectionNavProps["counts"]): SubTab[] | null {
  // Postings — opportunities and events (also lit by the create/edit forms).
  if (
    isPrefix(
      pathname,
      "/club/dashboard/opportunities",
      "/club/dashboard/events",
      "/club/opportunities",
      "/club/events",
    )
  ) {
    return [
      {
        to: "/club/dashboard/opportunities",
        label: "Opportunities",
        active: (p) => isPrefix(p, "/club/dashboard/opportunities", "/club/opportunities"),
      },
      {
        to: "/club/dashboard/events",
        label: "Events",
        active: (p) => isPrefix(p, "/club/dashboard/events", "/club/events"),
      },
    ];
  }

  // My Club — the club's own overview, team and analytics (the profile editor
  // lives one click deeper, off the Overview).
  if (
    isPrefix(
      pathname,
      "/club/dashboard/overview",
      "/club/dashboard/team",
      "/club/dashboard/analytics",
      "/club/profile",
    )
  ) {
    return [
      {
        to: "/club/dashboard/overview",
        label: "Overview",
        active: (p) => isPrefix(p, "/club/dashboard/overview", "/club/profile"),
      },
      {
        to: "/club/dashboard/team",
        label: "Team",
        active: (p) => isPrefix(p, "/club/dashboard/team"),
      },
      {
        to: "/club/dashboard/analytics",
        label: "Analytics",
        active: (p) => isPrefix(p, "/club/dashboard/analytics"),
      },
    ];
  }

  // Responses — applications and RSVPs. Bare /club/dashboard lands here.
  if (pathname === "/club/dashboard" || isPrefix(pathname, "/club/dashboard/applications", "/club/dashboard/rsvps")) {
    return [
      {
        to: "/club/dashboard/applications",
        label: "Applications",
        count: counts?.applications,
        active: (p) => p === "/club/dashboard" || isPrefix(p, "/club/dashboard/applications"),
      },
      {
        to: "/club/dashboard/rsvps",
        label: "RSVPs",
        count: counts?.rsvps,
        active: (p) => isPrefix(p, "/club/dashboard/rsvps"),
      },
    ];
  }

  return null;
}

export function ClubSectionNav({ counts }: ClubSectionNavProps) {
  const { pathname } = useLocation();
  const tabs = getTabs(pathname, counts);
  if (!tabs) return null;

  return (
    <div className="sticky top-[60px] z-40 border-b border-line bg-surface">
      <div className="container mx-auto max-w-6xl px-4 py-3">
        <div
          role="tablist"
          className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-pill bg-surface-3 p-1 text-ink-3"
        >
          {tabs.map((tab) => {
            const active = tab.active(pathname);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-medium transition-all duration-fast ease-zh",
                  "[@media(pointer:coarse)]:min-h-11",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "bg-surface font-semibold text-ink shadow-e1"
                    : "text-ink-3 hover:text-ink",
                )}
              >
                {tab.label}
                {tab.count && tab.count > 0 ? (
                  <span className="font-data text-[12px] tabular-nums opacity-70">
                    {tab.count > 99 ? "99+" : tab.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
