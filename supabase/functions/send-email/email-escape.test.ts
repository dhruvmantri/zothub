// Unit tests for the email HTML-escaping helpers.
// Run: deno test supabase/functions/send-email/email-escape.test.ts
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { esc, safeUrl } from "./email-escape.ts";

Deno.test("esc neutralises HTML-injection payloads", () => {
  assertEquals(
    esc(`<script>alert('x')</script>`),
    "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
  );
  assertEquals(esc(`" onmouseover="evil()`), "&quot; onmouseover=&quot;evil()");
  assertEquals(esc("Tom & Jerry"), "Tom &amp; Jerry");
});

Deno.test("esc coerces null/undefined/numbers to safe strings", () => {
  assertEquals(esc(null), "");
  assertEquals(esc(undefined), "");
  assertEquals(esc(42), "42");
});

Deno.test("esc leaves a clean club name untouched", () => {
  assertEquals(esc("Vietnamese Student Association"), "Vietnamese Student Association");
});

Deno.test("safeUrl passes http(s) links through", () => {
  assertEquals(
    safeUrl("https://zothub.app/reset-password#token=abc"),
    "https://zothub.app/reset-password%23token=abc",
  );
  assertStringIncludes(safeUrl("http://localhost:8080/reset-password"), "http://localhost:8080");
});

Deno.test("safeUrl blocks script-bearing and non-http schemes", () => {
  assertEquals(safeUrl("javascript:alert(1)"), "#");
  assertEquals(safeUrl("data:text/html,<script>alert(1)</script>"), "#");
  assertEquals(safeUrl("  javascript:alert(1)"), "#");
  assertEquals(safeUrl(null), "#");
  assertEquals(safeUrl(""), "#");
});

Deno.test("safeUrl cannot break out of an href attribute", () => {
  // A crafted value with a quote must not terminate the attribute.
  const out = safeUrl(`https://evil.example/"><script>alert(1)</script>`);
  assertEquals(out.includes('"'), false);
  assertEquals(out.includes("<"), false);
  assertEquals(out.includes(">"), false);
});
