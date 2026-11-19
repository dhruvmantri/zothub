import { Button } from "@/components/ui/button";

/**
 * "Show more" under the Events and Opportunities lists (CP1).
 *
 * Says how much is loaded out of how much exists, so a student can tell the
 * list is not complete. When a search or filter is on, it also says that those
 * only look at what is loaded — search is client-side over the loaded rows, and
 * a filter that finds nothing among 50 must not read as "nothing on campus".
 */
export function ShowMore({
  noun,
  loaded,
  total,
  filtered,
  loading,
  onShowMore,
}: {
  noun: string;
  loaded: number;
  total: number;
  filtered: boolean;
  loading: boolean;
  onShowMore: () => void;
}) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-ink-3">
        Showing <span className="font-data text-ink-2">{loaded}</span> of{" "}
        <span className="font-data text-ink-2">{total}</span> {noun}
        {filtered ? ". Search and filters only look at the ones shown so far." : "."}
      </p>
      <Button variant="outline" onClick={onShowMore} disabled={loading} aria-busy={loading}>
        {loading ? "Loading…" : `Show more ${noun}`}
      </Button>
    </div>
  );
}
