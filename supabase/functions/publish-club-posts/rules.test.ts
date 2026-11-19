import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkHttpsUrl,
  checkPost,
  clubNameMatches,
  keysMatch,
  pacificDate,
  pacificToInstant,
  titlesLookAlike,
  type IncomingPost,
} from "./rules.ts";

const NOW = new Date("2026-11-19T22:00:00Z"); // 2 PM Pacific, the run time
const CLUB = "6f1d2c3b-4a59-4e8f-9a0b-1c2d3e4f5a6b";

const event = (over: Partial<IncomingPost> = {}): IncomingPost => ({
  source_key: "row-1",
  kind: "event",
  club_id: CLUB,
  club_name: "AI at UCI",
  title: "Intro to LLMs Workshop",
  description: "Bring a laptop.",
  external_url: "https://forms.gle/abc123",
  starts_at: "2026-11-25 18:30",
  location: "DBH 6011",
  ...over,
});
const role = (over: Partial<IncomingPost> = {}): IncomingPost => ({
  source_key: "row-2",
  kind: "opportunity",
  club_id: CLUB,
  club_name: "AI at UCI",
  title: "Events Committee",
  external_url: "https://forms.gle/xyz",
  type: "committee",
  deadline: "2026-12-01",
  ...over,
});
const reason = (r: ReturnType<typeof checkPost>) => (r.ok ? "" : r.reason);

// ---- Pacific time -----------------------------------------------------------------

test("a winter Pacific time converts with the -8h offset", () => {
  assert.equal(pacificToInstant("2026-11-25 18:30"), "2026-11-26T02:30:00.000Z");
});

test("a summer Pacific time converts with the -7h offset", () => {
  assert.equal(pacificToInstant("2026-07-04T09:00"), "2026-07-04T16:00:00.000Z");
});

test("the hour skipped when clocks go forward is refused, not guessed", () => {
  assert.equal(pacificToInstant("2027-03-14 02:30"), null);
});

test("the repeated hour in November takes the earlier occurrence", () => {
  assert.equal(pacificToInstant("2026-11-01 01:30"), "2026-11-01T08:30:00.000Z");
});

test("a bare date is refused for an event, but means end-of-day for a deadline", () => {
  assert.equal(pacificToInstant("2026-12-01"), null);
  assert.equal(pacificToInstant("2026-12-01", true), "2026-12-02T07:59:00.000Z");
});

test("malformed times are refused", () => {
  for (const bad of ["", "tomorrow 6pm", "11/25/2026 18:30", "2026-13-01 10:00", "2026-11-25 25:00", 42, null]) {
    assert.equal(pacificToInstant(bad), null, String(bad));
  }
});

test("pacificDate gives the Pacific calendar day, not the UTC one", () => {
  // 02:30 UTC on the 26th is still the evening of the 25th in Irvine.
  assert.equal(pacificDate("2026-11-26T02:30:00.000Z"), "2026-11-25");
});

// ---- links ------------------------------------------------------------------------

test("only plain public https links are accepted", () => {
  assert.equal(checkHttpsUrl("https://forms.gle/abc", "L").ok, true);
  for (const bad of [
    "http://forms.gle/abc",
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://user:pw@forms.gle/x",
    "https://127.0.0.1/x",
    "https://localhost/x",
    "https://[::1]/x",
    "https://intranet/x",
    "https://forms.gle/a b",
    "",
  ]) {
    assert.equal(checkHttpsUrl(bad, "L").ok, false, bad);
  }
});

// ---- the row check ----------------------------------------------------------------

test("a good event passes and is normalised", () => {
  const r = checkPost(event({ title: "  Intro   to LLMs\tWorkshop " }), NOW);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.post.title, "Intro to LLMs Workshop");
  assert.equal(r.post.event_date, "2026-11-26T02:30:00.000Z");
  assert.equal(r.post.status, "active");
});

test("a good role passes; its type is case-insensitive", () => {
  const r = checkPost(role({ type: "Committee" }), NOW);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.post.type, "committee");
});

