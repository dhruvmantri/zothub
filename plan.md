# ZotHub — Build & Deployment Plan

> **Engineering execution doc.** This is what should drive the remaining build (Fable 5 / Claude Code). `prd.md` is the companion product spec (vision, users, journeys, metrics, launch ops) — read it for *why*, read this for *what's left and how*.
>
> **Reconciliation note (this revision):** A fresh audit of `main` (post-merge, post-PR#4) found the app is **far more complete than the previous version of this plan assumed**. Nearly all 22 originally-tracked features are implemented and wired, the "Unknown question" blocker is fixed, and a new **waitlist/admin-approval/OTP access-gate** has been built that wasn't in scope before. This revision reflects the *true* current state and narrows the remaining work to what's actually left.
>
> **Update (2026-07-08): Phases A and B below are now complete.** The app migrated off Lovable entirely — Vercel hosts the frontend, a self-owned Supabase project (`fguzpscguulkfctipeih`) replaced Lovable Cloud (schema/data/storage/edge functions all migrated), and the `send-reminders-hourly` cron job is active. See `MIGRATION.md` for the detailed step-by-step status. What's left is Phase C (DB-level UCI enforcement), Phase D (cleanup), and Phase E (QA) — plus two bugs found during QA, added below under **Known Issues**.

---

## Context

**What ZotHub is:** A two-sided UCI campus marketplace connecting students (leadership roles, internships, projects, volunteer positions, events) with UCI clubs (posting opportunities, managing applications, building community). Stack: React 18.3 + Vite 5 + TypeScript + Tailwind/shadcn + react-router-dom v6 (BrowserRouter) + Supabase (Postgres, RLS, Storage, Auth, Edge Functions, pg_cron/pg_net) + react-hook-form/zod + sonner + framer-motion + recharts.

**Where things stand:** Built on Lovable Dec 2025 → Jan 2026 across several sprints. As of this audit (28 migrations, latest dated 2026-01-29), the codebase has grown well past the original 22-feature PRD list: it now includes a full access-control system (waitlist signup → OTP email verification → admin approval → role-based access), 4 Supabase Edge Functions (`send-email`, `send-otp`, `verify-otp`, `send-reminders`), CSV export, bulk application actions, resume prefill, RSVP forms + approval, share links, add-to-calendar, and success modals — all wired into the UI. The Lovable subscription has ended, and although `zothub.app` is currently still resolving and serving the live site, **this is not a stable state — see "Why the site is still up, and why that won't last" below** — so **hosting migration remains the top-priority remaining item**, and a handful of other concrete gaps remain (below).

**Decisions carried forward:**
1. **Scope = finish what's left**, not rebuild — see "Remaining work" below. It's a short list.
2. **Email = already real** — Resend-backed Edge Functions exist; what's missing is the **scheduler** (cron jobs were never created) and a review of the templates.
3. **Deploy = migrate off Lovable → Vercel**, re-point `zothub.app`, backend managed via Supabase CLI.
4. **Access model = gated beta now, open @uci.edu signup later** (assumption — confirm/adjust; see "Access model" below).
5. **UI/UX = light coherence pass now; comprehensive redesign is an explicit post-launch phase** (see Phase 5).

**Key backend facts (superseded — kept for history; see MIGRATION.md for current state):**
- ~~Supabase project ref: `alpmifyiwwrkolixwyvz`~~ → **now `fguzpscguulkfctipeih`** (own project, not Lovable Cloud), `supabase/config.toml` updated to match.
- ~~zero `cron.schedule` calls exist~~ → **`send-reminders-hourly` cron job is now active** on the new project.
- ~~No SPA rewrite config~~ → **`vercel.json` added.**
- ~~`lovable-tagger` still wired in~~ → **removed** from `vite.config.ts`/`package.json`; consolidated to a single lockfile (`package-lock.json`).
- ~~.env handling~~ → untracked, fail-fast env validation added to `src/integrations/supabase/client.ts`.
- UCI `@uci.edu` restriction is **still client-side only** (no DB-level trigger on `auth.users`) — this one item has **not** been done yet (Phase C below).

---

## Why the site is still up, and why that won't last (mostly resolved — one open item)

*Kept for context on why Phase 0 was originally treated as urgent.*

You correctly observed that `zothub.app` was resolving and serving the live app even though the Lovable subscription had ended, and asked whether that meant migration wasn't urgent. It was urgent: Lovable's own docs state custom-domain hosting on a lapsed subscription isn't something to rely on, and the uptime at the time was very likely a grace-period artifact, not a stable state.

**Hosting/backend migration itself is done** — Vercel now hosts the app and its environment variables point at the new, self-owned Supabase project (`fguzpscguulkfctipeih`), replacing Lovable Cloud entirely.

**⚠️ DNS itself is a separate, still-open item.** Every migration step so far has explicitly excluded touching DNS (by your own instruction each time). That means it's **not confirmed** whether `zothub.app`'s DNS records currently point at Vercel or still point at Lovable's old hosting. Until DNS is re-pointed, the public `zothub.app` domain may still be serving the old Lovable-hosted app (or nothing, if that's already been decommissioned) — the new Vercel-hosted app is likely only reachable today via Vercel's own assigned domain (e.g. `*.vercel.app`), not yet at `zothub.app`. The domain registration itself is held at **Name.com** (not Lovable), so DNS control isn't blocked by the lapsed subscription whenever you're ready to do this step.

