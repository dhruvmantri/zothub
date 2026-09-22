import { test } from "node:test";
import assert from "node:assert/strict";

import { isServiceRoleCaller } from "./service-role.ts";

const KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg";
const headers = (h: Record<string, string>) => (n: string) => h[n] ?? h[n.toLowerCase()] ?? null;

test("the legacy shape: key in the Authorization bearer", () => {
  assert.equal(isServiceRoleCaller(headers({ Authorization: `Bearer ${KEY}` }), KEY), true);
});

test("the new-key shape: key in apikey, NO bearer at all", () => {
  // This is the case that broke production: supabase-js omits Authorization
  // entirely for a non-JWT key.
  assert.equal(isServiceRoleCaller(headers({ apikey: KEY }), KEY), true);
});

test("a browser sending the publishable key is NOT the service role", () => {
  assert.equal(isServiceRoleCaller(headers({ apikey: "sb_publishable_ACJWlzQHlZjBrEg" }), KEY), false);
});

test("a signed-in user's JWT is NOT the service role", () => {
  assert.equal(isServiceRoleCaller(headers({ Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.x.y" }), KEY), false);
});

test("no headers at all is refused", () => {
  assert.equal(isServiceRoleCaller(headers({}), KEY), false);
});

test("an UNSET service key refuses everyone, including empty headers", () => {
  // The dangerous case: "" === "" would authorise the whole internet.
  assert.equal(isServiceRoleCaller(headers({ apikey: "" }), undefined), false);
  assert.equal(isServiceRoleCaller(headers({ Authorization: "Bearer " }), ""), false);
  assert.equal(isServiceRoleCaller(headers({}), null), false);
});

test("whitespace around the key does not defeat the match", () => {
  assert.equal(isServiceRoleCaller(headers({ apikey: `  ${KEY}  ` }), KEY), true);
  assert.equal(isServiceRoleCaller(headers({ Authorization: `Bearer  ${KEY} ` }), KEY), true);
});

test("a near-miss key is refused", () => {
  assert.equal(isServiceRoleCaller(headers({ apikey: KEY + "x" }), KEY), false);
});
