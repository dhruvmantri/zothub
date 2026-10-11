// Unit tests for the provider pre-check (backlog A7).
// Run: node --experimental-strip-types --test src/lib/oauthProvider.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isProviderEnabled, providerEnabled } from "./oauthProvider.ts";

// The exact shape production returned on 2026-10-10, trimmed.
const PROD_2026_10_10 = { external: { email: true, google: false, github: false }, disable_signup: false };

test("reads a disabled provider as false — the production state that broke the button", () => {
  assert.equal(providerEnabled(PROD_2026_10_10, "google"), false);
});

test("reads an enabled provider as true", () => {
  assert.equal(providerEnabled({ external: { google: true } }, "google"), true);
});

test("anything it cannot read is null (unknown), never false", () => {
  for (const s of [null, undefined, "x", 42, {}, { external: null }, { external: {} }, { external: { google: "yes" } }]) {
    assert.equal(providerEnabled(s, "google"), null, JSON.stringify(s));
  }
});

const fakeFetch = (impl: () => Promise<Response>) => (async () => impl()) as unknown as typeof fetch;

test("asks the settings endpoint with the publishable key", async () => {
  let seen: { url: string; key: string | null } | null = null;
  const f = (async (url: string, init?: RequestInit) => {
    seen = { url, key: new Headers(init?.headers).get("apikey") };
    return new Response(JSON.stringify(PROD_2026_10_10), { status: 200 });
  }) as unknown as typeof fetch;
  assert.equal(await isProviderEnabled("https://p.supabase.co", "pk", "google", f), false);
  assert.deepEqual(seen, { url: "https://p.supabase.co/auth/v1/settings", key: "pk" });
});

test("a network failure, a non-2xx and a non-JSON body are all unknown, so sign-in still proceeds", async () => {
  assert.equal(await isProviderEnabled("u", "k", "google", fakeFetch(() => Promise.reject(new TypeError("offline")))), null);
  assert.equal(await isProviderEnabled("u", "k", "google", fakeFetch(async () => new Response("nope", { status: 503 }))), null);
  assert.equal(await isProviderEnabled("u", "k", "google", fakeFetch(async () => new Response("<html>", { status: 200 }))), null);
});

test("a hung request is abandoned at the timeout and reads as unknown", async () => {
  const hang = ((_u: string, init?: RequestInit) =>
    new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch;
  const started = Date.now();
  assert.equal(await isProviderEnabled("u", "k", "google", hang, 50), null);
  assert.ok(Date.now() - started < 1000);
});
