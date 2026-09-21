import { test } from "node:test";
import assert from "node:assert/strict";

import { countOf } from "./countOf.ts";

test("one of something is singular", () => {
  assert.equal(countOf(1, "application"), "1 application");
  assert.equal(countOf(1, "view"), "1 view");
});

test("none and many are plural", () => {
  // Zero takes the plural in English — "0 applications", never "0 application".
  assert.equal(countOf(0, "application"), "0 applications");
  assert.equal(countOf(2, "application"), "2 applications");
  assert.equal(countOf(725, "club"), "725 clubs");
});

test("irregular plurals are given, not guessed", () => {
  assert.equal(countOf(1, "opportunity", "opportunities"), "1 opportunity");
  assert.equal(countOf(3, "opportunity", "opportunities"), "3 opportunities");
});

test("negative counts are not treated as singular", () => {
  // Nothing should pass one, but -1 reading "-1 application" would be worse
  // than the plural, and this pins which way it falls.
  assert.equal(countOf(-1, "application"), "-1 applications");
});
