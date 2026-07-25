# ZotHub — Design System (v1)

**Date:** 2026-07-25 · **Status:** Derived from the locked visual identity.
**Source of truth:** [`current/direction-11-v4-uci.html`](./current/direction-11-v4-uci.html) (tokens live in its `:root`) · **Visual reference:** [`current/design-system.html`](./current/design-system.html) (swatches, marks, type, components, AA badges — open this).

This file is the written token spec. The HTML page is the same system made visible. When they disagree, the HTML page wins (it's the running artifact); update this to match.

> **Implementation bridge.** The live app is React + Tailwind + shadcn/ui (Radix). The rule is **re-token, don't replace** (strategy §04). These tokens become CSS custom properties on `:root` / `[data-theme="dark"]` and Tailwind theme extensions; shadcn components inherit them. `src/index.css` today ships a dark-only indigo/coral palette on Inter — it gets rewritten to the below. Nothing about the component wiring (RLS, queries, routing) changes.

---

## 1. Colour

All pairs AA-verified by measurement (ratios in `design-system.html`). Format: **light / dark**.

### Neutrals — Slate (light) · Graphite (dark)
| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#0E0F10` | page base, cards |
| `--bg-2` | `#F5F7FA` | `#141517` | grouped surfaces, hover |
| `--bg-3` | `#EBEFF4` | `#1B1D1F` | sunken, neutral tag fill |
| `--ink` | `#0D1519` | `#F0F1F2` | primary text (18.5:1) |
| `--ink-2` | `#44515A` | `#A8ABAF` | body, secondary (8.2:1) |
| `--ink-3` | `#5F6B74` | `#85888D` | meta, captions (5.5:1) |
| `--line` | `#E4E9EE` | `#26282B` | hairlines — decorative only |
| `--line-2` | `#CDD6DD` | `#37393D` | stronger dividers |
| `--line-3` | `#828E97` | `#64676C` | **control boundaries, ≥3:1** (inputs, checkboxes) |

### Accent — Pacific blue (UCI-adjacent; **no seal, no gold**)
| Token | Light | Dark | Role |
|---|---|---|---|
| `--accent` | `#0F5FA8` | `#5AA2E6` | fills, primary CTA (white/ink 6.5:1) |
| `--accent-text` | `#0B4E8C` | `#8FBEF2` | accent used **as text** (8.5:1) |
| `--accent-ink` | `#FFFFFF` | `#06182B` | text/icon **on** an accent fill |
| `--accent-wash` | `#E9F1FB` | `#0E2338` | badge / chip / tag fill |
| `--accent-line` | `#BAD6F2` | `#234A6B` | accent borders |
| `--panel-accent` | `#5AA2E6` | `#5AA2E6` | accent inside **dark contexts** (theme-independent) |
| `--panel-accent-text` | `#8FBEF2` | `#8FBEF2` | accent-as-text in dark contexts |

### Status — fixed semantics, **never brand**
| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--ok` / `--ok-wash` | `#10794D` / `#E7F4EE` | `#4FCB92` / `#102A1F` | accepted, going |
| `--warn` / `--warn-wash` | `#8A5A0B` / `#FCF3E4` | `#DCA85A` / `#2B2210` | reviewed, waiting |
| `--bad` / `--bad-wash` | `#B32B1D` / `#FBEBE9` | `#E98A7C` / `#2D1613` | declined, closed |
| idle | `--bg-3` + `--ink-3` | — | applied, neutral |

### Panel (dark card in light theme)
`--panel #14171B` · `--panel-2 #1E2228` · `--panel-ink #F0F2F4` · `--panel-ink-2 #9AA1A8` · `--panel-line #2B3037`. (Dark theme: `#17181A` / `#1F2124` / … .)

### Contexts — fixed register in **both** themes
- **`.ctx-dark`** (club card, photo hero): re-binds the full alias set to the panel palette + `--panel-accent`. Always dark.
- **`.ctx-light`** (student card): always light, even inside dark theme.
- Every distinct surface owns a **complete** alias set — nothing inherits accent across a register boundary. (This closed the W1 AA failure.)

**Accent-semantics rule:** the accent marks exactly one thing — **demands action now** (New, Closing soon, Review them) and primary CTAs. Everything decided or waiting is a calm status colour. In dense lists the in-app primary verb (Apply, RSVP) is `--ink`, not accent, so blue stays scarce and status stays legible.

### Hero-over-photo
White headline, `#AFCDF3` italic, `#E4EAF1` subhead, `#E6ECF2` counts, over a baked two-axis scrim (`rgba(6,13,22,…)` L→R + bottom). AA-verified over the real composited pixels: 5.7–11.2:1 across both themes. Don't remove the scrim.

---

## 2. Typography

**Instrument Sans** (one superfamily; the italic is load-bearing — signature + wordmark). Self-host at implementation (~55KB); fallback `--sys` system stack. Mono = `ui-monospace,…` for the data voice.

| Step | Size | Weight | Tracking |
|---|---|---|---|
| Display | clamp(38–64px) | 500 | `-.034em` |
| Section | 28–32px | 500 | `-.026em` |
| Card | 22px | 600 | `-.018em` |
| UI title | 16px | 600 | `-.01em` |
| Body | 16px | 400 | ~0 |
| Meta | 13.5px | 400 | 0 |
| Label | 10.5px mono | 600 | `.14em` uppercase |

- **Tracking scales with size** — tight on display, near-0 on body.
- **Italic has two jobs only:** the accent signature (one phrase per view) and the wordmark's `hub`. Never italicise body for emphasis — use weight.
- **Data voice:** counts, dates, deadlines → mono + tabular-nums. Words people wrote → the UI face.

---

## 3. Spacing, radii, elevation, motion

- **Spacing** (4pt ramp): `--s1..s8` = 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Radii:** `--r1 6` · `--r2 10` (inputs) · `--r3 14` (cards) · `--r4 20` (hero) · `--rp 999` (pills, all buttons/chips). Inputs must not share the card radius.
- **Elevation** (ink-tinted, not pure black): `--e1` resting · `--e2` hover/active · `--e3` popovers · `--e4` modals + the bridging hero cards.
- **Motion:** `--t-fast 150 / --t-base 200 / --t-slow 250`, one ease `cubic-bezier(.2,.7,.3,1)`. Signature = the dot **pulses once** on a state change (application submitted, decision made, posting published). Never loops; dies under `prefers-reduced-motion`.

---

## 4. Components (inventory)

Re-tokened shadcn/Radix, not replaced. Compact = a **variant**, never a different component.

- **Buttons:** `btn-acc` (blue — the one action that demands it, marketing CTAs) · `btn-ink` (in-app primary verb in lists) · default (outline) · `btn-ghost` · `.btn-sm`. Min 44px height (34px `-sm` on non-touch; 44px on touch).
  - **Hover rule (load-bearing):** base/state hovers use `:where()` — `.btn:where(:hover){background:var(--bg-3)}` — so the base hover stays specificity 0-1-0 and filled variants (`.btn-acc`/`.btn-ink`, also 0-1-0) always win by source order and keep their fill. Without this, `.btn:hover` (0-2-0) outranks the variants and swaps their colour for grey → light text goes invisible. Never re-declare a variant's background just to defend it; fix the base specificity instead.
- **Opportunity — two views:** **Cards** (default browse — one self-contained card per item, scannable) and **List** (denser, club-grouped power view), switched by a per-surface toggle; choice persists per surface. The card is a **polymorphic renderer** — a role shows a deadline countdown; an event shows the mono date chip. Same tokens both views.
- **Tags** (uppercase, pill): accent `tag` = "demands action"; `tag-n` neutral = category. **Dedicated-slot rule:** tags/badges/chips get their own slot and never share a line with flexible content (a title, a name) — so a component *with* a tag and one *without* stay identical. (Fixed the card where "Closing soon" squeezed the title.)
- **Badges** (status, dot + label): `b-new` `b-ok` `b-warn` `b-bad` `b-idle` — one shared status map (label + colour + dot).
- **Chips** (filter): pill, `aria-pressed` → accent-wash.
- **Inputs:** `--line-3` boundary, `--r2` radius, accent focus, 44px min.
- **Date chip:** mono, tabular — the marker that makes an **event** look different from a **role** (different time semantics) without a second hue.
- **Avatars — shape = kind:** **people are circles, clubs/orgs are rounded-squares** (square radius scales with size so a logo never reads as a nested card). Fallback chain: photo → initials on a **name-derived, AA-safe colour** (hashed from identity, decorative not semantic) → neutral glyph. Sizes 24 / 32 / 40 / 48 / 64 / 88. Two ZotHub-specific variants: an **unclaimed-club** avatar (dashed, muted — for ZotSpot-seeded profiles) and a **stacked cluster** (`+N`) for "who applied / who's going". *(Supersedes the earlier "rounded-square for all" note — shape now carries person-vs-org meaning, which matters on a two-sided marketplace.)*
- **Opportunity card (avatar-card layout):** tile is its own left column (club logo for roles, calendar for events); **title / club / meta / tag / footer all share one aligned right column** so every left edge matches and footers line up across a row. Tags sit in a dedicated slot below the meta (never the title's line).
- **Opportunity row (list view):** grouped under a club bar (logo, name, live pulse); a **CSS grid with fixed column tracks** (name / standing / date / badge / actions) so columns align across every row regardless of which action a row shows.
- **Empty state, confirmation (severity-keyed), loading skeletons, toast** — built (`component-library.html` §05–06).
- **Navigation:** four fixed destinations per role — student `Discover · Clubs · Activity · Messages`, club `Postings · Responses · Messages · My Club` — identical *items* on both platforms, each in its own idiom. **One active language: an accent bar marks "you are here"** (bottom edge on the desktop bar, top edge on the mobile tab bar). Desktop = text links + account avatar-menu (the profile home on desktop); mobile = bottom tab bar with Lucide icons, profile living inside Activity. **Notification counts** on Messages / Responses (real state, not manufactured), plus a lighter dot on the mobile bell. (`component-library.html` §07.)
- **Messages:** two relationships on one surface — `student ↔ club` (tied to the application via a context line) and the net-new `student ↔ member` (Positioning §8), the latter labelled `MEMBER` so it's never mistaken for the official club account. Inbox list (unread badge on the avatar; open thread carries the accent left-bar) + thread (grey-received / **accent-sent** bubbles — the one deliberate accent use outside "demands action") + composer. **The thread header is a link** to the club page / member profile (never a dead end). (`component-library.html` §09.)
- **Profile:** soft gate, never a wall (Structure §6) — a short, **skippable** first-run setup (progress + reassurance) distinct from a plain **settings-style edit** (never the wizard again), plus the profile **view** (person circle / club square destination page; no private activity counts exposed to others). (`component-library.html` §10.)

---

## 5. Operating rules (inherited by every screen)

1. **Never a dead end** — every state offers the next action. Wins on conflict.
2. **Honest about state** — live counts only; no copy describing the product's *stage*; no fabricated stats.
3. **Accent = demands action** — blue for the thing to act on now + primary CTAs; status stays status; colour never the sole carrier of meaning.
4. **Density follows the task** — cards ↔ list ↔ table first-class on any collection; same components, compact variant.
5. **AA is a merge gate** — every pair measured (1.4.3 text *and* 1.4.11 boundaries); visible focus everywhere; 44×44 targets; every icon-only control labelled.
6. **Not UCI-official** — campus-adjacent, not impersonating: the blue and photo say "built for UCI," never a seal/gold/endorsement. Identity lives in tokens → a rebrand is a token swap.

---

## 6. Open / next

- **Icon/app-mark: the stacked wordmark** (decided 2026-07-25; `zot`/`hub` disc, italic-accent `hub`). Wordmark (inline italic hub) and mark (stacked disc) are both font-rendered lockups. For shipped assets, **outline from licensed Instrument Sans** (favicon/app-icon/social); disc `#101112`, letters `#F5F5F6`, accent `#5AA2E6`, 16px uses the tight cut. The other icon explorations live in `direction-11-icon-lab.html` (not chosen).
- **Maintainer's pending UI changes** land in the **component library / screens** phase. Foundational ones (radius, spacing density, type sizes, button height) are token edits here; component/layout/interaction ones are built downstream.
- **Component library is complete** — `current/component-library.html`, ten stateful/interactive sections: buttons · tags/badges/chips · forms · review row · severity-keyed confirmation · empty/loading/toast · **nav** · **avatars** · **messages** · **profile**. Both themes, every pair AA-verified by measurement in the browser. **Next:** assemble the product screens from these components — **club first-run is the priority journey** (signup → profile → post a role → receive/review, Positioning §3), then the apply flow, club dashboard (lands on Responses), Clubs/club page, Activity, Messages, Profile → then implementation (rewrite `src/index.css` tokens, self-host font, route-split).
- **One open component call, deliberately deferred to the maintainer:** sent message bubbles use the accent (the single accent use outside "demands action") — kept because chat is a focused context and blue-for-you is universal; toneable to ink/wash on request.
