# Stage 1 — Product Strategy & Positioning

**Status:** **Approved with amendments (2026-07-23).** Decisions resolved — see §10.
**Date:** 2026-07-23 · amended same day after review
**Stage:** 1 of 10 in the redesign workflow. Produces no code.
**Purpose:** Give the redesign a brief to be judged against, so "does this design work?" has an answer other than taste.

> **Amendments from review, in one place.** (1) Positioning accepted, but ZotHub does **not** cede discovery — it competes on usability and seeds supply by scraping ZotSpot into claimable club profiles. (2) **Name stays ZotHub**; portability is not this cycle's problem because a full rebrand precedes any second campus. The logo and favicon are still hard requirements to replace. (3) **Build window is 10 days**, then ~5 weeks of outreach before the Involvement Fair. (4) Events and student-to-student connection are **core**, not deferred. Execution detail: [`02-execution-plan.md`](./02-execution-plan.md).

---

## 1. The finding that resets the strategy

**UCI already has a club discovery platform, it has 974 groups on it, and every club is required to use it.**

The official platform is **ZotSpot** (`zotspot.uci.edu`, a white-labeled CampusGroups instance). It offers:

- **974 organizations**, browsable and searchable
- **19 category tags** (Academics and Honors, Career and Professional, Club Sports, Community Service, Creative Arts, Multicultural, Performance and Entertainment, Religious and Spiritual, …) plus **11 group types**
- **Join** — direct membership enrollment
- **Contact** — built-in messaging to group officers
- Per-organization pages with logo, mission, membership benefits, contact info

Adoption is not optional. To be a Registered Campus Organization for 2026–27, a club must register **on ZotSpot**, have 3–5 authorized signers complete Signer Agreements and five COOL modules, file a constitution, and pay a **$50 fee through the platform**. Registration opened July 1 2026 and closes **August 14 2026**; Involvement Fair registration closes **August 21 2026**.

### Why this matters

`prd.md`'s competitive table lists Facebook Groups, Discord servers, email listservs, and campus job boards. **It does not mention ZotSpot at all.** The strategy was built against the wrong incumbent.

ZotHub's stated value proposition is "centralized discovery — a single, searchable hub where every UCI student has equal access to all campus opportunities." That is a precise description of a product UCI already operates, with **974 organizations to ZotHub's 1**, mandatory adoption, institutional endorsement, and payment rails.

**ZotHub cannot win "a searchable directory of UCI clubs." That battle is over and it did not lose narrowly — it lost by 973 organizations and a registration mandate.** Every hour spent designing better club discovery is an hour spent competing with free, mandatory, already-adopted infrastructure.

This is the single most important correction in this brief, and I'd rather surface it in week one than after a redesign.

---

## 2. Where ZotHub can win

ZotSpot is a **directory, roster, and events tool**. Walk one step further into the club's actual year and it stops:

| The club's job | Where it happens today |
|---|---|
| Be listed, register, pay dues, book an Involvement Fair booth | **ZotSpot** — solved, mandatory |
| Announce "we're recruiting" | Instagram, Discord, GroupMe, tabling |
| Collect applications | **Google Forms** |
| Read 40 applications and decide | **Google Sheets**, screenshots in a Discord officer channel |
| Track who's in what stage | Nobody's tracking it; it's in a group chat |
| Tell applicants yes or no | Someone hand-writes 40 emails, or nobody does and applicants just never hear back |
| Hand it all to next year's officers | Lost. Rebuilt from scratch every September |

**Nothing in the market sits here.** The "student organization management" category (CampusGroups, Presence, Engage, Joinit) is about membership, rosters, and events. The applicant-tracking category (Greenhouse, Lever, Slate) is built for employers and universities hiring or admitting. **Applicant tracking for student organizations is an unserved intersection** — and it's the part of the year where club officers feel real, dated, recurring pain.

That gap is what ZotHub already built, without framing it that way. The custom application-question builder, status workflow, bulk review, CSV export, duplicate prevention, and applicant messaging are not "features around discovery." **They are the product.** The discovery surfaces are the commodity wrapper around them.

