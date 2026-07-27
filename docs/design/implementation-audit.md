# ZotHub Redesign — Implementation Audit & Coverage Map

**Written:** 2026-07-25 · **Branch:** `redesign/implementation` · **Method:** read the code, not the docs.
**Purpose:** enumerate everything the live app does today, map each item against the design mocks, and
mark it into one of three buckets. This file is the contract: **everything that exists today survives**,
and every gap is closed deliberately, never silently.

- **A** — exists in the app, has a mock → straightforward re-skin.
- **B** — exists in the app, **no mock** → must still exist; design in-system by extending
  `component-library.html`. Anything beyond an obvious in-system placement needs maintainer sign-off.
- **C** — mocked but **no backend** → net-new; build only if the maintainer confirms scope, otherwise
  defer cleanly with the UI marking it not-yet-live. Never ship a dead button.

Sources read: `src/App.tsx`, all 30 `src/pages/**`, all 60 `src/components/**` (non-shadcn), all 14
`src/hooks/**`, `src/contexts/AuthContext.tsx`, `src/lib/**`, `src/types/index.ts`, `src/index.css`,
`tailwind.config.ts`, `index.html`, `supabase/functions/**` (names only — not modified).

---

## 0. Global facts that shape the work

| Fact | Where | Consequence |
|---|---|---|
| Theme is **hard-forced dark** | `App.tsx:46` `forcedTheme="dark"`, `index.html` `class="dark"` | The redesign is **light-default, both themes**. `forcedTheme` must go and a real toggle must exist. This is a behaviour change the design explicitly calls for (Foundation: "Light default, both themes genuinely designed"). |
| Tokens are **dark-only indigo/coral on Inter**, loaded from Google Fonts at runtime | `src/index.css:1–62` | Full rewrite to the spec; self-host Instrument Sans. |
| Tailwind maps to `hsl(var(--token))` | `tailwind.config.ts:47–95` | Token rewrite must keep the `--background`/`--foreground`/… shadcn contract **or** update every consumer. Chosen approach: keep shadcn's names as *aliases onto the new palette*, and add the ZotHub token set alongside. |
| ~~**Zero route-level code splitting**; recharts (411KB) is in the landing bundle~~ | ~~`App.tsx` imports all 30 pages eagerly~~ | ✅ **fixed in slice 11** — all routes `lazy()`, ClubAnalytics lazy-within-ClubHome, and the eager `manualChunks: {charts}` entry removed; recharts is no longer in the initial bundle. |
| Realtime subscriptions in 6 places | `useMessages`, `useNavigationCounts`, `useNotifications`, `useEventRSVP`, `StudentDashboard`, `ClubDetail` | Presentation-only changes — do not touch. |
| `useToast` (shadcn) **and** `sonner` both mounted | `App.tsx:48–49` | Two toast systems. Both must keep working; both get the new toast styling. |

---

## 1. Route inventory (complete — `src/App.tsx`)

| # | Path | Page | Guard | Layout | Bucket |
|---|---|---|---|---|---|
| 1 | `/` | `Landing` | public | `RoleBasedLayout` | **A** — v4 hero |
| 2 | `/opportunities` | `Opportunities` | public | `RoleBasedLayout` | **A** — Discover (pre-filtered) |
| 3 | `/opportunities/:id` | `OpportunityDetail` | public | `RoleBasedLayout` | **A** — student-apply step 2 |
| 4 | `/events` | `Events` | public | `RoleBasedLayout` | **A** — Discover (pre-filtered) |
| 5 | `/events/:id` | `EventDetail` | public | `RoleBasedLayout` | **B** — no event-detail mock |
| 6 | `/clubs` | `Clubs` | public | `RoleBasedLayout` | **A** — clubs directory |
| 7 | `/clubs/:id` | `ClubDetail` | public | `RoleBasedLayout` | **A** — claimed club page |
| 8 | `/login` | `Login` | public | none (split-screen) | **B** |
| 9 | `/signup` | `Signup` | public | none (split-screen) | **A/B** — firstrun step 1 covers club signup; role-picker + OTP are B |
| 10 | `/forgot-password` | `ForgotPassword` | public | none | **B** |
| 11 | `/privacy` | `Privacy` | public | `RoleBasedLayout` | **B** |
| 12 | `/unsubscribe` | `Unsubscribe` | public | `RoleBasedLayout` | **B** |
| 13 | `/waitlist` | `Waitlist` | auth-ish | none | **B** |
| 14 | `/waitlist-rejected` | `WaitlistRejected` | auth-ish | none | **B** |
| 15 | `/admin` | `AdminDashboard` | `AdminRoute` | none | **B** |
| 16 | `/club/feed` | ~~`ClubFeed`~~ → **redirects to `/opportunities`** | club | — | **retired** in the 4-destination nav; the page lost its only entry point, so (like `/student/feed`) it now redirects to public discovery. `ClubFeed.tsx`, `FeedCard`, `EmptyFeedState` deleted. |
| 17 | `/club/dashboard` | `ClubHome` (overview) | club | `ClubLayout` + `DashboardTabs` | **B** — IA says land on Responses, not a stats page |
| 18 | `/club/dashboard/opportunities` | `ClubHome` → `OpportunityManagement` | club | ↑ | **A** — Postings |
| 19 | `/club/dashboard/events` | `ClubHome` → `EventManagement` | club | ↑ | **A** — Postings |
| 20 | `/club/dashboard/applications` | `ClubHome` → `ApplicationReview` | club | ↑ | **A** — review queue |
| 21 | `/club/dashboard/rsvps` | `ClubHome` → `RSVPReview` | club | ↑ | **A** — same review impl (IA §5) |
| 22 | `/club/dashboard/team` | `ClubHome` → `TeamManagement` | club | ↑ | **B** |
| 23 | `/club/dashboard/analytics` | `ClubHome` → `ClubAnalytics` | club | ↑ | **B** |
| 24 | `/club/opportunities/new` | `CreateOpportunity` | club | `ClubLayout` | **A** — firstrun step 3 |
| 25 | `/club/events/new` | `CreateEvent` | club | `ClubLayout` | **B** |
| 26 | `/club/opportunities/:id/edit` | `EditOpportunity` | club | `ClubLayout` | **B** (same form as 24) |
| 27 | `/club/events/:id/edit` | `EditEvent` | club | `ClubLayout` | **B** (same form as 25) |
| 28 | `/student/dashboard` | `StudentDashboard` (→ Activity) | student | `StudentLayout` | **A** — Activity ✅ |
| 29 | `/student/feed` | *redirect* → `/opportunities?filter=following` | — | — | **B** — retired as a destination; page deleted, route kept so old links live ✅ |
| 30 | `/student/profile` | `StudentProfile` (view) | student | `StudentLayout` | **B** — no view mock; built in-system ✅ |
| 30b | `/student/profile/edit` | `StudentProfileEdit` | student | `StudentLayout` | **A/B** — edit-profile mock exists; skills/interests/resume are B ✅ |
| 31 | `/club/profile` | `ClubProfileSetup` | club | own header | **A/B** — firstrun step 2 covers most; banner/socials are B |
| 32 | `/club/messages` | `ClubMessages` | club | `ClubLayout` | **A** |
| 33 | `/student/messages` | `StudentMessages` | student | `StudentLayout` | **A** |
| 34 | `/notifications` | `Notifications` | student+club | `RoleBasedLayout` | **B** |
| 35 | `*` | `NotFound` | — | none | **B** |

