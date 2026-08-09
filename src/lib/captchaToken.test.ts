// Unit tests for the captcha token lifecycle (fresh-token-per-request rule).
// Run: node --experimental-strip-types --test src/lib/captchaToken.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captchaReducer,
  canSubmitWithCaptcha,
  initialCaptchaState,
  type CaptchaState,
} from "./captchaToken.ts";

test("starts with no token, so a captcha-gated submit is blocked", () => {
  assert.equal(initialCaptchaState.token, null);
  assert.equal(canSubmitWithCaptcha(initialCaptchaState, true), false);
  // With captcha disabled (local/dev) the same state may submit.
  assert.equal(canSubmitWithCaptcha(initialCaptchaState, false), true);
});

test("solving the challenge unblocks submission", () => {
  const s = captchaReducer(initialCaptchaState, { type: "solved", token: "tok-1" });
  assert.equal(s.token, "tok-1");
  assert.equal(canSubmitWithCaptcha(s, true), true);
  assert.equal(s.refreshKey, 0, "solving must not reset the widget");
});

test("consuming a token clears it AND forces a fresh challenge", () => {
  const solved = captchaReducer(initialCaptchaState, { type: "solved", token: "tok-1" });
  const consumed = captchaReducer(solved, { type: "consumed" });
  assert.equal(consumed.token, null, "spent token must not linger");
  assert.equal(consumed.refreshKey, 1, "refreshKey must bump to reset the widget");
  assert.equal(canSubmitWithCaptcha(consumed, true), false, "must re-solve before resending");
});

test("every OTP resend gets a DIFFERENT fresh token — no replay", () => {
  // send #1
  let s: CaptchaState = captchaReducer(initialCaptchaState, { type: "solved", token: "tok-1" });
  const firstSubmitted = s.token;
  s = captchaReducer(s, { type: "consumed" });

  // resend #1 — widget was reset, user solves again
  s = captchaReducer(s, { type: "solved", token: "tok-2" });
  const secondSubmitted = s.token;
  assert.notEqual(secondSubmitted, firstSubmitted, "resend must not reuse the spent token");
  assert.equal(canSubmitWithCaptcha(s, true), true);
  s = captchaReducer(s, { type: "consumed" });

  // resend #2 — another distinct challenge
  s = captchaReducer(s, { type: "solved", token: "tok-3" });
  assert.equal(s.token, "tok-3");
  assert.equal(s.refreshKey, 2, "each consume bumps the widget reset key");
});

test("expiry/error clears the token without forcing an extra widget reset", () => {
  const solved = captchaReducer(initialCaptchaState, { type: "solved", token: "tok-1" });
  const cleared = captchaReducer(solved, { type: "cleared" });
  assert.equal(cleared.token, null);
  assert.equal(cleared.refreshKey, solved.refreshKey);
  assert.equal(canSubmitWithCaptcha(cleared, true), false);
});
