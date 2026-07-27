import { Link, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";

import { Logo } from "@/components/Logo";
import { AccountMenu } from "@/components/nav/AccountMenu";
import type { NavItem } from "@/components/nav/navConfig";
import { cn } from "@/lib/utils";

export interface TopNavProps {
  items: NavItem[];
  role: "student" | "club";
  displayName: string;
  subtitle: string;
  avatarUrl?: string | null;
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
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // px keeps even the shortest label ("Clubs") over 44px wide.
                  "relative inline-flex items-center whitespace-nowrap px-1.5 text-sm transition-colors duration-fast ease-zh",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active
                    ? "font-semibold text-ink shadow-[inset_0_-2px_0_hsl(var(--accent))]"
                    : "font-medium text-ink-2 hover:text-ink",
                )}
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

          <AccountMenu
            role={role}
            displayName={displayName}
            subtitle={subtitle}
            avatarUrl={avatarUrl}
          />
        </div>
      </div>
    </header>
  );
}
