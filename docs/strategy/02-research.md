# Stage 2 — Research & Evidence

**Status:** In progress. Desk research and heuristic evaluation complete; student and club evidence outstanding.
**Date:** 2026-07-23
**Stage input:** [`01-positioning.md`](./01-positioning.md)
**Purpose:** Replace assumptions with evidence where we can, and label the rest honestly — so Stage 3 (IA) designs against findings rather than intuition.

---

## 1. Assumption log

Carried from Stage 1, updated. **Confidence is stated as of today, not as of when the assumption was written.**

| # | Assumption | Status | Confidence | Resolved / tested by |
|---|---|---|---|---|
| **A3** | ZotSpot has no application/review workflow | ✅ **CLOSED — true** | Confirmed by maintainer from an officer view | — |
| A1 | Clubs run recruiting on Google Forms + spreadsheets and feel real pain there | **Open** | Medium-high (maintainer's direct experience; no artifacts collected yet) | Club protocol, §4 |
| A2 | "Applicants never hear back" is a *felt* problem, not merely untidy | **Open** | Medium — plausible, entirely untested | Student interviews, §3 |
| A4 | Officers will adopt an optional tool alongside a mandatory one | **Open — biggest risk** | Low | Real outreach conversations; the claim-flow is the countermeasure |
| A5 | Students discover clubs through fragmented channels rather than ZotSpot | **Open — newly doubtful** | Low. Stage 1 assumed fragmentation, but ZotSpot has 974 orgs and institutional placement. It may well be where students already look | Student interviews, §3 |

**A3 closing matters more than it looks.** It was the single assumption that could have invalidated the wedge, and it held. Everything downstream now rests on A1/A2/A4 — which are all about *clubs*, the side where our evidence is weakest.

**A5 is new and I want to flag it.** Stage 1 inherited the PRD's "opportunities scattered across 10+ platforms" framing without testing it. With ZotSpot's actual scale visible, that framing is suspect. If students *do* already use ZotSpot for discovery, the student-side pitch changes from "finally, one place" to "the same clubs, without the friction." Worth knowing before Stage 5 writes a headline.

---

## 2. What research can and can't reach

| Track | Access | Method | Status |
|---|---|---|---|
| Desk / competitive | Full | Public sources | ✅ Done — Stage 1 §1 |
| Heuristic evaluation | Full | Expert review of the live product | ✅ Done — §5 below |
| Students | **Real** | Semi-structured interviews | ⏳ Needs scheduling |
| Clubs | **Proxy only** | Maintainer as domain expert + artifact archaeology | ⏳ Blocked on §4 |

The club side stays weaker than the student side no matter how well this is run, because we have no direct officer access. Rather than pretend otherwise, every club-side conclusion is tagged proxy-sourced and gets a real test at first outreach.

---

## 3. Student interview guide

**Target:** 5–8 UCI students, mixed years. Prioritize students who have *and haven't* joined clubs — non-joiners explain the drop-off, and they're the ones a discovery product has to win.

**Rules that keep this honest:**
- Ask about **past behavior**, never hypotheticals. "Would you use X?" produces polite lies.
- Never show ZotHub until the final section. Everything before it must be uncontaminated.
- Ask for the **most recent** instance, not the typical one — memory of specifics is reliable, memory of patterns is reconstruction.

**Warm-up (2 min).** Year, major, what they're involved in now.

**Discovery — tests A5.**
- Walk me through the last club you looked into. Start from the very first moment you heard of it.
- How did you first hear about it — who or what told you?
- What did you do next? Where did you go to find out more?
- *(If ZotSpot / CampusGroups isn't mentioned)* Have you used ZotSpot? When was the last time? What for?
- Last time you wanted to find something new to join, what did you actually do?

**Application — tests A1, A2.**
- Tell me about the last club you applied to. What did the application look like?
- What happened after you submitted it? Walk me through what you heard and when.
- Did you ever hear back? *(If no)* — how long did you wait, and what did you assume had happened? How did that feel?
- Was there a club you started applying to and didn't finish? What stopped you?

**The human question.**
- Before joining something, what do you most want to know that you can't find out online?
- Have you ever messaged someone already in a club? What happened?

**Reaction (last 10 min only).** Show the current product. Task: "Find something here you'd actually apply to." Observe silently; note first click, hesitations, and the moment they'd give up. Then: what did you expect that wasn't here?

**Synthesis:** code for recurring *behaviors*, not opinions. Target output: 3–5 themes with verbatim support, and an explicit verdict on A2 and A5.

---

## 4. Club-side protocol — blocked on the maintainer

Two parts, both outstanding.

**Artifact archaeology (highest value).** Real artifacts beat recollection, because they record what actually happened rather than what's remembered. Requested:
- the actual Google Form(s) used for recruiting — question text and order
- the spreadsheet or wherever responses were read
- the Discord/Instagram recruiting announcement as posted
- any officer handoff doc
- any message sent to accepted or rejected applicants

**Structured extraction.** The question already asked and still open: end to end, where did applications live, who read them, how was the decision made, and what happened to the people who weren't picked?

*Specifics worth more than a tidy summary — including the parts that went badly.*

---

## 5. Heuristic evaluation — current product

Expert review against Nielsen's 10, grounded in the live site and specific code. **Severity 0–4** (0 = not a problem, 4 = catastrophe — must fix before release).

### Findings by severity

| # | Heuristic | Sev | Finding |
|---|---|---|---|
| H3 | User control & freedom | **4** | Accept/Reject and Accept All/Reject All fire immediately — no confirmation, no undo ([ApplicationReview.tsx:462](../../src/components/dashboard/ApplicationReview.tsx#L462)). These are irreversible decisions about real people, and they're the easiest actions in the product to trigger by accident. No account deletion either. |
| H9 | Error recovery | **4** | Dead ends. "Please complete your student profile first" is a toast with no link ([ApplicationForm.tsx:104](../../src/components/ApplicationForm.tsx#L104)) — it names the blocker and offers no way to resolve it. Worse, `handleNewOAuthUser` inserts the profile client-side where RLS requires a role the user doesn't have yet, with no error handling — so **every Google signup silently fails to create a profile**, and the user's first symptom is that dead-end toast. |
| H10 | Help & documentation | **4** | None exists. No `/help`, FAQ, contact, or report-an-issue. The only support channel is an email address in the privacy policy — and that line still shows the wrong address. |
| H2 | Match with the real world | **3** | **Four different status vocabularies** for the same "someone decided yes/no" concept: applications `accepted/rejected`, RSVPs `confirmed/cancelled`, waitlist `approved/rejected`, team invites `accepted/declined`. UI copy crosses them — `CreateEvent.tsx:302` says "approve each RSVP" for a workflow that writes `confirmed`. Separately, Committee and Other opportunities render as **"Volunteer"** ([formatters.ts:69](../../src/lib/formatters.ts#L69)) — the product mislabels a club's own posting. |
| H4 | Consistency & standards | **3** | Three navigation systems with divergent `isActive` logic, and two mobile paradigms (hamburger logged-out, tab bar logged-in). Three confirmation paradigms applied *inversely to risk*: `AlertDialog` for low-stakes deletes, native `confirm()` in AdminDashboard, and nothing at all for rejecting a person's application. Four duplicated status-colour maps; 41 raw palette utilities bypassing tokens; `font-display` on 39 elements resolving to nothing. |
| H5 | Error prevention | **3** | No guard on the high-regret path (see H3). Credit where due: capacity is enforced server-side under concurrency and duplicate applications are blocked — the backend prevents errors the interface doesn't. |
| H7 | Flexibility & efficiency | **3** | Hard `limit(50)` with no pagination ([Opportunities.tsx:79](../../src/pages/Opportunities.tsx#L79)) — past 50 items, content is simply unreachable. No keyboard affordances in review, which is the highest-volume repetitive task in the product. CSV export is a genuine bright spot. |
| H1 | Visibility of system status | **2** | Skeletons don't match the cards they stand in for (`rounded-2xl`/`p-6` vs `rounded-lg`/`p-5`), so every list visibly reflows on load. No application timeline — a student sees a status, never its history. Waitlist polls every 30s with no indication it's doing so. |
| H6 | Recognition over recall | **2** | Search is client-side substring over title + club name only. A student must recall near-exact wording. The `/clubs` category filter offers 8 categories against the 17 offered at signup — only *Academic* and *Technology* overlap, so most filters match nothing. **"Reviewed" is a filter for a state no code can produce** — verified: `updateApplicationStatus` is only ever called with `accepted` or `rejected`, so selecting it always returns zero results. |
| H8 | Aesthetic & minimalist design | **2** | Hero is 85vh of centred text with zero product content — no screenshot, no live opportunity, no proof. A full empty viewport sits between sections. |

### Cross-cutting: accessibility

Not a Nielsen heuristic, but it fails hard enough to rank with the 4s. Measured, not estimated:

| Pair | Ratio | AA |
|---|---|---|
| Coral `#dd7255` + white — **the hero CTA** | 3.18:1 | ✗ |
| `--success` + white | 2.70:1 | ✗ |
| Indigo `#5565dd` text on background | 4.05:1 | ✗ |
| `--border` on `--card` | 1.29:1 | ✗ |

Plus **zero** `focus-visible` styling across the 11 non-`ui/` components using raw `<button>` — bookmark toggles, filter chips, search clear, and the mobile menu are all keyboard-invisible (WCAG 2.4.7). Three `aria-label`s exist in the entire app outside `ui/`.

### What this tells Stage 3

The severity-4 findings cluster in one place: **the product tells users what's wrong and never what to do about it.** Dead-end toast, unreachable state, no help, no undo. That's not ten separate bugs — it's a single missing principle, and it should become an explicit UX principle in Stage 3 rather than ten tickets.

The severity-3 findings cluster somewhere else: **the system disagrees with itself.** Four status vocabularies, two category taxonomies, three navigation models, three confirmation paradigms. Re-skinning preserves every one of them, which is the core argument for Stage 3 existing at all.

---

## 6. Outstanding

1. **Club artifacts + the recruiting walkthrough** (§4) — blocks A1, A2, and most of Stage 3's club journey work.
2. **Student interviews** (§3) — blocks A2 and A5. Guide is ready to run as written.
3. Synthesis into themes, JTBD statements, and a verdict on each open assumption — after 1 and 2.

Stage 3 can begin on the heuristic findings alone, but its club-side journey work will be assumption-driven until §4 lands.
