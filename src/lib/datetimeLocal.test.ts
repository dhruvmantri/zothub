// Unit tests for the datetime-local round trip (audit G6-02).
// Run: TZ=America/Los_Angeles node --experimental-strip-types --test src/lib/datetimeLocal.test.ts
// The zone is pinned in the test itself too, so a plain run cannot pass by
// happening to be in UTC — the one zone where the old bug was invisible.
process.env.TZ = "America/Los_Angeles";

import { test } from "node:test";
import assert from "node:assert/strict";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "./datetimeLocal.ts";

test("the zone really is California (guard: in UTC the old bug cannot show)", () => {
  assert.equal(new Date("2026-10-20T12:00:00Z").getTimezoneOffset(), 420);
});

test("a 6pm Pacific event shows as 18:00 in the edit form, not 01:00 next day", () => {
  // 6pm PDT on Oct 20 is 01:00Z on Oct 21.
  assert.equal(toDatetimeLocalValue("2026-10-21T01:00:00+00:00"), "2026-10-20T18:00");
});

test("saving an untouched form stores exactly the same instant (PDT and PST)", () => {
  for (const stored of ["2026-10-21T01:00:00.000Z", "2026-12-05T02:30:00.000Z", "2027-03-14T09:59:00.000Z"]) {
    assert.equal(fromDatetimeLocalValue(toDatetimeLocalValue(stored)), stored, stored);
  }
});

test("the old code moved it 7 hours on one save — this is the bug being fixed", () => {
  const stored = "2026-10-21T01:00:00.000Z";
  const oldFormValue = new Date(stored).toISOString().slice(0, 16);
  const afterOneSave = new Date(oldFormValue).toISOString();
  assert.equal((Date.parse(afterOneSave) - Date.parse(stored)) / 3_600_000, 7);
});

test("a Date and an unparseable value", () => {
  assert.equal(toDatetimeLocalValue(new Date("2026-10-21T01:00:00Z")), "2026-10-20T18:00");
  assert.equal(toDatetimeLocalValue("not a date"), "");
});
