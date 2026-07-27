import { cn } from "@/lib/utils";

/**
 * Never a dead end (Foundation, the tiebreaker): every empty state offers the
 * next action.
 *
 * Honest about state (Foundation): an empty result describes the *query*, not
 * the product. "No roles match Internship" — never "we're just getting
 * started". Copy that describes the product's stage does not belong anywhere
 * in the app.
 *
 * The signature italic appears once per view; this is usually the place.
 */
export function EmptyState({
  title,
  signature,
  body,
  actions,
  className,
}: {
  title: string;
  /** Trailing italic-accent phrase — the signature. One per view. */
  signature?: string;
  body?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-line-2 px-6 py-9 text-center",
        className,
      )}
    >
      <h3 className="text-[22px] font-medium leading-tight tracking-[-0.02em] text-ink">
        {title}
        {signature ? <> <span className="sig">{signature}</span></> : null}
      </h3>
      {body ? <p className="mx-auto mt-2 max-w-[38ch] text-sm text-ink-2">{body}</p> : null}
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
