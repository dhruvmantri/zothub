import { cn } from "@/lib/utils";

/**
 * A directional shimmer rather than a pulse — it reads as "loading in", not as
 * a broken element blinking. Dies under prefers-reduced-motion via the global
 * rule in index.css.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-sm bg-[linear-gradient(90deg,hsl(var(--bg-3))_25%,hsl(var(--bg-2))_37%,hsl(var(--bg-3))_63%)] bg-[length:400%_100%]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
