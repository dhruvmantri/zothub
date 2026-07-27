import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";

import { cn } from "@/lib/utils";

export type DiscoverView = "cards" | "list";

/**
 * Density follows the task, not the user (Foundation) — so view switching is
 * first-class on any collection, and the choice persists **per surface**
 * rather than globally: browsing Discover casually and working a long Clubs
 * list are different jobs.
 *
 * Cards is the default: scannable, good for deciding what to look at. List is
 * the denser, club-grouped power view for when you already know.
 */
export function useDiscoverView(surface: string): [DiscoverView, (v: DiscoverView) => void] {
  const storageKey = `zothub:view:${surface}`;
  const [view, setView] = useState<DiscoverView>("cards");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "cards" || stored === "list") setView(stored);
    } catch {
      /* private mode — fall back to the default */
    }
  }, [storageKey]);

  const update = useCallback(
    (v: DiscoverView) => {
      setView(v);
      try {
        localStorage.setItem(storageKey, v);
      } catch {
        /* non-fatal */
      }
    },
    [storageKey],
  );

  return [view, update];
}

const OPTIONS = [
  { value: "cards", label: "Cards", Icon: LayoutGrid },
  { value: "list", label: "List", Icon: Rows3 },
] as const;

export function ViewToggle({
  view,
  onChange,
  className,
}: {
  view: DiscoverView;
  onChange: (v: DiscoverView) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="View density"
      className={cn("inline-flex shrink-0 rounded-pill bg-surface-3 p-[3px]", className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={cn(
              "inline-flex min-h-[38px] items-center gap-1.5 rounded-pill px-3.5 text-[12px] font-semibold",
              "transition-colors duration-fast ease-zh [@media(pointer:coarse)]:min-h-11",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              active ? "bg-surface text-ink shadow-e1" : "text-ink-3 hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