### Broken route references found while auditing (pre-existing bugs)
| Ref | Where | Target | Result today |
|---|---|---|---|
| `/messages?to=<user_id>` | `ClubDetail.tsx:376` — "Message a team member" | no such route | → 404. **This is the student↔member messaging entry point** — see bucket C. |
| `/club/applications` | `NotificationCard.tsx:16,18` | no such route (`/club/dashboard/applications`) | → 404 on a club clicking an application notification |
| `/reset-password` | `ForgotPassword.tsx:35` `redirectTo` | no such route | Password-reset emails land on 404. **User-visible break.** |

### Dead code (routed nowhere, imported nowhere)
- `src/pages/Index.tsx` — Lovable scaffold placeholder ("Welcome to Your Blank App").
- `src/components/dashboard/DashboardLayout.tsx` — old sidebar using the retired `?tab=` scheme.
- `src/components/NavLink.tsx` — wrapper, zero consumers.
- `src/components/feed/FollowedClubsList.tsx` — **deleted in slice 7** along with `StudentFeed.tsx`;
  it had exactly one consumer. `FeedCard` and `EmptyFeedState` were kept for `ClubFeed` — but that
  page was retired in slice 11's parity pass (its nav entry was gone), so all three are now deleted.

---

## 2. Feature inventory by surface

Legend: ✅ = must survive. Every row below is a thing the app does today.

### 2.1 Auth & account (`AuthContext`, `Login`, `Signup`, `OTPVerification`, `ForgotPassword`, `ProtectedRoute`, `AdminRoute`, `useWaitlist`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| Email+password signup with **6-digit OTP** | `send-otp` → `verify-otp` edge functions; expiry countdown; resend; back | B |
| Role picker before signup | Student / Club cards; `?role=` deep-link skips it | B (firstrun mock starts *after* this) |
| **UCI email enforcement** | `@uci.edu` or `ADMIN_ALLOWED_EMAILS`; also DB-enforced | B |
| Password rules | ≥8 chars, confirm-match, show/hide toggle | B |
| Google OAuth (`hd=uci.edu`) | `signInWithGoogle(intendedRole)`; new OAuth users → waitlist + profile row + confirmation email | B |
| Auto sign-in after OTP | students auto-approved → `/student/dashboard`; clubs → `/waitlist` | B (Day-0 change — committed; `verify-otp` deployed v3 ACTIVE 2026-07-27) |
| Login + friendly error mapping | "Invalid login credentials" → plain English | B |
| Login redirect logic | `from` state → role dashboard → waitlist/rejected fallback for role-less users | B |
| Forgot password | UCI-email gated; success state; **`redirectTo` is broken** | B |
| Sign out | in every nav + waitlist pages | A (avatar menu) |
| Waitlist pending screen | email, role, requested date, **30s poll**, sign out | B |
| Waitlist rejected screen | shows `rejection_reason` if set | B |
| Route guards | `ProtectedRoute` (auth → waitlist status → role) and `AdminRoute` | B (loading states only) |

### 2.2 Discovery — Opportunities (`Opportunities.tsx`, `OpportunityCard`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| List active, non-expired opportunities | `is_active` + `deadline is null or >= now`, limit 50 | A |
| Text search | title + club name | A |
| Category filter | All · **Saved** · Leadership · Project · Internship · Volunteer · Committee · Other | A |
| Sort | Newest · Deadline approaching · Most popular | **B** (no sort control in the mock) |
| Bookmark toggle per card | optimistic; idempotent on 23505 | A |
| "Applied" state on card | from the student's own applications | A |
| Applicant count | gated by `show_application_count` | A |
| Results count line | "Showing N opportunities" | A |
| Loading skeletons (6) | card-shaped | A |
| Empty state, two copies | "none posted yet" vs "adjust your filters" + Clear filters | A |
| ⚠️ `normalizeOpportunityType()` coercion | `committee`/`other` are silently rendered as **volunteer** (`formatters.ts:72`) | **Fix** — Structure §3 says delete the coercion, support all six |

### 2.3 Discovery — Events (`Events.tsx`, `EventCard`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| List upcoming active events | `event_date >= now`, limit 50 | A |
| Text search | title + club | A |
| Date filters | All · **Saved** · This Week · This Month · Upcoming | A (as chips) |
| Banner image, date badge, time, location | card | A |
| Attendee/capacity bar | `attendees/capacity` + progress | **B** (no capacity meter in the mock) |
| Bookmark, skeletons, empty states | as above | A |

### 2.4 Opportunity detail (`OpportunityDetail.tsx`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| **View tracking** | `useTrackView('opportunity')` → `track_page_view` RPC w/ session id | A (invisible) |
| Anon-safe column selection | `application_questions` requested only when logged in | A |
| Club logo/name → club page | header | A |
| Type badge, applicant count, posted date | header meta | A |
| Deadline alert card | open vs **Applications Closed** (`border-l` accent/destructive) | A |
| Apply / Already Applied / Deadline Passed | tri-state primary button | A |
| Bookmark toggle | filled when saved | A |
| **Share** | dropdown: copy link · Twitter · LinkedIn · email; native share on mobile-icon | **B** |
| Description + Requirements sections | `whitespace-pre-wrap` | A |
| **Application questions preview** | "You'll answer N question(s)" + numbered list w/ required `*` | **B** |
| About-the-club sidebar card | logo, description, View Club, website | A |
| "Ready to Apply?" CTA card | students only | A |
| Logged-out CTA card | "Log In to Apply" | A |
| Not-found + loading states | skeleton, then redirect w/ toast | A |

### 2.5 Application flow (`ApplicationForm`, `DynamicQuestionForm`, `SuccessModal`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| Modal apply form | scrollable, cancel/submit | A |
| **Resume: auto-attached from profile**, replaceable per application | `FileUpload` to `student-resumes`, ≤10MB, pdf/doc/docx; explanatory hint text | **B** — the one example the brief named |
| Dynamic questions | short_text · long_text · single_choice · multiple_choice; required validation; per-field errors clear on type | A |
| Zod validation + `sanitizeText` | before insert | A |
| Duplicate guard | `23505` → "You have already applied" | A |
| Confirmation email to student | `sendApplicationConfirmation` (pref-gated server-side) | A |
| Club notification email | `sendNewApplicationNotification(applicationId)` after confirmed insert | A |
| Success modal | "View My Applications" / "Browse More Opportunities" | A |
| Guard: no student profile | "Please complete your student profile first" | A |

### 2.6 Event detail + RSVP (`EventDetail`, `useEventRSVP`, `RSVPForm`, `AddToCalendarButton`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| Banner, date/time/location/attending card | | **B** |
| Capacity + **spots left** | derived from confirmed RSVPs | B |
| RSVP / Cancel RSVP toggle | disabled when full | B |
| **Requires-approval** path | status `pending`; "Awaiting approval" panel | B |
| RSVP question form | modal, same dynamic engine | B |
| **Re-RSVP after cancel** | `upsert` on `(event_id,student_id)` — deliberate, load-bearing | B |
| DB capacity guard surfaced | "full capacity" error mapped to plain copy | B |
| **Realtime RSVP status** | club approves → student's page updates live | B |
| **Add to Calendar** | .ics download + Google/Outlook/Yahoo links | **B** |
| Share button | | B |
| Bookmark | | B |
| Event Ended state | past events | B |
| Role guards | "Clubs cannot RSVP"; logged-out → "Log in to RSVP" | B |

