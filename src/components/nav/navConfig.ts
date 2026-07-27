import {
  Building2,
  Compass,
  Inbox,
  ListChecks,
  MessageSquare,
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
 */
export interface NavItem {
  to: string;
  label: string;
  /** Mobile tab bar only — the desktop bar is text, so blue stays scarce. */
  icon: LucideIcon;
  /** Which live count rides on this item, if any. Never a manufactured number. */
  count?: "messages" | "responses";
  /** Active when the path matches exactly, or when it is a prefix. */
  match: (pathname: string) => boolean;
}

const startsWith =
  (...prefixes: string[]) =>
  (p: string) =>
    prefixes.some((prefix) => p === prefix || p.startsWith(prefix + "/"));

export const STUDENT_NAV: NavItem[] = [
  {
    to: "/opportunities",
    label: "Discover",
    icon: Compass,
    // One discovery surface; /events stays a pre-filtered entry point into it,
    // so both light up the same destination.
    match: startsWith("/opportunities", "/events"),
  },
  { to: "/clubs", label: "Clubs", icon: Building2, match: startsWith("/clubs") },
  {
    to: "/student/dashboard",
    label: "Activity",
    icon: ListChecks,
    match: startsWith("/student/dashboard", "/student/feed", "/student/profile"),
  },
  {
    to: "/student/messages",
    label: "Messages",
    icon: MessageSquare,
    count: "messages",
    match: startsWith("/student/messages", "/messages"),
  },
];

export const CLUB_NAV: NavItem[] = [
  {
    to: "/club/dashboard/opportunities",
    label: "Postings",
    icon: Briefcase,
    match: startsWith("/club/dashboard/opportunities", "/club/dashboard/events", "/club/opportunities", "/club/events"),
  },
  {
    to: "/club/dashboard",
    label: "Responses",
    icon: Inbox,
    count: "responses",
    // The club's landing page is the work queue, not a stats page (§5).
    match: (p) =>
      p === "/club/dashboard" ||
      p === "/club/dashboard/applications" ||
      p === "/club/dashboard/rsvps",
  },
  {
    to: "/club/messages",
    label: "Messages",
    icon: MessageSquare,
    count: "messages",
    match: startsWith("/club/messages", "/messages"),
  },
  {
    // Lands on the club's own Overview (stats + recent items), with Team,
    // Analytics and the profile editor one sub-tab / one click deeper.
    to: "/club/dashboard/overview",
    label: "My Club",
    icon: Building2,
    match: startsWith(
      "/club/dashboard/overview",
      "/club/profile",
      "/club/dashboard/team",
      "/club/dashboard/analytics",
    ),
  },
];
