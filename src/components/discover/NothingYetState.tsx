import { Link } from "react-router-dom";

import { EmptyState } from "@/components/discover/EmptyState";
import { Button } from "@/components/ui/button";
import { useClubCount } from "@/hooks/useClubCount";

/**
 * What a visitor sees when a discovery list is genuinely empty and no filter
 * is on — which, on launch day, is BOTH of them: production holds 722 clubs,
 * 0 publicly visible events, and 0 roles once the test data is purged
 * (measured 2026-09-21, not assumed).
 *
 * That measurement is the whole design. The previous copy had the two empty
 * pages promising each other — Opportunities said "events are worth a look"
 * and Events said "roles are open though" — so a visitor arriving on an empty
 * site was sent in a circle between two empty pages (UX17a). Both now point at
 * the clubs, the one surface with 722 real things in it.
 *
 * The number is read LIVE from the same cached query the directory uses, so it
 * costs no extra request and can never go stale — which is what keeps it on
 * the right side of "live counts only, no copy describing the product's
 * stage" (Foundation rule 2). "We're onboarding clubs" would have broken it.
 */
export function NothingYetState({
  /** "roles" or "events" — picks the wording, since the two read differently. */
  kind,
}: {
  kind: "roles" | "events";
}) {
  const clubCount = useClubCount();
  // Below 1 (or still loading) the number is not worth saying, and a flashed
  // "0 clubs are here" would be both wrong and dispiriting.
  const hasCount = clubCount !== null && clubCount > 0;

  return (
    <EmptyState
      title={kind === "roles" ? "Nothing open right now —" : "Nothing scheduled right now —"}
      signature={
        hasCount ? `but ${clubCount} clubs are here.` : "the clubs are still here."
      }
      body={
        kind === "roles"
          ? "No club is recruiting at this moment. Follow the ones you care about and their next posting lands here first."
          : "No club has an event coming up. Follow the ones you care about and their next one lands here first."
      }
      actions={
        <Button variant="outline" asChild>
          <Link to="/clubs">{hasCount ? `Browse all ${clubCount} clubs` : "Browse clubs"}</Link>
        </Button>
      }
    />
  );
}