---

## Access model (confirm before building)

The app has been built out with a **waitlist-gated signup flow**: user picks role → verifies email via OTP (`send-otp`/`verify-otp` functions) → a `waitlist` row is created (`status: pending`) → an admin reviews and approves/rejects from `/admin` (`AdminDashboard.tsx`, `useWaitlistAdmin`) → approved users get full access; rejected users land on `/waitlist-rejected`.

This plan **assumes "gated now, open later"**: keep the waitlist/admin/OTP system for the beta launch (it gives you control over who's on the platform while validating), and treat "open @uci.edu signup" as a documented future toggle (disable the gate, keep OTP + DB-level `@uci.edu` enforcement as the sole gate). **If your intent was different — e.g. the waitlist was a stopgap you want removed before launch, or you want it permanent — say so and this section (plus the Phase 1 items below) should be adjusted.**

Operationally, this means: you (or another designated admin) must **check `/admin` regularly** to approve pending signups, or beta users are stuck waiting indefinitely. This replaces the old PRD's "manual club approval via SQL" — it's now a proper UI-driven approval queue for *both* students and clubs, and is a stronger foundation than what was originally planned.

---

## Remaining work (the real punch list)

### A. Deploy migration (do first — Phase 0) — items below individually marked

1. ✅ Add `vercel.json` SPA rewrite — done.
2. ✅ Remove `lovable-tagger` from `vite.config.ts`/`package.json` — done.
3. ✅ Pick one package manager (npm) — done.
4. ✅ Untrack `.env`, add fail-fast env validation — done.
5. ✅ Vercel project created, deployed, env vars set and now pointing at the new Supabase project — done.
6. ❌ **Point `zothub.app` DNS at Vercel via Name.com — NOT done.** Every migration step so far has explicitly excluded DNS changes. This is the one remaining item in Phase A. Until this happens, the live `zothub.app` domain isn't necessarily serving the new Vercel-hosted app yet (see note above).
7. 🟡 **Unconfirmed:** `supabase link`/`db pull`/`migration list` drift check was never completed this way — the schema was instead restored via `pg_restore` from a Lovable Cloud backup (see `MIGRATION.md`), not via `supabase db push` from tracked migrations. `supabase/config.toml` now points at the new project ref, but whether `supabase migration list` shows local==remote hasn't been explicitly verified. Low urgency unless/until new migrations need to be pushed via the CLI.
8. 🟡 **Assumed working, not explicitly re-verified:** Supabase Auth URL config (Site URL, redirect allow-list) and Google OAuth redirect URIs on the new project. OTP signup + login both work, which implies the basics are fine, but the exact settings haven't been checked against this checklist.

**Verification:** `npm run build` succeeds locally (confirmed). `https://zothub.app` loading the new app depends on item 6 (DNS) — not yet verifiable. Hard-refresh deep-link behavior, Google login redirect, and `supabase migration list` drift — not yet explicitly re-verified.

### B. Wire the scheduler — ✅ DONE

`send-reminders-hourly` cron job is confirmed active on the new project (`fguzpscguulkfctipeih`). `RESEND_API_KEY` is set, the Resend sending domain (`zothub.app`) is verified, and the sender address is `notifications@zothub.app` (updated from the shared `resend.dev` sandbox domain).

**Not yet confirmed:** whether the idempotency check (`reminder_logs` table lookups before each send — this logic already exists in `send-reminders/index.ts`) has been observed working in practice under the live cron job, and whether Supabase Auth's custom SMTP was pointed at Resend (optional item, for password-reset/magic-link emails specifically — separate from the `send-reminders` function).

**Verification still worth doing:** `select * from cron.job;` on the new project to confirm the schedule details; create a test event ~24h out with an RSVP and confirm exactly one reminder email arrives (not zero, not duplicates).

### C. DB-level UCI enforcement (Phase 1)
Client-side `@uci.edu` checks exist but are bypassable via direct API calls. Add a `BEFORE INSERT` trigger on `auth.users` (SECURITY DEFINER) rejecting non-`@uci.edu` emails (allow-list exceptions if needed for staff/partners). Keep the client-side check for fast UX feedback; DB is the source of truth.

**Verification:** attempt signup with a non-UCI email — rejected at the DB layer even if the client check is bypassed (e.g. via direct `supabase.auth.signUp` call in devtools).

### D. Cleanup & hardening (Phase 1, low-risk, do alongside B/C)
1. Fix the 26 ESLint errors surfaced by `npm run lint` — mostly `@typescript-eslint/no-explicit-any` in `StudentFeed.tsx`, `ClubFeed.tsx`; `no-case-declarations` in `supabase/functions/send-email/index.ts`; a `require()` import in `tailwind.config.ts`. None are runtime blockers, but they should be clean before calling this "done."
2. Run `supabase db pull` (part of Phase 0.7) and check for any RLS gaps on the newer tables (`waitlist`, and the new columns on `opportunities`/`events`/`rsvps`/`club_team_members`) — confirm policies exist and are scoped correctly (e.g., only admins can update `waitlist.status`; only the owning student can see their own `rsvps.answers`).
3. Re-check `.limit()` / `useMemo` usage on `Opportunities.tsx`/`Events.tsx`/`useMessages.ts` — some of this may already have landed with the recent work; verify before redoing it, only patch what's actually missing.

### E. QA pass on the full flow (Phase 2 — before calling it launch-ready)
The build compiles cleanly and the known blocker bug is fixed, but a full runtime walkthrough hasn't been done against a live Supabase instance since the recent burst of work landed. Walk these end-to-end on a Vercel preview deploy:
- **New-user flow:** signup → role select → OTP email → verify → waitlist "pending" screen → admin approves from `/admin` → user lands on the correct dashboard.
- **Club flow:** post opportunity (with custom form + app-count toggle) → receive application → review (question labels correct, resume downloadable) → bulk accept/reject → CSV export → student notified.
- **Student flow:** search/sort/filter opportunities → apply (resume prefilled) → track status → RSVP to event with a custom form → (if `requires_approval`) see pending state → get approved → Add-to-Calendar → cancel RSVP frees capacity.
- **Messaging & notifications:** team messaging (if wired to individual members), in-app notification badges update in real time, notification preferences save and are respected.
- **Admin flow:** approve/reject a waitlist entry, confirm the user is notified and unblocked/blocked accordingly.

**Verification:** each flow completes without console errors, without stuck loading states, and with the correct data ending up in the DB (spot-check via Supabase table editor).

---

## Known Issues (found during migration QA — not yet fixed)

Two bugs surfaced while smoke-testing the migrated app. Full detail (symptom, likely cause, desired behavior) is in `MIGRATION.md`'s Known Issues section — summarized here since they're now part of the engineering punch list:

1. **Student profile setup validation error.** Saving a profile with only a name filled in fails with the raw error `"Expected array, received null. Expected array, received null."` — `interests`/`skills` are being treated as required arrays in the validation schema. Fix: make them optional, normalize `null` → `[]`, and surface human-readable validation errors instead of raw schema error text.
2. **Orphaned/deleted user still shows as a club team member.** Root cause: `auth.users` was intentionally not migrated from Lovable Cloud (see `MIGRATION.md` Step 3), so `club_team_members` rows referencing the old Lovable Cloud auth UUID for a deleted test account now point at an ID with no corresponding row in the new project's `auth.users`. Fix: orphan-cleanup SQL pass, better `ON DELETE` cascade behavior on these FKs, and/or UI-level filtering to hide references to nonexistent users.

Neither blocks the migration itself — both are product/data-quality cleanup items for a future pass.

---

## Phase 5 (post-launch, explicitly deferred) — Comprehensive UI/UX revision

Per your instruction, a full design revision is **out of scope for the pre-launch build** and should happen after the app is live and you have real usage data. When you're ready to run it, scope should include:
- Design-system audit (are shadcn components used consistently? any one-off styling drift?)
- Full empty/loading/error state pass across every page (not just the light Phase-1-D fixes)
- Mobile-specific UX pass (the app is responsive but not mobile-optimized — small touch targets, dense forms)
- Accessibility audit (ARIA labels, keyboard nav, contrast)
- Visual refresh if desired (branding, typography, spacing system)
- Onboarding/empty-state polish informed by where real users actually drop off

This is intentionally not detailed further here — it should be scoped fresh, informed by post-launch analytics and user feedback, not planned blind before launch.

---

## Consolidated remaining schema/infra changes

| Change | Why | Risk |
|---|---|---|
| `vercel.json` SPA rewrite | Deploy blocker | none |
| Remove `lovable-tagger`, pick one lockfile | Clean deploy | none |
| `cron.schedule` jobs (reminders hourly, archive nightly) | Nothing currently fires the existing functions | Low — additive |
| `auth.users` BEFORE INSERT `@uci.edu` trigger | Security gap | Low — additive, test against existing rows first |
| RLS review on `waitlist` + new columns | Confirm no gaps introduced by recent work | Verify only, likely no change needed |
| ESLint cleanup (26 errors) | Code quality | None — no schema |

No large schema changes remain — the bulk of the schema work (RSVP forms/approval, app-count toggle, team display-order, waitlist) is already in place.

---

## Highest-risk items & ordering

1. ~~The site could go down without further notice at any time~~ — **RESOLVED.** Hosting has moved to Vercel and the backend to a self-owned Supabase project; no longer dependent on the lapsed Lovable subscription.
2. **DNS for `zothub.app` still needs to be re-pointed at Vercel via Name.com** — the one open item from Phase A. Resend's domain verification for `zothub.app` succeeded independently (via DNS records already added), so this is specifically about the *app-serving* DNS record(s), not email.
3. **`auth.users` was never migrated** — a deliberate decision, but it means any old `public.*` row referencing a Lovable Cloud auth UUID is now an orphaned reference. Known to affect `club_team_members` (see Known Issues); other tables with user-ID foreign keys should be checked too before assuming this is fully contained.
4. **Migration drift check** (Phase A.7) was never done in the originally-planned form (`supabase link`/`db pull`/`migration list`) — schema instead came from a `pg_restore` of a Lovable Cloud backup. Low urgency unless/until new migrations need to be pushed via the CLI, but worth reconciling before doing so.
5. **Confirm the access-model decision (gated vs. open)** before doing the full QA pass — it changes what "done" looks like for the new-user flow.
6. Everything else is additive/low-risk cleanup, not architecture change.

---

## Critical files

- `vercel.json` (new) — SPA rewrite, Phase 0
- `vite.config.ts`, `package.json` — remove lovable-tagger, pick one lockfile, Phase 0
- `src/integrations/supabase/client.ts` — env validation, Phase 0
- `supabase/functions/send-reminders/index.ts` — read closely for idempotency before scheduling, Phase B
- **new migration** in `supabase/migrations/` — `cron.schedule` jobs, Phase B
- **new migration** in `supabase/migrations/` — `auth.users` UCI trigger, Phase C
- `src/pages/admin/AdminDashboard.tsx`, `src/hooks/useWaitlistAdmin.ts` — your operational approval queue going forward
- `src/pages/Waitlist.tsx`, `src/pages/WaitlistRejected.tsx`, `src/pages/Signup.tsx` — the new-user gated flow to QA

---

## Suggested execution order

**Phase 0** (deploy migration) → **Phase 1** (scheduler + UCI trigger + cleanup, items B/C/D above, can run in parallel with each other) → **Phase 2** (full QA pass, item E) → **Launch** → **Phase 5** (UI/UX revision, post-launch, separately scoped). Ship a Vercel preview after Phase 0 so Phases 1-2 are verified against the real deploy target, not just localhost.
