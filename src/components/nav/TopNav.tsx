import { Link, useLocation } from "react-router-dom";
import { Bell, MessageSquare } from "lucide-react";

import { Logo } from "@/components/Logo";
import { AccountMenu } from "@/components/nav/AccountMenu";
import { MESSAGES_PATH, messagesMatch } from "@/components/nav/navConfig";
import { NavMenu } from "@/components/nav/NavMenu";
import type { NavItem } from "@/components/nav/navConfig";
import { cn } from "@/lib/utils";

export interface TopNavProps {
  items: NavItem[];
  role: "student" | "club";
  displayName: string;
  subtitle: string;
  avatarUrl?: string | null;
  /** Forwarded to AccountMenu so the avatar skeletons instead of flashing the
   *  email-derived initials on every navigation (UX7). */
  isLoading?: boolean;
  counts: { messages: number; responses: number };
  notificationCount: number;
}

/**
 * Desktop bar. One active language across platforms: **an accent bar marks
 * "you are here"** — along the bottom edge here, along the top edge of the
 * mobile tab bar. (v4 had desktop=ink and mobile=accent; consistent beats
 * clever, so they now match.)
 *
 * Desktop items are text, not icons — icons live on the tab bar only. Counts
 * are real unread/pending state; there is never a manufactured number here.
 */
export function TopNav({
  items,
  role,
  displayName,
  subtitle,
  avatarUrl,
  isLoading,
  counts,
  notificationCount,
}: TopNavProps) {
  const { pathname } = useLocation();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-[10px]">
      <div className="container mx-auto flex min-h-[60px] items-stretch gap-6 px-4">
        <div className="flex items-center">
          <Logo />
        </div>

        <nav aria-label="Main" className="hidden items-stretch gap-6 md:flex">
          {items.map((item) => {
            const active = item.match(pathname);
            const count = item.count ? counts[item.count] : 0;

            const linkClass = cn(
              // px keeps even the shortest label ("Clubs") over 44px wide.
              "relative inline-flex items-center whitespace-nowrap px-1.5 text-sm transition-colors duration-fast ease-zh",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "font-semibold text-ink shadow-[inset_0_-2px_0_hsl(var(--accent))]"
                : "font-medium text-ink-2 hover:text-ink",
            );

            // An item with children groups destinations instead of being one.
            if (item.children?.length) {
              return (
                <NavMenu key={item.label} item={item} variant="top" className={linkClass} />
              );
            }

            return (
              <Link
                key={item.to}
                to={item.to!}
                aria-current={active ? "page" : undefined}
                className={linkClass}
              >
                {item.label}
                {count > 0 && (
                  <span className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-accent px-1.5 font-mono text-[10.5px] font-bold leading-none text-accent-ink [font-variant-numeric:tabular-nums]">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <Link
            to="/notifications"
            aria-label={
              notificationCount > 0
                ? `Notifications, ${notificationCount} unread`
                : "Notifications"
            }
            className={cn(
              "relative inline-flex size-11 items-center justify-center rounded-pill text-ink-2",
              "transition-colors duration-fast ease-zh hover:bg-surface-3 hover:text-ink",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              pathname === "/notifications" && "bg-surface-3 text-ink",
            )}
          >
            <Bell className="size-[18px]" aria-hidden />
            {notificationCount > 0 && (
              <span
                aria-hidden
                className="absolute right-2.5 top-2.5 size-2 rounded-full border-2 border-surface bg-accent"
              />
            )}
          </Link>

          {/* Messages moved out of the nav row and into this icon row
              (maintainer decision, 2026-08-23). That is what frees the fourth
              text slot for Events, which had no nav entry at all. It also
              reaches mobile for free — this row renders at every width, while
              the text nav above is desktop-only. Order is the maintainer's and
              is fixed: notifications, MESSAGES, you — messages sits BETWEEN the
              bell and the avatar (decision, 2026-08-23). */}
          <Link
            to={MESSAGES_PATH}
            aria-label={
              counts.messages > 0
                ? `Messages, ${counts.messages} unread`
                : "Messages"
            }
            className={cn(
              "relative inline-flex size-11 items-center justify-center rounded-pill text-ink-2",
              "transition-colors duration-fast ease-zh hover:bg-surface-3 hover:text-ink",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              messagesMatch(pathname) && "bg-surface-3 text-ink",
            )}
          >
            <MessageSquare className="size-[18px]" aria-hidden />
            {counts.messages > 0 && (
              <span
                aria-hidden
                className="absolute right-2.5 top-2.5 size-2 rounded-full border-2 border-surface bg-accent"
              />
            )}
          </Link>

          <AccountMenu
            role={role}
            displayName={displayName}
            subtitle={subtitle}
            avatarUrl={avatarUrl}
            isLoading={isLoading}
          />
        </div>
      </div>
    </header>
  );
}
