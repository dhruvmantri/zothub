# SUPERSEDED — 10-Day Execution Plan (retained as a record)

> **This document is void as a schedule.** It was written when the maintainer's
> statement of personal capacity ("I'll grind this out in 10 days") was
> mistakenly turned into a project plan with day numbers. Scheduling belongs to
> the maintainer; the approved 10-stage workflow carries no dates and should not
> acquire any from Claude.
>
> **Retained for two things that are still live:**
> - the **Day 0 shipping record** — what the access-model change did, why
>   auto-approving students is safe, and the manual steps still outstanding;
> - the **resolved decisions** in "Open decisions" — light-default theming,
>   student↔member chat deferred past launch, students unqueued.
>
> The scope boundary (bespoke tier vs. systematic tier) folds into Stage 3/6.
> Everything framed as "Day N" is void. Active plan: the approved 10-stage
> workflow; strategy input: [`01-positioning.md`](./01-positioning.md).

**Original status:** Draft for review.
**Date:** 2026-07-23
**Build window:** ~Jul 24 – Aug 2, 2026 · **Outreach window:** Aug 3 – Sept 22 (Involvement Fair)
**Strategy input:** [`01-positioning.md`](./01-positioning.md)

---

## The honest framing

"10 days" and "no sacrifice in quality" can both hold — under exactly one condition:

> **The quality bar is fixed. The scope moves.**

There is no version of this where 30 screens get bespoke design in 10 days at a high standard. There *is* a version where the **core loop** is genuinely excellent, the design system is real, and every other surface inherits it cleanly and looks deliberate. That's the plan below. The difference between the two is not effort — it's admitting the second one is the goal on Day 1 instead of Day 8.

**The constraint that effort cannot buy down:** anything depending on other people's calendars. Five scheduled student interviews and a formal usability round can't be compressed by working nights. So research runs *concurrent and non-blocking*, and the real validation becomes the outreach conversations themselves — which start on **Day 3**, not Day 11.

**The deadline is not Sept 22. It's Aug 2.** After that, every day is outreach. Engineering is not the scarce resource; club officers' attention in the two weeks around the Involvement Fair is.

---

## Scope boundary

### In the 10 days — the launch surface

Everything a club officer or a student touches during the fall pilot.

| Surface | Treatment |
|---|---|
| Brand: logo, wordmark, favicon, tokens, type, color | **Bespoke** — rebuilt from scratch |
| Landing / marketing | **Bespoke** — ships Day 3, unblocks outreach |
| Club: first-run → post opportunity → review → decide → message | **Bespoke** — this is the wedge, highest bar |
| Student: discover → compare → apply → RSVP → track → chat with club | **Bespoke** — the promise from §8 of the brief |
| Events: browse, detail, RSVP, calendar | **Bespoke** — core, and underserved by ZotSpot |
| Navigation / IA | **Rebuilt** — one model replacing today's three |
| Notifications, messages, profiles, settings | **Systematic** — inherit the system, no bespoke design |
| Admin, unsubscribe, privacy, 404 | **Systematic** — consistent, unremarkable, correct |
| Support center, account deletion | **New, minimal, correct** — launch-blocking for trust |

### Immediately after launch, during outreach

- **ZotSpot seeding + claim flow** — the cold-start play. Deliberately post-launch: it's an outreach *accelerant*, and it wants the design system finished before it generates hundreds of profiles.
- **Student ↔ member chat.** Net-new: `messages` is student ↔ club only today, so this needs new access rules, RLS policy, and UI. **Recommend deferring** — it's the single largest net-new item in scope, it isn't needed to run a fall recruiting cycle, and cutting it protects the loop that is.
- Applicant notes/ratings, saved searches, weekly digest, recommendations, analytics redesign.

### Explicitly not now

Multi-campus, monetization, ticketing, the rebrand.

---

## Day 0 — Unblock ✅ *(2026-07-23)*

1. **Assumption A3 verified — ✅ ZotSpot does not do club applications.** Confirmed by the maintainer from an officer view. **The wedge holds**, and it's now evidence rather than inference. This was the single largest risk to the strategy.
2. **Access gate decided and implemented** — students auto-approved, clubs still queued. See below.
3. **Credibility triage** — done for the items the Day 3 landing redesign won't itself replace.

### Shipped in this pass

**Access model: students skip the waitlist, clubs don't.**

