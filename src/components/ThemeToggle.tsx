import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/**
 * Both themes are genuinely designed, so both have to be reachable — the app
 * previously hard-forced dark via `forcedTheme`, which made half the design
 * unreachable. Light is the default; System is offered but not assumed.
 *
 * Placement (maintainer, 2026-07-25): this segmented control lives in the
 * account menu, which the component library already establishes as the profile
 * home on desktop. Logged-out visitors have no account menu, so the public nav
 * gets `ThemeToggleButton` instead.
 */
export function ThemeToggleGroup({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("flex items-center gap-1 rounded-pill bg-surface-3 p-1", className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        // Before mount `theme` is undefined; render nothing as selected rather
        // than flashing the wrong option as active.
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              // Full 44px floor — there is room for it inside the menu, and a
              // compact exception here would be the only one in the app.
              "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-pill px-2.5 text-[13px] font-medium",
              "transition-colors duration-fast ease-zh",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              active ? "bg-surface font-semibold text-ink shadow-e1" : "text-ink-3 hover:text-ink",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Icon-only fallback for the logged-out public nav. Flips between light and
 * dark; the full three-way choice lives in the account menu once signed in.
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-pill text-ink-2",
        "transition-colors duration-fast ease-zh hover:bg-surface-3 hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {/* Render a stable icon until mounted so the button never flips on hydrate. */}
      {isDark ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
    </button>
  );
}