### Positioning — **approved**

> **ZotHub is where UCI club life actually happens: find a club, apply, show up, and stay connected — and for clubs, run real recruiting instead of a Google Form and a spreadsheet.**
>
> The wedge is recruiting. The reason students come is that everything ZotSpot makes tedious, ZotHub makes fast.

**Amended after review — the original draft was too concessive.** It proposed ceding discovery entirely. That was wrong for two reasons:

1. **"The incumbent has a feature" ≠ "we can't do it better."** ZotSpot's directory is comprehensive and mandatory; it is not *good*. 974 groups behind 11 group types and 19 tags, on a white-labeled enterprise platform, is a compliance tool students tolerate. Discovery that is genuinely fast, modern, and straightforward is a legitimate reason to prefer ZotHub — the differentiator is **usability, not existence**.
2. **The cold-start problem has a solution** (below), which removes the "1 club vs 974" objection that drove the original concession.

So the structure is: **recruiting is the wedge and the defensible ground; discovery is the front door and must be excellent; events and connection are core, not deferred.** Nothing is ceded to ZotSpot on the grounds that they got there first.

### The cold-start solution — ZotSpot seeding + claim

Scrape ZotSpot's public directory of active registered organizations and pre-populate ZotHub with **unclaimed club profiles**. Any club can **claim** its page after registering. This does three things at once:

- **Fixes discovery on day one.** Students arrive to a real UCI club directory, not one club called "Test Club."
- **Collapses club onboarding.** The pitch stops being "sign up and build a profile" and becomes "your page already exists — claim it." That is a far shorter ask of a volunteer officer, and it directly de-risks assumption **A4**.
- **Makes outreach concrete.** Every conversation can open with a link to *their* page.

**Sequencing:** built after the core redesign ships (see [`02-execution-plan.md`](./02-execution-plan.md)), during the outreach window.

**Flags to handle when we build it, not now** — none is a blocker, all are cheap to get right and expensive to get wrong:
- **Accuracy and consent.** An unclaimed page must be unmistakably unclaimed — no fabricated activity, no implied endorsement. If a club is misrepresented, recourse is admin-side (an admin can unpublish the seeded page), with questions routed through the Help/Contact surface — deliberately **not** a self-service removal control. A directory entry that misrepresents a real organization is the same credibility failure as the fabricated landing stats, just aimed at someone else.
- **Attribution and terms.** Check ZotSpot/CampusGroups terms before scraping; prefer low-rate, cached, public-page-only collection. Source the data visibly.
- **Freshness.** Registration status changes annually; stale "active" claims age badly. Plan a refresh, or timestamp the data.

---

## 3. Club-first or student-first — resolved

**Club-first.** Not on preference — on three pieces of evidence:

1. **The PRD's own primary metric is supply-side** ("number of opportunities posted"), while its problem statement is demand-side. The metric is right; the problem statement was written against the wrong incumbent.
2. **Discovery is where the incumbent is strongest and recruiting is where it's absent.** Student-side polish competes with ZotSpot; club-side tooling doesn't.
3. **Zero supply makes student-side design unevaluable.** A student journey tested against 4 opportunities named `opp 2` and `opp 3` teaches nothing. Club-side journeys can be designed and tested against real recruiting artifacts today.

**What this means concretely:** the club's first-run — sign up → complete profile → post a real opportunity → receive and review applications — is the highest-priority journey in Stage 7, and the landing page in Stage 5 is written to a **club officer**, not a browsing freshman.

**What this does not mean:** student experience gets deferred to "later." Students are the applicants; a club will abandon a tool that embarrasses them in front of members. Student surfaces must be excellent — they just aren't where we differentiate.

---

## 4. First ICP — which clubs

Target: **mid-size to large clubs that run competitive, structured recruiting with defined roles.** At UCI these are the professional/pre-professional orgs, project-based technical clubs, consulting and finance groups, and large cultural orgs with officer boards and committees.

