# ZotHub Redesign — Handoff

**Written:** 2026-07-23 · **Updated:** 2026-07-24 (round 2: maintainer decisions in, lab 2 + v3 pages built) · **Purpose:** give a fresh session (any tool, any context window) everything it needs to continue without re-deriving.

> **Start here.** Read this file, then `docs/strategy/01-positioning.md`, `02-research.md`, `03-structure-decisions.md`, `04-design-foundation.md`. Those four are the locked decisions. Everything in this folder is the visual work built on top of them.

---

## 1. What ZotHub is

A two-sided campus marketplace at UC Irvine. **Students** discover club roles and events, apply, RSVP, and track. **Club officers** post openings, review applicants, and decide.

**Live in production** — `zothub.app`, Vercel + self-owned Supabase. React 18 + TypeScript + Vite + Tailwind + shadcn/ui (Radix) + react-router v6 + TanStack Query. Backend is Postgres with RLS on every table, Edge Functions, `pg_cron`.

**The backbone is solid and must be preserved.** Eight correctness workstreams (WS1–WS8 + an auth-orphan cleanup) are closed and production-verified: RLS, capacity enforcement under concurrency, realtime, email idempotency, cron, referential integrity. The standing rule for all redesign work is **re-skin, don't rebuild the wiring.**

### The finding that reframed the whole project

The live marketplace is effectively **empty** — one club ("Test Club"), four junk opportunities, one event — while the landing page claimed *200+ clubs, 10K+ students*. Those fabricated stats have been removed.

More importantly: **UCI already runs a club directory.** It's **ZotSpot** (`zotspot.uci.edu`, a white-labeled CampusGroups instance) with **974 organizations**, mandatory registration, a $50 fee, and institutional placement. `prd.md`'s competitive analysis never mentioned it.

**But ZotSpot has no application or review workflow** (confirmed by the maintainer from an officer account). That gap is the wedge.

---

## 2. Where we are in the workflow

An approved 10-stage workflow, later collapsed into three phases by agreement.

| Stage | Status |
|---|---|
| 0 · Credibility triage | **Partly done** — fabricated stats + Lovable OG image removed. Test Club data purge still outstanding (production, maintainer's job) |
| 1 · Positioning | ✅ `docs/strategy/01-positioning.md` |
| 2 · Research | 🟡 desk research + heuristic evaluation done; **student interviews and club artifacts still outstanding** |
| 3 · Structure (IA) | ✅ `docs/strategy/03-structure-decisions.md` |
| 4–6 · Brand, direction, design language | ✅ **Identity locked (v4) + design system derived (2026-07-25).** 11 directions → D11 → critiqued → identity labs → UCI blue/place turn (v4) → `design-system.html` + `design-system.md` |
| 7 · Core journey design | ✅ **complete** — component library (`component-library.html`, 10 sections) + four assembled screen files (club-firstrun, student-apply, clubs, more-screens), both themes, AA-verified by measurement |
| 8 · Validation | Not started |
| 9 · Implementation in slices | ✅ **all slices (0–11) done and verified** on branch `redesign/implementation` — see `implementation-audit.md`. Every surface re-skinned + verified in the running app, both themes, 0 contrast / 0 unlabelled. Route-level code splitting landed (recharts out of the initial bundle). Remaining work is pre-launch ops, not redesign — see §6 |
| 10 · Onboarding readiness | Not started |

**Agreed remaining sequence:** ~~refine Direction 11 → design system + brand kit~~ ✅ done → **component library → remaining pages** → implementation.

---

## 3. Locked decisions

### Positioning
**ZotHub is where UCI club life happens: find a club, apply, show up, stay connected — and for clubs, run real recruiting instead of a Google Form and a spreadsheet.** Recruiting is the wedge and the defensible ground. Discovery is the front door and must be excellent — the bet is usability, not exclusivity. Events and connection are core, not deferred.

- **Club-first sequencing.** Supply is the constraint. But the student side is a first-class deliverable: *discover → compare → apply → RSVP → chat*, as frictionless as possible.
- **Name stays ZotHub.** Portability deferred to a future full rebrand. Sounding native to UCI is an adoption advantage now.
- **Cold start = ZotSpot seeding.** Scrape ZotSpot's public directory into **unclaimed, claimable club profiles**. Built after the core redesign. Unclaimed pages must be unmistakably marked, imported public data only, sourced visibly, one-click claim, one-click removal request.

### Structure (IA)
1. **One discovery surface** containing action-oriented item types, each keeping its own data model and lifecycle. Not a merged object. Clubs are destination pages.
2. **Student nav:** `Discover · Clubs · Activity · Messages` — identical mobile and desktop. "Following" is a filter, not a destination. The word *Feed* is retired. URL-backed filter state; `/opportunities` and `/events` preserved as pre-filtered entry points.
3. **Taxonomy:** store source tags losslessly, expose ~8–10 curated filter categories mapped from them. Support all six opportunity types properly; delete the coercion in `normalizeOpportunityType()`.
4. **Status:** one presentation vocabulary and one colour semantic across all workflows. **Database values unchanged.** `reviewed` becomes reachable.
5. **Club nav:** `Postings · Responses · Messages · My Club`. Applicants and RSVPs share **one** review implementation. Lands on Responses — the work queue, not a stats page.
6. **Profile:** soft gate, never a wall. Setup and editing split.
7. **Cold start:** no copy describing the product's *stage*; only data describing its *state*. Live counts. Empty results describe the query, not the product.

### Design foundation
- **Primary principle (the tiebreaker): never a dead end.** Every state offers the next action.
- Operating set: **low floor, high ceiling** (a club can link an existing Google Form in 30s; full pipeline available) · **less work than what it replaces** · **consistent beats clever**.
- **Consequential moments:** rejection reads *direct, then a door* — acknowledge first, offer second, never in the same breath. Closing a posting **auto-declines** undecided applicants, but only after an explicit prompt naming how many. An auto-declined student reads the **same message** as a deliberately-declined one.
- **Density follows the task, not the user.** View switching (cards ↔ list ↔ table) is first-class on any collection.
- **Personality: confident utility.** Not UCI-official, not generic B2B SaaS, not institutional.
- **Light default**, both themes genuinely designed.
- **Motion:** functional, plus a few earned signature moments. 150–250ms.
- **Gates:** WCAG 2.1 AA verified by measurement; route-level code splitting mandatory (currently zero — recharts 411KB is preloaded on the landing page); 44×44 touch targets; visible focus everywhere.

### Standing rules for this work
- **Every mockup ships with a working in-page light/dark toggle.** Both palettes genuinely designed, never a naive inversion.
- Colours used as *text* often need a separate AA-safe token from the same colour used as a *fill*. Use `*-text` aliases.
- **Every surface owns a full alias set.** A dark card inside the light theme is a third context — it carries theme-independent `--panel-*` aliases; nothing inherits accent across a register boundary. (Learned from W1: the AA sweep covered theme×text but not context×text.)
- **Control boundaries carry `--line-3` (≥3:1)**; hairlines stay decorative. WCAG 1.4.11 is part of the AA gate, not just 1.4.3.
- **Escape non-ASCII to HTML entities** outside `<style>`/`<script>` — artifacts declare no charset and render mojibake otherwise.
- **Verify by driving the page in a browser** and reading computed styles. Don't trust the diff. (This caught four failing `--line-3` values in the lab's first draft.)
- **Webfont exception:** files whose *subject is the typeface* (currently only the identity lab) may load webfonts, with stacks degrading gracefully to system fonts offline. Everything else stays dependency-free.

