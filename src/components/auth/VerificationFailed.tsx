import { RotateCw, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";

import { AccountStateCard } from "@/components/auth/AccountStateCard";
import { Button } from "@/components/ui/button";

/**
 * Shown when we could not READ whether this account is allowed here — the role
 * or waitlist request failed (A5, maintainer decision 2026-09-21).
 *
 * It is deliberately neither a pass nor a lock-out. Letting them through was
 * the original bug: a failed read was indistinguishable from an approved
 * account, so one flaky request opened every protected page. But failing
 * closed silently is its own defect in the other direction — an approved
 * student thrown out of a page they are entitled to by one bad moment on the
 * campus wifi, with no explanation. So: say what happened, and offer the retry.
 *
 * Rendered IN PLACE rather than redirected to. A redirect would lose the page
 * they asked for, so a successful retry could not return them to it.
 */
export function VerificationFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <AccountStateCard
      icon={WifiOff}
      title="We couldn't check your account"
      description="That's usually a connection hiccup rather than anything wrong with your account."
      actions={
        <>
          <Button onClick={onRetry}>
            <RotateCw className="mr-2 size-4" aria-hidden />
            Try again
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/help">Get help</Link>
          </Button>
        </>
      }
    />
  );
}
