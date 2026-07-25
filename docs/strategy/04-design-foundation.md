# Design Foundation

**Date:** 2026-07-23 · settled in a working session
**Status:** Agreed. Inherited by every screen.
**Preceded by:** [`01-positioning.md`](./01-positioning.md) · [`02-research.md`](./02-research.md) · [`03-structure-decisions.md`](./03-structure-decisions.md)

**What this is and isn't.** This locks **decisions and constraints**, not specifications. Type scale values, exact hex, spacing ramp, and shadow tokens are *outputs* of designing real screens — fixing them here would mean designing to invented numbers, then quietly abandoning them at the first hard layout.

---

## Principles

### Primary — the tiebreaker

**1. Never a dead end.** Every state offers the next action. No message names a problem without offering the remedy; no empty result ends the journey; no error only reports. **When principles conflict, this wins.**

*Chosen because all three severity-4 heuristic findings were this same failure — it's the product's actual disease.* Immediate consequences: the "complete your profile" toast with no link, the empty search with no next step, the `reviewed` filter returning nothing, and the rejection that ends the relationship are all now **violations**, not backlog items.

### Operating set

**2. Low floor, high ceiling.** A club can list an existing Google Form in thirty seconds; the full pipeline is there when they want it. **No capability removed to make entry easy.**

*This materially de-risks assumption A4 — the ask changes from "migrate your recruiting" to "add a listing."*

**3. Less work than what it replaces.** Every flow measured against the Google Form + spreadsheet + group chat it displaces. More steps here than there is a bug, not a preference.

**4. Consistent beats clever.** One vocabulary, one nav model, one card renderer, one status colour. A user who learns a pattern on one screen is right on the next.

*Grounded in every severity-3 finding: four status vocabularies, three nav systems, two taxonomies, three confirmation paradigms.*

### Live as decisions, not tiebreakers

- **Honest about state** — locked by Structure §7 (live counts, no stage-announcing copy).
- **Respect the stakes** — expressed through the consequential-moment decisions below.

---

## Consequential moments

The product's most differentiated behaviour is how it acts when the stakes are human. Almost nobody designs rejection.

**Rejection reads direct, then offers a door.** "Design Society didn't move forward with your application." Then, quieter and separated: "3 open roles look like a fit →". **The ordering is the design** — acknowledge first, offer second, never in the same breath.

**Nobody gets ghosted.** Closing a posting **auto-declines** undecided applicants — but only after an explicit prompt stating exactly how many will be declined, with "review them first" offered as the alternative. Nothing is sent on a club's behalf without knowing consent at that moment.

**An auto-declined student reads the same message as a deliberately-declined one.** "You weren't even looked at" is materially worse than "not selected," and the student must not be able to tell the difference.

---

## Brand & feel

**Personality: confident utility.** Clean and functional, but with real typographic personality and considered colour rather than default-safe neutrality. Reads as *someone who cares about craft built this* — credible enough for an officer to trust with applicant data, warm enough not to be enterprise software.

**Resolving the core tension:** the product must simultaneously convince a club officer to hand over real applicants' data (argues for restraint and precision) and feel like something a nineteen-year-old wants to open in a park (argues for warmth). Confident utility sits deliberately between them.

**Reference point:** minimal but memorable — the register of Claude's own interface.

**Ruled out:** UCI-official (seal, blue/gold, implied endorsement); generic B2B SaaS; institutional-comprehensive-tedious, which is ZotSpot's register and our only felt advantage.

> **Amendment (2026-07-25, maintainer).** This anti-goal was about *impersonation*, and that still holds: no UCI seal, no gold, no wordmark lift, no implied endorsement. What is now **in scope** is a **campus-adjacent blue accent** (a deep Pacific blue, deliberately not the registrar seal-blue) plus **a UCI campus image on the landing**, to make the product feel place-specific and worked-on rather than generic. The line: *"built for UCI," not "we are UCI."* Because the accent is a single token, a future objection is a one-variable swap. See `docs/design/00-handoff.md` §5 and `direction-11-v4-uci.html`. This supersedes the earlier crimson/near-monochrome accent direction.

---

## Density

**Density follows the task, not the user.** One design language, one default density, complexity increasing with depth.

- A student comparing eight opportunities deserves a table view as much as a club triaging forty applicants. Role-based density would have denied them that.
- **View switching (cards ↔ list ↔ table) is a first-class pattern on any collection**, not a club feature.
- Density is a property of **context depth**, not of who is logged in. A focused work context (reviewing applicants for one opportunity) is legitimately denser.
- Same components at both densities — a compact **variant**, never a different component.
- **View choice persists per surface.**

