// Unit tests for THE reminder ordering rule (the module the send-reminders edge
// function imports). Run:
//   node --experimental-strip-types --test src/lib/reminderDelivery.test.ts
//
// R1 is the reason these exist. The old job sent first and logged after, and
// Resend resolves with `{ error }` instead of throwing — so a failed send was
// recorded as delivered and `unique_reminder` made it permanently unsendable.
// Every test below is a shape that used to lose a student's email forever.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deliverReminder, type ReminderDeps } from "../../supabase/functions/_shared/reminder-delivery.ts";

const target = {
  reminderType: "event_reminder",
  targetId: "event-1",
  userId: "user-1",
  prefColumn: "event_reminders",
};

function deps(over: Partial<ReminderDeps> = {}) {
  const calls: string[] = [];
  const base: ReminderDeps = {
    wants: async () => { calls.push("wants"); return true; },
    claim: async () => { calls.push("claim"); return { claimed: true }; },
    send: async () => { calls.push("send"); return { ok: true }; },
    release: async () => { calls.push("release"); return null; },
  };
  return { deps: { ...base, ...over }, calls };
}

test("the happy path claims BEFORE sending", async () => {
  const { deps: d, calls } = deps();
  const out = await deliverReminder(d, target);
  assert.deepEqual(out, { status: "sent" });
  // The ordering is the whole point: a send that happens before the claim can be
  // duplicated by an overlapping run.
  assert.deepEqual(calls, ["wants", "claim", "send"]);
});

test("a failed send RELEASES the claim, so the next run retries", async () => {
  const { deps: d, calls } = deps({
    send: async () => ({ ok: false, error: "API key is invalid" }),
  });
  const out = await deliverReminder(d, target);
  assert.equal(out.status, "failed");
  assert.equal(out.status === "failed" && out.retryable, true);
  // Without this release the reminder is unsendable forever — the original bug.
  assert.ok(calls.includes("release"), "the claim must be given back");
});

test("Resend's resolve-with-{error} is treated as a FAILURE, not a send", async () => {
  // The exact shape that fooled the old try/catch: nothing throws, and the old
  // code therefore wrote the log row and moved on.
  const { deps: d } = deps({ send: async () => ({ ok: false, error: "domain not verified" }) });
  const out = await deliverReminder(d, target);
  assert.equal(out.status, "failed");
});

test("an opted-out recipient is skipped WITHOUT consuming a claim", async () => {
  const { deps: d, calls } = deps({ wants: async () => false });
  const out = await deliverReminder(d, target);
  assert.deepEqual(out, { status: "skipped", reason: "opted-out" });
  assert.ok(!calls.includes("claim"), "an opt-out must not write a log row");
  assert.ok(!calls.includes("send"));
});

test("a duplicate claim is a skip, not a failure — overlapping runs are safe", async () => {
  const { deps: d, calls } = deps({ claim: async () => ({ claimed: false }) });
  const out = await deliverReminder(d, target);
  assert.deepEqual(out, { status: "skipped", reason: "already-claimed" });
  assert.ok(!calls.includes("send"), "the other run owns this send");
});

test("a claim that fails for a real reason is retryable and does not send", async () => {
  const { deps: d, calls } = deps({
    claim: async () => ({ claimed: false, error: "connection reset" }),
  });
  const out = await deliverReminder(d, target);
  assert.equal(out.status, "failed");
  assert.equal(out.status === "failed" && out.retryable, true);
  assert.ok(!calls.includes("send"));
});

test("send failed AND release failed is reported as NOT retryable", async () => {
  // The one surviving shape of the original bug: the claim is stuck, so this
  // reminder never goes out. It must be loud, not folded in with ordinary
  // failures.
  const { deps: d } = deps({
    send: async () => ({ ok: false, error: "rate limited" }),
    release: async () => "delete blocked by policy",
  });
  const out = await deliverReminder(d, target);
  assert.equal(out.status, "failed");
  assert.equal(out.status === "failed" && out.retryable, false);
  assert.match(String(out.status === "failed" && out.error), /could not be released/);
});

test("a send that throws is not silently swallowed by the caller's contract", async () => {
  const { deps: d } = deps({ send: async () => { throw new Error("boom"); } });
  await assert.rejects(() => deliverReminder(d, target), /boom/);
});
