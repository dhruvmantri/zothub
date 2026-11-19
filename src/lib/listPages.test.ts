import { test } from "node:test";
import assert from "node:assert/strict";

import { LIST_PAGE_SIZE, flattenPages, nextPageIndex, type ListPage } from "./listPages.ts";

const page = (start: number, n: number, total: number): ListPage<{ id: string }> => ({
  rows: Array.from({ length: n }, (_, i) => ({ id: `r${start + i}` })),
  total,
});

test("one short page: nothing more to load", () => {
  const p = page(0, 12, 12);
  assert.equal(nextPageIndex(p, [p]), undefined);
});

test("a full page with more on the server asks for the next one", () => {
  const p = page(0, LIST_PAGE_SIZE, 132);
  assert.equal(nextPageIndex(p, [p]), 1);
});

test("exactly 50 on the server: a full page, but nothing more", () => {
  const p = page(0, LIST_PAGE_SIZE, 50);
  assert.equal(nextPageIndex(p, [p]), undefined);
});

test("the last partial page stops paging", () => {
  const a = page(0, 50, 132);
  const b = page(50, 50, 132);
  const c = page(100, 32, 132);
  assert.equal(nextPageIndex(b, [a, b]), 2);
  assert.equal(nextPageIndex(c, [a, b, c]), undefined);
});

test("a row that slid onto the next page is shown once", () => {
  const a = page(0, 50, 101);
  const b: ListPage<{ id: string }> = { rows: [{ id: "r49" }, { id: "r50" }], total: 101 };
  const flat = flattenPages([a, b]);
  assert.equal(flat.length, 51);
  assert.deepEqual(flat.slice(-2).map((r) => r.id), ["r49", "r50"]);
});