### 2.7 Clubs directory + club page (`Clubs.tsx`, `ClubDetail.tsx`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| Directory via `get_all_clubs_public` RPC | + live per-club opportunity/event counts | A |
| Search (name + description) | | A |
| Category filter | ⚠️ hard-coded 9-item list that **does not match** `CLUB_CATEGORIES` (17 items) — most categories are unfilterable | **Fix** — Structure §3 curated set |
| Sort | Name A–Z · Z–A · Most active | B |
| Card: logo, category badge, description, counts, social icon links | | A |
| Club page: banner, logo, name, category, description | | A |
| Activity stats | open opportunities / upcoming events | A |
| **Follow / Following** (students) | stored as a `bookmarks.club_id` row | A |
| **Contact Club** dialog | students only; inserts a message to the club owner | A |
| Social links | website · LinkedIn · Instagram · Discord (custom SVGs) | A |
| **Team section** | active members, role, ordered by `display_order`, **realtime-subscribed** | A (members preview) |
| **Message a team member** | icon button → `/messages?to=` → **404 today** | **C** |
| Open opportunities + upcoming events lists | with deadlines / dates → detail links | A |
| Empty + not-found states | | A |

### 2.8 Student dashboard (`StudentDashboard.tsx`) → becomes **Activity**

| ✅ Feature | Detail | Bucket | Where it landed (slice 7) |
|---|---|---|---|
| 4 stat tiles | Applications · Following (→ feed) · Messages (→ messages) · Notifications (→ notifications) | B (mock has no stat tiles) | **Dropped as tiles.** Applications/Following are tab counts; Messages and Notifications already live in the nav on every page, so the tiles were duplicate navigation, not information |
| Recent applications (5) | title, club, **status badge**: pending/reviewed/accepted/rejected | A | Applications tab — **the full list**, `StatusBadge audience="student"` |
| Upcoming RSVP'd events (5) | date/time, links to event | A | Going tab — full list, **plus the RSVP status** it never showed |
| **Saved opportunities** (5) | non-expired only | B | Saved tab → Roles |
| **Saved events** (5) | future only | B | Saved tab → Events |
| Realtime unread-notification count | | A | Kept — `useNavigationCounts` already subscribes to the same table for the nav bell, on *every* student page. The dashboard's own duplicate channel is gone; the count is still realtime |
| Per-panel empty states with a next action | | A | One per tab, in the shared `EmptyState` |

### 2.9 Student feed (`StudentFeed.tsx`) + `FeedCard`, `FollowedClubsList`, `EmptyFeedState`

| ✅ Feature | Detail | Bucket | Where it landed (slice 7) |
|---|---|---|---|
| Merged opportunities+events **from followed clubs**, newest first | | B → becomes a Discover "Following" filter (IA §2) | **Following** chip on Discover *and* on Events. Same cards, same sort, same actions as the rest of discovery |
| Followed-clubs avatar strip with hover **Unfollow** | tooltip | B | Activity → **Following** tab. Unfollow is a real labelled button on a 44px row, not a hover-only affordance |
| Tabs: All / Opportunities / Events | | B | Redundant once the feed is a filter: Discover *is* roles, Events *is* events |
| Two distinct empty states | "no clubs followed" vs "no activity" | B | Both kept — "not following anyone yet" lives in Activity → Following; "your clubs have nothing open" is the Following filter's empty state on each surface |
| Page transition animations | `PageTransition` / `SlideUp` (framer-motion) | B | Not carried over; no other redesigned screen uses page-level entrance animation, and the motion spec reserves movement for state changes the user caused |

### 2.10 Club dashboard (`ClubHome`, `DashboardTabs`, `StatsCard`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| 7 dashboard tabs w/ **pending counts** on Applications + RSVPs | horizontally scrollable | A (nav) / B (7→4 items) |
| Overview: 4 stat cards | Total views · Applications · Active opportunities · Upcoming events | B |
| Overview: recent opportunities (3) + upcoming events (3) | apps/views/RSVP counts, → edit | B |
| "New Opportunity" / "New Event" buttons | | A |

### 2.11 Postings management (`OpportunityManagement`, `EventManagement`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| Opportunities **table**: title, created, type badge, status badge, deadline, views, applications, ⋯ menu | | A |
| Derived status | `draft` (inactive) / `closed` (past deadline) / `active` | A |
| Search + status filter | All/Active/Closed/Draft | A |
| Row actions | View · Edit · **Delete** (confirm: "will also delete all applications") | A |
| Events **card list**: title, status, date, time, location, RSVPs, capacity, views, **capacity bar** | | A |
| Event status | draft / past / **ongoing** (today) / upcoming | A |
| Event search + filter + row actions incl. delete-confirm | | A |
| Empty states with "create your first…" | | A |

### 2.12 Review — Applications (`ApplicationReview.tsx`) — the differentiator

| ✅ Feature | Detail | Bucket |
|---|---|---|
| List all applications across the club's opportunities | joined to opportunity + student | A |
| Search | name, email, opportunity title | A |
| Filter by opportunity (dropdown) | | A |
| Filter by status | all/pending(count)/reviewed/accepted/rejected | A |
| **Bulk select** incl. select-all | | A |
| **Bulk accept / reject** + Clear | | A |
| **CSV export** — selection-aware, with dynamic per-question columns | `csvExport.ts` | **B** |
| Row: avatar initials, name, status badge, major • year, opportunity, applied date | | A |
| Row quick actions | **Resume** (signed URL via `openFileUrl`), ✓ accept, ✗ reject (pending only) | A |
| Detail dialog | email, major, year, applied date, resume link, **all Q&A**, status, accept/reject footer | A |
| Status emails on accept/reject | `sendApplicationStatusUpdate` (non-blocking) | A |
| Empty states (no applications vs no matches) | | A |
| ⚠️ `reviewed` is filterable but **never settable** | Structure §4: "`reviewed` becomes reachable" | **Fix** |

### 2.13 Review — RSVPs (`RSVPReview.tsx`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| Same shape as applications: search, event filter, status filter, bulk, CSV, detail dialog | | A (IA §5: **one** review implementation) |
| Confirm / Cancel actions | pending only | A |
| **0-rows-changed detection** | `.select("id")` after update — catches RLS-silent failures; do not remove | A |
| Capacity error mapping | "full capacity" → plain copy | A |
| Emails only for rows that actually changed | `sendRSVPStatusEmail` | A |
| Pending-RSVPs notice banner | "You have N pending RSVPs awaiting approval" | A |

