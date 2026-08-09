// Unit tests for THE shared email-result check (the module the edge functions and
// the browser client both import).
// Run: node --experimental-strip-types --test src/lib/emailResult.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEmailResult } from "../../supabase/functions/_shared/email-result.ts";

test("HTTP 200 carrying { error } is a FAILURE (Resend false-success)", () => {
  // This is the exact shape send-email returns when Resend rejects the send: the
  // function replies 200 with the Resend body, whose `error` field is populated.
  const r = checkEmailResult(null, { data: null, error: { message: "API key is invalid" } }, 200);
  assert.equal(r.ok, false);
  assert.match(String(r.error), /API key is invalid|object/);
});

test("HTTP 200 with a plain error string is a FAILURE", () => {
  const r = checkEmailResult(null, { error: "domain not verified" }, 200);
  assert.equal(r.ok, false);
  assert.equal(r.error, "domain not verified");
});

test("a genuine success is ok", () => {
  assert.equal(checkEmailResult(null, { id: "re_123", error: null }, 200).ok, true);
  assert.equal(checkEmailResult(null, { data: { id: "re_123" }, error: null }).ok, true);
});

test("transport/invoke errors are failures", () => {
  const r = checkEmailResult({ message: "network down" }, null);
  assert.equal(r.ok, false);
  assert.equal(r.error, "network down");
});

test("non-2xx HTTP is a failure and prefers the body's error text", () => {
  const r = checkEmailResult(null, { error: "Not authorized." }, 401);
  assert.equal(r.ok, false);
  assert.equal(r.error, "Not authorized.");
  assert.equal(checkEmailResult(null, null, 500).ok, false);
});

test("bulk sends: ok:false with per-recipient errors is a failure", () => {
  const r = checkEmailResult(null, { ok: false, sent: 2, failed: 1, errors: ["a@x: bounced"] }, 200);
  assert.equal(r.ok, false);
  assert.equal(r.sent, 2);
  assert.equal(r.failed, 1);
  assert.match(String(r.error), /bounced/);
});

test("bulk sends: all delivered is a success and reports the count", () => {
  const r = checkEmailResult(null, { ok: true, sent: 3, failed: 0, errors: [] }, 200);
  assert.equal(r.ok, true);
  assert.equal(r.sent, 3);
});

test("a deliberate skip is not a delivery failure", () => {
  const r = checkEmailResult(null, { skipped: true, reason: "preference_disabled" }, 200);
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
  assert.equal(r.error, "preference_disabled");
});

test("an unverifiable response (no body, no status) is NOT assumed sent", () => {
  assert.equal(checkEmailResult(null, null).ok, false);
});