**Why these and not others:**
- They already run an application process, so we replace a workflow rather than invent one. Adoption is a switch, not a behavior change.
- They have **application volume** (30–100+ per cycle), which is the exact point where Google Forms + Sheets stops working and the pain is felt.
- They have **officer boards**, so the tool serves a team — creating internal pull rather than one champion.
- They have **annual turnover**, so "everything is lost each September" is a felt problem, and continuity is a real benefit we can deliver.

**Explicitly not first:** brand-new clubs with no audience (they need members, not an ATS — that's ZotSpot's and the Involvement Fair's job) and small social clubs that don't run applications at all (no pain to relieve).

**Anti-goal:** do not chase "all 974 orgs." Ten clubs running a real recruiting cycle on ZotHub is a product. Two hundred inert listings is a directory nobody needed.

---

## 5. Brand architecture — and a name collision

Two problems converge on the name, and they need one decision.

**Problem 1 — the collision.** UCI's official platform is **ZotSpot**. This product is **ZotHub**. Same campus, same category, same prefix, one syllable apart. A club officer told "register on ZotSpot, then post your applications on ZotHub" will conflate them, and any confusion transfers *our* credibility to *them*, never the reverse. Trading on the official platform's name-shape is also a poor look if UCI ever notices.

**Problem 2 — portability.** You named scalability beyond UCI as a core consideration. "Zot" is the UCI Anteater chant. The name and the anteater mark are the least portable assets in the product. A Berkeley club will not adopt something called ZotHub.

Compounding both: **the current wordmark doesn't render the name.** The custom Z glyph reads as an arrow, so the live site says "otHub."

### Decision — **keep ZotHub. Rebuild the mark.**

**Resolved (2026-07-23):** the name stays.

The reasoning that overrides my draft recommendation: **portability is not this cycle's problem.** Expansion beyond UCI would be preceded by a complete rebrand anyway, so optimizing the name for a second campus today buys an option we've already decided to exercise differently. Meanwhile, sounding native to UC Irvine is an *adoption advantage* in the only market that matters for the next year. Renaming to differentiate from ZotSpot would spend real cost against a benefit we don't need yet.

Treat ZotSpot as what it is: **the competitor**, not a naming hazard. Differentiation comes from the product being visibly better, not from the name being further away.

**Still hard requirements, unchanged:**
- **The wordmark must be rebuilt from scratch.** It currently renders as "otHub" — the product's name is not legible in its own logo. This is not a polish item.
- **The favicon must be replaced.** It's still Lovable's.
- Both are outputs of the brand stage, once the new direction is settled — not patches applied beforehand.

**Carried forward, not lost:** the eventual rebrand is a known future event. The visual system should therefore be built so identity lives in **tokens and a design language**, not in anteater-shaped decisions scattered through 30 screens. A future rename should cost a logo swap and a token file, not a redesign.

---

## 6. Timing — there is a real, dated window

| Date | Event |
|---|---|
| Jul 1 – **Aug 14, 2026** | Club re-registration open on ZotSpot ($50, signer agreements, COOL modules) |
| **Aug 21, 2026** | Involvement Fair booth registration closes |
| **Sept 22, 2026** | Anteater Involvement Fair — Aldrich Park, 11am–4pm, the year's single largest recruiting moment |
| Late Sept – Oct 2026 | **Fall recruiting**: clubs convert fair interest into applications and run their cycles |

Today is **July 23, 2026**. The fair is **~8.5 weeks out**; fall application cycles run 2–4 weeks after that.

This is the moment club officers are actively thinking about the coming year's recruiting — and the only window all year when "how are you handling applications this fall?" is a question they're already asking themselves. Missing it costs roughly a year: winter recruiting is much smaller, and spring is officer transition.

### Decision — **fall, with a 10-day build**

**Resolved (2026-07-23):** redesign and development complete in **10 days**, then the remaining ~5 weeks go to **outreach and club onboarding** ahead of the Involvement Fair.

This inverts the constraint in a useful way. The deadline isn't September 22 — it's **August 2**, after which every day is spent getting clubs on the platform rather than building it. Outreach is the scarce resource, not engineering.

**The one resequencing this forces:** the landing page and club-facing pitch must ship **first**, not last. Outreach can begin the moment a club officer has something credible to look at — it does not need the whole app finished. Front-loading the public surface buys roughly a week of extra outreach at no cost.

**What 10 days actually requires** — and this is the honest version, because "no quality sacrifice" and "10 days" only coexist under one condition: **the quality bar holds, the scope shrinks.** Not all 30 screens get bespoke design. The launch surface is the core loop; everything else inherits the design system without individual attention. Full scope boundary and day-by-day in [`02-execution-plan.md`](./02-execution-plan.md).

**The constraint effort can't buy down:** research that depends on *other people's calendars*. Five scheduled student interviews and a formal usability round cannot be compressed by working nights. Those stages get restructured — run concurrently and non-blocking, using fast proxies — rather than pretended away. See the execution plan.

---

## 7. Metric tree

**North star:** *completed recruiting cycles* — a club posts an opportunity, receives ≥5 applications, and issues decisions on all of them. This measures the full loop rather than any single step, and it's the only metric that can't be gamed by an empty listing.

| Level | Metric | Why |
|---|---|---|
| **Primary** | Opportunities posted with ≥1 real application | The PRD's supply metric, hardened so test posts don't count |
| Activation (club) | Signup → first opportunity published, and time to it | The onboarding funnel Stage 7 designs against |
| Activation (student) | Detail page view → application submitted | The conversion the apply flow owns |
| Quality | Applications per opportunity | Below ~5, the club got no value; the tool didn't beat a Google Form |
| **Completion** | % of applications receiving a decision | The differentiator. Google Forms' worst failure is applicants never hearing back |
| Retention (club) | Clubs running a 2nd cycle | The only real proof of value |
| Retention (student) | Return visits after first application | Secondary until supply exists |

**Deliberately not tracked yet:** DAU/WAU. At 10 clubs, daily active use is the wrong shape — recruiting is bursty by nature. Optimizing for daily engagement would push the product toward feed mechanics it doesn't need.

---

## 8. What ZotHub is deliberately not

Stating anti-goals so the redesign can refuse things without relitigating. **Revised after review** — the original list was too quick to concede ground to ZotSpot.

- **Not official UCI.** No UCI seal, no blue/gold lift, no implied endorsement. Homely *to* UC Irvine, yes — impersonating it, no.
- **Not generic B2B SaaS.** The users are 20-year-olds volunteering their evenings. Enterprise-solemn is the wrong register.
- **Not an engagement-farming social network.** No infinite feed, no streaks, no manufactured notification volume.
- **Not a system of record for club compliance.** Registration, dues, constitutions, COOL modules — that's ZotSpot's mandate and we don't want it.

**Reversed from the draft — these are now in scope, deliberately:**

- **Discovery is core.** Students should *prefer* browsing clubs here. The bet is usability, not exclusivity.
- **Events are core.** ZotSpot's event surface skews toward departmental and university programming; **student-org events are underserved there**, which makes this a differentiator rather than a duplicate.
- **Social texture is core, in a bounded way.** Students should be able to see who's actually in a club and talk to them — the human question ("what's it like to be in this club?") is the one no directory answers. This means *connection*, not a feed.
  - **Scope note:** this is **net-new**. Today `messages` supports student ↔ club only; student ↔ member requires new access rules and UI. Sizing and sequencing in [`02-execution-plan.md`](./02-execution-plan.md) — it is a strong candidate to land right after launch rather than inside the 10 days.

**The student promise, in their words:** discover → compare → apply → RSVP → chat, in the fewest steps anyone has managed on this campus.

---

## 9. Assumptions this brief is making

Marked honestly, with where each gets tested:

| # | Assumption | Confidence | Tested where |
|---|---|---|---|
| A1 | Clubs run applications on Google Forms + Sheets and feel real pain there | **Medium-high** — matches your club experience; no external evidence gathered yet | Stage 2 artifact archaeology; Stage 8 pitch test |
| A2 | "Applicants never hear back" is a felt problem, not just an untidy one | **Medium** — plausible, unverified | Stage 2 student interviews (you have access) |
| A3 | ZotSpot genuinely lacks an application/review workflow | **Medium-high** — its public surface shows Join and Contact only; not verified from an officer's logged-in view | **Priority Stage 2 check** — needs an officer account. If ZotSpot ships an ATS, this brief changes materially |
| A4 | Officers will adopt a second tool alongside a mandatory one | **Low — the biggest risk in this brief** | Stage 8 pitch test with real officers |
| A5 | Fall is the right window rather than winter | Medium | Your call in §6 |

**A4 is the assumption most likely to sink this**, and it deserves saying plainly: we are asking a volunteer officer to adopt an optional tool next to a mandatory one. The answer has to be that it removes work they're already doing, not that it adds a place to be. Every design decision downstream should be tested against that sentence.

---

## 10. Decisions — resolved 2026-07-23

| # | Decision | Outcome |
|---|---|---|
| 1 | **Positioning** | **Accepted, amended.** Recruiting is the wedge; discovery, events, and connection are core and competed for on usability. Nothing ceded to ZotSpot on precedence. |
| 2 | **Club-first sequencing** | **Accepted** — supply first, because clubs and their opportunities are the inventory. But the student side is a first-class deliverable, not a follow-up: discover → compare → apply → RSVP → chat, as frictionless as it can be made. |
| 3 | **Name** | **Keep ZotHub.** Portability deferred to a future full rebrand. Logo rebuilt from scratch and favicon replaced — both non-negotiable. |
| 4 | **Window** | **Fall.** 10-day build, then ~5 weeks of outreach and onboarding to the Sept 22 Involvement Fair. |
| 5 | **Cold start** | **ZotSpot seeding + claim** — scrape active registered orgs into unclaimed, claimable profiles. Built after the core redesign, during outreach. |

### Consequences for the workflow

The approved 10-stage workflow still holds as the *sequence of thinking*, but its calendar shape changes hard:

- **Stage 2 (research) stops being a blocking phase.** Student interviews run *concurrently* with design and are used to correct course, not to gate it. Assumption **A3** (does ZotSpot have an application workflow?) becomes a same-day check, since a wrong answer there changes the wedge.
- **Stage 8 (validation) becomes continuous rather than a gate.** Fast proxies during the build; the real validation is the outreach conversations themselves, which start ~Day 3.
- **Stages 5–7 compress into a single design push** with the landing page first, since outreach is blocked on it.
- **Scope, not standards, absorbs the compression.** Core loop gets bespoke design; everything else inherits the system.

Full day-by-day: [`02-execution-plan.md`](./02-execution-plan.md).

**Still open, carried into execution:** whether student ↔ member chat lands inside the 10 days or immediately after (net-new backend + access rules — see §8).

**Follow-up flagged, not actioned:** `prd.md`'s competitive landscape table omits ZotSpot and its problem statement is built on the discovery framing. It's the product source of truth and is now demonstrably wrong on both. I have not edited it — that reconciliation should happen once the decisions above are made, not before.

---

## Sources

- [UCI Campus Organizations — Re-Registered Organizations](https://campusorgs.uci.edu/registration/re-registered-organizations/) — registration requirements, deadlines, $50 fee, signer/COOL obligations
- [ZotSpot — UCI student organization directory](https://zotspot.uci.edu/club_signup) — 974 groups, category tags, group types, Join/Contact actions
- [Anteater Involvement Fair](https://campusorgs.uci.edu/signature-programs-events/fall-quarter/anteater-involvement-fair/) — Sept 22 2026, Aldrich Park, eligibility
- [CampusGroups / UCI events](https://campusgroups.uci.edu/events) — redirects to ZotSpot, confirming the white-label relationship
- [Best Student Organization Management Systems](https://joinit.com/blog/best-student-organization-management-system) — category scan confirming the membership/roster orientation of existing tools
- [Applicant tracking system (overview)](https://en.wikipedia.org/wiki/Applicant_tracking_system) — ATS category definition, employer-oriented
