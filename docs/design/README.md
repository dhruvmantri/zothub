# ZotHub — Design

Self-contained design work for the ZotHub redesign. Everything here is a plain HTML file with no build step and no external dependencies — **open any of them directly in a browser.**

**New here?** The original context package is archived at
[`../archive/00-handoff.md`](../archive/00-handoff.md) — product, workflow state and the
locked decisions. For anything still **open**, see the single tracker:
[`../BACKLOG.md`](../BACKLOG.md).

---

## Contents

```
docs/design/
├── 01-direction-11-critique.md   ← formal critique (2026-07-24), all claims measured
├── design-system.md               ← written token/brand spec
├── mb5-claim-flow.md              ← as-built record of the club claim flow
├── README.md                      ← this file
├── current/                       ← Direction 11 — the chosen direction
├── explored/                      ← Directions 1–10 — the exploration, kept for reference
└── prototypes/                    ← clickable interaction prototypes

docs/archive/00-handoff.md         ← the original context package (superseded)
```

### `current/` — Direction 11 · The Two-Sided Market

| File | What it is |
|---|---|
| **`component-library.html`** | **Component library v1** — the highest-value parts as real, stateful, interactive pieces: buttons (all states), tags/badges/chips (+ dedicated-slot coherence demo), form fields, the live review row, the severity-keyed confirmation dialogs, empty/loading/skeleton, toast. Click things. |
| **`design-system.html`** | **The brand kit / token reference.** Every colour with hex + AA badge, the marks at all sizes, the type scale, spacing/radii/elevation, the component inventory, motion, and the operating rules. Written spec: [`design-system.md`](./design-system.md). |
| **`direction-11-v4-uci.html`** | **The identity in practice / source of truth** — **Pacific blue**, **slate** light / **graphite** dark, **UCI campus hero** (real photo at `assets/hero-campus.jpg`). Discover defaults to **card view** with a **Cards/List toggle**; live review queue. |
| `direction-11-icon-lab.html` | Icon exploration — **decided: A, the stacked wordmark.** The other four (Ring · Zot · Snout · Hub×Ring) are kept for the record. |
| `direction-11-v3-pages.html` | The crimson version — structural reference (identical layout/components, pink accent + rose/graphite ramp). Superseded on colour by v4. |
| **`direction-11-identity-lab-2.html`** | Wordmark rounds (italic hub won) + **§01b the stacked mark** (avatar/app-icon/favicon — one open nit: the 16px cut) + ramp candidates + motion v1→v2. |
| `direction-11-identity-lab.html` | Round 1 — partially superseded. Still authoritative for: the dense 12.5px type test, W1–W3 component fixes, accent-semantics rule. |
| `direction-11-v2-pages.html` | Superseded by v3; kept until the archive pass. |
| `direction-11-refinement-studio.html` | Five accent systems + stress tests. Crimson locked here. |
| `direction-11.html` | The original direction as first published. |

### `explored/` — Directions 1–10

Ten alternative directions, each a different thesis about the user rather than a recolour. Kept because the shortlist reasoning depends on them and because several contain ideas worth grafting back — notably **09-agenda** (time as the organising spine) and **10-club-page** (a club's colour tinting its page).

### `prototypes/`

`direction-01-instrument-clickable.html` is fully interactive: role switcher, live filters, detail view, review queue with working accept/decline/undo/bulk, and messaging with switchable threads and a composer. It exists to prove the **interaction model**, which is direction-independent.

---

## Conventions

Every file follows these, and new ones should too:

- **Working light/dark toggle** in-page. Both palettes designed, never a naive inversion. The toggle writes `data-theme` on the root element.
- **WCAG 2.1 AA verified by measurement** — 1.4.3 *and* 1.4.11 (control boundaries ≥3:1, `--line-3`). Colours used as *text* carry a separate AA-safe token from the same colour used as a *fill* (`*-text` aliases). Every distinct surface (e.g. the dark panel in light theme) carries its own full alias set.
- **Non-ASCII escaped to HTML entities** outside `<style>`/`<script>` — these files declare no charset and will render mojibake otherwise.
- **System font stacks, with one exception.** Files whose *subject is the typeface* (currently only `direction-11-identity-lab.html`) load webfonts via Google Fonts, degrading gracefully to system stacks offline. Typeface selection is an **identity-phase decision** (made in the lab), no longer deferred to implementation.
- Mock content is illustrative and consistent across files — the same five clubs and six applicants throughout — so directions are compared on design rather than content.

---

## State

**Identity locked, with a 2026-07-25 colour/place revision** (full record in `../archive/00-handoff.md` §5): **Pacific blue** accent (UCI-adjacent, no seal/gold) · **cool slate light / graphite dark** · **campus-image landing** · Instrument Sans · italic signature · italic-hub wordmark + stacked disc mark · pills · mono data voice, date chip, no secondary · motion v2 · fixed-register context cards. Live counts only — no fabricated stats.

**Design system derived** (2026-07-25): [`design-system.html`](./current/design-system.html) + [`design-system.md`](./design-system.md) are the canonical token/brand reference, in sync with v4.

Icon decided (A, stacked); production SVGs shipped (see `/brand`). The redesign is
implemented and live.

**Open design work is tracked in [`../BACKLOG.md`](../BACKLOG.md)** — notably the UI/UX
usability pass (`UX0`), hero-photo licensing (`P1-license`) and WebP/AVIF (`P1`), and the
maintainer's pending component-level tweaks (`DP9`). Do not keep a second open-items list
here.
