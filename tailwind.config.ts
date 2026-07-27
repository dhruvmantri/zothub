import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * Tailwind is wired to the token layer in `src/index.css` — every colour here
 * is `hsl(var(--token) / <alpha-value>)` so alpha modifiers (`bg-accent/10`)
 * keep working. Nothing below holds a literal colour; changing the palette is
 * a token edit, never a config edit.
 *
 * Two families of names, both pointing at the same tokens:
 *   · ZotHub  — surface / ink / line / accent / ok / warn / bad / panel
 *   · shadcn  — background / foreground / primary / muted / border / …
 */
export default {
  // next-themes writes `data-theme="dark"` on <html> (see App.tsx). Kept as a
  // variant so the handful of `dark:` utilities still in the tree resolve.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        // One superfamily across both registers — marketing loud and app quiet
        // stay in a single voice, and the italic stays available everywhere.
        sans: ["Instrument Sans", "var(--sys)"],
        display: ["Instrument Sans", "var(--sys)"],
        mono: ["var(--mono)"],
      },
      colors: {
        /* ---------- ZotHub ---------- */
        surface: {
          DEFAULT: "hsl(var(--bg) / <alpha-value>)",
          2: "hsl(var(--bg-2) / <alpha-value>)",
          3: "hsl(var(--bg-3) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "hsl(var(--ink) / <alpha-value>)",
          2: "hsl(var(--ink-2) / <alpha-value>)",
          3: "hsl(var(--ink-3) / <alpha-value>)",
        },
        line: {
          DEFAULT: "hsl(var(--line) / <alpha-value>)",
          2: "hsl(var(--line-2) / <alpha-value>)",
          3: "hsl(var(--line-3) / <alpha-value>)",
        },
        ok: {
          DEFAULT: "hsl(var(--ok) / <alpha-value>)",
          wash: "hsl(var(--ok-wash) / <alpha-value>)",
        },
        warn: {
          DEFAULT: "hsl(var(--warn) / <alpha-value>)",
          wash: "hsl(var(--warn-wash) / <alpha-value>)",
        },
        bad: {
          DEFAULT: "hsl(var(--bad) / <alpha-value>)",
          wash: "hsl(var(--bad-wash) / <alpha-value>)",
        },
        panel: {
          DEFAULT: "hsl(var(--panel) / <alpha-value>)",
          2: "hsl(var(--panel-2) / <alpha-value>)",
          ink: "hsl(var(--panel-ink) / <alpha-value>)",
          "ink-2": "hsl(var(--panel-ink-2) / <alpha-value>)",
          line: "hsl(var(--panel-line) / <alpha-value>)",
          accent: "hsl(var(--panel-accent) / <alpha-value>)",
          "accent-text": "hsl(var(--panel-accent-text) / <alpha-value>)",
        },

        /* ---------- shadcn contract ---------- */
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        /**
         * `accent` is the BRAND accent (Pacific blue) — that is what the app
         * code has always meant by it. shadcn's own components use `bg-accent`
         * for their neutral hover surface; those have been re-pointed at
         * `surface-3` so a menu row never lights up blue.
         */
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          text: "hsl(var(--accent-text) / <alpha-value>)",
          ink: "hsl(var(--accent-ink) / <alpha-value>)",
          wash: "hsl(var(--accent-wash) / <alpha-value>)",
          line: "hsl(var(--accent-line) / <alpha-value>)",
          foreground: "hsl(var(--accent-ink) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          primary: "hsl(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "hsl(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
        },
      },
      // Inputs (r2) must not share the card radius (r3) or they read as
      // nested cards. `pill` is every button and chip.
      borderRadius: {
        sm: "var(--r1)",
        md: "var(--r2)",
        lg: "var(--r3)",
        xl: "var(--r4)",
        "2xl": "24px",
        pill: "var(--rp)",
      },
      spacing: {
        s1: "var(--s1)", s2: "var(--s2)", s3: "var(--s3)", s4: "var(--s4)",
        s5: "var(--s5)", s6: "var(--s6)", s7: "var(--s7)", s8: "var(--s8)",
      },
      boxShadow: {
        e1: "var(--e1)",
        e2: "var(--e2)",
        e3: "var(--e3)",
        e4: "var(--e4)",
        card: "var(--e1)",
        "card-hover": "var(--e2)",
      },
      transitionTimingFunction: { zh: "var(--ease)" },
      transitionDuration: { fast: "150ms", base: "200ms", slow: "250ms" },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { "0%": { backgroundPosition: "100% 0" }, "100%": { backgroundPosition: "-100% 0" } },
      },
      animation: {
        "accordion-down": "accordion-down 200ms var(--ease)",
        "accordion-up": "accordion-up 200ms var(--ease)",
        "fade-in": "fade-in 250ms var(--ease)",
        "fade-up": "fade-up 250ms var(--ease)",
        shimmer: "shimmer 1.4s ease infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
