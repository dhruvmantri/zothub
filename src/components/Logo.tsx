import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

interface LogoProps {
  linkTo?: string | null;
  className?: string;
  /** 20px in app chrome; 17px on the mobile top bar. */
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "text-[17px]",
  md: "text-[20px]",
  lg: "text-[26px]",
} as const;

/**
 * The wordmark: `zot` upright in ink, `hub` italic in accent, one line.
 *
 * The italic is load-bearing — the same move as the signature phrase, and the
 * reason the typeface is Instrument Sans (its true italic is a real design,
 * not a slant). Rendered from the live webfont rather than traced to paths, so
 * it stays theme-correct and crisp at any size.
 *
 * Spec (design-system.html §01, source of truth): Instrument Sans 700, `zot` in
 * --ink, italic `hub` in --accent-text (light) / --accent (dark), tracking
 * -0.045em. The outlined favicon / app-icon / social set ships in /public + /brand.
 */
export function Logo({ linkTo = "/", className, size = "md" }: LogoProps) {
  const mark = (
    <span
      className={cn(
        "select-none font-bold leading-none tracking-[-0.045em] text-ink",
        SIZES[size],
        className,
      )}
    >
      zot<i className="italic text-accent-text dark:text-accent">hub</i>
    </span>
  );

  if (!linkTo) return mark;

  return (
    <Link
      to={linkTo}
      aria-label="ZotHub home"
      className="inline-flex min-h-11 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {mark}
    </Link>
  );
}