test("each missing or bad field is refused with a readable reason", () => {
  assert.match(reason(checkPost(event({ source_key: "" }), NOW)), /no id/);
  assert.match(reason(checkPost(event({ source_key: "has space" }), NOW)), /row id/);
  assert.match(reason(checkPost(event({ kind: "party" }), NOW)), /Kind/);
  assert.match(reason(checkPost(event({ club_id: "AI at UCI" }), NOW)), /club id/);
  assert.match(reason(checkPost(event({ club_name: " " }), NOW)), /club name/);
  assert.match(reason(checkPost(event({ title: "Hi" }), NOW)), /title/);
  assert.match(reason(checkPost(event({ title: "x".repeat(121) }), NOW)), /longer than 120/);
  assert.match(reason(checkPost(event({ external_url: undefined }), NOW)), /link is missing/);
  assert.match(reason(checkPost(event({ external_url: "http://x.com" }), NOW)), /https/);
  assert.match(reason(checkPost(event({ image_url: "ftp://x.com/a.png" }), NOW)), /image link/);
  assert.match(reason(checkPost(event({ status: "maybe" }), NOW)), /Status/);
  assert.match(reason(checkPost(role({ type: "party" }), NOW)), /role type/);
});

test("an event in the past, or now, is refused", () => {
  assert.match(reason(checkPost(event({ starts_at: "2026-11-19 14:00" }), NOW)), /past/);
  assert.match(reason(checkPost(event({ starts_at: "2026-11-18 18:00" }), NOW)), /past/);
});

test("a date more than a year out is treated as a typo", () => {
  assert.match(reason(checkPost(event({ starts_at: "2027-11-25 18:30" }), NOW)), /typo/);
  assert.match(reason(checkPost(role({ deadline: "2028-01-01" }), NOW)), /typo/);
});

test("a role's deadline is optional, but must be in the future if given", () => {
  assert.equal(checkPost(role({ deadline: "" }), NOW).ok, true);
  assert.match(reason(checkPost(role({ deadline: "2026-11-01" }), NOW)), /passed/);
});

test("a cancellation needs only its identity", () => {
  const r = checkPost({ source_key: "row-1", kind: "event", status: "cancelled", club_id: CLUB, club_name: "AI at UCI" }, NOW);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.post.status, "cancelled");
});

test("control characters are stripped from text", () => {
  const r = checkPost(event({ description: "Line one\u0000\u0007\r\nLine two" }), NOW);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.post.description, "Line one\nLine two");
});

// ---- matching ---------------------------------------------------------------------

test("club names match through case, spacing, accents and punctuation — and nothing looser", () => {
  assert.equal(clubNameMatches("ai @ uci", "AI at UCI"), false); // "@" is not "at": refuse, don't guess
  assert.equal(clubNameMatches("  ai at  UCI ", "AI at UCI"), true);
  assert.equal(clubNameMatches("Société Française", "Societe Francaise"), true);
  assert.equal(clubNameMatches("Engineers & Scientists", "Engineers and Scientists"), true);
  assert.equal(clubNameMatches("AI at UCI", "AI Club at UCI"), false);
  assert.equal(clubNameMatches("", "AI at UCI"), false);
});

test("look-alike titles are caught; different ones are not", () => {
  assert.equal(titlesLookAlike("Intro to LLMs Workshop", "intro to LLMs workshop!"), true);
  assert.equal(titlesLookAlike("General Meeting #4", "General Meeting 4"), true);
  assert.equal(titlesLookAlike("Intro to LLMs Workshop", "Resume Review Night"), false);
  assert.equal(titlesLookAlike("General Meeting", "General Meeting Social Night"), false);
});

// ---- auth -------------------------------------------------------------------------

test("the automation key must match exactly; short or unset keys never match", () => {
  const KEY = "k".repeat(40);
  assert.equal(keysMatch(KEY, KEY), true);
  assert.equal(keysMatch(KEY.slice(0, 39), KEY), false);
  assert.equal(keysMatch(KEY + "x", KEY), false);
  assert.equal(keysMatch("", KEY), false);
  assert.equal(keysMatch(null, KEY), false);
  assert.equal(keysMatch("", ""), false); // an unset secret authorises nobody
  assert.equal(keysMatch("short", "short"), false); // a weak secret is refused outright
});