---

## 4. The design exploration

Eleven directions, each a different thesis about the user. All in `explored/`, all with working theme toggles.

| # | Name | Thesis |
|---|---|---|
| 1 | The Instrument | You know what you want — get out of the way |
| 2 | The Noticeboard | You don't know what's out there — come look |
| 3 | The Concierge | You don't know what you want — let me help |
| 4 | The Study | Anthropic philosophy: understatement as confidence |
| 5 | The Shelf | Apple philosophy: one idea per screen, hierarchy does the talking |
| 6 | The Wall | Instagram philosophy: identity and belonging first |
| 7 | The Print Shop | Campus silkscreen — unmistakably student-made |
| 8 | The Departures Board | Transit wayfinding — deadlines are departures |
| 9 | The Agenda | A club is a calendar you follow |
| 10 | The Club Page | Luma-grounded — the club's colour tints its page |
| **11** | **The Two-Sided Market** | **CHOSEN** — Wellfound-grounded; both sides on one page, product shown not described |

`prototypes/direction-01-instrument-clickable.html` is a fully working prototype (role switcher, live filters, detail view, review with accept/decline/undo/bulk, messaging with threads and a composer). It exists to prove the *interaction model*; the same skeleton was to be applied to directions 3, 5, 10, 11.

---

## 5. Direction 11 — current state

**Files (newest first):** `current/component-library.html` (**component library — COMPLETE**, 10 sections: buttons/tags/badges/chips/forms/review-row/severity-confirmation/empty+loading/toast **+ nav/avatars/messages/profile**, all stateful & interactive, both themes, AA-measured) · `current/design-system.html` (the brand kit / token reference) · `../design-system.md` (written token spec + implementation bridge) · `current/direction-11-icon-lab.html` (icon exploration — **decided: A, stacked wordmark**) · `current/direction-11-v4-uci.html` (**source of truth** — UCI Pacific blue + slate/graphite + campus hero; Discover defaults to card view w/ list toggle; live review queue) · `current/direction-11-v3-pages.html` (crimson structural reference) · `current/direction-11-identity-lab-2.html` (wordmark round 2, dark-ramp candidates, motion v2) · `current/direction-11-identity-lab.html` (round 1 — partially superseded, keeps the dense-type test and component fixes) · `current/direction-11-v2-pages.html` (superseded by v3) · `current/direction-11-refinement-studio.html` · `current/direction-11.html` (original) · `../01-direction-11-critique.md` (formal critique, all claims measured).

