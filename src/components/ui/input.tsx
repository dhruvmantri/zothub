import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Control boundary is `--line-3` (>=3:1) — WCAG 1.4.11 is part of the AA gate,
 * not just 1.4.3. Radius is `--r2` (10px), deliberately NOT the card radius, or
 * an input starts reading as a nested card. 46px min height clears 2.5.5.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[46px] w-full rounded-md border border-line-3 bg-surface px-3.5 py-2.5 text-[15px] text-ink",
          "transition-[border-color,box-shadow] duration-fast ease-zh",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink",
          "placeholder:text-ink-3",
          "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-bad",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
