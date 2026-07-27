import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { getStatus, type Audience, type StatusDomain } from "@/lib/status";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  domain: StatusDomain;
  status: string | null | undefined;
  audience?: Audience;
  /**
   * Fires the signature motion once — a badge pop plus a dot pulse and ring.
   * Reserved for a real state change the user just caused (application
   * submitted, decision made, posting published). Never on mount, never looped.
   */
  animateChange?: boolean;
}

/**
 * The single rendering path for status anywhere in the app. Screens pass the
 * raw database value; label, tone and dot all come from `lib/status`, so the
 * two sides of the marketplace can never drift apart in wording or colour.
 */
export function StatusBadge({
  domain,
  status,
  audience = "student",
  animateChange = false,
  className,
  ...props
}: StatusBadgeProps) {
  const { label, tone } = getStatus(domain, status, audience);
  return (
    <Badge
      variant={tone}
      withDot
      className={cn(animateChange && "state-change", className)}
      {...props}
    >
      {label}
    </Badge>
  );
}
