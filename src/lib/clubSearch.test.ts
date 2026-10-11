// Unit tests for club search ranking (audit G2-07).
// Run: node --experimental-strip-types --test src/lib/clubSearch.test.ts
// Uses the REAL club names from the ZotSpot manifest, so a case that matters to
// an actual officer at a fair is what is being checked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clubMatchTier } from "./clubSearch.ts";

type Row = { club_name: string; description: string | null };
const CLUBS: Row[] = JSON.parse(readFileSync(new URL("../../scripts/data/zotspot_club_manifest.json", import.meta.url), "utf8"));

/** The page's order: best tier first, then A–Z. */
function search(query: string): string[] {
  return CLUBS
    .map((c) => ({ name: c.club_name, tier: clubMatchTier(c.club_name, c.description, query) }))
    .filter((r) => r.tier !== null)
    .sort((a, b) => a.tier! - b.tier! || a.name.localeCompare(b.name))
    .map((r) => r.name);
}

test("the manifest really is loaded (guard)", () => {
  assert.ok(CLUBS.length > 700, `${CLUBS.length} clubs`);
});

test("an acronym written in the name finds that club first", () => {
  assert.equal(search("vsa")[0], "Vietnamese Student Association (VSA)");
  assert.equal(search("ASUCI")[0], "Associated Students UCI (ASUCI)");
  assert.equal(search("acm")[0], "Association for Computing Machinery at UC Irvine - ACM");
  assert.equal(search("ieee")[0], "Institute of Electrical and Electronics Engineers at UCI - IEEE");
});

test("an acronym in the name beats a name whose initials merely spell it", () => {
  const r = search("acm");
  assert.ok(r.indexOf("Association for Computing Machinery at UC Irvine - ACM") < r.indexOf("Acts College Ministry"), r.slice(0, 3).join(" | "));
});

test("an acronym that is only the initials still finds the club first ('swe' is in no name)", () => {
  assert.equal(search("swe")[0], "Society of Women Engineers");
});

test("the start of the name beats the same words later in another name", () => {
  const r = search("society of women");
  assert.deepEqual(r.slice(0, 2), ["Society of Women Engineers", "Graduate Society of Women Engineers"]);
});

test("a name-prefix match beats a word inside another name, which beats a description", () => {
  const r = search("hack");
  assert.equal(r[0], "Hack at UCI");
  assert.ok(r.indexOf("Irvine Hacker Fab") < r.findIndex((n) => !/hack/i.test(n)), r.slice(0, 5).join(" | "));
});

test("an exact name is tier 0 and case/punctuation do not matter", () => {
  assert.equal(clubMatchTier("Hack at UCI", null, "hack at uci"), 0);
  assert.equal(clubMatchTier("Hack at UCI", null, "  HACK  at   UCI "), 0);
});

test("no match is null, and an empty query matches nothing", () => {
  assert.equal(clubMatchTier("Hack at UCI", "We build things.", "chess"), null);
  assert.equal(clubMatchTier("Hack at UCI", "We build things.", "   "), null);
});

test("a description-only match still appears, after every name match", () => {
  assert.equal(clubMatchTier("Hack at UCI", "Weekly chess nights.", "chess"), 6);
});
