/**
 * `"1 application"`, not `"1 applications"`.
 *
 * The club overview shipped reading "1 applications · 6 views" under every
 * posting — the kind of thing a club officer notices immediately and a code
 * review never does. The codebase already spells this out inline in a dozen
 * ternaries; this exists so the next one is not written by hand.
 *
 * Its own module rather than a function in `formatters.ts`, because that file
 * imports through the `@/` alias and so cannot be run by the Node test runner
 * (`CLAUDE.md` — the same reason `_shared/*.ts` exists on the edge side).
 *
 * `plural` is passed explicitly for the irregular cases: "opportunity" is not
 * `opportunity + s`.
 */
export function countOf(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