### What it is
Wellfound's *structure*, not its skin. Verified from their DOM: system font stack (no webfont), ink `#051316`, translucent greys rather than solid borders, 8px radii, **two registers** — marketing loud at 58px/weight 500/−2.3px tracking, app quiet at 28px/weight 600.

Ours: ink `#071417`, **crimson `#D81E5B`** with `#B01048` as the AA-safe text variant. FOR CLUBS (dark card) / FOR STUDENTS (light card) split. Numbered value props on hairlines. Row pattern: bold title, grey meta with middots, right-aligned status + Save/Apply pair.

### Refinements applied
- **`ink-3` was 3.57:1 — failed AA while carrying content** (the meta line on every Discover row). Now `#616E72` at 5.27:1.
- **The hairline was 1.23:1** and was the only thing grouping roles under a club. Darkening doesn't work (even `#C3CBCE` reaches 1.65). **Grouping now rides on a surface**, with the line as reinforcement.
- 4pt spacing rhythm, named. Three elevation steps tinted with the ink hue, not pure black. Radii scale: inputs 10px, cards 14px, pills 999px — inputs must not share the card radius or they read as nested cards.
- **Tracking scales with size:** −0.042em above 44px, −0.038em at 28–44px, −0.02em below 28px. −0.042em at 29px is unreadable.
- Form section headings need **weight 600**; weight 500 goes limp against input borders.
- At 375px, button pairs **stack or overflow** — they cannot shrink without breaking the 44px target.

### Accent decision
**Crimson locked.** Four alternatives were explored and measured (Ember, Brass, Violet, Jade — all clear AA in both themes; see the refinement studio). Note if ever revisited: **Jade conflicts with the success state**, since accent and "Accepted" would share a hue family.

### Critique findings (2026-07-24) — full detail in `../01-direction-11-critique.md`
All prior measurements re-verified and reproduce exactly. New, previously unrecorded:
- **W1** — the dark card in the *light* theme has no accent token: FOR CLUBS eyebrow is 3.80:1 (fails AA). Systemic fix in the lab: theme-independent `--panel-accent/--panel-accent-text` aliases; rule — every surface owns a full alias set.
- **W2** — input borders 1.49:1 vs WCAG 1.4.11's 3:1. Fix: a third line weight `--line-3` for control boundaries only, ≥3:1 on every input-bearing surface in all four ramps (values in the lab tokens).
- **W3** — the studio's own 375px rule (primary keeps 44px, secondary demotes) was documented but never applied; v2 still renders 34px Save/Apply pairs on mobile.
- **W4** — the two-sided split's light/dark opposition dissolves in dark mode (the direction's namesake metaphor only exists in one theme). Unsolved; carry into the pages pass.
- **W5** — event rows are visually identical to role rows, against Structure §1. Solved in the lab with the mono **date chip** (typography, not a second hue).
- Foundation says **warm neutrals**; D11 shipped cool ink-derived greys. Resolved as an explicit A/B in the lab (Cool vs Paper).
- Foundation says **display + workhorse faces**; D11 shipped one system stack. Resolved as three real stacks in the lab — **typeface selection moved into this phase** (it cannot be an implementation detail if the identity is to be definitive).

### ⚠️ Direction change — 2026-07-25 (maintainer): UCI blue + campus image
The neon-crimson accent was rejected as reading "AI vibe-code / generic startup," and the brand was pushed to feel **more UCI, more worked-on**. Two changes, both applied in **`direction-11-v4-uci.html`** (the new most-current file):
- **Accent → Pacific blue.** Fill `#0F5FA8` · text `#0B4E8C` · washes `#E9F1FB`; dark `#5AA2E6` / `#8FBEF2` / wash `#0E2338` (dark ink `#06182B` on blue fills). UCI-*adjacent*, deliberately not the registrar seal-blue; **no gold, no seal** (that would be impersonation — see the strategy amendment in `04-design-foundation.md`). Tokenised, so a future UCI objection is a one-variable swap. All pairs re-measured AA in both themes.
- **Neutrals → cool Slate (light) + Graphite (dark).** The Rose ramp existed only to sit inside the *pink's* warmth; with a cool accent that logic inverts, so light is now cool slate (`#F5F7FA` / ink `#0D1519` / ink-3 `#5F6B74`). Graphite dark carries over unchanged. Rose/Paper/Cool are retired.
- **Landing leads with a campus image.** Full-bleed hero photo band with a baked-in scrim (`rgba(8,16,26,…)` L-to-R + bottom) so white headline + light-blue italic + subhead all clear AA over it (measured 10–18:1). The two-sided cards now **bridge the photo's lower edge** (dark club card + light student card, `--e4` shadow). In the mock the file ships a **stylised golden-hour SVG scene as a placeholder** — final art is a licensed/own UCI photo *or* a commissioned illustration (open choice, see below).
- **Held the line on honest data.** The mock's "300+ students applied this week" was **not** used — that is the same fabricated-stat class as the original fake "200+ clubs / 10K+ students." Hero shows **live counts only** (opportunities · events · clubs), honest at any scale.

