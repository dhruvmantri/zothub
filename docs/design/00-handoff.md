# ZotHub Redesign — Handoff

**Written:** 2026-07-23 · **Purpose:** give a fresh session (any tool, any context window) everything it needs to continue without re-deriving.

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
| 4–6 · Brand, direction, design language | 🟡 **in progress — this folder.** 11 directions explored, Direction 11 chosen, refinement underway |
| 7 · Core journey design | Not started |
| 8 · Validation | Not started |
| 9 · Implementation in slices | Not started |
| 10 · Onboarding readiness | Not started |

**Agreed remaining sequence:** refine Direction 11 → design system + brand kit → component library → remaining pages.

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
- **Escape non-ASCII to HTML entities** outside `<style>`/`<script>` — artifacts declare no charset and render mojibake otherwise.
- **Verify by driving the page in a browser** and reading computed styles. Don't trust the diff.

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

**Files:** `current/direction-11.html` (original) · `current/direction-11-refinement-studio.html` (accent systems + stress tests) · `current/direction-11-v2-pages.html` (**most current** — refinements applied to three real pages with live switchers).

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

### OPEN — decide these first
1. **Signature treatment.** The original italic-accent headline was Wellfound's move and a serif italic pairing was rejected (old-style serif against a neo-grotesque reads mismatched). Three single-family replacements are live in `direction-11-v2-pages.html`: **Weight** (300 accent vs 500 ink) · **Rule** (ink text, crimson rule beneath) · **Colour** (same weight, crimson only). Flip them on the Landing page.
2. **Secondary colour.** Blue / Teal / Ink / None, switchable. It appears in only two places (the "Event" tag and "Replies fast") and "None" collapses them to neutral — a deliberate test of whether it earns a slot. Likely only justified if it becomes the **events/RSVP** marker.
3. **The wordmark.** `zothub:` still borrows Wellfound's colon device. **This is the last borrowed piece and the main thing between this and an ownable identity.** Do it before deriving the design system, so we tokenize something that's ours. The `ui-ux-pro-max:design` skill has logo generation.

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
Read docs/design/00-handoff.md and docs/strategy/*.md, then continue the ZotHub
redesign from Direction 11. Open docs/design/current/direction-11-v2-pages.html
to see the current state.
```

**Working style that's been productive:** one decision at a time with real options and stated tradeoffs; challenge assumptions rather than agreeing; verify by measurement and browser rather than assertion; say plainly what wasn't done.
