import { defineConfig, devices } from "@playwright/test";

// The dev server needs Supabase env vars to boot (the client throws without
// them). The smoke suite is backend-independent by design: if real
// VITE_SUPABASE_* vars are present in the environment they are used,
// otherwise unreachable placeholders are injected so pages render their
// normal loading/empty/error states instead of crashing.
const supabaseEnv = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:65432",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "smoke-test-placeholder-key",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8080",
    trace: "on-first-retry",
    launchOptions: {
      // Sandboxed/CI environments can point at a pre-installed Chromium
      // instead of downloading a browser; unset locally, this is a no-op.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Explicit loopback host: the app's dev default (`host: "::"`) requires
    // IPv6, which not every CI/sandbox provides; tests only need localhost.
    command: "npx vite --host 127.0.0.1 --port 8080 --strictPort",
    url: "http://127.0.0.1:8080",
    reuseExistingServer: !process.env.CI,
    env: supabaseEnv,
  },
});
