import { test } from "node:test";
import assert from "node:assert/strict";

import { checkExternalLinkInput, safeExternalUrl } from "./externalLink.ts";

test("only plain https links become an href", () => {
  assert.equal(safeExternalUrl("https://forms.gle/abc"), "https://forms.gle/abc");
  for (const bad of [null, undefined, "", " ", "http://forms.gle/x", "javascript:alert(1)", "data:text/html,x", "https://a b.com", "https://user:pw@x.com", "https://intranet/x", "forms.gle/abc"]) {
    assert.equal(safeExternalUrl(bad), null, String(bad));
  }
});

test("a club may leave the link empty", () => {
  assert.deepEqual(checkExternalLinkInput("   "), { ok: true, value: null });
});

test("a link pasted without https:// is completed, not refused", () => {
  assert.deepEqual(checkExternalLinkInput("forms.gle/abc"), { ok: true, value: "https://forms.gle/abc" });
});

test("http and nonsense are refused with a sentence a club officer can act on", () => {
  const http = checkExternalLinkInput("http://forms.gle/abc");
  assert.equal(http.ok, false);
  if (!http.ok) assert.match(http.error, /https:\/\//);
  const junk = checkExternalLinkInput("sign up at the fair");
  assert.equal(junk.ok, false);
  const js = checkExternalLinkInput("javascript:alert(1)");
  assert.equal(js.ok, false);
});
