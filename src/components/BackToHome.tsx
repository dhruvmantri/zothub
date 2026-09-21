import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one way out of a page that sits outside the app shell.
 *
 * Login, the first Sign-up screen and both waitlist screens had no back
 * affordance at all (`UX3`): a visitor who pressed "Get started" and changed
 * their mind had the browser's Back button and nothing else, and the waitlist
 * pages' only control was **Sign Out**, which destroys the session to leave a
 * page. `/help`, `/forgot-password` and `/privacy` already did this correctly,
 * so this is that pattern extracted rather than invented — the maintainer chose
 * it on 2026-09-21 precisely because it was already in the product.
 *
 * Placement is the caller's, because these pages do not agree on where the top
 * left is: Login's left half is a dark decorative panel, so an absolutely
 * positioned link would land on it invisibly.
 */
export function BackToHome({
  className,
  to = "/",
  label = "Back to Home",
}: {
  className?: string;
  to?: string;
  label?: string;
}) {
  return (
    <Button variant="ghost" size="sm" asChild className={cn("-ml-2", className)}>
      <Link to={to}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
