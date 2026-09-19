import { Link } from "react-router-dom";

import { EmptyState } from "@/components/discover/EmptyState";
import { Button } from "@/components/ui/button";

/**
 * Shown when a SIGNED-OUT visitor taps the "Saved" filter chip.
 *
 * The chip is deliberately visible to everyone — hiding it would make the
 * toolbar change shape depending on whether you happen to be logged in. But the
 * ordinary empty state ("You haven't saved any events yet. Save one from a card
 * and it'll wait for you here.") is a dead end for a visitor with no account: it
 * implies they forgot to do something they were never able to do.
 *
 * Foundation rule 1 — never name a problem without offering the remedy. The
 * remedy here is an account, so this is also the one place on the list pages
 * that earns a primary button.
 *
 * Maintainer decision, 2026-09-19 (see docs/BACKLOG.md, UX22).
 *
 * Safe to link at /signup only because this never renders for an authenticated
 * viewer — /signup bounces signed-in visitors to their dashboard.
 */
export function SignInToSaveState({
  /** Plural noun, lowercase, as it reads mid-sentence: "events", "roles". */
  noun,
}: {
  noun: string;
}) {
  return (
    <EmptyState
      title="Saving needs an account —"
      signature="it takes a minute."
      body={`Sign in and the ${noun} you save stay here, on whatever device you open ZotHub on next.`}
      actions={
        <>
          <Button asChild>
            <Link to="/signup">Create account</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/login">Log in</Link>
          </Button>
        </>
      }
    />
  );
}