### 2.14 Create / edit posting (`CreateOpportunity`, `EditOpportunity`, `CreateEvent`, `EditEvent`, `ApplicationQuestionsBuilder`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| Opportunity fields | title*, type* (6 values), description, requirements, deadline (datetime-local), publish toggle, **show application count** toggle | A (partly) |
| Event fields | title*, description, date/time*, location, capacity, **banner upload**, publish toggle, **requires approval** toggle | B |
| **Question builder** | 4 question types, add/reorder ↑↓/delete, expand-to-edit, options add/remove (min 2), placeholder, required switch, empty state | **B** |
| Save as Draft (secondary submit) | forces `is_active:false` | A |
| Zod validation + field errors + toast summary | | A |
| Success modal | "View Dashboard" / "Create Another" (resets the form) | A |
| Guard: missing club profile | "Club profile not found. Please complete your club profile first." | A |
| Edit: prefill, "Published" toggle wording, update path | | B |

### 2.15 Team management (`TeamManagement`, `useClubTeam`, `useTeamInvitations`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| Add member by email + name + role (datalist of 8 suggestions) | duplicate-email guard | **B** |
| Status badges | pending / active / inactive / declined | B |
| Change role dialog | | B |
| Remove member (confirm) | | B |
| **Reorder** ↑↓ (`display_order` swap) | drives the public club page order | B |
| Invitation accept/decline **from the notifications page** | writes back a confirmation notification | B |
| Invited-at date | | B |

### 2.16 Analytics (`ClubAnalytics`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| KPI cards | total views · club profile views · applications · RSVPs · **conversion rate** | **B** |
| Views over time (7d) area chart | from `page_views` | B |
| Opportunity performance bar chart (views vs applications) | | B |
| Application status donut | | B |
| Event RSVPs bar chart | | B |
| Top performing listings | views, conversions, rate | B |
| ⚠️ Chart colours are **hard-coded HSL literals** | ignore the theme entirely — unreadable in one of the two themes | **Fix** (tokenise) |

### 2.17 Messaging (`MessagesContainer`, `ConversationList`, `MessageThread`, `MessageComposer`, `useMessages`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| Conversation list grouped by partner, newest first | | A |
| Partner resolution student↔club | `useProfileLookup` **batched** (N+1 already fixed) | A |
| Unread counts per conversation + auto mark-read on open | | A |
| Thread bubbles sent/received + day-aware timestamps | Today / Yesterday / date | A |
| **Delete own message** (hover, confirm dialog) | | **B** |
| Composer: auto-resize, Enter=send, Shift+Enter=newline, hint line | | A |
| **Realtime inbound messages** incl. brand-new conversations | | A |
| Mobile list→thread collapse with back button | | A |
| Empty states: no conversations / no thread selected / new empty thread | | A |
| Contact-club dialog reuses the composer | | A |

### 2.18 Notifications (`Notifications.tsx`, `useNotifications`, `NotificationCard`, `TeamInvitationCard`, `NotificationPreferencesDialog`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| List (50), unread badge, All/Unread tabs | | **B** |
| Per-type icons | application_update · new_message · event_reminder · deadline_reminder · team_invitation | B |
| Deep links per type | ⚠️ `/club/applications` is a **dead link** | B + fix |
| Mark read / unread / delete (hover actions) | | B |
| Mark all read · **Clear all** (confirm) | | B |
| **Team invitations inline**: Accept / Decline, then Accepted/Declined badge | | B |
| **Preferences dialog — 6 switches** | application_updates · event_reminders · new_messages · deadline_reminders · new_post_notifications · team_invitations | **B** (brief called these out) |
| Realtime refresh | | B |

### 2.19 Profiles

**Student** (`StudentProfileSetup.tsx`) — full name, major, year (6 options), expected graduation date,
**skills** (add/remove + 10 suggestions), **interests** (add/remove + 10 suggestions), **resume upload**,
LinkedIn, GitHub, portfolio. Zod-validated, `sanitizeText`, **upsert** on `user_id` (deliberate — a plain
update silently no-ops if the row is missing). → **A** for the frame, **B** for skills/interests/resume/links.

**Club** (`ClubProfileSetup.tsx`) — club name*, category (17), description, **logo upload** (≤2MB),
**banner upload** (≤5MB), website, Instagram, Discord, LinkedIn. Same upsert reasoning. → **A** for
name/category/description, **B** for banner + the four socials.

### 2.20 Admin (`AdminDashboard`, `useWaitlistAdmin`)

| ✅ Feature | Detail | Bucket |
|---|---|---|
| Stats: total / pending / approved / rejected | | **B** |
| Table: email, role, status, requested date | | B |
| Search by email + status filter + role filter + refresh | | B |
| **Approve** → inserts `user_roles` row + emails the user | | B |
| **Reject** with optional reason → emails the user | | B |
| Delete entry (`window.confirm`) | | B |
| Admin-only header + sign out | | B |

### 2.21 Cross-cutting components

`Logo` (anteater-Z SVG + "otHub.") → replaced by the italic-hub wordmark (**A**) ·
`ShareButton` (**B**) · `AddToCalendarButton` (**B**) · `SuccessModal` (**A**) ·
`FileUpload` — image and file variants, size guard, preview, replace, remove (**B**) ·
`ErrorBoundary` with dev stack trace (**B**) · `PageLoader` (**A**) ·
`PageTransition`/`SlideUp` (**B**) · `NotFound` (**B**) · `Privacy` long-form legal page (**B**) ·
`Unsubscribe` — 6 preference switches + `?type=` auto-opt-out (**B**) ·
shadcn `ui/*` (48 files) — re-tokened wholesale, not rebuilt.

---

## 3. Bucket C — mocked, no backend

| Item | Mock | Backend today | Note |
|---|---|---|---|
| **student ↔ member messaging** | `component-library.html` §09 (MEMBER role chip), `direction-11-v4-clubs.html` (message-a-member on the club page), `more-screens` Messages | Partial: `messages` table is generic `sender_id/receiver_id`, and `club_team_members.user_id` exists, so a member DM would **work** — but the only entry point (`ClubDetail.tsx:376`) navigates to `/messages?to=`, **a route that does not exist**, and no page reads a `?to=` param. | Smallest real gap in the whole audit: a route + a `?to=` handler. No schema change. |
| **ZotSpot seed / claim flow** | `direction-11-v4-clubs.html` — unclaimed cards, claim banner, source attribution | **None.** No `claimed`/`source` columns, no scraper, no claim mutation. | Genuinely net-new; needs schema + RLS ⇒ outside "re-skin, don't rebuild". |

---

## 4. Maintainer decisions — **settled 2026-07-25**

1. **Bucket C → member DMs only; ZotSpot deferred.** Register a `/messages` route that reads
   `?to=<user_id>` and opens that thread. No schema, no RLS, no edge functions — `messages` and
   `club_team_members.user_id` already support it; this closes a live 404. ZotSpot claim UI ships
   visually but **clearly marked not-yet-live, with no dead buttons**.
2. **Nav collapses to 4 per role; extras relocate.** Student `Discover · Clubs · Activity · Messages`
   — **Feed becomes a "Following" filter on Discover**. Club `Postings · Responses · Messages · My Club`
   — **Analytics and Team move inside My Club**. Nothing lost; three things stop being one click away.
3. **Club dashboard lands on Responses.** `/club/dashboard` renders the review queue. The four stat
   cards and the recent-items lists **move into My Club** — not deleted.
4. **Pre-existing bugs get fixed in the relevant slice** (3 broken routes, `normalizeOpportunityType`
   coercion, club-category mismatch, unsettable `reviewed`, hard-coded chart colours), each noted here
   and in the final written pass.

