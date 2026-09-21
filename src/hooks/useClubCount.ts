import { useQuery } from "@tanstack/react-query";

import { clubKeys } from "@/lib/queryKeys";
import { fetchAllClubsPublic } from "@/lib/queryFns";

/** Module-level so TanStack can memoise the derived number. */
const selectClubCount = (rows: unknown[]): number => rows.length;

/**
 * How many clubs are publicly listed, live.
 *
 * Shares `clubKeys.list()` with the Clubs directory and the landing page, so
 * this costs **no extra request** wherever it is used — the rows are already
 * cached by whichever of them loaded first.
 *
 * Returns `null` while loading rather than 0. A confident "0 clubs" flashing
 * on screen is worse than showing nothing, and every caller is decoration that
 * must never block the page it sits on.
 */
export function useClubCount(): number | null {
  const { data } = useQuery({
    queryKey: clubKeys.list(),
    queryFn: fetchAllClubsPublic,
    select: selectClubCount,
  });
  return data ?? null;
}
