import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
          "charts": ["recharts"],
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
}));
