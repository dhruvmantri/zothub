// LR3 (maintainer decision 2026-10-11): when a club claim arrives, email the
// maintainer so it can be approved fast, and email the officer a receipt so
// they know it went through. Before this, nothing was sent at all: the admin
// had to happen to open /admin, and an officer met at a fair had nothing in
// their inbox while they waited.
//
// Pure + injectable so it is tested from Node (claimAlerts.test.ts) — the edge
// runtime cannot be booted in a cloud session (T14).
import { checkEmailResult } from "./email-result.ts";

export const DEFAULT_ADMIN_ALERT_EMAIL = "zothub.uci@gmail.com";

export type ClaimAlertType = "claim_received" | "claim_received_admin";

export interface ClaimAlert {
  type: ClaimAlertType;
  to: string;
  data: Record<string, unknown>;
}

export function buildClaimAlerts(input: {
  clubId: string;
  clubName: string;
  claimantEmail: string;
  note: string | null;
  adminEmail?: string | null;
}): ClaimAlert[] {
  const admin = (input.adminEmail ?? "").trim() || DEFAULT_ADMIN_ALERT_EMAIL;
  return [
    {
      type: "claim_received",
      to: input.claimantEmail,
      data: { clubName: input.clubName },
    },
    {
      type: "claim_received_admin",
      to: admin,
      data: {
        clubName: input.clubName,
        clubId: input.clubId,
        claimantEmail: input.claimantEmail,
        note: input.note ? input.note.slice(0, 2000) : null,
      },
    },
  ];
}

interface Invoker {
  functions: {
    invoke: (
      name: string,
      opts: { body: Record<string, unknown> },
    ) => Promise<{ data: unknown; error: ({ message?: string; context?: { json?: () => Promise<unknown> } }) | null }>;
  };
}

/**
 * Sends every alert, never throws, and reports each outcome. Judged by the ONE
 * shared checker (a 200 is not proof of delivery), and a refused invoke reads
 * the response BODY for the reason — a FunctionsHttpError's message is always
 * the generic "non-2xx" string (CLAUDE.md, E2).
 */
export async function sendClaimAlerts(
  client: Invoker,
  alerts: ClaimAlert[],
): Promise<{ type: ClaimAlertType; ok: boolean; error?: string }[]> {
  return Promise.all(
    alerts.map(async (a) => {
      try {
        const { data, error } = await client.functions.invoke("send-email", { body: { ...a } });
        if (error) {
          let detail = error.message ?? "email transport error";
          const ctx = error.context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const body = (await ctx.json()) as { error?: unknown } | null;
              if (body && body.error) detail = String(body.error);
            } catch { /* body unreadable — keep the generic message */ }
          }
          return { type: a.type, ok: false, error: detail };
        }
        const r = checkEmailResult(null, data);
        return { type: a.type, ok: r.ok, error: r.error };
      } catch (e) {
        return { type: a.type, ok: false, error: e instanceof Error ? e.message : "send-email threw" };
      }
    }),
  );
}
