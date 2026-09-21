/**
 * End-to-end test for scripts/rehost_club_logos.mjs.
 *
 * The script does a ONE-WAY BULK WRITE to production, so "it looks right" is
 * not good enough. This runs the real script, unmodified, against a stand-in
 * Supabase that implements only the endpoints it uses and records every call.
 * ZotSpot is stood in for too, so the download path is exercised without
 * depending on a university server being up.
 *
 * What it proves, in order of how much it would cost to get wrong:
 *   1. --commit aborts on a failed canary WITHOUT touching a single club.
 *   2. Clubs that already have a logo are skipped, so a re-run is safe.
 *   3. It prefers the 320px variant and falls back per club, counting both.
 *   4. A 200 that is not an image is refused, not re-hosted.
 *   5. A dry run writes nothing at all.
 *   6. An upload that succeeds but whose row update fails is REPORTED, not
 *      counted as done — otherwise a re-run would skip a club whose logo is
 *      in storage but invisible.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Stands in for both ZotSpot and Supabase. `cfg` bends its behaviour per case. */
function makeServer(cfg) {
  const calls = { uploads: [], canary: [], removes: [], patches: [], selects: 0 };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const send = (code, body, type = "application/json") => {
      res.writeHead(code, { "content-type": type });
      res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };

    // --- ZotSpot stand-in -------------------------------------------------
    if (url.pathname.startsWith("/zotspot/")) {
      const is320 = url.pathname.includes("s3_image_upload");
      const id = url.pathname.split("_").pop();
      if (is320 && cfg.no320?.includes(id)) return send(404, "gone", "text/plain");
      if (cfg.htmlFor?.includes(id)) return send(200, "<html>not found</html>", "text/html");
      return send(200, PNG, "image/png");
    }

    // --- storage ----------------------------------------------------------
    if (url.pathname.startsWith("/storage/v1/object/")) {
      const path = url.pathname.replace("/storage/v1/object/", "");
      if (req.method === "POST" || req.method === "PUT") {
        const chunks = []; for await (const c of req) chunks.push(c);
        if (path.includes("_canary") && cfg.canaryFails) return send(403, { message: "new row violates row-level security policy" });
        // The canary is bookkeeping, not a club. Counting it as an upload made
        // four of these checks fail against a script that was behaving
        // correctly — the test was wrong, not the code.
        (path.includes("_canary") ? calls.canary : calls.uploads).push({ path, bytes: Buffer.concat(chunks).length });
        return send(200, { Key: path });
      }
      if (req.method === "DELETE") { calls.removes.push(path); return send(200, []); }
    }

    // --- postgrest --------------------------------------------------------
    if (url.pathname === "/rest/v1/club_profiles") {
      if (req.method === "GET") { calls.selects++; return send(200, cfg.clubs); }
      if (req.method === "PATCH") {
        const chunks = []; for await (const c of req) chunks.push(c);
        const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        if (cfg.patchFails) return send(400, { message: "update blew up" });
        calls.patches.push({ where: url.search, logo_url: body.logo_url });
        return send(200, []);
      }
    }
    send(404, { message: "unhandled " + req.method + " " + url.pathname });
  });
  return { server, calls };
}

