# ZotHub — Build & Deployment Plan

> **Engineering execution doc.** This is what should drive the remaining build (Fable 5 / Claude Code). `prd.md` is the companion product spec (vision, users, journeys, metrics, launch ops) — read it for *why*, read this for *what's left and how*.
>
> **Reconciliation note (this revision):** A fresh audit of `main` (post-merge, post-PR#4) found the app is **far more complete than the previous version of this plan assumed**. Nearly all 22 originally-tracked features are implemented and wired, the "Unknown question" blocker is fixed, and a new **waitlist/admin-approval/OTP access-gate** has been built that wasn't in scope before. This revision reflects the *true* current state and narrows the remaining work to what's actually left.

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

**Key backend facts (re-audited):**
- Supabase project ref: `alpmifyiwwrkolixwyvz` (`supabase/config.toml`).
- `pg_cron` + `pg_net` extensions **are enabled** (migration `20260121010216`) but **zero `cron.schedule` calls exist anywhere** — no job is actually scheduled. `send-reminders` and `archive_past_events()` are both wired code with no trigger to run them.
- `.env` handling: re-verify it's untracked (`git ls-files | grep .env`) — this was flagged before and may or may not have been fixed since.
- No SPA rewrite config (`vercel.json`/`_redirects`) exists — required for BrowserRouter on Vercel/Netlify.
- `lovable-tagger` is still wired into `vite.config.ts` and `package.json`; three lockfiles coexist (`bun.lock`, `bun.lockb`, `package-lock.json`).
- UCI `@uci.edu` restriction is still **client-side only** (no DB-level trigger on `auth.users`).

---

## Why the site is still up, and why that won't last

You correctly observed that `zothub.app` is currently resolving and serving the live app even though the Lovable subscription has ended. This was worth verifying rather than assuming — here's what's actually true, based on Lovable's own documentation:

- **Custom domains are an explicitly paid-plan-only feature on Lovable.** Their own FAQ states that when a subscription lapses and the account drops to the free tier, the custom domain "reverts to pointing elsewhere (or expires)," and explicitly warns not to rely on continued custom-domain functionality without an active paid plan.
- **The site currently working is most likely a temporary grace-period or cancellation-timing artifact** (e.g., access typically continues until the end of the current billing period even after cancellation), **not a stable free-tier guarantee.** It could stop resolving/serving with no further warning.
- **Good news on domain control:** domains purchased "through Lovable" are actually registered with **Name.com** (Lovable facilitates the purchase; Name.com is the ICANN-accredited registrar of record) and connected to Lovable's hosting via **Entri**, an automated DNS-setup tool. This means **the domain registration itself is very likely independent of the Lovable subscription** — it's a separate Name.com service relationship. You are almost certainly *not* locked out of DNS control by the lapsed Lovable subscription; you just need to log into the Name.com account tied to the original purchase (check the email used at signup for a Name.com confirmation/welcome email) and update the DNS records there once Vercel is ready.

**Action for you before Phase 0:** log into your Lovable account and check Settings → Billing/Subscription for the actual state (fully downgraded already vs. still inside a paid period with an end date) — this tells you how much runway you actually have. Separately, confirm you can log into Name.com (or whatever shows as the registrar in a WHOIS lookup for `zothub.app`) — that account, not Lovable, is where DNS gets re-pointed in Phase 0 step 6.

**Bottom line:** it's fine that you haven't migrated yet — nothing is broken today — but this should not be deprioritized or treated as "not urgent because it's still working." Treat the current uptime as borrowed time, not a stable state, and complete Phase 0 promptly.

---

## Access model (confirm before building)

The app has been built out with a **waitlist-gated signup flow**: user picks role → verifies email via OTP (`send-otp`/`verify-otp` functions) → a `waitlist` row is created (`status: pending`) → an admin reviews and approves/rejects from `/admin` (`AdminDashboard.tsx`, `useWaitlistAdmin`) → approved users get full access; rejected users land on `/waitlist-rejected`.

This plan **assumes "gated now, open later"**: keep the waitlist/admin/OTP system for the beta launch (it gives you control over who's on the platform while validating), and treat "open @uci.edu signup" as a documented future toggle (disable the gate, keep OTP + DB-level `@uci.edu` enforcement as the sole gate). **If your intent was different — e.g. the waitlist was a stopgap you want removed before launch, or you want it permanent — say so and this section (plus the Phase 1 items below) should be adjusted.**

Operationally, this means: you (or another designated admin) must **check `/admin` regularly** to approve pending signups, or beta users are stuck waiting indefinitely. This replaces the old PRD's "manual club approval via SQL" — it's now a proper UI-driven approval queue for *both* students and clubs, and is a stronger foundation than what was originally planned.

---

## Remaining work (the real punch list)

### A. Deploy migration (do first — Phase 0)
1. Add `vercel.json` SPA rewrite (`{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`) — without this, refreshing any deep link (e.g. `/club/dashboard`) 404s on Vercel.
2. Remove `lovable-tagger` from `vite.config.ts` (plugin import + usage) and `package.json`.
3. Pick one package manager (recommend **npm**, matches `package-lock.json` and is Vercel's default); delete `bun.lock` and `bun.lockb`.
4. Verify `.env` is untracked (`git rm --cached .env` if not); add a fail-fast check in `src/integrations/supabase/client.ts` if `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` are missing.
5. Create Vercel project: framework preset Vite, build `npm run build`, output `dist`. Set env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) for Production + Preview.
6. Log into the **Name.com** account tied to the domain purchase (not Lovable) and point `zothub.app` (+ `www`) DNS at Vercel; remove the old Lovable/Entri-created A and TXT records once cut over.
7. `supabase login` → `supabase link --project-ref alpmifyiwwrkolixwyvz` → `supabase db pull` to catch any drift → `supabase migration list` to confirm local == remote **before pushing any new migration**.
8. Supabase Auth → URL config: Site URL `https://zothub.app`, redirect allow-list `https://zothub.app/**` + Vercel preview pattern. Update Google OAuth redirect URIs in Google Cloud Console.

**Verification:** `npm run build` succeeds locally; `https://zothub.app` loads; hard-refresh on `/opportunities` does not 404; Google + email/password login both land on the new domain; `supabase migration list` shows no drift.

### B. Wire the scheduler — the only functionally-missing piece (Phase 1)
The Edge Functions and DB functions exist; they're just never invoked automatically.
1. Create a migration adding `cron.schedule(...)` jobs:
   - **Event reminders / deadline reminders**: hourly job that calls `send-reminders` via `net.http_post`, passing a service-role/shared-secret bearer header.
   - **Auto-archive**: nightly job (`0 8 * * *`, ≈ midnight PT) that runs `archive_past_events()` directly in SQL (no HTTP needed — it's already a Postgres function).
   - Store the function URL + bearer token via Supabase Vault or a small `private.app_config` table so it isn't hardcoded into the migration.
2. Read `supabase/functions/send-reminders/index.ts` closely first — confirm what window/query it uses (e.g. "next 24h") and what idempotency check it does (does it check `notifications` or similar before sending, to avoid duplicate emails on every hourly run?). If idempotency is missing, add a guard before wiring the cron job, or you will spam users hourly.
3. Confirm Resend sending domain (`zothub.app`) has DKIM/SPF/DMARC verified, and that `RESEND_API_KEY` is set via `supabase secrets set` (not committed anywhere).
4. Optional but recommended: point Supabase Auth's custom SMTP at Resend so password-reset/magic-link emails aren't rate-limited by the default shared SMTP.

**Verification:** `select * from cron.job;` shows the jobs. Manually invoke `send-reminders` twice in a row — second call sends nothing new (idempotent). Create a test event ~24h out with an RSVP, wait for/trigger the cron, confirm exactly one email arrives with a working "Add to Calendar" link.

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

1. **The site could go down without further notice at any time** — Lovable's own docs say custom-domain hosting on a lapsed subscription is not something to rely on; the current uptime is very likely a grace-period artifact. Don't deprioritize Phase 0 because "it's still working."
2. **Migration drift check (Phase 0.7) before any new migration** — still the top engineering risk, unchanged from before.
3. **Confirm `send-reminders` has idempotency before wiring the cron job** (Phase B.2) — an hourly job with no dedup will spam users.
4. **DNS + Resend domain verification has propagation lag** — start early, in parallel with other Phase 0 work. Note DNS is managed via **Name.com** (the actual registrar), not Lovable directly.
5. **Confirm the access-model decision (gated vs. open)** before doing the QA pass — it changes what "done" looks like for the new-user flow.
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
