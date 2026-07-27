import { cn } from "@/lib/utils";

/**
 * Filter chip. `aria-pressed` rather than a fake radio, because these are
 * independent toggles from the user's point of view and screen readers should
 * announce the pressed state, not a selection index.
 */
export function FilterChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-4 text-[13px] font-medium",
        "transition-colors duration-fast ease-zh",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-accent-line bg-accent-wash font-semibold text-accent-text"
          : "border-line-2 bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}
