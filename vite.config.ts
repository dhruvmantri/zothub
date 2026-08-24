import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Fail a production build that is missing VITE_TURNSTILE_SITE_KEY (backlog S10).
 *
 * The key is INLINED at build time, so a build without it produces an artifact
 * that renders a visible error and BLOCKS signup and club claims entirely — by
 * design, fail-closed. The problem was that `npm run build` exited 0 anyway, so
 * the documented failure mode was the DEFAULT for a fresh deploy and nothing
 * caught it. It nearly took signup down on 2026-07-27.
 *
 * Failing here rather than only in CI means every build is covered — a laptop, a
 * new Vercel project, anything — not just the ones that happen to run CI.
 *
 * Working locally and don't have the real key? Use Cloudflare's public test
 * site key, which always passes: 1x00000000000000000000AA. Deliberately no
 * bypass flag — a flag that skips this check is a flag someone eventually ships.
 */
function assertProductionEnv(mode: string) {
  if (mode !== "production") return;

  const env = loadEnv(mode, process.cwd(), "");
  const missing = ["VITE_TURNSTILE_SITE_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]
    .filter((key) => !env[key]?.trim());

  if (missing.length) {
    throw new Error(
      `\n\nProduction build aborted — missing required env var(s): ${missing.join(", ")}.\n\n` +
        `VITE_* values are inlined at BUILD time, so a build without them ships broken:\n` +
        `  • VITE_TURNSTILE_SITE_KEY missing  -> signup and club claims are blocked outright\n` +
        `  • VITE_SUPABASE_* missing          -> the app cannot reach its backend at all\n\n` +
        `Set them in the Vercel project (or .env locally) and rebuild.\n` +
        `For local builds without the real Turnstile key, use Cloudflare's test key:\n` +
        `  VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA\n`,
    );
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  assertProductionEnv(mode);

  return {
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code into separate chunks
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          "supabase": ["@supabase/supabase-js"],
          "query": ["@tanstack/react-query"],
          "form": ["react-hook-form", "@hookform/resolvers", "zod"],
          "animation": ["framer-motion"],
          // recharts is deliberately NOT a manual vendor chunk. Declaring it
          // here forced it into an eagerly-preloaded chunk even though its only
          // importer (ClubAnalytics) is lazy — that's why it stayed in the
          // initial download. Left to Rollup, it folds into the on-demand
          // ClubAnalytics chunk and loads only when the analytics tab opens.
        },
      },
    },
    // Increase chunk size warning limit (in kB)
    chunkSizeWarningLimit: 1000,
    // Enable minification in production
    minify: mode === "production" ? "esbuild" : false,
    // Generate source maps for production debugging (optional)
    sourcemap: mode === "production" ? false : true,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@supabase/supabase-js",
      "@tanstack/react-query",
    ],
  },
  };
});