---

## 5. Deploy status (updated 2026-07-27)

- `supabase/migrations/20260723000100_drop_self_insert_user_roles_policy.sql` — closed a **live
  privilege-escalation hole** (`user_roles` self-insert let any authenticated user grant themselves
  `admin`). ✅ **Applied to the linked production database** (maintainer-confirmed). Correction to
  the earlier note: it **only drops the unsafe policy — it deletes no `user_roles` rows and destroys
  no evidence**. A read-only post-hoc admin-role audit (`scripts/audit_admin_roles.sql`) **remains
  outstanding** until the maintainer runs it and reviews the results.
- Day-0 auth changes (`verify-otp` auto-approve + `Signup.tsx` auto sign-in) are committed, and
  ✅ **`verify-otp` is deployed and ACTIVE (Version 3)** (maintainer-confirmed).
- Test Club seed data still live in production (open — see `docs/LAUNCH-BACKLOG.md` D1).

---

## 6. Slice plan (execution order)

| # | Slice | Covers | Status |
|---|---|---|---|
| 0 | Audit + coverage map | this file | ✅ done |
| 1 | Token layer | `src/index.css`, `tailwind.config.ts`, self-hosted Instrument Sans, `forcedTheme` dropped | ✅ **done — verified** |
| 2 | Primitives | button, input, textarea, select, checkbox, radio, switch, badge, card, dialog, alert-dialog, dropdown, tabs, toast ×2, skeleton, avatar (circle/square split) | ✅ **done — verified** |
| 3 | Shared app furniture | nav (desktop bar + mobile tab bar), avatar menu, logo/wordmark, theme toggle | ✅ **done — verified** (student + club nav) |
| 4 | Discovery | Landing, Discover (cards↔list), opportunity + event detail | ✅ **done — verified end-to-end** |
| 5 | Apply + RSVP | forms, dynamic questions, resume, success | ✅ **done — verified end-to-end** |
| 6 | Clubs | directory, club page, follow, contact | ✅ **done — verified** |
| 7 | Student side | Activity, saved, feed-as-filter, profile view + edit | ✅ **done — verified** |
| 8 | Club side | Postings, Responses (both reviews), create/edit, questions builder, team, analytics, my club | ✅ **done — verified** (both themes, 0 contrast / 0 unlabelled; `/club/dashboard`→Responses, `ClubSectionNav` sub-tabs, `StatusBadge audience="club"`, reviewed-unsettable fixed, chart colours tokenised) |
| 9 | Messages | inbox, thread, composer, member chip | ✅ **done — verified** (club side both themes, 0/0; accent-sent/grey-received bubbles, `EntityAvatar`, `?to=` handler closes the student↔member dead link, MEMBER chip + club header link; student view shares the container, chip code-verified pending a real member) |
| 10 | Edges | notifications + prefs, admin, waitlist ×2, auth ×4, privacy, unsubscribe, 404, error boundary | ✅ **done — verified** (both themes, 0/0 on the accessible set; `/reset-password` route added, NotificationCard dead link fixed, password-eye + all switch/icon buttons labelled, NotFound redesigned, off-palette colours tokenised, unread-notification wash→left-bar contrast fix; Waitlist ×2 + Admin code-verified only) |
| 11 | Route splitting + AA sweep + written pass | | ✅ **done** — all routes `lazy()` + `Suspense` (Landing eager); recharts removed from the eager `manualChunks` so it folds into the on-demand ClubAnalytics chunk; production build confirms recharts is no longer preloaded / statically imported by the entry, and the Analytics tab lazy-loads + renders at runtime |

### Slice 1 — what landed, and how it was verified

**Changed:** `src/index.css` (full rewrite), `tailwind.config.ts` (full rewrite), `src/App.tsx`
(`ThemeProvider`), `index.html` (pre-paint theme script), `public/fonts/*` (4 new woff2),
9 shadcn files (hover-surface `accent` re-pointed), `src/components/ui/chart.tsx` (dark selector).
**Not changed:** any query, mutation, hook, route, RLS, edge function or cron.

- **Colour is stored as HSL triplets, not hex.** Tailwind alpha modifiers (`bg-accent/10`,
  `border-bad/30`) are used in ~70 places today and silently break against raw `var()` colours.
  Every triplet was generated from the mock's hex and **verified to round-trip to the identical
  hex**, so the AA ratios measured during design carry over untouched.
- **`--accent` collision, resolved.** shadcn's `--accent` is its neutral menu-hover surface; ZotHub's
  is the brand blue. Left alone, every dropdown row would have lit up Pacific blue. The 26 shadcn
  hover usages across 9 files now point at `surface-3`; the ~70 app usages keep meaning brand.
- **Theme.** `forcedTheme="dark"` removed — the light theme was previously unreachable. `data-theme`
  on `<html>`, light default, pre-paint script so there is no flash.
- **Instrument Sans self-hosted**, 4 woff2 (88KB on disk; ~62KB fetched — latin-ext is
  unicode-range gated), `font-display: swap`. The **real italic** was confirmed by rendering `hub`
  to canvas in both styles and diffing: 2,889 differing pixels. (Its advance widths are identical to
  the roman — Instrument's italic is metric-compatible — so width measurement alone is a false
  negative here.)
- **Fixed in passing:** `.safe-area-bottom` was referenced by both mobile tab bars but never
  defined, so the bar sat under the home indicator on notched phones.

**Measured in the running app** (`/`, viewport 1440), tokens read back from `getComputedStyle`:

| | light | dark |
|---|---|---|
| token values matching the mock hex | 18/18 | 20/20 |
| 1.4.3 text contrast failures | **0** | **0** |
| 1.4.11 control-boundary failures | **0** | **0** |
| unlabelled interactive controls | **0** | **0** |
| 2.5.5 targets under 44×44 | 16 | 16 |

The 16 target misses are all un-reskinned markup (nav links and buttons at 32–40px); Button gets its
44px floor in slice 2 and the landing page is rebuilt in slice 4.

*Auditor note:* contrast must be sampled **after** transitions settle. Measuring in the same tick as
a theme flip reads cards mid-fade and reports phantom failures (it briefly showed 13).

### Slice 2 — what landed, and how it was verified

**Changed:** `button`, `badge` (+ new `Tag`), `input`, `textarea`, `checkbox`, `switch`, `card`,
`skeleton`, `avatar`, `select`, `popover`, `dropdown-menu`, `context-menu`, `menubar`, `command`,
`hover-card`, `dialog`, `alert-dialog`, `tabs`, `progress`, `toast`, `sonner`.
**New:** `src/lib/status.ts`, `src/components/ui/status-badge.tsx`.
**Not changed:** any query, mutation, hook, route, RLS, edge function or cron.

- **Buttons are pills with a 44px floor.** Two primary verbs, deliberately: `default`/`accent`
  (Pacific blue — the action that demands it, plus marketing CTAs) and **`ink`** (the in-app primary
  verb in dense lists, so blue stays scarce and status stays legible). `sm` is the one exception —
  34px on a precise pointer, back to 44 under `(pointer: coarse)`.
  *On the documented hover bug:* in plain CSS `.btn:hover` (0-2-0) outranks `.btn-acc` (0-1-0) and
  swaps its fill for grey, making light labels vanish. CVA sidesteps it — variants emit their own
  hover into one flat class string, so there is no specificity contest. Nothing was needed beyond
  not re-introducing a base hover.
