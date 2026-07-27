# Structure — Decision Record

**Date:** 2026-07-23 · settled in a working session
**Status:** Agreed. These are inputs to design, not proposals.
**Preceded by:** [`01-positioning.md`](./01-positioning.md) · [`02-research.md`](./02-research.md)

Decisions only. Rationale is compressed to the sentence that would stop us relitigating.

---

### 1. Discovery spine
**One discovery surface containing action-oriented item types**, each keeping its own data model, lifecycle, and interactions — not a merged object. Clubs are destination pages reached from items; club admins get a separate club-centric dashboard.

*Consequence:* the card is a **polymorphic renderer over typed items**, not one generic card pretending Apply and RSVP are the same verb. Deadlines and event dates are different time semantics and must look different.

*Corrected during the session:* Clubs are **not** a type inside Discover — you don't apply to a club. Three catalogs become **two**: things-you-act-on, and organizations-you-explore.

### 2. Navigation
**Student:** `Discover · Clubs · Activity · Messages` — identical on mobile and desktop.
- "Following" is a **filter inside Discover**, not a destination. The word **"Feed" is retired** (it collided with the new discovery feed and caused the original Feed/Dashboard confusion).
- Activity = applications, RSVPs, saved.
- Profile: avatar menu on desktop, inside Activity on mobile.

**Architecture:** one Discover implementation, **URL-backed filter state** (`/discover?type=roles&category=…`) — shareable, back-button correct. `/opportunities` and `/events` are **preserved as entry points** resolving to pre-filtered state, so no existing link breaks and clear intent still costs zero thought.

*Why:* today three separate implementations (three fetches, searches, filter arrays, sorts) drift apart — that drift is what produced the taxonomy mismatch. Unify what's underneath; keep the shortcuts on top.

### 3. Taxonomy
**Club categories:** store **source tags losslessly** (ZotSpot's on import, ours on signup); expose **~8–10 curated filter categories** mapped from them. Filter UI stays usable; a ~974-club import loses nothing; the curated set can be retuned without re-tagging everything.

**Opportunity types:** support **all six properly**. Delete the coercion in `normalizeOpportunityType()` that silently renders Committee and Other as "Volunteer."

### 4. Status model
**One presentation vocabulary and one colour semantic** across all workflows — one word each for waiting / yes / no. **Database values unchanged**, because they are load-bearing for the triggers, RLS, and email branching hardened in WS1–WS4, and the user-visible problem is words and colours.

*Fixes:* "yes" is currently spelled `accepted` / `confirmed` / `approved` / `active`, and rendered indigo on one screen and green on two others.

**`reviewed`** becomes a genuinely reachable state ("read, still deciding") — it is the minimum viable version of the thing a Google Form cannot do. **Pipeline depth is deferred** until the club walkthrough lands; inventing stages without evidence is expensive once clubs have data in them.

### 5. Club navigation
**`Postings · Responses · Messages · My Club`** — mirrors the student's four.
- **Postings** = roles + events you've created.
- **Responses** = applicants + RSVPs in **one review implementation** (they're the same shape: people who replied to something you posted).
- **My Club** = your public page, team, analytics, settings.
- **Lands on Responses** — the work queue, not a stats page. A dashboard of zeros is the worst possible first screen at current scale.

*Fixes:* four of five current club nav items are the student marketplace, while the club's actual job sits behind one "Dashboard" link with seven routes rendering one component.

### 6. Profile & first run
**Soft gate, never a wall.** Prompt at first signup, and again before the first application — always skippable.

**Split setup from editing:** a short guided first-run, and a plain settings-style editor thereafter. The current wizard makes routine edits feel like re-onboarding.

*Finding that reframed this:* the existing "Please complete your student profile first" is **not** an onboarding gate — `ApplicationForm` only checks that a profile *row exists*, and `verify-otp` always creates one. The message only fires for Google signups, where the OAuth profile insert silently fails against RLS. It was a misleading message for a broken insert.

### 7. Cold start
**No copy that describes the product's stage; only data that describes its state.** Stage-announcing copy ("new here, first clubs joining") carries a hidden maintenance cost and would have to be found and removed later.

- **Live counts** — "12 clubs · 34 opportunities · 8 events" — occupy the slot the fabricated stats vacated. Honest at every scale, self-updating, and quietly become social proof.
- Placement: secondary, not on a primary work surface.
- **Empty results describe the query, not the product:** "No roles match 'design'."

**Seeded ZotSpot clubs:** visible in the directory, **unmistakably marked unclaimed**, imported public data only, sourced visibly, with a prominent "Is this your club? Claim it". No self-service removal — an admin can unpublish a seeded page when genuinely needed; concerns go through Help/Contact. Density from day one, and every outreach conversation opens with a link to their page.

*Accepted asymmetry:* post-seeding, Clubs looks full while Discover is thin. That reads honestly as "many clubs, few openings right now" and creates real urgency for clubs to post — but it must be designed deliberately rather than allowed to read as broken.

---

## Still open

| Item | Blocks |
|---|---|
| **Club recruiting walkthrough + artifacts** | Review-pipeline depth (§4) and the application review screen. Designing it without this is guessing. |
| **A5 — do students already discover clubs via ZotSpot?** | The student-side headline. "Finally, one place" vs. "the same clubs, without the friction" are different landing pages. |
| Recruiting CTA in empty results ("know a club that should post? tell them") | Optional; not rejected, not confirmed. |