Everything else from the locked system is **unchanged and carried into v4**: italic-hub wordmark (hub now blue), italic signature (blue; light-blue over the photo), Instrument Sans, pills, mono date chip, `ctx-dark`/`ctx-light` context cards, motion v2 (live on v4 Review), 44px mobile targets + tab bar. The v3 file stays as the crimson reference.

**Open from this change:**
1. **Hero art: PHOTO chosen & in place** (maintainer, 2026-07-25) — the UCI Student Center / Anthill Pub courtyard. v4 loads it from **`current/assets/hero-campus.jpg`** (1440×500, `<img>` + warm-gradient fallback). **AA verified over the real composited pixels** (image + scrim) in both themes via a canvas sampler — worst cases: white headline 6.25 light / 8.53 dark, light-blue italic 5.70 / 7.24, subhead 8.84 / 11.24, counts 5.81 / 7.02 (all ≥4.5). The counts line first failed at 3.28, fixed by strengthening the bottom scrim + lifting the counts colour to `#E6ECF2`. Crop is `object-position:50% 44%` (courtyard axis) — nudge in CSS if a different framing is wanted. **Still required before public launch:** (a) **licensing** — looks like a UCI marketing photo; needs a real license / own-commissioned shot / illustration, not a scraped asset; (b) **optimization** — WebP/AVIF ~1600px, lazy-decode (landing perf gate ≤~200KB JS). See `current/assets/README.md`.
2. **Dark-mode club card** sits dark-on-dark; distinguishable via border+peek but lower contrast than the light student card. Fine, minor; revisit when building components.
3. Confirm blue shade + slate on your own screen (the mock's blue vs `#0F5FA8` — nudge if wanted).

### The identity — earlier locks (2026-07-23 → 24), still in force except accent/neutrals above
- **Accent:** ~~crimson~~ → **superseded 2026-07-25 by Pacific blue (above).** Rule unchanged: no secondary colour; events carry the mono **date chip**; **accent = demands action now** (New, Closing soon, Review them).
- **Typeface: Instrument Sans**, all registers. Reasoning: the italic is load-bearing (signature + wordmark), and Instrument's true italic is the strongest of the tested stacks; one family keeps both registers in one voice; platform-independent. Self-host at implementation (~55KB).
- **Signature: italic.** Upright ink tipping into italic accent, headline + empty states.
- **Wordmark: italic hub** — `zot` upright ink, `hub` italic accent, one line. **Stacked mark** for avatar/app-icon/favicon: disc, white `zot` over italic `hub` (now **blue** per the v4 change — `#5AA2E6` on `#101112`). 16px favicon uses the **tight cut**.
- **Neutrals — SUPERSEDED by v4:** was rose light; **now cool Slate light + Graphite dark** (accent went blue, so neutrals went cool to match — see the v4 direction-change section above). Rule holds: *dark stays neutral so the accent does the talking.*
- **Buttons: pills.** Radii 10/14/999. 4pt rhythm. Three ink-tinted elevations.
- **Motion v2:** 150/200/250ms, one ease. Signature compound on state change only (badge pops 1.06×, dot 1.55×, 14px ring, 750ms, once — never loops): application submitted, decision made, posting published. Live on the v3 Review queue.
- **Fixed-register contexts:** the club card is always dark, the student card always light (`ctx-dark`/`ctx-light` full alias sets) — the two-sided opposition exists in both themes.

### Icon/app-mark — DECIDED: **A, the stacked wordmark** (maintainer, 2026-07-25)
The `zot`/`hub` stacked disc (white `zot` over italic-accent `hub`) is the app mark / favicon / app icon; the inline italic-hub wordmark is unchanged. The four explorations (Ring, Zot, Snout, Hub×Ring) are kept in `direction-11-icon-lab.html` for the record but not chosen. Production still needs the glyphs outlined from licensed Instrument Sans for the shipped favicon/app-icon set (disc `#101112`, letters `#F5F5F6`, italic `#5AA2E6`); use the **16px tight cut**.

### 2026-07-25 maintainer notes — folded in
- **Button hover bug fixed** (filled buttons went text-invisible on hover). Root cause: `.btn:hover` (0,2,0) outranked `.btn-acc`/`.btn-ink` (0,1,0) and swapped their fill for grey. Fix: `.btn:where(:hover)` drops base-hover to 0,1,0 so variants always keep their fill. **Standing rule:** base/state hovers use `:where()` so variants win by source order — never re-declare a variant's background just to defend it.
- **Discover now defaults to CARD view** (scannable, casual browsing) with a **Cards/List toggle**; List is the denser club-grouped power view. Both in v4 + documented in `design-system.html`. This is the foundation's "density follows the task / view-switching is first-class" decision, built. View choice persists per surface (to wire at implementation).
- **Cards use one unified anatomy** so roles and events read as siblings: a leading **tile** (club logo for roles, calendar for events — the calendar is the one intentional differentiator, kept because the maintainer likes it), then title / club / meta, then a matching two-button footer (Save + Apply / Save + RSVP). Set 2026-07-25.
- **Dedicated-slot rule for tags/badges/chips** (maintainer, 2026-07-25): they get their **own slot and never share a line with flexible content** (a title, a name). Fixed the card where "Closing soon" was squeezing the title (made "Fall Case Team Analyst" wrap while others didn't). Now the tag sits in its own `.opp-tags` row below the meta, so tagged and untagged cards stay identical. This is a **standing component-library rule**.
- **Component library v1 built** — `current/component-library.html`, the highest-value stateful/interactive set: buttons (all states incl. loading), tags/badges/chips (+ a coherence demo proving the dedicated-slot rule), form fields (all states + checkbox/radio), the **review row** (live accept/decline/undo + motion), the **severity-keyed confirmation model** (low-stakes vs the high-stakes "close posting → auto-decline 12, review first" dialog — the "nobody gets ghosted" differentiator) + the "direct, then a door" rejection message, empty/loading/skeleton, and toast. Both themes, verified.
- **Review-row alignment fix** (maintainer, 2026-07-25): rows were flex with a variable-width action column, so the name column absorbed the difference and the middle columns (standing/date/badge) shifted between rows. Now a **CSS grid with fixed tracks** — every column aligns regardless of the action, and "Undo" right-aligns with "Accept". Fixed in `component-library.html` and `v4`.
- **Card layout reorganized** (maintainer, 2026-07-25): the text was indented (right of the tile) while the footer spanned full-width — mismatched left edges, dead space under the tile. Now the **avatar-card layout**: the tile is its own left column; **title / club / meta / tag / footer all live in one aligned right column**, so every left edge matches and footers line up across a row. Applied to v4 cards, `design-system.html`, and the library's coherence demo. This is the **standard card anatomy** going forward.
- Maintainer has **further component-level UI changes** coming — they land as the component library gets built.

### Applied in v3 pages (beyond v2)
Italic signature everywhere it belongs (hero, student card, empty state) · period wordmark v2 provisionally · ctx-dark/ctx-light **fixed-register context classes** — the club card is always dark, the student card always light, which restores the two-sided opposition in dark mode (**W4 solved**) and retires the panel one-offs · date chip on event rows · "Applied" idle wash · mono data voice on counts/dates · `--line-3` input boundaries (W2) · real mobile behaviour: 44px targets, Save demotes to ghost, bottom tab bar, meta wraps (W3) · review flex row fix (W6) · live Accept/Decline/Undo with motion v2.

---

## 6. Outstanding beyond design

- **Security fix awaiting deploy:** `supabase/migrations/20260723000100_drop_self_insert_user_roles_policy.sql` closes a **live privilege-escalation hole** — the `user_roles` self-insert RLS policy was orphaned by `20260709000200` but never dropped, letting any authenticated user grant themselves `admin`. Written, guarded, **not yet pushed**. Run the abuse-check query in the plan first; it destroys the evidence.
- **Day 0 auth changes uncommitted:** `verify-otp` (students auto-approved, clubs still queued) + `Signup.tsx` (auto sign-in after OTP). Needs `supabase functions deploy verify-otp`.
- **Test Club data** still live in production.
- **Research gaps:** student interviews (guide is written and ready in `02-research.md` §3) and club recruiting artifacts. The club walkthrough blocks review-pipeline depth.
- **Assumption A5 untested:** do students already use ZotSpot for discovery? Changes the student-side headline from "finally, one place" to "the same clubs, without the friction."

---

## 7. How to resume

```
Read docs/design/00-handoff.md, docs/design/design-system.md, and
docs/design/01-direction-11-critique.md, then continue the ZotHub redesign.
Serve docs/design over localhost (file:// is blocked in browser tooling:
`cd docs/design && python3 -m http.server 8471 --bind 127.0.0.1`) and open
current/direction-11-v4-uci.html (source of truth), current/design-system.html,
and current/component-library.html. Verify by driving the page in the browser
in BOTH themes; keep the docs current as decisions land.
```

**Where we are:** visual identity **locked** (v4 — Pacific blue, cool-slate light / graphite dark, italic-hub wordmark + stacked disc mark, Instrument, campus hero). **Design system derived** (`design-system.html` + `design-system.md`). **Component library is COMPLETE** — `component-library.html`, ten stateful/interactive sections: v1 (buttons · tags/badges/chips · forms · review row · severity-keyed confirmation · empty/loading/toast) **plus the set built 2026-07-25: nav · avatars · messages · profile.** Both themes; every colour pair AA-verified by driving the page in the browser (not asserted).

**Screen assembly — in progress.** **Club first-run is built** — `current/direction-11-v4-club-firstrun.html`, a walkable 5-step flow (sign up → club setup → post a role → you're live/share → review responses) composed from the locked components, both themes, AA-verified. Key moves: minimal onboarding chrome (wordmark + stepper) for steps 1–3 then the full app nav "arrives" at step 4; **post-a-role features "link a Google Form" as the low-floor default** (the wedge — less work than the spreadsheet); the live/empty posting hands over a share link (honest empty state); the flow ends on the review queue + nobody-gets-ghosted banner. **Student apply flow is built too** — `direction-11-v4-student-apply.html`, a 4-step flow (Discover cards → opportunity detail → apply → tracked in Activity) on the *same* VP-of-Design posting, so the two sides of the marketplace meet around one role. Key moves: card-first Discover (square club logo / mono date chip); a detail page with an about-the-club mini-card; an apply screen with the **skippable soft-gate** ("add your year — won't block you") + privacy transparency ("they see name, year, major — nothing else"); and Activity showing **one status vocabulary** (Applied · Reviewed · Accepted · Not selected) where the decline reads *direct, then a door* — the humane "always hear back" made concrete. Both flows: both themes, AA-measured, no console errors.

**Clubs surface is built** — `direction-11-v4-clubs.html`, 3 screens: the **directory** (honest asymmetry — "312 clubs · 9 recruiting"; claimed cards vs. dashed/muted **unclaimed** cards with one-tap Claim), a **claimed club page** (recruiting status, open roles → apply, members preview as circles, message-a-member per Positioning §8), and the **unclaimed / ZotSpot-seeded page** (claim banner + request-removal, imported-public-data-only, source shown, no fabricated activity — the outreach opener that de-risks A4). Both themes, AA-measured.

**Built so far in screen assembly (all in `current/`, all both-theme + AA-verified):** `direction-11-v4-club-firstrun.html`, `direction-11-v4-student-apply.html`, `direction-11-v4-clubs.html`. Between them the core marketplace loop and the cold-start surface are designed.

**Remaining screens are built** — `direction-11-v4-more-screens.html`, 4 screens: **Messages** (two-pane convo-list + thread on desktop, collapsing to list→thread on mobile; active convo carries the accent left-bar; thread header links to the club page / member profile), **Profile** view (reached from the avatar menu, not a nav item; person circle + club squares in "Member of"; no private counts shown), **Edit profile** (plain settings form, not the wizard), and the club **Postings** list (roles + events with the new-applicant count in accent; Draft/Closed use a muted `bg-3`+`ink-3` tile + labelled badges — fixed a white-on-grey tile that was 3.67:1). Both themes, AA-measured.

**Screen assembly is complete — Stage 7 done.** Four screen files under `current/`: club-firstrun, student-apply, clubs, more-screens. Every core route + the cold-start surface has a designed, both-theme, AA-verified home, all composed from the locked component library.

### Implementation status (Stage 9) — branch `redesign/implementation`

The contract is **`implementation-audit.md`**: every route, feature, field and state the live app has
today, mapped to buckets A (mocked → re-skin), B (exists, no mock → design in-system) and C (mocked,
no backend). Read it before touching anything.

Maintainer decisions settled 2026-07-25: member DMs are in scope / ZotSpot deferred and marked
not-yet-live · nav collapses to four per role with Feed→a Discover filter and Analytics+Team→My Club ·
`/club/dashboard` lands on Responses with the overview moving into My Club · pre-existing bugs get
fixed in the slice that owns the screen · theme toggle lives in the account menu with an icon button
in the public nav · the wordmark ships font-rendered now, outlined SVG later.

**Done and verified in the running app** (both themes, AA measured on real pixels — 0 text-contrast
and 0 control-boundary failures throughout):
- **Slice 1 — tokens.** `src/index.css` and `tailwind.config.ts` rewritten. Colour is stored as HSL
  triplets so Tailwind alpha modifiers keep working; every triplet round-trips to the mock's exact
  hex. Instrument Sans self-hosted (4 woff2, ~62KB fetched). `forcedTheme="dark"` removed.
- **Slice 2 — primitives.** 22 shadcn/Radix components re-tokened, plus `lib/status.ts` (the one
  shared, audience-aware status map) and shape-as-kind avatars.
- **Slice 3 — furniture.** Italic-hub wordmark, four-destination nav per role with one accent
  "you are here" language, account menu, working theme toggle. *Club nav still pending a club login.*
- **Slice 4 — discovery.** Landing (with the hero photo and its scrim, whose stops are an AA
  control), Discover cards↔list, opportunity detail, event detail.
- **Slice 5 — apply + RSVP.** Verified end-to-end against a real submission: all four dynamic
  question types, required-field validation, resume-from-profile, success modal, posting flips to
  "Applied".
- **Slice 6 — clubs.** Directory and club page. The category filter was hard-coded to nine labels
  that do not exist in the taxonomy; it is derived from the data now.
- **Slice 7 — student side.** The dashboard is now **Activity** (Applications · Going · Saved ·
  Following), where a rejection finally reads **"Not selected"** to the student and an RSVP shows
  whether it is confirmed or still awaiting approval. The feed became a **Following filter** on
  Discover and Events, with `/student/feed` redirecting there; unfollow moved into Activity. The
  profile split into a **view** (`/student/profile`) and an **edit** (`/student/profile/edit`).
- **Slice 8 — club side.** `/club/dashboard` now lands on the **Responses** work queue, not a stats
  page. The old flat seven-tab bar is gone, replaced by per-destination sub-tabs (`ClubSectionNav`):
  Postings [Opportunities · Events], Responses [Applications · RSVPs], My Club [Overview · Team ·
  Analytics]; the old overview stats + recent-item lists moved into **My Club → Overview** (the
  profile editor sits one click deeper). Both review queues now speak the club vocabulary through
  `StatusBadge audience="club"` — a pending application reads **"New"**, a rejection **"Declined"** —
  and the management tables use `StatusBadge domain="posting"/"event"` (Live/Closed/Draft, Upcoming/
  Today/Past). Fixed the **reviewed-status-unsettable** bug: a "Mark as reviewed" action, and reviewed
  rows stay decidable. `ClubAnalytics` charts now read the **live token values keyed on theme**
  instead of hard-coded HSL, so they finally adapt to dark mode; pie labels use the club vocabulary.
  Every club surface verified in the running app in both themes: **0 text-contrast, 0 unlabelled**
  (the shadcn `Switch` + adjacent `<label for>` pattern needed explicit `aria-label`s — a
  `role=switch` button is not named by a `for` label; the per-row `⋯` menus needed them too).
  Two follow-up polish fixes after review: the **Applications queue is now a header+aligned table**
  (matching the RSVP queue — rows no longer shift between decided/undecided), and the My Club
  identity card **skeletons while the profile loads** instead of flashing the email local-part as the
  club name (`useAccountIdentity` now exposes `isLoading` and never uses the email as a club's name).
- **Slice 9 — Messages.** Re-skinned the whole thread UI (`MessagesContainer`, `ConversationList`,
  `MessageThread`, `MessageComposer` + both page headers): `EntityAvatar` shape-by-kind,
  **accent-sent / grey-received** bubbles (the one deliberate accent outside "demands action"),
  active-row accent left-bar, mono timestamps. The thread header links a **club** participant to
  their public page. Closed the **student↔member dead link**: `useMessages` gained `startConversation`
  behind a `?to=<user_id>` handler in `MessagesContainer` — the "Message a member" button on the club
  page now opens (or drafts) that thread instead of 404-ing; the param is stripped after open.
  A **MEMBER** chip (one batch `club_team_members` read) marks a team member so a student never mistakes
  them for the official club. Verified club-side both themes (0/0) incl. the `?to=` open; student view
  shares the same container, and the MEMBER chip is code-verified (Test Club has no members yet).
- **Slice 10 — edges.** Two real bugs closed: the **`/reset-password` route now exists** (new
  `ResetPassword` page — ForgotPassword had been redirecting to a 404), and `NotificationCard`'s
  **`/club/applications` dead link** → `/club/dashboard/applications`. A11y sweep: the flagged
  **password-eye** buttons (Login, Signup, ResetPassword) are labelled + verified toggling; the
  notification action buttons, the 6 preference switches in `NotificationPreferencesDialog`, the 6 in
  `Unsubscribe`, and the admin approve/reject/delete buttons all gained `aria-label`s (a `role=switch`
  / icon button is never named by a sibling `<label for>`). Off-palette raw colours → tokens
  (notification type-icons emerald/amber/purple → ok/warn/ink; admin waitlist statuses →
  `StatusBadge domain="waitlist"`; various washes). **NotFound** redesigned (wordmark · mono 404 ·
  accent CTA). One dark-mode contrast fix: the unread-notification row moved from a full `accent-wash`
  (which dropped the meta timestamp to 4.49:1) to an **accent left-bar on a near-base surface** — the
  same "passes on base, fails on a wash" pattern as messages. Verified both themes, 0/0: Notifications
  (+ prefs dialog), NotFound, ResetPassword, Privacy, Unsubscribe, Login, Signup. Waitlist ×2 (need a
  pending/rejected user) and Admin (need an admin login) are code-verified only.

- **Slice 11 — route splitting.** Every route is now `lazy()` + `Suspense` (Landing stays eager as
  the LCP page), and `ClubAnalytics` is lazily imported *inside* `ClubHome` so recharts loads only when
  the Analytics tab opens. The real fix was in `vite.config.ts`: the explicit
  `manualChunks: { charts: ["recharts"] }` was forcing recharts into an **eagerly-preloaded** vendor
  chunk even though its only importer is lazy — that's why "recharts was still in the landing bundle."
  Removing that entry lets recharts fold into the on-demand ClubAnalytics chunk. Verified against a
  production build: recharts (~411KB) is no longer in `index.html`'s modulepreloads nor a static import
  of the entry, and the Analytics tab lazy-loads + renders its charts correctly at runtime. **This
  completes the redesign implementation (slices 0–11).**

**Pre-commit parity audit (before anything was committed).** Ran `tsc --noEmit` (0 errors), ESLint
(0 errors), a production build (clean), and a four-way diff of the working tree against `HEAD` (= the
previous design) across every subsystem. Route set is additive-only (no route removed). Verdict:
**full feature parity** with one exception — the club **Feed** (`/club/feed`, "browse other clubs'
postings") had silently lost its nav entry in the 4-destination collapse (it was a top/bottom-nav
destination at HEAD, never mentioned in the relocation decisions). Resolved by mirroring the student
feed: `/club/feed` now redirects to `/opportunities`, and `ClubFeed.tsx` + its exclusive deps
`FeedCard`/`EmptyFeedState` were deleted. If clubs are meant to have a first-class discovery
destination, that's a nav decision to revisit — but nothing is now orphaned or broken.

**Three traps worth remembering.** shadcn's `--accent` is its neutral menu-hover surface, not a brand
colour — pointing it at Pacific blue lights every dropdown row blue (26 usages across 9 files were
re-pointed at `surface-3`). React 18.3 **silently drops** camelCase DOM props it does not know
(`fetchPriority` cost the hero its LCP hint) — check the attribute is actually in the DOM. And a
**forced** `data-theme` flip leaves stale transitioned colours behind: elements keep their old
`color` because changing a `var()` does not always restart a running transition, so an audit run
straight after reports phantom failures. Waiting is not enough — suppress transitions during the
flip, which is exactly what next-themes' `disableTransitionOnChange` does for the real toggle.

**Redesign implementation is complete (slices 0–11).** What's left is **pre-launch ops, not
re-skin work** (§6): WebP/AVIF for the hero photo, the outlined SVG favicon/stacked-mark, the Test
Club data purge, and the **unpushed `user_roles` security migration** (run the abuse-check query
before deploying — it destroys the evidence). A few screens are **code-verified only** because the
current data/logins can't exercise them — pick these up when possible: a **populated club Team row**
and the **Messages MEMBER chip** against a real club member (Test Club has none), the **student-side**
Messages/Activity against a student login, and the **Waitlist ×2 / Admin** screens (need a
pending/rejected user and an admin login).
Still-open pre-launch items in §6 stand: WebP/AVIF for the hero, production SVG for the stacked
mark, Test Club purge, and the **unpushed security migration** (`user_roles` self-insert
privilege-escalation — run the abuse-check query *before* deploying it, since the migration destroys
the evidence).

**Capture note (tooling):** the in-app Browser pane renders wide desktop layouts (3-col grids, the Messages two-pane) only when the viewport is actually wide — set `resize_window` to ~1440 and confirm `window.innerWidth` before screenshotting, or responsive breakpoints collapse to the narrow layout. Screens use a step-switcher so each renders at scroll 0 (avoids the deep-scroll blank bug).

**Component decisions that landed 2026-07-25** (folded into `component-library.html` + `design-system.md`):
- **Nav** — one active language across platforms: an **accent bar = "you are here"** (desktop underbar / tab-bar top-bar), resolving v4's desktop-vs-mobile inconsistency. Notification **counts** on Messages/Responses + a bell dot. Account **avatar-menu is the profile home on desktop**; mobile profile lives inside Activity. Lucide icons on the mobile tab bar only. Club account-menu = Club profile / Club settings / Log out (maintainer cut "switch account").
- **Avatars — shape = kind** (the one real fork; maintainer chose it over all-rounded-square): **people = circle, clubs = rounded-square.** Fallback photo → initials (name-hashed colour) → glyph; sizes 24–88; unclaimed-club (dashed) + stacked `+N` cluster. **Supersedes the old design-system line "avatars/club logos: rounded-square."** Propagated to the nav avatar; **still to propagate when assembling screens: v4's peek rows / group logos** — v4's `.av` is used for *both* people and clubs, so split it by kind.
- **Messages** — `student↔club` + net-new `student↔member` (Positioning §8), member labelled `MEMBER` so it's never taken for the official club account. Grey-received / **accent-sent** bubbles (the one deliberate accent use outside "demands action"; maintainer OK'd, toneable to ink/wash later). Application-context system line. **Thread header is a link → club page / member profile** (maintainer request). Active convo row = `bg-2` + accent left-bar (this fixed a 4.49:1 timestamp that the old accent-wash caused — the W1 "passes on base, fails on a wash" class).
- **Profile** — soft-gate **skippable** setup (progress + reassurance) vs a plain **settings-style edit** (never the wizard again); view shows person/club, with **no private activity counts exposed to others**.

**Working loop the maintainer likes:** build a component → show it (screenshot both themes) → they react → fold in → next. One thing at a time; verify by driving the page and measuring AA, not by asserting. *(Tooling note: the in-app browser can blank/hang on programmatic scroll to a deep section; capturing a component reliably was done via a throwaway `_*-preview.html` in `current/` with that section at the top + a tall viewport, then deleted.)*

**Still open (small):** production SVG for the stacked mark (outline from licensed Instrument); hero-photo licensing + WebP/AVIF before public launch; archive superseded explorations to `explored/direction-11-earlier/` (original, refinement studio, v2, v3, labs — pending an explicit OK). None block component work.

**Working style that's been productive:** one decision at a time with real options and stated tradeoffs; challenge assumptions rather than agreeing; verify by measurement and browser rather than assertion; keep docs current; say plainly what wasn't done.
