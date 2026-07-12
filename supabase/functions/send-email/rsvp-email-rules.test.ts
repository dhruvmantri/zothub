// Exhaustive matrix test for validateRsvpEmailRequest. Pure module, no network.
// Run: deno test supabase/functions/send-email/rsvp-email-rules.test.ts
import { validateRsvpEmailRequest, type RsvpEmailType } from "./rsvp-email-rules.ts";

// Local assert (avoids a remote std import; deno.land is not reachable here).
function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ?? "assertEquals"}: got ${a}, expected ${e}`);
}

type Role = "club" | "student" | "other";
const roles: Role[] = ["club", "student", "other"];
const statuses = ["pending", "confirmed", "cancelled"];
const types: RsvpEmailType[] = ["rsvp_confirmation", "rsvp_declined"];

const isClubOf = (r: Role) => r === "club";
const isStudentOf = (r: Role) => r === "student";

// Expected outcome for each (type, role, status): true = send allowed,
// otherwise the expected HTTP code.
function expected(type: RsvpEmailType, role: Role, status: string): true | number {
  if (role === "other") return 403; // not the student or the club
  if (type === "rsvp_declined") {
    if (role !== "club") return 403; // student may never trigger a decline
    return status === "cancelled" ? true : 409;
  }
  // rsvp_confirmation
  if (role === "club") return status === "confirmed" ? true : 409;
  // student
  return status === "pending" || status === "confirmed" ? true : 409;
}

Deno.test("RSVP email rules — full (type × role × status) matrix", () => {
  const rows: string[] = [];
  for (const type of types) {
    for (const role of roles) {
      for (const status of statuses) {
        const got = validateRsvpEmailRequest(type, isClubOf(role), isStudentOf(role), status);
        const exp = expected(type, role, status);
        const gotSummary = got.ok ? "ALLOW" : `REJECT ${got.code}`;
        const expSummary = exp === true ? "ALLOW" : `REJECT ${exp}`;
        rows.push(`${type} | ${role.padEnd(7)} | ${status.padEnd(9)} -> ${gotSummary}`);
        assertEquals(
          got.ok ? true : got.code,
          exp,
          `mismatch for ${type}/${role}/${status}: got ${gotSummary}, expected ${expSummary}`,
        );
      }
    }
  }
  console.log("\n" + rows.join("\n"));
});

// Spot-check the specific security requirements called out in the task.
Deno.test("student cannot trigger a decline email (even after self-cancel)", () => {
  const d = validateRsvpEmailRequest("rsvp_declined", false, true, "cancelled");
  assertEquals(d, { ok: false, code: 403, error: "Only the owning club can send a decline email" });
});

Deno.test("club decline requires an actually-cancelled RSVP", () => {
  assertEquals(validateRsvpEmailRequest("rsvp_declined", true, false, "pending").ok, false);
  assertEquals(validateRsvpEmailRequest("rsvp_declined", true, false, "confirmed").ok, false);
  assertEquals(validateRsvpEmailRequest("rsvp_declined", true, false, "cancelled").ok, true);
});

Deno.test("club confirmation requires confirmed; student confirmation allows pending/confirmed", () => {
  assertEquals(validateRsvpEmailRequest("rsvp_confirmation", true, false, "pending").ok, false);
  assertEquals(validateRsvpEmailRequest("rsvp_confirmation", true, false, "confirmed").ok, true);
  assertEquals(validateRsvpEmailRequest("rsvp_confirmation", false, true, "pending").ok, true);
  assertEquals(validateRsvpEmailRequest("rsvp_confirmation", false, true, "confirmed").ok, true);
  assertEquals(validateRsvpEmailRequest("rsvp_confirmation", false, true, "cancelled").ok, false);
});
