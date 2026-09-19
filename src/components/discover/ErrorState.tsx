import { RotateCw } from "lucide-react";

import { EmptyState } from "@/components/discover/EmptyState";
import { Button } from "@/components/ui/button";

/**
 * Shown when a read FAILED — deliberately distinct from an empty result.
 *
 * Before this existed, a network failure rendered the same "No clubs yet — check
 * back soon" as a genuinely empty database (UX17c). The app told visitors the
 * site was empty when it wasn't, and offered them nothing to do about it.
 *
 * Built on EmptyState rather than beside it, so a failure and an empty result
 * look like the same product ("consistent beats clever", Foundation rule 4) and
 * the difference is carried by the words and the action, not by a second visual
 * language.
 *
 * The retry is the point: Foundation rule 1 — the tiebreaker — says no message
 * names a problem without offering the remedy.
 */
export function ErrorState({
  /** What failed to load, lowercase, as it reads mid-sentence: "the clubs", "this event". */
  noun,
  onRetry,
  isRetrying = false,
  className,
}: {
  noun: string;
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
}) {
  return (
    <EmptyState
      className={className}
      title="We couldn't load"
      signature={`${noun} just now.`}
      body="That's usually a connection hiccup rather than anything missing. Trying again normally sorts it."
      actions={
        <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
          <RotateCw className={isRetrying ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} aria-hidden />
          {isRetrying ? "Trying…" : "Try again"}
        </Button>
      }
    />
  );
}
