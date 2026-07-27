import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * One status vocabulary, one colour semantic (Structure §4). Five states:
 *   new  — demands action now (accent; the only non-status use of blue here)
 *   ok   — accepted / going / active
 *   warn — reviewed / waiting / pending approval
 *   bad  — declined / closed / cancelled
 *   idle — applied / neutral / draft
 *
 * Colour is never the sole carrier of meaning: every badge renders a label,
 * and `withDot` adds a shape cue on top of the hue.
 *
 * The legacy shadcn variant names stay as aliases so the ~40 existing
 * `<Badge variant="…">` call sites keep rendering correctly while screens are
 * migrated; new code should use the five semantic names.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        new: "bg-accent-wash text-accent-text",
        ok: "bg-ok-wash text-ok",
        warn: "bg-warn-wash text-warn",
        bad: "bg-bad-wash text-bad",
        idle: "bg-surface-3 text-ink-3",
        outline: "border border-line-2 text-ink-2",

        /* legacy aliases — identical pixels to the semantic names above */
        default: "bg-accent-wash text-accent-text",
        accent: "bg-accent-wash text-accent-text",
        success: "bg-ok-wash text-ok",
        destructive: "bg-bad-wash text-bad",
        secondary: "bg-surface-3 text-ink-3",
        muted: "bg-surface-3 text-ink-3",
      },
    },
    defaultVariants: { variant: "idle" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Render the leading dot — the shape cue that keeps meaning off colour alone. */
  withDot?: boolean;
}

function Badge({ className, variant, withDot = false, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {withDot && <span aria-hidden className="dot size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </div>
  );
}

/**
 * Tags are categories, not statuses. Dedicated-slot rule: a tag gets its own
 * slot and never shares a line with flexible content (a title, a name), so a
 * card WITH a tag and one WITHOUT stay identical and titles never get squeezed.
 */
const tagVariants = cva(
  "inline-flex items-center rounded-pill px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.11em] whitespace-nowrap",
  {
    variants: {
      variant: {
        /** accent tag = demands action (New, Closing soon) */
        accent: "bg-accent-wash text-accent-text",
        /** neutral tag = category */
        neutral: "bg-surface-3 text-ink-3",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface TagProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof tagVariants> {}

function Tag({ className, variant, ...props }: TagProps) {
  return <span className={cn(tagVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants, Tag, tagVariants };
