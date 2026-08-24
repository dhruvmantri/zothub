import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Flat config does NOT read .gitignore, so local build/tooling artifacts must be
    // listed explicitly. `supabase/.temp` is written by `supabase start` and contains
    // a bundled, minified edge-runtime entrypoint — linting it produced 207 phantom
    // errors on any machine that had ever run the local stack, which would have made
    // the build gate fail for reasons unrelated to the code.
    ignores: ["dist", "supabase/.temp", "supabase/.branches", "playwright-report", "test-results"],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
