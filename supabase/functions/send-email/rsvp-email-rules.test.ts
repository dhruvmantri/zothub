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
const actorIsClubOpts = [true, false];

const isClubOf = (r: Role) => r === "club";
const isStudentOf = (r: Role) => r === "student";

// Expected outcome for each (type, role, status, transitionActorIsClub):
// true = send allowed, otherwise the expected HTTP code.
function expected(
  type: RsvpEmailType,
  role: Role,
  status: string,
  actorIsClub: boolean,
): true | number {
  if (role === "other") return 403; // not the student or the club
  if (type === "rsvp_declined") {
    if (role !== "club") return 403; // student may never trigger a decline
    if (status !== "cancelled") return 409;
    if (!actorIsClub) return 409; // student self-cancel — club can't decline it
    return true;
  }
  // rsvp_confirmation (transitionActorIsClub is irrelevant here)
  if (role === "club") return status === "confirmed" ? true : 409;
  return status === "pending" || status === "confirmed" ? true : 409; // student
}

Deno.test("RSVP email rules — full (type × role × status × actor) matrix", () => {
  const rows: string[] = [];
  for (const type of types) {
    for (const role of roles) {
      for (const status of statuses) {
        for (const actorIsClub of actorIsClubOpts) {
          const got = validateRsvpEmailRequest(
            type,
            isClubOf(role),
            isStudentOf(role),
            status,
            actorIsClub,
          );
          const exp = expected(type, role, status, actorIsClub);
          const gotSummary = got.ok ? "ALLOW" : `REJECT ${got.code}`;
          const expSummary = exp === true ? "ALLOW" : `REJECT ${exp}`;
          rows.push(
            `${type} | ${role.padEnd(7)} | ${status.padEnd(9)} | actorIsClub=${String(actorIsClub).padEnd(5)} -> ${gotSummary}`,
          );
          assertEquals(
            got.ok ? true : got.code,
            exp,
            `mismatch for ${type}/${role}/${status}/actorIsClub=${actorIsClub}: got ${gotSummary}, expected ${expSummary}`,
          );
        }
      }
    }
  }
  console.log("\n" + rows.join("\n"));
});

// Spot-check the specific security requirements called out in the task.
Deno.test("student cannot trigger a decline email (even after self-cancel)", () => {
  // Student caller is rejected outright.
  assertEquals(
    validateRsvpEmailRequest("rsvp_declined", false, true, "cancelled", false),
    { ok: false, code: 403, error: "Only the owning club can send a decline email" },
  );
});

Deno.test("club cannot decline a student-self-cancelled RSVP (actor mismatch)", () => {
  // Cancelled, club caller, but the cancellation actor was the student.
  assertEquals(
    validateRsvpEmailRequest("rsvp_declined", true, false, "cancelled", false),
    { ok: false, code: 409, error: "RSVP was not cancelled by the organizer" },
  );
  // Cancelled by the club -> allowed.
  assertEquals(validateRsvpEmailRequest("rsvp_declined", true, false, "cancelled", true).ok, true);
});

Deno.test("club decline requires an actually-cancelled RSVP", () => {
  assertEquals(validateRsvpEmailRequest("rsvp_declined", true, false, "pending", true).ok, false);
  assertEquals(validateRsvpEmailRequest("rsvp_declined", true, false, "confirmed", true).ok, false);
  assertEquals(validateRsvpEmailRequest("rsvp_declined", true, false, "cancelled", true).ok, true);
});

Deno.test("club confirmation requires confirmed; student confirmation allows pending/confirmed", () => {
  assertEquals(validateRsvpEmailRequest("rsvp_confirmation", true, false, "pending", false).ok, false);
  assertEquals(validateRsvpEmailRequest("rsvp_confirmation", true, false, "confirmed", false).ok, true);
  assertEquals(validateRsvpEmailRequest("rsvp_confirmation", false, true, "pending", false).ok, true);
  assertEquals(validateRsvpEmailRequest("rsvp_confirmation", false, true, "confirmed", false).ok, true);
  assertEquals(validateRsvpEmailRequest("rsvp_confirmation", false, true, "cancelled", false).ok, false);
});