- **One shared status map** (`lib/status.ts`) now backs every workflow — applications, RSVPs,
  postings, events, team, waitlist. **Database values are untouched**; this is presentation only.
  It is audience-aware because the same row means different things to the two sides: `pending` reads
  **"New"** in the club's queue (it demands action) and **"Applied"** to the student (calm, factual);
  `rejected` reads **"Declined"** to the club and **"Not selected"** to the student.
- **Avatars: shape = kind.** People are circles, clubs are rounded-squares, and the square radius is
  a *percentage* so it scales with the avatar and a logo never reads as a nested card. Full fallback
  chain in `EntityAvatar` (photo → initials on a name-hashed colour → glyph), plus the unclaimed
  (dashed) variant for ZotSpot seeds and an `AvatarCluster` with `+N`. All 12 hash colours were
  measured against white: worst 5.18:1.
- **Toasts are a dark panel pill in both themes** — a toast should read as floating over the page,
  not as one more card that happens to be on top.
- **Touch targets on switches and checkboxes** are padded to 44px with a transparent `::before`,
  so they clear 2.5.5 without changing how large they look.

**Measured** (`/signup` and `/opportunities`, both themes, real pixels):
text-contrast failures **0**, control-boundary failures **0**, in both themes on both pages.
Remaining target-size and label misses all sit in un-reskinned screen markup (see defects below).

### Slice 3 — what landed, and how it was verified

**Changed:** `Logo`, `Navbar`, `PublicLayout`, `StudentTopNav`, `StudentBottomNav`, `ClubTopNav`,
`ClubBottomNav`, `StudentLayout`, `ClubLayout`, `App.tsx` (enableSystem), `index.html` (theme script).
**New:** `nav/navConfig.ts`, `nav/TopNav.tsx`, `nav/TabBar.tsx`, `nav/AccountMenu.tsx`,
`ThemeToggle.tsx`, `hooks/useAccountIdentity.ts`.
**Not changed:** any query, mutation, hook, route, RLS, edge function or cron.

- **Wordmark** is font-rendered: `zot` upright in ink, `hub` in true italic `--accent-text`,
  tracking −0.045em. Outlined SVG favicon/app-icon set still owed before launch.
- **Nav is four destinations per role**, with **one active language** — an accent bar on the bottom
  edge of the desktop bar and the top edge of the mobile tab bar. Desktop is text-only; Lucide icons
  are tab-bar-only, so blue stays scarce.
- **The Responses count is now pending applications + pending RSVPs.** Responses is one queue over
  both (Structure §5); previously only applications were counted, so a club with pending RSVPs saw
  no badge at all. Same queries as `ClubHome` already ran — no new wiring pattern.
- **Theme control** lives in the account menu (Light/Dark/System, `role="radiogroup"`), with an
  icon button in the public nav for logged-out visitors. Verified end-to-end: click → `data-theme`
  flips → persisted to `localStorage` → pre-paint script honours it on reload.
- **`useAccountIdentity`** reuses the existing cached `useProfileLookup` resolver rather than adding
  another profile query, so the nav avatar is a real person/club, not an email initial.

**Measured** on `/student/dashboard` signed in, account menu open, both themes:
**0 text-contrast · 0 control-boundary · 0 target-size · 0 unlabelled.**

Fixed during verification: menu rows and the theme control were 34–36px (raised to 44); nav links
and the wordmark were under 44 wide (padded); the theme control overflowed the 240px menu and clipped
"System" (menu widened to 272px).

**Tooling notes for whoever picks this up** — both cost real time:
1. **Pointer clicks in the in-app Browser pane are coordinate-scaled** (~2.9× at a 1440 viewport), so
   they land far off-target; `elementFromPoint` says the button is there while the dispatched event
   lands on `<html>`. Drive Radix components by focusing the element and dispatching a `keydown`
   instead — which doubles as keyboard-accessibility evidence.
2. **Never read DOM attributes in the same tick you dispatch an event.** React has not flushed yet,
   so `aria-expanded` still reads `false` on a menu that is already open. This looked like a broken
   component for several rounds; the React fiber's `data-state` said `open` the whole time.

### Slice 4a — Discover + Events

**Changed:** `pages/Opportunities.tsx`, `pages/Events.tsx`, `cards/OpportunityCard.tsx`,
`lib/formatters.ts`. **New:** `discover/ViewToggle.tsx`, `discover/FilterChip.tsx`,
`discover/DiscoverList.tsx`, `discover/EmptyState.tsx`.
**Not changed:** every query, filter, sort and bookmark handler is byte-for-byte the original.

- **One card anatomy for roles and events.** Avatar-card layout — the tile is its own left column;
  title / club / meta / tags / footer share one aligned right column, so left edges match and
  footers line up across a row. The tile is the only differentiator: a square club logo for a role,
  a **mono date chip** for an event. Different time semantics via typography, not a second hue.
- **Tags have a dedicated slot**, so a card with "Closing soon" and one without are identical and
  a long title is never squeezed.
- **The type-coercion bug is fixed.** `normalizeOpportunityType()` used to fold anything
  unrecognised into `volunteer`, so every Committee and Other posting advertised itself as
  Volunteer *and* was unreachable by filter. Verified by exercising the function in the browser:
  `committee`→committee, `other`→other, `COMMITTEE`/`" Other "` normalise, unknown→`other`.
  The category chips now list all six real types instead of four.
- **Cards ↔ List**, persisted per surface. List is the club-grouped power view: grouping rides on a
  **surface**, not the 1.23:1 hairline that used to be the only cue, with fixed grid tracks so
  columns align no matter which action a row shows.
- **In-app primary verb is `ink`, not accent** — a grid full of blue Apply buttons would leave
  nothing for "demands action now" to mean.
- **Empty states describe the query, not the product's stage**, and always offer a next action.
- Fixed here: the unlabelled 28px bookmark button (now a labelled `aria-pressed` control) and the
  placeholder-only search (now has a real `<label>`).

**Measured** on `/opportunities`, cards and list, both themes:
**0 text-contrast · 0 control-boundary · 0 unlabelled.**

*On target sizes:* the sub-44px controls that remain are the documented **non-touch compact**
exception in design-system §4 ("min 44px height; 34px `-sm` on non-touch, 44px on touch"). Verified
the `@media (pointer: coarse)` rules actually compile into the stylesheet and resolve to 44px —
they measure 36–38px here only because this desktop reports `pointer: fine`.

*Auditor fix:* stretched links (`after:absolute after:inset-0`) must be measured by their positioned
ancestor. Measuring the anchor's own inline box reports a full-row target as 23px — a false failure
that appears on every card and list row.

### Slice 4b — opportunity detail + Landing

**Changed:** `pages/OpportunityDetail.tsx`, `pages/Landing.tsx`.
**Not changed:** `useTrackView`, `useBookmarks`, the anon-safe conditional column select,
`checkExistingApplication`, `ApplicationForm`, `ShareButton`, `SuccessModal` — all preserved.