- `supabase/functions/verify-otp/index.ts` — a `student` signup now has its `user_roles` row granted at verification and its `waitlist` row written as `approved` (with `reviewed_at` set, `reviewed_by` left null — no human reviewed it). Clubs are untouched: still `pending`, still no role, still reviewed at `/admin`.
- **Fails safe, not open.** If the role grant errors, the account falls back to the queue rather than ending up authenticated-but-unauthorized with an `approved` waitlist row — which would have waved it past `ProtectedRoute` into a dashboard it can't populate.
- **The auto-approved row is kept, not skipped**, so `/admin` still shows a complete picture of who joined rather than only the accounts that needed review.
- The signup email now matches reality — auto-approved students get `waitlist_approved`, queued clubs get `waitlist_confirmation`. Sending "you're on the waitlist" to someone already inside would be actively confusing.
- `src/pages/Signup.tsx` — **auto sign-in after OTP** instead of bouncing to `/login`. The password was just proven correct by `verify-otp`, so re-asking for it was pure friction. Students land on `/student/dashboard`; clubs land on `/waitlist`. If sign-in fails, it degrades to the old `/login` path rather than stranding the user on the OTP screen.

**Why auto-approving students is safe:** reaching that code path already proves control of an `@uci.edu` mailbox — `send-otp` rejects other domains, the code was delivered to that address and entered correctly, and the `BEFORE INSERT` trigger on `auth.users` (migration `20260709000300`) is the authoritative gate that just allowed `createUser`. Manual approval was adding latency, not a security property.

**Credibility:**
- Removed the fabricated landing stats (`200+ Active Clubs`, `1,500+ Opportunities`, `10K+ Students`, `500+ Events Monthly`) and the "Join thousands of UCI students and clubs already using ZotHub" line.
- Removed the Lovable OpenGraph image from `index.html`. Every ZotHub link shared to Discord/iMessage/Slack was rendering another company's branding. Left absent with a `TODO(brand)` — a text-only preview beats a competitor's logo, and the real 1200×630 asset is a Day 1–2 output.

**Verified:** `tsc --noEmit` clean · `npm run build` clean · `eslint` clean on touched files · no schema change, so no migration.

### Manual steps required — these are yours, not mine

1. **Deploy the edge function.** The frontend ships via the normal Vercel flow on merge, but the access-model change is inert until:
   ```bash
   supabase functions deploy verify-otp
   ```
2. **Purge the `Test Club` production data.** I have not touched production. Live discovery currently shows one club with `opp 2`, `opp 3`, `opp 3`, `opp 5` and an event at location "duh" — the first thing any club officer sees. **Take a backup first** (your policy already requires one before schema changes; this is irreversible data deletion, so it qualifies). Review before deleting:
   ```sql
   -- Review first — confirm this is only test data and not an account you still need
   select cp.id, cp.club_name, cp.email,
          (select count(*) from opportunities o where o.club_id = cp.id) as opps,
          (select count(*) from events e where e.club_id = cp.id) as events
   from club_profiles cp;
   ```
   Then delete the club profile once you've confirmed the row; `opportunities`/`events` cascade from `club_id`. Check for real applications/RSVPs attached before you do.
3. **Re-verify after deploy:** sign up a throwaway `@uci.edu` student and confirm it lands on the dashboard without admin action; sign up a club and confirm it still lands on `/waitlist`.

---

## Days 1–2 — Brand & design language

**Do:** brand brief (personality, promise, anti-patterns) → **3 divergent directions**, not palette swaps → choose one → build the identity.

**The rule that protects this:** each direction is presented as **a landing hero *and* the club application-review table**. A direction that only survives the hero is a poster, not a design system. This is the single practice most likely to prevent a Day 7 discovery that the design language doesn't handle density.

**Ship:** logo + wordmark (must render "ZotHub" legibly — the current one reads "otHub"), favicon replacing Lovable's, full token set with **every pair contrast-verified**, real display typeface, **light + dark with light as default**, motion spec. Committed as `docs/design-system.md`.

**Theme decision has code consequences** — the app is currently hard-locked to dark in three places, all of which come out in this pass:
- `App.tsx` — `<ThemeProvider forcedTheme="dark">` overrides everything
- `index.html` — `<html class="dark" style="color-scheme: dark">` hardcoded
- `index.html` — a `localStorage.theme` bootstrap script that is presently dead code, because `forcedTheme` wins; it becomes live again
- `src/index.css` — `:root` holds the dark palette directly, with no light set to switch to

**Gate:** you approve the direction before any implementation. This is the last cheap moment to change your mind.

---

## Day 3 — Landing live · **outreach begins**

Two tracks in parallel:

- **Landing page implemented and deployed** with honest content. The moment it's live, outreach starts — it does not wait for the app.
- **Foundation in code:** token layer, `font-display` fixed, `focus-visible` everywhere, **route-level code splitting** (drops the landing payload from ~1.38MB by roughly two-thirds), dead code removed (`Index.tsx`, `DashboardLayout.tsx`, `club_followers`).

---

## Days 4–5 — Club core loop *(the wedge — highest bar)*

First-run → complete profile → **post an opportunity** → receive applications → **review and decide** → message the applicant.

Folded in, because these are what make it beat a Google Form:
- Confirmation + **undo** on accept/reject and bulk actions (today: fires instantly, no confirmation, no revert)
- The unreachable `reviewed` state wired up
- **Message applicant** from review — backend already exists, path doesn't
- Dead-end "complete your profile first" toasts replaced with inline links

---

## Days 6–7 — Student core loop

Discover → compare → detail → **apply** / **RSVP** → track → chat with club. Events first-class throughout.

Folded in:
- **Real search** — server-side, beyond today's client substring on title + club name over a hard `limit(50)`
- **Taxonomy fixed** — one club category vocabulary (signup offers 17, discovery filters 8, two overlap) and no more silent coercion of Committee/Other into "Volunteer"
- True multi-facet filters + pagination
- Logged-out apply/RSVP carries return-to context

---

## Day 8 — IA, shared surfaces, systematic pass

- **One navigation model** replacing three parallel systems with divergent active-state logic and two mobile paradigms
- Notifications, messages, profiles, settings, admin — inherit the system
- Canonical empty / loading / error / success states everywhere, including the **cold-start** states that matter most at 10 clubs

---

## Day 9 — Trust, launch-blockers, QA

- **Support center** (`/help`: FAQ, contact, report an issue), **self-service account deletion**, `/privacy` contact line, RSVP confirmation-email consistency
- **Full quality pass:** WCAG AA verified by measurement, keyboard-only traversal of every core journey, mobile, perf budget, Playwright expanded to authenticated journeys
- Seed real content so launch day isn't an empty marketplace

---

## Day 10 — Buffer · polish · launch

Deliberately reserved. **A 10-day plan with no slack is a 14-day plan.** If Days 1–9 hold, this is polish and a real end-to-end drive. If they don't, this is where reality gets absorbed — and if it isn't enough, the thing that gives is *scope from the systematic tier*, never the quality bar on the core loop.

---

## Non-negotiable quality gates

Per slice, every slice — these are what "no sacrifice in quality" actually means in practice:

- `tsc -p tsconfig.app.json --noEmit`, `npm run build`, focused lint clean
- Playwright smoke passes and is extended to cover the slice
- **Contrast measured**, not eyeballed, on every new token pair (today: the hero CTA is 3.18:1, `--success` is 2.70:1 — both fail AA)
- Keyboard-only traversal of the slice, with visible focus
- Mobile verified at 375px
- **Backbone preserved** — re-skin, don't rebuild the wiring. Every correctness migration, RLS policy, and trigger from WS1–WS8 stays intact.

---

## Risks

| Risk | Mitigation |
|---|---|
| **A3 is wrong** — ZotSpot already does applications | Day 0 check, before anything is designed around the wedge |
| **A4 is wrong** — officers won't adopt an optional tool next to a mandatory one | Outreach from Day 3 tests this while there's still time to respond; the claim-flow is the direct countermeasure |
| Implementation uncovers unknowns in 30 screens | Day 10 buffer; systematic tier is the release valve |
| Design language doesn't survive density | Dense screen paired with every landing concept on Day 2 |
| The waitlist gate throttles the fall push | Open decision below — needs answering before outreach, not after |
| Solo build, 10 days, no redundancy | Ordering is deliberately front-loaded on the highest-value surfaces, so a slip costs the *least* important work |

---

## Open decisions

1. ~~**Access gate**~~ — ✅ **decided and shipped 2026-07-23.** Students auto-approved, clubs queued. See Day 0.
2. ~~**Student ↔ member chat**~~ — ✅ **decided: right after launch.** Stays out of the 10 days; ships during the outreach window. Protects polish time on the club review flow, which is what outreach is actually selling.
3. ~~**Light mode**~~ — ✅ **decided: both themes, light default.** The app is a work tool club officers use in daylight, and light reads as more trustworthy to a first-time visitor. Day 1–2 builds the token layer for two themes from the start rather than retrofitting one later.
4. **`/admin` cadence during outreach.** With students no longer queued, the queue is clubs only — which is exactly the population you're personally recruiting. Worth deciding whether club approval should stay manual at all once outreach is warm, or become "approve on the call."