---

## Visual system direction

**Typography — display face + workhorse text face.** Personality where it's seen (headings, hero, key numbers), reliability where it's read (body, tables, forms). Dense tables at 11–13px are non-negotiable, and most characterful faces fail there. The codebase's phantom `font-display` class finally gets something real behind it.

*Constraint:* Inter currently loads via a **render-blocking `@import`** on top of a 1.38MB payload. Families and weights are a performance decision, not only an aesthetic one — self-host or preconnect, subset, `font-display: swap`.

**Colour — near-monochrome plus one accent, on warm neutrals.** Neutrals carry ~95% of the UI; a single saturated accent marks action; a disciplined semantic set is used **only** for status.

*The argument is the density decision:* in a dense review table, colour must mean something. If brand colour is everywhere, status colour becomes invisible.

**Specific hue deliberately deferred** to 2–3 mockup directions. *Note for that phase:* the existing coral `#dd7255` may be closer to right than the indigo — it needs darkening regardless, currently failing AA at 3.18:1 on white.

**Motion — functional, plus a few signature moments.** Motion confirms a state change, shows where something came from, or holds spatial continuity. 150–250ms. Never decorative. Two or three deliberately crafted moments (submitting an application; a club publishing their first posting) carry memorability rather than spreading it thin. `prefers-reduced-motion` respected everywhere.

**Imagery — deferred, with a concrete test.** Mockups must produce **empty and populated states for both** approaches: (a) real product and real content only, (b) product plus restrained illustration in the moments with nothing to show. Decision made from the states, not from a description.

**Iconography — Lucide, already a dependency.** Outline, consistent stroke weight, sizes aligned to the type scale. **No emoji as icons.** Every icon-only control carries an accessible label — there are currently three `aria-label`s in the entire app outside `ui/`.

**Components — keep shadcn/Radix, re-token rather than replace.** Replacing costs weeks and buys nothing the token layer can't. What changes:
- One **card as a polymorphic renderer** over typed items — Apply and RSVP are different verbs with different time semantics and must look different.
- One shared **status map** (label + colour + icon) replacing four.
- One **empty-state** component; one **loading** path; one **confirmation model keyed to severity**, replacing three paradigms currently applied inversely to risk.
- **No raw palette utilities in components** — 41 exist today; tokens only.

---

## Gates

Not aspirations. A slice doesn't ship without them.

**Accessibility — WCAG 2.1 AA as a merge gate.**
- Every token pair **contrast-verified by measurement**, not eyeballed. Four pairs fail today.
- **Visible focus on every interactive element.** Zero exist across 11 components using raw `<button>`.
- Minimum **44×44** touch targets — the bookmark control is ~28px today.
- Keyboard traversal of every core journey; every icon-only control labelled.

**Performance.**
- **Route-level code splitting mandatory.** Zero today: recharts (411KB) is `modulepreload`ed on the landing page for anonymous visitors.
- Landing route target ≤ ~200KB gzipped JS.
- Reserve space to avoid layout shift (CLS < 0.1) — skeletons must match the components they stand in for; they don't today.
- Images WebP/AVIF, lazy below the fold.

---

## Anti-patterns

Explicit so drift needs an argument:

- No fabricated data or social proof — already made this mistake once.
- No copy describing the product's stage; only data describing its state.
- No emoji as icons; no colour as the sole carrier of meaning.
- No decorative-only motion; no hover-only affordances.
- No placeholder-only labels; no errors shown only at the top of a form.
- No engagement mechanics — streaks, infinite scroll, manufactured notification volume.
- No duplicated status maps, colour maps, or search implementations.
- **No dead ends.**

---

## Deferred, with what resolves each

| Deferred | Resolved by |
|---|---|
| Specific accent hue and full palette | 2–3 mockup directions |
| Imagery vs illustration | Empty + populated states of both, side by side |
| Type scale, spacing ramp, shadow and radius tokens | Falls out of the first two screens |
| Named typefaces | Mockup directions, tested at 12px and 48px |

## Carried open from earlier stages

| Item | Blocks |
|---|---|
| **Club recruiting walkthrough + artifacts** | Review-pipeline depth and the application review screen |
| **A5 — do students already discover clubs via ZotSpot?** | The student-side headline: "finally, one place" vs "the same clubs, without the friction" |
