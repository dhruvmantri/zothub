# ZotHub — Design

Self-contained design work for the ZotHub redesign. Everything here is a plain HTML file with no build step and no external dependencies — **open any of them directly in a browser.**

**New here?** Read [`00-handoff.md`](./00-handoff.md) first. It carries the full context: product, workflow state, locked decisions, and what's open.

---

## Contents

```
docs/design/
├── 00-handoff.md      ← the context package. Start here.
├── README.md          ← this file
├── current/           ← Direction 11 — the chosen direction
├── explored/          ← Directions 1–10 — the exploration, kept for reference
└── prototypes/        ← clickable interaction prototypes
```

### `current/` — Direction 11 · The Two-Sided Market

| File | What it is |
|---|---|
| **`direction-11-v2-pages.html`** | **Most current.** Refinements applied to three real pages (Landing, Discover, Review), with live switchers for signature treatment and secondary colour. **Open this one first.** |
| `direction-11-refinement-studio.html` | Five accent systems, type scale, components, and two stress tests (dense form, 375px). Crimson has since been locked. |
| `direction-11.html` | The original direction as first published. |

### `explored/` — Directions 1–10

Ten alternative directions, each a different thesis about the user rather than a recolour. Kept because the shortlist reasoning depends on them and because several contain ideas worth grafting back — notably **09-agenda** (time as the organising spine) and **10-club-page** (a club's colour tinting its page).

### `prototypes/`

`direction-01-instrument-clickable.html` is fully interactive: role switcher, live filters, detail view, review queue with working accept/decline/undo/bulk, and messaging with switchable threads and a composer. It exists to prove the **interaction model**, which is direction-independent.

---

## Conventions

Every file follows these, and new ones should too:

- **Working light/dark toggle** in-page. Both palettes designed, never a naive inversion. The toggle writes `data-theme` on the root element.
- **WCAG 2.1 AA verified by measurement.** Colours used as *text* carry a separate AA-safe token from the same colour used as a *fill* (`*-text` aliases).
- **Non-ASCII escaped to HTML entities** outside `<style>`/`<script>` — these files declare no charset and will render mojibake otherwise.
- **System font stacks.** The artifact sandbox blocks font CDNs, so real typefaces are stood in for. Final selection happens at implementation.
- Mock content is illustrative and consistent across files — the same five clubs and six applicants throughout — so directions are compared on design rather than content.

---

## Decide next

Three open questions, all live in `current/direction-11-v2-pages.html`:

1. **Signature treatment** — Weight / Rule / Colour. Flip on the Landing page.
2. **Secondary colour** — None / Blue / Teal / Ink. Watch the Discover page; "None" collapses it to neutral so you can see whether it earns a slot.
3. **The wordmark** — still borrows Wellfound's colon device. The last borrowed piece, and the main thing between this and an ownable identity.

Then: design system + brand kit → component library → remaining pages.
