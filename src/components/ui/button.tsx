import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Buttons are pills (design-system §4). Two "primary" verbs on purpose:
 *   · `default` / `accent` — Pacific blue. The one action that demands it, plus
 *     marketing CTAs. Blue means "act now", so it has to stay scarce.
 *   · `ink`                — the in-app primary verb inside dense lists
 *     (Apply, RSVP). Blue there would drown out the status colours.
 *
 * Height floor is 44px (2.5.5). `sm` is the single exception: 34px on a precise
 * pointer, growing back to 44 on touch, where 34 is not reliably hittable.
 *
 * On the hover rule: the design system warns that in plain CSS a `.btn:hover`
 * (0-2-0) outranks a `.btn-acc` variant (0-1-0), swaps its fill for grey and
 * makes light label text vanish. CVA sidesteps that — each variant emits its
 * own hover class into one flat string, so there is no specificity contest to
 * lose. Keep it that way: never put a hover on the base string that a variant
 * would then have to defend against.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill",
    "text-sm font-medium transition-[background-color,color,box-shadow,filter,transform]",
    "duration-fast ease-zh active:translate-y-px",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-110 hover:shadow-e2",
        accent: "bg-accent text-accent-ink hover:brightness-110 hover:shadow-e2",
        ink: "bg-ink text-surface hover:brightness-150 hover:shadow-e2",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-105 hover:shadow-e2",
        success: "bg-success text-success-foreground hover:brightness-105 hover:shadow-e2",
        outline: "border-[1.5px] border-ink bg-transparent text-ink hover:bg-surface-3",
        secondary: "bg-surface-3 text-ink hover:bg-line-2",
        ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
        link: "text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-5 py-2.5",
        sm: "min-h-[34px] px-3.5 py-1.5 text-[13px] [@media(pointer:coarse)]:min-h-11",
        lg: "min-h-[50px] px-6 py-3 text-[15px]",
        xl: "min-h-[50px] px-8 py-3 text-[15px]",
        icon: "size-11 p-0",
        "icon-sm": "size-9 p-0 [@media(pointer:coarse)]:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
