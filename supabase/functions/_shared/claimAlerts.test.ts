// Run: node --experimental-strip-types --test supabase/functions/_shared/claimAlerts.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClaimAlerts, DEFAULT_ADMIN_ALERT_EMAIL, sendClaimAlerts } from "./claim-alerts.ts";

const base = { clubId: "c1", clubName: "Hack at UCI", claimantEmail: "officer@hackuci.com", note: "I'm the president." };

test("one receipt to the officer and one alert to the admin", () => {
  const a = buildClaimAlerts(base);
  assert.deepEqual(a.map((x) => [x.type, x.to]), [
    ["claim_received", "officer@hackuci.com"],
    ["claim_received_admin", DEFAULT_ADMIN_ALERT_EMAIL],
  ]);
  assert.equal(a[1].data.claimantEmail, "officer@hackuci.com");
  assert.equal(a[1].data.clubId, "c1");
});

test("the officer's receipt carries nothing but the club name", () => {
  // It goes to whatever address was typed into a public form; it must not echo
  // the note or anything else back.
  assert.deepEqual(buildClaimAlerts(base)[0].data, { clubName: "Hack at UCI" });
});

test("ADMIN_ALERT_EMAIL overrides the default; blank falls back", () => {
  assert.equal(buildClaimAlerts({ ...base, adminEmail: "me@zothub.app" })[1].to, "me@zothub.app");
  assert.equal(buildClaimAlerts({ ...base, adminEmail: "   " })[1].to, DEFAULT_ADMIN_ALERT_EMAIL);
});

test("a long note is capped at 2000 characters", () => {
  const a = buildClaimAlerts({ ...base, note: "x".repeat(5000) });
  assert.equal((a[1].data.note as string).length, 2000);
});

const invoker = (fn: (body: unknown) => Promise<{ data: unknown; error: unknown }>) =>
  ({ functions: { invoke: (_n: string, o: { body: unknown }) => fn(o.body) } }) as never;

test("a 200 carrying { error } is a failure, not a send (Resend's false success)", async () => {
  const r = await sendClaimAlerts(invoker(async () => ({ data: { error: "domain not verified" }, error: null })), buildClaimAlerts(base));
  assert.deepEqual(r.map((x) => x.ok), [false, false]);
  assert.equal(r[0].error, "domain not verified");
});

test("a refused invoke reports the reason from the BODY, not 'non-2xx'", async () => {
  const err = { message: "Edge Function returned a non-2xx status code", context: { json: async () => ({ error: "Not authorized." }) } };
  const r = await sendClaimAlerts(invoker(async () => ({ data: null, error: err })), buildClaimAlerts(base));
  assert.equal(r[1].error, "Not authorized.");
});

test("one failing send does not stop the other, and nothing throws", async () => {
  let n = 0;
  const r = await sendClaimAlerts(invoker(async () => { n += 1; if (n === 1) throw new Error("network"); return { data: { id: "re_1" }, error: null }; }), buildClaimAlerts(base));
  assert.deepEqual(r.map((x) => [x.type, x.ok]), [["claim_received", false], ["claim_received_admin", true]]);
});
