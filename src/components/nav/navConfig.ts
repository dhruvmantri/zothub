import {
  Building2,
  CalendarDays,
  Compass,
  Inbox,
  ListChecks,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

/**
 * Four fixed destinations per role (Structure §2 student, §5 club). The same
 * items on desktop and mobile, each platform in its own idiom — text links plus
 * an account avatar-menu up top, an icon tab bar at the bottom.
 *
 * What moved, and where it went (maintainer decision, 2026-07-25):
 *   · student "Feed"      → a Following filter on Discover, not a destination
 *   · club "Analytics"    → inside My Club
 *   · club "Team"         → inside My Club
 * Nothing was dropped; three things simply stopped being top-level.
 *
 * Restructured 2026-08-23 (maintainer decision; UX2 + UX6 together):
 *   · "Discover" splits into OPPORTUNITIES and EVENTS as two top-level items.
 *     Events was previously unreachable from the nav entirely — it existed only
 *     as a pre-filtered view of Discover that nothing linked to (UX2).
 *   · MESSAGES leaves the nav row for the top-right icon row, between the
 *     notifications bell and the profile avatar. That is what frees the slot
 *     Events needs, so the four-destinations rule survives intact. It also
 *     reaches mobile for free: the icon row renders at every width, while the
 *     text nav is desktop-only.
 *   · club "Responses" is renamed APPLICANTS — an event RSVP is treated as
 *     applying to the event, so the one word covers both sections of that page.
 */
export interface NavItem {
  /** Absent when the item only groups children — see `children`. */
  to?: string;
  label: string;
  /** Mobile tab bar only — the desktop bar is text, so blue stays scarce. */
  icon: LucideIcon;
  /** Which live count rides on this item, if any. Never a manufactured number. */
  count?: "messages" | "responses";
  /** Active when the path matches exactly, or when it is a prefix. */
  match: (pathname: string) => boolean;
  /**
   * Turns the item into a MENU rather than a destination.
   *
   * A club's "Discover" groups three pages that are equally the point —
   * Opportunities, Events and Clubs — so picking one of them as the thing the
   * label navigates to would be arbitrary, and the other two would be reachable
   * only after landing somewhere the club did not ask for (maintainer
   * decision, 2026-09-20).
   */
  children?: NavItem[];
}

const startsWith =
  (...prefixes: string[]) =>
  (p: string) =>
    prefixes.some((prefix) => p === prefix || p.startsWith(prefix + "/"));

export const STUDENT_NAV: NavItem[] = [
  {
    to: "/opportunities",
    label: "Opportunities",
    icon: Compass,
    match: startsWith("/opportunities"),
  },
  {
    to: "/events",
    label: "Events",
    icon: CalendarDays,
    match: startsWith("/events"),
  },
  { to: "/clubs", label: "Clubs", icon: Building2, match: startsWith("/clubs") },
  {
    to: "/activity",
    label: "Activity",
    icon: ListChecks,
    match: startsWith("/activity", "/profile"),
  },
];

export const CLUB_NAV: NavItem[] = [
  {
    to: "/postings",
    label: "Postings",
    icon: Briefcase,
    // `/postings` already covers `/postings/events` and the create/edit paths.
    match: startsWith("/postings"),
  },
  {
    to: "/applicants",
    label: "Applicants",
    icon: Inbox,
    count: "responses",
    // The club's landing page is the work queue, not a stats page (§5).
    match: (p) =>
      p === "/applicants" || p === "/applicants/events",
  },
  {
    // A club had no way to see the rest of campus at all — not a missing link,
    // a missing destination (UX19). It reuses the student-facing lists rather
    // than building a second discovery surface; the cards there render a
    // neutral "View" for clubs, since they can neither apply, RSVP nor save
    // (maintainer decision, 2026-09-20).
    //
    // A MENU, not a link: the three pages under it are equally the point, so
    // making the label navigate to one of them would be an arbitrary choice
    // that buries the other two behind a page the club never asked for.
    label: "Discover",
    icon: Compass,
    match: startsWith("/opportunities", "/events", "/clubs"),
    children: [
      { to: "/opportunities", label: "Opportunities", icon: Compass, match: startsWith("/opportunities") },
      { to: "/events", label: "Events", icon: CalendarDays, match: startsWith("/events") },
      { to: "/clubs", label: "Clubs", icon: Building2, match: startsWith("/clubs") },
    ],
  },
  {
    // Lands on the club's own Overview (stats + recent items), with Team,
    // Analytics and the profile editor one sub-tab / one click deeper.
    to: "/my-club",
    label: "My Club",
    icon: Building2,
    match: startsWith(
      "/my-club",
      "/my-club/edit",
      "/my-club/team",
      "/my-club/analytics",
    ),
  },
];

/**
 * Where the Messages icon points. Since UX8 both roles share one address —
 * nobody needs the word "student" or "club" in their own address bar — and
 * `pages/Messages.tsx` renders the right inbox for the signed-in account.
 */
/** One address for both inboxes; the page resolves which one by role. */
export const MESSAGES_PATH = "/messages";

export const messagesMatch = startsWith(MESSAGES_PATH);
