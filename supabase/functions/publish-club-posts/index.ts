// publish-club-posts — the locked door the daily posting automation uses (CP1).
//
// Server-to-server only: no browser ever calls this, so there are no CORS headers.
// Auth is its own secret, AUTOMATION_KEY, sent as `x-automation-key` — NOT the
// service key, so the automation never holds a credential that can do anything
// but this. `verify_jwt = false` in config.toml because the caller has no JWT.
//
// Fails CLOSED: no AUTOMATION_KEY (or a weak one) → 503 for everyone. Every refusal
// is LOGGED — a guard that refuses silently is how an outage hides (CLAUDE.md).
//
// Kill switch: remove the AUTOMATION_KEY secret. Logic: door.ts. Rules: rules.ts.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runDoor } from "./door.ts";
import { keysMatch } from "./rules.ts";

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  const expected = Deno.env.get("AUTOMATION_KEY");
  if (!expected || expected.length < 32) {
    console.error("publish-club-posts: REFUSED — AUTOMATION_KEY is not set (or shorter than 32 characters).");
    return json({ error: "The posting door is not configured." }, 503);
  }
  if (!keysMatch(req.headers.get("x-automation-key"), expected)) {
    console.warn(
      "publish-club-posts: REFUSED — missing or wrong x-automation-key",
      req.headers.get("x-automation-key") ? "(a key was sent)" : "(no key sent)",
    );
    return json({ error: "Not authorised." }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "The request body must be JSON." }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    console.error("publish-club-posts: REFUSED — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.");
    return json({ error: "The posting door is not configured." }, 503);
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const result = await runDoor(body, { db, fetchFn: fetch, now: new Date(), newId: () => crypto.randomUUID() });
    const counts = (result.body.counts ?? {}) as Record<string, number>;
    console.log("publish-club-posts:", JSON.stringify({ run_id: result.body.run_id, dry_run: result.body.dry_run, counts }));
    return json(result.body, result.status);
  } catch (e) {
    console.error("publish-club-posts: run failed", e);
    return json({ error: `The run failed: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
});
