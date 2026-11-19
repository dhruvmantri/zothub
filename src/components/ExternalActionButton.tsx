import { ExternalLink } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * "Apply Externally" / "RSVP Externally" (CP1, maintainer decision 2026-11-19).
 *
 * Replaces ZotHub's own Apply / RSVP on a post that takes responses on the
 * club's own form. It opens that form in a new tab, for EVERY visitor —
 * signed-out included: there is nothing to sign in for, the sign-up happens on
 * the club's page (decision 2026-11-19). The accessible name says it opens a new
 * tab, because a screen-reader user otherwise loses the ZotHub page silently.
 *
 * `href` must already have passed `safeExternalUrl` — the caller decides
 * whether a post is external at all, this component only renders the link.
 */
export function ExternalActionButton({
  href,
  kind,
  className,
  variant,
  size,
}: {
  href: string;
  kind: "apply" | "rsvp";
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const label = kind === "apply" ? "Apply Externally" : "RSVP Externally";
  return (
    <Button asChild className={className} variant={variant} size={size}>
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`}>
        {label}
        <ExternalLink aria-hidden className="size-4" />
      </a>
    </Button>
  );
}
