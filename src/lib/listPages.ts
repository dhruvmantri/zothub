/**
 * "Show more" for the Events and Opportunities lists (CP1).
 *
 * Both lists were a single `limit(50)` with no way past it: once a 51st upcoming
 * event existed, students simply could not see it, and nothing said so. They now
 * load 50 at a time, IN THE ORDER THE DATABASE APPLIED — so page two of "most
 * popular" is the next 50 most popular (CLAUDE.md: a sort that decides which rows
 * come back must be server-side).
 *
 * No `@/` imports, so Node can unit-test it (listPages.test.ts).
 */
export const LIST_PAGE_SIZE = 50;

export interface ListPage<T> {
  rows: T[];
  /** Matching rows on the server, from PostgREST's exact count. */
  total: number;
}

/**
 * All loaded pages as one list, each row once. A post published between two
 * page loads shifts every later row by one, so the row at the end of page one
 * can come back at the start of page two — keep the first copy.
 */
export function flattenPages<T extends { id: string }>(pages: ListPage<T>[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const page of pages) {
    for (const row of page.rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
}

/**
 * The next page index, or `undefined` when there is nothing left (TanStack's
 * `getNextPageParam`). Uses the server's count, and also stops on a short page,
 * so a count that drifts (rows deleted meanwhile) can never ask forever.
 */
export function nextPageIndex<T>(last: ListPage<T>, all: ListPage<T>[]): number | undefined {
  if (last.rows.length < LIST_PAGE_SIZE) return undefined;
  const loaded = all.reduce((n, p) => n + p.rows.length, 0);
  return loaded < last.total ? all.length : undefined;
}