**Opportunity detail.** Two-column layout with the about-the-club mini-card; the deadline callout is
keyed to state (accent = act now, `--bad` = the door is shut, neutral = rolling). "What you'll be
asked" previews the questions *before* you start. The apply CTA carries the privacy line from the
mock — "They see your name, year and major — nothing else from your profile."
Verified end-to-end against real data: the apply modal opens with **the resume auto-attached from
the profile** (the bucket-B feature the brief named), and a closed posting correctly shows
"Applications closed" plus "Applied". Nothing was submitted — that would write to production.

**Landing.** v4 hero: baked two-axis scrim, white headline tipping into the italic accent phrase,
and **live counts only** — the fabricated "200+ clubs / 10K+ students" is not coming back, and the
counts read correctly at 0 and 1 (`1 club`, not `1 clubs`), which is where they actually live today.
The two-sided cards bridge the hero's lower edge as fixed registers: `.ctx-dark` club card and
`.ctx-light` student card, so **the opposition survives in dark mode** (W4) and each carries a
complete alias set rather than inheriting accent across a register boundary (W1).

*Bug found and fixed here:* the hero's scrim layers are absolutely positioned, so without an explicit
stacking context the bridging cards were painted over and their headings clipped.

**Measured.** Page chrome: **0/0/0/0** in both themes. The hero cannot be measured from computed
styles — it sits on a gradient — so it was measured the way the design phase did it, by rebuilding
all three layers in a canvas at real size and sampling the **lightest** pixel under each text run:

| hero run | worst background | ratio |
|---|---|---|
| headline (white) | `rgb(130,101,68)` | **5.39** |
| italic phrase `#AFCDF3` | `rgb(87,63,44)` | **5.97** |
| subhead `#E4EAF1` | `rgb(90,60,39)` | **8.22** |
| counts `#E6ECF2` | `rgb(8,16,26)` | **16.05** |

**Hero photo — cleared and shipped** (maintainer, 2026-07-26: permission obtained, not licence-encumbered).
`public/images/hero-campus.jpg`, re-encoded 704KB → **233KB** (67% smaller) at 1440×500, crop
`50% 44%` (courtyard axis), `fetchpriority="high"` + `decoding="async"` since it is the LCP element.
The warm gradient stays underneath as the decode/failure fallback, so the headline is never
white-on-white while the photo loads or if it 404s.

**The photo broke AA, exactly as the handoff predicted it would.** Re-measured over the real
composited pixels, the subhead dropped from 8.22 (gradient) to **4.34 — a fail** — where it crosses
a sunlit concrete wall. Fixed by moving the scrim falloff right (42%→58%) and raising the near
stops:

| hero run | over gradient | over photo, old scrim | over photo, shipped scrim |
|---|---|---|---|
| headline (white) | 5.39 | 5.09 | **7.33** |
| italic `#AFCDF3` | 5.97 | 5.00 | **8.95** |
| subhead `#E4EAF1` | 8.22 | **4.34 FAIL** | **8.13** |
| counts label `#E6ECF2` | 16.05 | 14.20 | **14.95** |
| counts number (white) | — | 17.65 | **18.18** |

The sampler (`window.__heroAA()` in the slice notes) now reads the gradient stops **off the live
element**, so it cannot drift from what actually ships. Re-run it if the art, the crop or the copy
width changes — gradient-era numbers do not transfer to a photo.

*Still owed:* WebP/AVIF encodes. Neither `sips` nor anything in `node_modules` can produce them, so
this needs `cwebp`/`avifenc` installed — a build-time task, not a code change.

### Slice 4c — event detail (bucket B, no mock)

**Changed:** `pages/EventDetail.tsx`. **Not changed:** `useEventRSVP` and every one of its handlers
— the upsert-on-re-RSVP, the DB capacity guard's error mapping, and the realtime status
subscription are all untouched.

Built by extending the opportunity-detail pattern rather than inventing a second one: same header
shape, same about-the-club mini-card, same sidebar action panel. The one deliberate difference is
the **mono date block**, the same device the cards use to say "event" without a second colour.

The RSVP panel is state-keyed and never a dead end — going / awaiting approval / open / full /
ended / club-viewing / logged-out each get their own copy and their own next action, with Add to
Calendar appearing only once you're actually confirmed. Status comes from the shared map
(`domain="rsvp"`, student audience), so a pending RSVP reads "Awaiting approval" here and "Pending"
in the club's queue.

**Verified end-to-end** against three test events the maintainer created (2026-07-26):

| path | exercised | result |
|---|---|---|
| Not found | bogus id | signature italic + next action + panel-pill toast |
| Standard RSVP | Mock Event 2 (cap 30) | "RSVP confirmed", live count → `1 going · 29 spots left`, **Going** badge, Cancel + Add to Calendar appear |
| **Approval required** | Event 3 (cap 5) | "APPROVAL NEEDED" tag, **Awaiting approval** badge, pending correctly **excluded** from the going count |
| RSVP questions | Mock Event 2 | all four question types render — short text, long text, single choice (radio), multiple choice (checkbox) |
| Required-field validation | empty submit | `--bad` boundaries + inline messages + toast; submission blocked |

That last row matters beyond this page: it is the only place the **dynamic question form** gets
exercised, and the same component backs applications.

**Measured** both themes: **0 text-contrast · 0 control-boundary · 0 unlabelled.** The two sub-44px
targets are `size="sm"` buttons — the documented non-touch compact exception.

**Not exercised:** the *full* / at-capacity state. Event 4 has capacity 1, but a single student
account can only ever occupy that spot and then sees "Cancel RSVP"; showing "Full" needs a **second
student**. The DB-side capacity guard and its error mapping are therefore still unverified.

*Left in place deliberately:* the two RSVPs created during this pass (one confirmed, one pending).
They give the club-side **RSVP review queue** real rows to review in slice 8 — including the
pending one, which is exactly the approve/decline path that needs testing.

*Not a bug:* event times render in the **browser's** timezone, so they read as IST on this dev
machine and Pacific for an actual UCI student. Correct as-is.

### Slice 5 — apply + RSVP

No new files. `ApplicationForm`, `RSVPForm`, `DynamicQuestionForm` and `SuccessModal` inherit the
re-tokened primitives, so this slice was about **proving** the paths rather than restyling them.
Every mutation, validation call and email trigger is untouched.

Exercised against real data: all four question types (short text, long text, radio, checkbox) ·
required-field validation (`--bad` boundaries + inline messages + toast, submission blocked) ·
resume auto-attached from the student profile, replaceable per application · a real application
submitted end-to-end → **success modal** ("You'll hear back either way") → posting flips to
"Applied". Both RSVP paths — instant confirm and approval-required — verified in slice 4c.

### Slice 6 — Clubs directory + club page

**Changed:** `pages/Clubs.tsx`, `pages/ClubDetail.tsx`. Every query, the follow/bookmark handler,
`ContactClubDialog` and the realtime team-roster subscription are unchanged.

- **The category filter bug is fixed.** The bar hard-coded nine labels — `Creative`, `Service`,
  `Cultural`… — that do **not exist** in `CLUB_CATEGORIES` (17 real values). So several chips could
  never match anything, and most real categories were unfilterable. Categories are now **derived
  from the categories clubs actually use**, which means the bar can never drift from the taxonomy
  again. Verified live: one chip, "Academic", because that is the only category in use.