async function run(cfg, manifest, args = []) {
  const { server, calls } = makeServer(cfg);
  server.listen(0);
  await once(server, "listening");
  const port = server.address().port;

  const fs = await import("node:fs");
  const os = await import("node:os");
  const pathMod = await import("node:path");
  const file = pathMod.join(os.tmpdir(), `manifest-${port}.json`);
  fs.writeFileSync(file, JSON.stringify({
    records: manifest.map((m) => ({
      source_club_id: m.id, club_name: m.name,
      logo_url: `http://127.0.0.1:${port}/zotspot/s2_image_upload_${m.id}`,
    })),
  }));

  const child = spawn("node", ["scripts/rehost_club_logos.mjs", file, ...args], {
    env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${port}`, SUPABASE_SERVICE_ROLE_KEY: "test-service-key" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const [code] = await once(child, "close");
  server.close();
  return { out, code, calls };
}

const club = (id, logo = null) => ({ id: `uuid-${id}`, source_club_id: id, logo_url: logo, club_name: `Club ${id}` });

// 1 — canary
{
  const { out, code, calls } = await run(
    { clubs: [club("1"), club("2")], canaryFails: true },
    [{ id: "1", name: "Club 1" }, { id: "2", name: "Club 2" }],
    ["--commit"],
  );
  check("a failed canary aborts the run", code === 1 && /CANARY FAILED/.test(out));
  check("and NOT ONE club is touched first",
    calls.uploads.length === 0 && calls.patches.length === 0,
    `${calls.uploads.length} uploads, ${calls.patches.length} row updates`);
}

// 2 — idempotency
{
  const { out, calls } = await run(
    { clubs: [club("1", "https://existing/logo.png"), club("2")] },
    [{ id: "1", name: "Club 1" }, { id: "2", name: "Club 2" }],
    ["--commit"],
  );
  check("a club that already has a logo is skipped", /skipping 1 that already have a logo/.test(out));
  check("the canary ran and cleaned up after itself",
    calls.canary.length === 1 && calls.removes.length === 1,
    `${calls.canary.length} canary upload(s), ${calls.removes.length} delete(s)`);
  check("so a re-run only does the outstanding one",
    calls.patches.length === 1 && calls.uploads.length === 1,
    `${calls.uploads.length} uploads`);
  check("the file lands under the club's own id",
    calls.uploads[0]?.path === "club-assets/seeded/uuid-2/logo.png", calls.uploads[0]?.path);
}

// 3 — resolution preference and per-club fallback
{
  const { out } = await run(
    { clubs: [club("1"), club("2"), club("3")], no320: ["2"] },
    [{ id: "1", name: "A" }, { id: "2", name: "B" }, { id: "3", name: "C" }],
    ["--commit"],
  );
  check("all three are re-hosted even though one has no 320px", /uploaded {3}3/.test(out.replace(/\s+/g, " ")) || /uploaded\s+3/.test(out));
  check("the one that fell back to 100px is counted and reported",
    /fell back to 100px 1/.test(out.replace(/\s+/g, " ")), out.split("\n").find((l) => /fell back/.test(l)) ?? "no fallback line");
}

// 4 — a 200 that is not an image
{
  const { out, calls } = await run(
    { clubs: [club("1"), club("2")], htmlFor: ["2"] },
    [{ id: "1", name: "Good" }, { id: "2", name: "Broken" }],
    ["--commit"],
  );
  check("an HTML error page is refused, not re-hosted as a logo",
    calls.uploads.length === 1 && /not an image/.test(out), `${calls.uploads.length} uploads`);
  check("and the club is named in the failures", /Broken/.test(out));
}

// 5 — dry run
{
  const { out, calls } = await run(
    { clubs: [club("1"), club("2")] },
    [{ id: "1", name: "A" }, { id: "2", name: "B" }],
    [],
  );
  check("a dry run uploads nothing and changes nothing",
    calls.uploads.length === 0 && calls.patches.length === 0 && /Nothing was written/.test(out),
    `${calls.uploads.length} uploads, ${calls.patches.length} updates`);
  check("but it still says what it would do", /would upload/.test(out));
}

// 6 — uploaded but row update failed
{
  const { out, calls } = await run(
    { clubs: [club("1")], patchFails: true },
    [{ id: "1", name: "Orphan" }],
    ["--commit"],
  );
  check("an upload whose row update fails is reported, not counted as done",
    /uploaded but logo_url not set/.test(out) && /failed\s+1/.test(out.replace(/ +/g, " ")),
    out.split("\n").filter((l) => /failed|uploaded/.test(l)).slice(0, 3).join(" | "));
  check("the file did reach storage, so a re-run overwrites rather than duplicates",
    calls.uploads.length === 1);
}

const failed = results.filter((r) => !r).length;
console.log(`\nEXECUTED ${results.length} checks — ${results.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
