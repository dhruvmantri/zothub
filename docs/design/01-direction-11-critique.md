# Direction 11 — Design Critique

**Date:** 2026-07-24 · **Scope:** `current/direction-11-v2-pages.html` (most current), with the studio and original as context.
**Method:** every inherited claim re-verified — contrast recomputed from hex, pages driven at 1200px and 375px in both themes, codebase checked. Nothing below is asserted from memory.

**Verification note:** all documented measurements reproduce exactly (5.27:1, 3.57:1, 1.23:1, 3.18:1, 4.05:1). The record-keeping is trustworthy. The new findings below are things the record *missed*, not things it got wrong.

---

## 1. What is working well

- **The two registers.** Marketing loud (58px / 500 / −0.042em), app quiet (28px / 500–600). This is the single best inheritance from Wellfound because it solves ZotHub's actual tension — credible to an officer, warm to a student — structurally rather than with decoration.
- **The review screen is the thesis made visible.** The auto-decline banner ("12 people have been waiting 9 days…") with a crimson *Review them* is the positioning — nobody gets ghosted — rendered as a component. Undo on decided rows answers the severity-4 heuristic finding directly.
- **Product shown, not described.** The embedded peeks (a live applicant list, a student's application tracker) do more landing-page work than any copy. This is the direction's genuine idea and it survives any re-skinning.
- **Honest-state counts** ("34 clubs · 61 open roles · 12 events this week") occupying the slot the fabricated stats vacated — quiet, self-updating social proof.
- **The dark theme is designed, not inverted.** Deep-tinted washes, re-picked accent (`#FF4C86`), white primary buttons. The review queue in dark is genuinely good.
- **Discipline.** 4pt rhythm, named radii, three elevation steps, `*-text` aliases, AA measured rather than eyeballed. Rare at this stage of a project and worth protecting.

## 2. What must be preserved

1. The two-register type system and the quiet app register in particular.
2. The embedded product peeks on the landing page.
3. The review banner pattern (consequence named, count named, action offered).
4. The near-monochrome surface + one accent economy — colour scarcity is what makes status legible in dense views.
5. The token discipline and measurement culture (contrast, tracking-by-size, radii scale).
6. Ink `#071417`, crimson `#D81E5B`/`#B01048`, and the locked accent decision. Relitigating it buys nothing; ownability must come from elsewhere (see §5).
7. Live counts as the only social proof.

## 3. What feels generic or derivative

- **The wordmark is still Wellfound's colon**, verbatim. Known, flagged, still true — and it anchors everything else toward "Wellfound clone."
- **All three signature candidates are anonymous.** Weight-drop, colour-only, and rule-under are the three most common headline emphasis moves on the internet. The rule variant renders as a hyperlink underline (verified at 1200px — it wraps across two lines and underlines each fragment). None of the three is a *device someone could recognize ZotHub by*.
- **The system font stack makes the brand platform-dependent.** On macOS the −0.042em SF Pro display reads "Apple keynote"; on Windows it becomes Segoe UI and the tightness stops working. A brand that changes voice per OS is not yet a brand. (Wellfound chose system fonts deliberately — copying that choice is itself derivative, and they have a recognized logo to carry identity; we don't.)
- **Centered hero → gradient wash → two pill CTAs → counts** is the stock SaaS landing skeleton. The peeks redeem it; the frame around them is template-grade.
- **Discover with Secondary=None is a generic ATS.** Grey pills, grey meta, black Apply buttons. Disciplined, but nothing about the page says ZotHub rather than any job board.

## 4. What weakens the product (verified defects)

| # | Finding | Evidence |
|---|---|---|
| W1 | **The FOR CLUBS eyebrow fails AA on every landing view.** The dark card inside the *light* theme has no accent token of its own: `--accent #D81E5B` on `--panel #0B1316` = **3.80:1** at 10.5px/700 (v2); the original used `--accent-text` = **2.69:1**. The token system has `*-text` aliases per theme but no **on-panel** alias set — a systemic gap, since the dark-card-in-light-page is the landing's signature component. | computed; visible in screenshot |
| W2 | **Input borders are 1.49:1** (`#CDD5D7` on white) against WCAG 1.4.11's 3:1 for component boundaries. The hairline problem was found and fixed for *grouping* (1.23:1 → surface); the same problem in *form controls* was not. | computed |
| W3 | **The documented mobile rule was never applied.** The studio's finding — "button pairs stack, they don't shrink; primary stays, secondary moves to overflow" — is written in the handoff, but v2 at 375px still renders Save+Apply side-by-side at **34px height**, under the 44px gate. | measured at 375px |
| W4 | **The two-sided split dissolves in dark mode.** In light, dark-card-vs-light-card *is* the two-sided-market metaphor. In dark, both cards are dark (panel vs maroon wash) and the opposition — the direction's namesake — nearly vanishes. The signature move only exists in one theme. | screenshot comparison |
| W5 | **Event rows and role rows are visually identical** with Secondary=None (meta text aside). Structure §1: "Deadlines and event dates are different time semantics and **must look different**." A grey EVENT tag is not different semantics. | screenshot |
| W6 | Review grid: the 150px column wraps ("Senior · Computer Science") and misaligns the date column between rows. | screenshot |
| W7 | Mockup nits: the "Applied" badge has no wash (bare dot+text); v2 dropped the bulk accept/decline actions the original review header had; programmatic mobile nav is absent (desktop nav wraps and clips). | inspection |

## 5. Biggest opportunities

1. **The typeface decision is the identity decision, and it is currently deferred to the wrong phase.** The foundation doc locks "display face + workhorse text face," yet Direction 11 ships a single system stack and defers selection to implementation. For a near-monochrome utility, type + one device carry essentially all personality. Deferring means finalizing a "definitive identity" around a placeholder — and W3-style platform variance ships with it. **Disagreement with the prior conclusion, stated plainly: font selection belongs in this phase, not at implementation.**
2. **The serif-italic signature was rejected for the wrong reason — the mismatch was fixable, not fatal.** "Old-style serif against a neo-grotesque reads mismatched" is true of *Iowan/Georgia against SF Pro*. It is not true of a **designed sibling pair** (e.g. Instrument Sans + Instrument Serif italic, drawn together), nor of a grotesque's own **true italic**. Both routes keep the two-voice idea — which was the most ownable of all the candidates — while dissolving the objection.
3. **The dot is already the system's device; nobody has claimed it.** Status dots, the recruiting pulse, badge dots — "the dot carries the state" is latent everywhere. Anchor it: a dot-based wordmark device (own it as *ours*, replacing the borrowed colon), dot-pulse as the motion signature on state change, semantic dot colours already in place. Cheap, systemic, and no competitor owns it.
4. **Mono-as-data is half-present; making it a rule differentiates Discover.** Dates in review are already mono; prop numbers and eyebrows are mono. Extend it: counts, deadlines, and a **mono date chip on event rows** — which also fixes W5 *without* spending a second hue, answering the secondary-colour question with typography instead of colour.
5. **An explicit accent-semantics rule** turns an apparent inconsistency into a strength. Crimson currently marks brand *and* "New" *and* "Closing soon" — foundation says semantic colour is status-only. The coherent rule: **accent = demands action now** (new, closing soon, review them). Documented, it's a system; undocumented, it's drift.
6. **Warmth is specified and undelivered** — see §6.1.

## 6. Inconsistencies between goals and the current design

1. **Foundation: "near-monochrome plus one accent, on *warm* neutrals."** Direction 11's neutrals are cool — `#F7F9F9`, `#EFF3F3`, lines `#E4E8E9` all carry the blue-green cast of ink `#071417`. Only the pink washes are warm. Direction 09 delivered the warm-paper spec; 11 quietly abandoned it. Either the foundation changes or the neutrals do — currently the two documents disagree and nobody has said so.
2. **Foundation: "display face + workhorse text face."** One system family in every mockup (§5.1).
3. **Structure §1: different time semantics must look different.** Not delivered (W5).
4. **Gates: 44×44 targets.** Documented rule unapplied at 375px (W3).
5. **Gates: AA by measurement.** Holds impressively for text-on-theme-surface; missed for the cross-theme panel (W1) and non-text boundaries (W2). The gap is systematic: the checklist covers theme×text, not *context*×text and not 1.4.11.
6. **"Confident utility … not generic B2B SaaS."** The app register clears this; the landing frame and Discover-with-no-accent don't yet (§3).

## 7. Verdict

The skeleton is right and the discipline is real; both must survive. What's missing is not more polish of the borrowed parts — it's the three decisions that would make the system *ZotHub's*: a typeface (with the signature riding on it), a wordmark device, and one or two named system behaviours (the dot, mono-as-data) that no template ships with. Those are exactly the explorations built next, in `current/direction-11-identity-lab.html`.