- **Honest asymmetry** in the header — "N clubs · M recruiting right now" — and *recruiting is
  derived from real open roles*, never declared, so a club cannot advertise itself as recruiting
  with nothing posted.
- **`/messages?to=` 404 fixed.** Every "message a member" button pointed at a route that does not
  exist. They now point at `/student/messages?to=<user_id>`; the `?to=` handler that opens the
  thread lands with Messages (slice 9), so the button goes somewhere real in the meantime.
- Members render as **circles** beside the club's **square** mark — shape carrying person-vs-org.

**Measured** on the directory and the club page, both themes:
**0 text-contrast · 0 control-boundary · 0 unlabelled.** Sub-44px targets are `size="sm"`
buttons — the documented non-touch compact exception.

*Not exercised:* the members list and its message button — Test Club has no active team members.

---

### Slice 7 — Student side

**Changed:** `pages/StudentDashboard.tsx` (rebuilt as Activity), `pages/StudentProfile.tsx` (new,
the read side), `pages/StudentProfileSetup.tsx` → **`pages/StudentProfileEdit.tsx`** (renamed,
re-skinned), `pages/Opportunities.tsx` + `pages/Events.tsx` (Following filter), `components/
ui/file-upload.tsx` (re-tokened + a11y), `types/index.ts`, `App.tsx` (routes).
**Deleted:** `pages/StudentFeed.tsx`, `components/feed/FollowedClubsList.tsx` — nothing they did
was lost, see below. `FeedCard` and `EmptyFeedState` stay; `ClubFeed` still uses them.

**Activity replaces the dashboard.** The old page was four vanity stat tiles over five-item
previews whose "view all" links pointed at `/opportunities` — a page that never showed your
applications at all. It is now four real lists behind tabs: Applications · Going · Saved ·
Following, each the *whole* list. The `limit(5)` preview caps are gone for that reason.

- **"Rejected" is now "Not selected"** to the student, via `StatusBadge audience="student"` — the
  page's own `getStatusBadge()` is deleted. Confirmed live on a real rejected application.
- **RSVPs now show their status.** The query gained `status`; a pending RSVP reads *Awaiting
  approval*, a confirmed one reads *Going*. Before, both rendered identically as "upcoming", so a
  student who was only waitlisted was told they were going.
- **A saved role you already applied to shows its real status, not an Apply button.** The app does
  not prevent duplicate applications (this student has two on `opp 3`), so an inviting button there
  is a trap. Same for a saved event you have already RSVP'd to. Both derive from data already on
  the page — no extra queries.

**Feed → a filter, not a destination** (maintainer decision). A **Following** chip now sits on
both Discover and Events, and only appears once you actually follow a club, so it can never be a
filter that only ever returns nothing. It syncs to `?filter=following`, and **`/student/feed`
redirects there** so old links and bookmarks still land somewhere real. The feed's followed-clubs
list — and the only place to **unfollow** — moved into Activity → Following.

**Profile split into view and edit.** `/student/profile` was the edit form and nothing else, so a
student could never simply look at what clubs see without opening a form they might save by
accident. `/student/profile` is now the view (skills, interests, resume, links, and a plain list of
what is still missing rather than a meaningless completeness ring); `/student/profile/edit` is the
form, with the identical sanitize → zod → upsert path.

**Three real accessibility fixes**, all pre-existing:
- The skill/interest **suggestion chips were `<div>`s with click handlers** — a keyboard user could
  not add a suggested skill at all. They are `<button>`s now, each with `aria-label="Add skill X"`.
- **`FileUpload`'s dropzone was a bare `<div onClick>`** — not focusable, not announced, not
  operable by keyboard; and its two icon-only buttons had **no accessible name**. Fixed, and the
  component is re-tokened (it was still on `border-border` / `text-muted-foreground`).
- The chip **remove** button was 36px even on touch. Now 44 under `pointer: coarse`.

**Also fixed:** the hero image's `fetchPriority` (slice 4b) — React only learned that camelCase
prop in 19, so on 18.3 it warned and **dropped the attribute**; the LCP priority hint had never
actually shipped. Now spread as lowercase `fetchpriority`, confirmed present in the DOM.

**Measured** on Activity (all four tabs, Saved both empty and populated), profile view, profile
edit, and the Following filter on both Discover and Events — **both themes**:
**0 text-contrast · 0 control-boundary · 0 unlabelled.** Remaining sub-44px targets are `size="sm"`
buttons and 38px `TabsTrigger`s, both of which resolve to 44 under `@media (pointer: coarse)` —
verified in the compiled stylesheet, not assumed.

*Not exercised:* the profile view's "still missing" nudge — this student's profile is complete, and
checking it would need a fresh student account.

*Harness note:* forcing `data-theme` directly leaves **stale transitioned colours** — elements keep
the old `color` because a `var()` change does not always restart a running transition. The app
avoids this via next-themes' `disableTransitionOnChange`; the audit helper now does the same
(suppress transitions → flip → reflow → restore). Waiting for transitions to settle, which is what
I did previously, is **not** sufficient for a forced flip.

---

## 7. Defects found while building (fix in the owning slice)

Beyond the six already listed in §1 and §2, driving the app surfaced:

| Defect | Where | Gate | Fix in |
|---|---|---|---|
| Password show/hide button has **no accessible name** and is **16×16** | `Signup.tsx`, `Login.tsx` | 4.1.2, 2.5.5 | slice 10 |
| Bookmark buttons on cards have **no accessible name**, and are 28×28 | `cards/OpportunityCard.tsx` | 4.1.2, 2.5.5 | slice 4 |
| Search inputs are **placeholder-only**, no label | Opportunities, Events, Clubs, both reviews | 4.1.2 | slices 4, 6, 8 |
| Category filter chips are raw 36px buttons | Opportunities, Events, Clubs | 2.5.5 | slices 4, 6 |
| Skill/interest **suggestion chips are `<div>`s with click handlers** — unreachable by keyboard | `StudentProfileSetup.tsx` | 2.1.1, 4.1.2 | ✅ slice 7 |
| `FileUpload` dropzone is a bare **`<div onClick>`**; its two icon-only buttons have **no accessible name** | `ui/file-upload.tsx` | 2.1.1, 4.1.2 | ✅ slice 7 |
| `fetchPriority` is **dropped by React 18.3** — the hero's LCP priority hint never shipped | `Landing.tsx` | perf | ✅ slice 7 |
| RSVP list showed **no status**, so a waitlisted student was told they were "going" | `StudentDashboard.tsx` | honesty | ✅ slice 7 |

### Left for the maintainer — outside a re-skin's remit

| Defect | Where | Why I did not fix it |
|---|---|---|
| **Duplicate applications are allowed.** The test student has two applications to `opp 3` (one accepted, one rejected) | `applications` table / `ApplicationForm` submit | Needs a unique constraint or a mutation guard — both are backend changes the brief puts off-limits. Activity now shows the real status instead of an Apply button, so the UI no longer *invites* the duplicate, but it cannot prevent one. |
| `student_profiles.avatar_url` exists and is read by messaging, but **no screen can set it** | `StudentProfileEdit.tsx` | Needs a storage bucket plus its RLS policies. Bucket B, blocked on a maintainer decision. Profile avatars fall back to initials, which is a designed state, not a gap. |
