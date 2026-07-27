import { Link, useLocation } from "react-router-dom";

import type { NavItem } from "@/components/nav/navConfig";
import { cn } from "@/lib/utils";

export interface TabBarProps {
  items: NavItem[];
  counts: { messages: number; responses: number };
}

/**
 * Mobile bottom bar — the same four destinations as the desktop bar, in the
 * platform's own idiom. The accent bar sits on the TOP edge here and on the
 * bottom edge up top, so "you are here" reads identically on both.
 *
 * 56px rows plus the safe-area inset keep every tab clear of 44×44 and off the
 * home indicator.
 */
export function TabBar({ items, counts }: TabBarProps) {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 flex border-t border-line bg-surface md:hidden"
    >
      {items.map((item) => {
        const active = item.match(pathname);
        const count = item.count ? counts[item.count] : 0;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2",
              "text-[11px] font-semibold transition-colors duration-fast ease-zh",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              active
                ? "text-accent-text shadow-[inset_0_2px_0_hsl(var(--accent))]"
                : "text-ink-3 hover:text-ink-2",
            )}
          >
            <span className="relative inline-flex">
              <Icon className="size-[22px]" aria-hidden />
              {count > 0 && (
                <span className="absolute -top-1.5 left-3 inline-flex h-4 min-w-3 items-center justify-center rounded-pill border-2 border-surface bg-accent px-1 font-mono text-[9.5px] font-bold leading-none text-accent-ink [font-variant-numeric:tabular-nums]">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
