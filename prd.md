# ZotHub MVP Product Requirements Document

**Version:** 1.1
**Last Updated:** 2026-01-20
**Launch Target:** Within 1 week (public launch)
**Author:** Claude (based on stakeholder interview + manual testing feedback)

---

## 📋 Executive Summary

**ZotHub** is a two-sided campus marketplace platform that connects **UC Irvine students** (seeking leadership roles, internships, projects, volunteer positions, and campus events) with **UCI clubs** (posting opportunities, managing applications, and building community). The platform solves the critical problem of **centralized discovery**—students currently miss opportunities scattered across Facebook groups, Discord servers, email listservs, and personal networks.

### Mission
Create a single, searchable hub where every UCI student has equal access to all campus opportunities, and every club has professional tools to recruit, manage, and engage their community.

### Launch Scope
- **Timeline:** Launch in under 1 week (public launch, not beta)
- **Expected Scale:** 10-30 clubs, 200-500 students in first 30 days
- **Launch Platform:** https://zothub.lovable.app (Lovable subdomain)
- **Support Model:** Founder-led support via personal email (<24hr response, nights/weekends coverage)

**🆕 Version 1.1 Updates (Manual Testing Feedback):**
This PRD includes 8 additional UX features identified during manual testing, all MUST-HAVES for launch:
1. Team member messaging (students can message individual team members)
2. Application count visibility toggle (clubs control whether to show "X applications")
3. Auto-archive expired content (past opportunities/events hidden from students)
4. Event RSVP forms (custom questions for RSVPs like dietary restrictions)
5. RSVP approval workflow (clubs can manually approve RSVPs for exclusive events)
6. Application question label fix (display question text, not "Unknown question")
7. Application filtering by opportunity (dropdown filter in review page)
8. Team member display order sorting (up/down arrows to reorder)

### Success Criteria
**Primary Metric:** Number of opportunities posted (supply-side health)
**Secondary Metrics:** Application volume, student retention (DAU/WAU), club satisfaction

---

## 🎯 Product Vision

### Target Users

#### Primary: UCI Students
- **Profile:** Undergraduates and graduates seeking leadership roles, internships, projects, volunteer opportunities, and campus events
- **Pain Points:**
  - Opportunities scattered across 10+ platforms (Facebook, Discord, Instagram, email)
  - Miss opportunities due to lack of centralized discovery
  - No way to track application status or follow clubs long-term
- **Goals:**
  - Find relevant opportunities quickly
  - Apply with professional applications
  - Track application status in real-time
  - Stay connected to clubs they care about

#### Secondary: UCI Clubs
- **Profile:** Student organizations (cultural, professional, academic, social) posting opportunities and events
- **Pain Points:**
  - Managing applications via Google Forms + email is messy and unprofessional
  - No analytics on engagement or application quality
  - Hard to build long-term relationships with interested students
- **Goals:**
  - Post opportunities with custom application forms
  - Efficiently review and manage applications
  - Reach engaged students who care about their mission
  - Track analytics (views, applications, RSVPs)

### Value Proposition

**For Students:**
One searchable platform to discover all UCI opportunities (instead of monitoring 10+ fragmented channels) with real-time application tracking and personalized club feeds.

**For Clubs:**
Professional application management tools (custom forms, status tracking, analytics) that replace messy Google Forms + email workflows, plus direct messaging to engage interested students.

### Competitive Landscape

| Platform | Strengths | Weaknesses |
|----------|-----------|------------|
| **Facebook Groups** | High reach, existing user base | Chronological feed (posts buried quickly), no application tracking, search is poor |
| **Discord Servers** | Real-time chat, community building | Fragmented (each club has separate server), poor discoverability, no application tools |
| **Email Listservs** | Direct to inbox | One-way broadcast, no interactivity, inbox overload |
| **Campus Job Boards** | Professional appearance | Limited to paid positions, no events/volunteer/leadership roles |
| **ZotHub** | **Centralized discovery + structured applications + status tracking + club relationship management** | New platform (needs critical mass) |

---

## 🚀 MVP Scope Definition

### ✅ IN SCOPE (Must Have for Launch)

#### Student-Facing Features
1. **Authentication & Profiles**
   - UCI email-only signup (@uci.edu required, manual whitelist for exceptions)
   - Google OAuth via Supabase Auth
   - Role selection at signup: Student or Club (locked, cannot switch roles)
   - Optional profile completion (major, year, skills, interests, portfolio links)
   - No onboarding tutorial (immediate access to feed after signup)

2. **Opportunity Discovery**
   - Browse opportunities (leadership, project, internship, volunteer, committee, other)
   - **Advanced search:** Keyword search across titles, descriptions, club names, categories/tags
   - **Advanced filters:** Filter by opportunity type, date, category, tags
   - Bookmark/save opportunities for later
   - View opportunity details (requirements, deadline, club info, custom application questions)
   - **Application count display:** Clubs choose per-opportunity whether to show "X applications" to students (optional visibility)
   - **Auto-archive:** Expired opportunities (past deadline) automatically hidden from student view

3. **Applications**
   - Submit applications with custom form questions:
     - **Question types:** Text input, textarea, single-choice select, multi-choice select, **file uploads** (resumes, portfolios)
   - **Application statuses:** Pending → Reviewed → Accepted/Rejected (4-stage workflow)
   - Real-time status updates visible in student dashboard
   - **Cannot withdraw applications** after submission (must contact club)
   - **Duplicate prevention:** Cannot apply twice to same opportunity (blocked at application layer)
   - View application history in dashboard

4. **Events**
   - Browse events with RSVP functionality
   - **Optional capacity limits** (RSVP blocked when event full, capacity freed when students cancel)
   - **Optional custom RSVP forms:** Clubs can add custom questions (dietary restrictions, T-shirt size, etc.) using question builder (same types as application forms)
   - **Optional RSVP approval:** Clubs can enable "approval required" per-event (manual review of RSVPs similar to application workflow)
   - **Can cancel RSVP** anytime before event starts
   - **Add to Calendar links** (.ics download for Google Calendar, Outlook, iCal)
   - RSVP dashboard showing upcoming events
   - **Auto-archive:** Past events automatically hidden from student view after event date

5. **Messaging**
   - **Bidirectional messaging:** Students can message clubs, clubs can message applicants/attendees
   - Text-only (no attachments, video, or voice)
   - Real-time message notifications

6. **Feed & Following**
   - **Explicit follow button** on club profiles
   - Personalized feed showing updates from followed clubs (new opportunities, events)
   - Global feed showing all recent opportunities/events

7. **Notifications**
   - **In-app + Email notifications** for:
     1. New application received (notify club)
     2. Application status changed (notify student)
     3. New message received (notify recipient)
     4. Followed club posts new content (notify followers)
   - **Event reminders:** Automated email 24-48 hours before event
   - **Event cancellations:** Email all RSVP'd attendees when club cancels event
   - **User-configurable preferences** (frequency, types, unsubscribe link in all emails)

#### Club-Facing Features
1. **Club Account Management**
   - **Manual approval required:** Clubs sign up, founder verifies against UCI club directory via Supabase SQL, manually approves
   - Club profile setup (description, category, logo, social links)
   - **Team roster:** Add team members to profile with roles (e.g., "President", "VP", "Social Media Manager")
     - **Team member messaging:** Students can message individual team members via in-app ZotHub chat
     - **Custom display order:** Clubs can reorder team members using up/down arrow buttons (e.g., show President first, then VPs)
     - Display-only roster (no functional roles or separate login access for team members)
   - Single club account with shared credentials (no multi-user access control)

2. **Opportunity & Event Management**
   - Post opportunities with custom application forms
     - **Optional application count:** Checkbox to show/hide "X applications" to students (default: hidden)
   - Create events with optional capacity limits
     - **Optional RSVP forms:** Checkbox to add custom RSVP questions (dietary restrictions, T-shirt size, etc.)
     - **Optional RSVP approval:** Checkbox to enable manual approval workflow (club reviews each RSVP)
   - **Hard deadlines:** Applications automatically close after deadline (apply button disabled)
   - **Auto-archive:** Opportunities past deadline and events past event date automatically hidden from students (archived for club history)
   - **Soft delete:** Manually deleted opportunities hidden from public but applications preserved for club review
   - Edit opportunities/events after posting

3. **Application Review**
   - View all applications with **opportunity filter dropdown** (filter by specific opportunity to review)
   - **Question labels:** Application responses display actual question text (not "Unknown question")
   - Update application statuses (Pending → Reviewed → Accepted/Rejected)
   - Download submitted files (resumes, portfolios)
   - Message applicants directly

4. **Analytics Dashboard**
   - Track views, applications, RSVPs per opportunity/event
   - Engagement metrics (clicks, bookmarks, follows)
   - Built-in club analytics dashboard (already implemented per codebase)

5. **Content Moderation (Manual)**
   - **No admin UI:** Moderation via Supabase SQL editor
   - **Report mechanism:** Users email support for inappropriate content
   - Founder manually reviews and deletes spam/abuse via database

#### New UX Features (Added from Manual Testing Feedback)

**These 8 features were identified during manual testing and are MUST-HAVES for launch:**

1. **Team Member Messaging**
   - **What:** Students can click on individual team members listed on club profile → opens in-app ZotHub messaging
   - **Why:** Allows students to contact specific club officers (e.g., message Treasurer about dues, message Event Coordinator about logistics) instead of only main club account
   - **Implementation:** Each team member has clickable message button → opens chat with that specific user (requires bidirectional messaging to team member's personal account)

2. **Application Count Visibility Control**
   - **What:** When posting opportunity, club can check box "Show application count to students" → displays "23 applications" on opportunity detail page
   - **Why:** Gives clubs control over psychology (high count = competitive/popular, low count = still recruiting)
   - **Default:** Hidden (club must opt-in to show count)

3. **Auto-Archive Expired Content**
   - **What:** Opportunities automatically hidden from student view immediately after deadline passes; Events automatically hidden after event date passes
   - **Why:** Prevents students from applying to closed opportunities or RSVPing to past events (reduces confusion + support tickets)
   - **Club View:** Archived opportunities/events still visible in club dashboard under "Archived" tab for historical reference
   - **Implementation:** Cron job or database query filter (`WHERE deadline > NOW()` for students, no filter for clubs)

4. **Event RSVP Forms**
   - **What:** When creating event, club can check box "Add RSVP form" → opens question builder (same UI as application forms) → students fill out when RSVPing
   - **Why:** Collect info beyond simple RSVP (dietary restrictions for catered event, T-shirt sizes for giveaways, teammate preferences for tournament, etc.)
   - **Question Types:** Text, textarea, single-select, multi-select, file upload (same as application forms)
   - **Display:** RSVP responses visible in event management dashboard (similar to application review)

5. **RSVP Approval Workflow**
   - **What:** When creating event, club can check box "Require approval for RSVPs" → RSVPs go to "Pending" state → club manually approves/rejects (like application workflow)
   - **Why:** Allows clubs to curate attendance for exclusive events (invite-only workshops, limited competition slots, member-only socials)
   - **Student View:** "RSVP Pending" status in dashboard until club approves → receives notification when approved/rejected
   - **Default:** Unchecked (most events auto-confirm RSVPs)

6. **Application Question Label Bug Fix**
   - **What:** Application review currently shows "Unknown question" instead of actual question text → FIX to display question label/text correctly
   - **Why:** Clubs can't understand student answers without knowing which question was answered
   - **Implementation:** Map `application.answers` JSONB to `opportunity.custom_questions` JSONB → display question text above each answer

7. **Application Filtering by Opportunity**
   - **What:** Application review page has dropdown filter "Filter by opportunity: [All | Opportunity A | Opportunity B]" → shows only applications for selected opportunity
   - **Why:** Clubs with multiple active opportunities (10+ opportunities) need to review applications per-opportunity (not mixed global list)
   - **Implementation:** Filter query `WHERE opportunity_id = selected_id` + UI dropdown populated from club's opportunities

8. **Team Member Display Order Sorting**
   - **What:** Team management UI has up/down arrow buttons next to each team member → click to reorder → order saved to `display_order` column → reflected on public club profile
   - **Why:** Clubs want to show hierarchy (President first, then VPs, then general members) or prioritize key contacts
   - **Implementation:** Update `display_order` integer column on button click → re-render list → query team members `ORDER BY display_order ASC`

---

#### Technical Requirements
1. **Security**
   - Row Level Security (RLS) enforced on all Supabase tables
   - **File upload security:** Max file size limits, forbidden file types (executables), validation
   - **Authentication security:** Session management, password reset, logout tested
   - All API keys and secrets secured in environment variables (not in git)
   - XSS prevention via React's built-in sanitization (not manually audited)

2. **Email System**
   - All emails sent via Supabase Auth
   - **Unsubscribe links required** in all notification emails (CAN-SPAM compliance)
   - Email preference management UI (users control notification frequency)
   - Automated event reminder cron job (24-48hrs before events)
   - Event cancellation notification emails

3. **Data & Privacy**
   - **Data visibility:** Student names, emails, resumes, and profile data visible to clubs when applying/RSVPing
   - **Data retention:** Indefinite retention (no account deletion feature)
   - **Privacy policy:** Template privacy policy customized for ZotHub, Supabase, no data selling
   - Supabase automatic backups (recovery procedure untested but assumed functional)

4. **Performance & Infrastructure**
   - Mobile-responsive design (works on phones/tablets but not optimized)
   - Deployed via Lovable.dev platform (automatic deployment on push)
   - **No load testing:** Performance under concurrent users unknown
   - **Error tracking:** Basic browser console + Supabase logs (no proactive alerts like Sentry)
   - **Fix forward only:** No rollback capability; bugs fixed by pushing new code

5. **Analytics**
   - **Platform:** Supabase built-in analytics (may not capture custom events)
   - **Events tracked:** Application submissions, event RSVPs, bookmarks (instrumentation may need implementation)
   - Manual SQL queries for custom metrics (opportunities posted, applications per opportunity, retention)

#### Launch Readiness
1. **Documentation**
   - Privacy policy (template-based, customized for ZotHub)
   - Club approval workflow documentation (SQL queries, verification steps)
   - Support email (personal email address for support@ inquiries)
   - No user-facing help docs/FAQs (rely on intuitive UX + support emails)

2. **Pre-Launch Club Seeding**
   - **None:** Launching with empty platform, no pre-seeded clubs or opportunities
   - Hybrid marketing: Manually seed 5-10 anchor clubs + broad marketing to all UCI clubs simultaneously
   - **Risk:** Students see empty platform on day one (potential immediate churn)

3. **QA Testing Checklist**
   - ✅ Complete student journey: Signup → profile → search → apply → status update → RSVP → reminder → bookmark → follow → message
   - ✅ Complete club journey: Signup → approval → post opportunity → custom form → review applications → update statuses → post event → message student
   - ✅ Image uploads: Club logos, event flyers, opportunity images (size limits, validation)
   - ✅ Cross-browser: Chrome, Safari, Firefox
   - ✅ Mobile: iOS Safari, Android Chrome (responsive design + touch targets)
   - ✅ Error states: Empty states, network errors, form validation, missing images

4. **Launch Marketing**
   - Social media: Facebook groups (UCI Class of XXXX), r/UCI subreddit, Instagram, Discord servers
   - Campus tabling: Student center, library (in-person promotion with demo)
   - Student government partnership: Promote via ASUCI or club council channels
   - Mass email: Blast to all UCI students (via official channels or purchased list)

---

### ❌ OUT OF SCOPE (Deferred Post-MVP)

#### Features Explicitly Cut
1. **Native mobile apps** (iOS/Android)—mobile-responsive web only
2. **Payment/monetization** (paid event tickets, premium listings, club subscriptions)—completely free platform
3. **In-app video/voice calling**—text messaging only
4. **Advanced personalization** (AI recommendations, saved searches)—basic search/filter only
5. **Admin dashboard UI**—manual Supabase moderation for MVP
6. **E2E automated tests**—rely on manual QA testing
7. **Error monitoring** (Sentry, real-time alerts)—basic logging only
8. **Custom domain** (zothub.io)—launch on zothub.lovable.app
9. **Account deletion feature**—indefinite retention, handle deletion requests manually if needed
10. **Application editing** (students cannot edit submitted applications)—contact club to update
11. **Waitlist for events**—capacity-based blocking only, no waitlist management
12. **Student-to-student or club-to-club messaging**—only student ↔ club communication

---

## 👥 User Journeys

### Critical Path: Club Posts Opportunity → Receives Applications → Selects Candidate

**Priority:** HIGHEST (supply-side is critical for marketplace success)

#### Step-by-Step Club Journey
1. **Signup & Approval**
   - Club officer visits zothub.lovable.app
   - Signs up with UCI email (e.g., acmpresident@uci.edu)
   - Selects "Club" role
   - Fills out club profile (name, description, logo, category, social links)
   - Receives "Pending Approval" message
   - Founder manually verifies club against UCI official club directory
   - Founder approves via Supabase SQL (`UPDATE club_profiles SET status='active' WHERE id='...'`)
   - Club receives "Account Approved" email

2. **Post First Opportunity**
   - Club logs in, navigates to `/club/opportunities/new`
   - Fills out opportunity form:
     - Title (e.g., "Social Media Manager - UCI ACM")
     - Type (leadership, project, internship, volunteer, committee, other)
     - Description (responsibilities, requirements, time commitment)
     - Deadline (hard deadline, applications close automatically)
     - Optional image upload (opportunity flyer)
   - **Builds custom application form:**
     - Add text input: "Why do you want to join ACM?"
     - Add file upload: "Upload your resume/portfolio"
     - Add multi-select: "Which skills do you have? (Python, JavaScript, Design, Marketing)"
   - Publishes opportunity (immediately visible to all students)

3. **Receive Applications**
   - Students apply to opportunity
   - Club receives **in-app + email notification** for each new application
   - Club navigates to `/club/dashboard/applications`
   - Reviews applications (reads answers, downloads resumes)
   - Marks application as "Reviewed" (status visible to student)

4. **Select Candidate**
   - Club decides on top candidates
   - Updates application status to "Accepted" for winners
   - Updates remaining applications to "Rejected"
   - Students receive **in-app + email notifications** of status change
   - Club messages accepted candidates via ZotHub messaging to coordinate next steps
   - Student sees "Accepted" status in `/student/dashboard`

**Success Criteria:**
- Club can post opportunity in <5 minutes
- Custom form builder is intuitive (no training needed)
- Application review UI makes it easy to compare candidates
- Students respond quickly to acceptance notifications (check email/app daily)

---

### Secondary Journey: Student Discovers Opportunity → Applies → Gets Hired

#### Step-by-Step Student Journey
1. **Signup & Onboarding**
   - Student visits zothub.lovable.app
   - Signs up with UCI email via Google OAuth
   - Selects "Student" role
   - Optionally fills out profile (major, year, skills, interests)—not required
   - Lands on opportunity feed (no tutorial)

2. **Discover Opportunity**
   - Student searches "marketing" in search bar
   - Filters by type: "Leadership"
   - Sees "Social Media Manager - UCI ACM" opportunity
   - Clicks to view details
   - Reads requirements, deadline, club profile
   - Bookmarks opportunity for later (notification sent to club)

3. **Apply**
   - Student clicks "Apply" button
   - Sees custom application form with 3 questions:
     - Text: "Why do you want to join ACM?" (answers in 200 words)
     - File upload: Uploads resume PDF from Google Drive
     - Multi-select: Checks "Marketing" and "Design" skills
   - Submits application
   - Sees confirmation message: "Application submitted! Track status in your dashboard."
   - Receives **email confirmation** of submission
   - **Cannot apply again** (duplicate blocked)

4. **Track Status**
   - Student checks `/student/dashboard` daily
   - Sees application status change to "Reviewed" (receives **in-app + email notification**)
   - Days later, status changes to "Accepted" (receives **in-app + email notification**)
   - Receives message from club via ZotHub messaging with next steps
   - Student replies to confirm attendance at first meeting

5. **Ongoing Engagement**
   - Student clicks "Follow" on ACM club profile
   - Receives notifications when ACM posts new opportunities or events
   - RSVPs to ACM's welcome event
   - Receives **email reminder** 24 hours before event
   - Clicks **"Add to Calendar"** link to save event in Google Calendar
   - Attends event and becomes active ACM member

**Success Criteria:**
- Student finds relevant opportunity within 3 clicks
- Application form is clear and submits without errors
- Student receives timely notifications (not delayed >1 hour)
- Student feels informed throughout process (no black box)

---

### Tertiary Journey: Student RSVPs to Event

#### Step-by-Step Event Journey
1. Student browses events, sees "ACM General Meeting"
2. Checks event details (date, time, location, capacity: 50/100)
3. Clicks "RSVP" → sees confirmation "You're registered!"
4. Event appears in `/student/dashboard` RSVP list
5. 24 hours before event, receives **automated email reminder** with event details
6. Clicks **"Add to Calendar"** link → event added to Google Calendar
7. Day of event: Attends meeting
8. **If student cancels:** Clicks "Cancel RSVP" → capacity freed for others, no longer receives reminders
9. **If club cancels event:** All RSVP'd students receive **email notification** of cancellation

**Success Criteria:**
- RSVP process is frictionless (<10 seconds)
- Email reminders arrive reliably (99% delivery rate)
- Add to Calendar link works across Google/Outlook/iCal
- Cancellations (student or club) update capacity in real-time

---

## 🛠️ Technical Implementation

### Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | React 18.3.1 + TypeScript | Vite 5.4.19 (SWC compiler for fast builds) |
| **Styling** | Tailwind CSS 3.4.17 + shadcn/ui | Radix UI primitives, dark mode only |
| **Routing** | React Router v6.30.1 | Client-side routing |
| **State** | React Context (Auth) + TanStack Query v5 | Server state caching, optimistic updates |
| **Backend** | Supabase (PostgreSQL) | Row Level Security (RLS), real-time subscriptions |
| **Auth** | Supabase Auth + Google OAuth | UCI email domain restriction |
| **Storage** | Supabase Storage | Image uploads (logos, flyers, resumes) |
| **Email** | Supabase Auth SMTP | All notification emails + event reminders |
| **Forms** | React Hook Form + Zod | Client-side validation |
| **Hosting** | Lovable.dev | Auto-deploy on push, https://zothub.lovable.app |
| **Analytics** | Supabase built-in | Manual SQL queries for custom metrics |
| **Monitoring** | Browser console + Supabase logs | No error tracking platform (Sentry) |

### Database Schema (Summary)

**Key Tables:**
- `user_roles` – Role assignment (student/club), locked at signup
- `student_profiles` – Student info (major, skills, interests, resume URL)
- `club_profiles` – Club info (description, category, logo, social links, approval status)
- `opportunities` – Opportunity posts (title, type, deadline, custom questions as JSONB)
- `events` – Event posts (date, location, capacity)
- `applications` – Opportunity applications (status: pending/reviewed/accepted/rejected, answers as JSONB, file URLs)
- `rsvps` – Event registrations (status: confirmed/cancelled)
- `bookmarks` – User's saved items
- `messages` – Direct messaging (sender/receiver, read status)
- `notifications` – In-app notifications (type, read status, related_id for context)
- `club_team_members` – Team roster (display-only, no functional roles)

**Security:**
- Row Level Security (RLS) enforced on all tables
- Students can only see own applications/RSVPs
- Clubs can only see applications for their own opportunities
- Automatic `updated_at` timestamps via triggers

### Key Workflows

#### 1. Automated Email Event Reminders

**Implementation Requirements:**
- **Cron job:** Runs every hour, queries all events starting in 24-48 hours
- **Filter:** Select events with `event_time BETWEEN NOW() + INTERVAL '24 hours' AND NOW() + INTERVAL '48 hours'`
- **Join:** Get all students who RSVP'd (status = 'confirmed')
- **Email template:** Include event name, date, time, location, "Add to Calendar" link
- **Idempotency:** Track sent reminders in `notifications` table to avoid duplicate emails
- **Unsubscribe link:** Footer must include unsubscribe link (legal requirement)

**Cron Schedule:**
```
0 * * * * // Every hour at :00
```

**SQL Query (Pseudo-code):**
```sql
SELECT e.*, r.student_id, s.email
FROM events e
JOIN rsvps r ON e.id = r.event_id
JOIN student_profiles s ON r.student_id = s.id
WHERE e.event_time BETWEEN NOW() + INTERVAL '24 hours' AND NOW() + INTERVAL '48 hours'
  AND r.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE type = 'event_reminder'
      AND related_id = e.id
      AND user_id = r.student_id
  )
```

#### 2. Add to Calendar (.ics File Generation)

**Implementation:**
- Generate .ics file dynamically when student clicks "Add to Calendar" link
- Format: iCalendar standard (RFC 5545)
- Include: Event name, start/end time (UTC), location, description, organizer (club contact)
- Serve via API endpoint: `GET /api/events/:id/calendar.ics`

**Example .ics:**
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ZotHub//Event//EN
BEGIN:VEVENT
UID:event-123@zothub.lovable.app
DTSTAMP:20260120T120000Z
DTSTART:20260125T190000Z
DTEND:20260125T210000Z
SUMMARY:ACM General Meeting
LOCATION:Student Center Ballroom A
DESCRIPTION:Join us for our kickoff meeting! Free pizza.
ORGANIZER:mailto:acm@uci.edu
END:VEVENT
END:VCALENDAR
```

#### 3. File Upload Security

**Requirements:**
- **Max file size:** 10MB per file (configurable via Supabase Storage policies)
- **Allowed file types:** PDF, DOCX, PNG, JPG (resumes, portfolios, images)
- **Forbidden file types:** .exe, .sh, .bat, .js, .html (executables, scripts)
- **Storage quota:** 1GB total per club (prevent storage bombing)
- **Validation:** Client-side + server-side file type validation (check MIME type, not just extension)
- **Access control:** Uploaded files (resumes) only accessible to club that received application (RLS on storage bucket)

**Supabase Storage Bucket Configuration:**
```javascript
// storage policies
{
  "allowed_mime_types": ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg"],
  "max_file_size": 10485760, // 10MB in bytes
  "public": false // RLS controls access
}
```

#### 4. Club Approval Workflow (Manual Process)

**Step-by-Step:**
1. Club signs up → `club_profiles` row created with `status = 'pending'`
2. Founder receives daily email digest of new clubs awaiting approval
3. Founder logs into Supabase dashboard → navigates to `club_profiles` table
4. Reviews club info:
   - Verify club name matches UCI official club directory (https://campusorgs.uci.edu/)
   - Check email domain is @uci.edu
   - Verify club description is legitimate (not spam/fake)
5. Approves via SQL query:
   ```sql
   UPDATE club_profiles
   SET status = 'active', approved_at = NOW()
   WHERE id = 'club-uuid-here';
   ```
6. Club receives "Account Approved" email (triggered by database update)
7. Club can now post opportunities/events

**Documentation Requirement:** Create `docs/club-approval-process.md` with exact SQL queries and verification checklist

#### 5. Notification System

**4 Notification Triggers (In-App + Email):**

| Trigger | Recipient | In-App Notification | Email Notification | Related Data |
|---------|-----------|---------------------|---------------------|--------------|
| **New Application** | Club | "New application for [Opportunity Title]" | Subject: "New application received for [Opportunity]"<br>Body: Student name, preview of answers, link to review | `application_id`, `opportunity_id`, `student_id` |
| **Status Change** | Student | "Your application for [Opportunity] is now [Accepted/Rejected]" | Subject: "Application update: [Opportunity]"<br>Body: Status, club message (if any), next steps | `application_id`, `opportunity_id`, `status` |
| **New Message** | Recipient | "New message from [Sender Name]" | Subject: "You have a new message from [Sender]"<br>Body: Message preview (first 100 chars), link to conversation | `message_id`, `sender_id`, `conversation_id` |
| **Followed Club Post** | Followers | "[Club Name] posted a new [opportunity/event]: [Title]" | Subject: "[Club] posted new content"<br>Body: Title, preview, link to view | `opportunity_id` OR `event_id`, `club_id` |

**Implementation:**
- Database triggers on `INSERT` (applications, messages, opportunities, events)
- Create row in `notifications` table for in-app notification
- Send email via Supabase Auth SMTP (async function, doesn't block user action)
- Email includes unsubscribe link (managed via `email_preferences` table)

#### 6. Search Implementation

**Search Query (Pseudo-code):**
```javascript
// Full-text search across opportunities
const searchOpportunities = async (query, filters) => {
  let queryBuilder = supabase
    .from('opportunities')
    .select('*, club_profiles(*)')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,club_profiles.name.ilike.%${query}%`)

  // Apply filters
  if (filters.type) queryBuilder = queryBuilder.eq('type', filters.type)
  if (filters.category) queryBuilder = queryBuilder.eq('category', filters.category)
  if (filters.dateAfter) queryBuilder = queryBuilder.gte('deadline', filters.dateAfter)

  return queryBuilder.order('created_at', { ascending: false })
}
```

**Search Fields:**
- Title (opportunity name, event name)
- Description (full text)
- Club name (who posted it)
- Category/tags/types

**Filters:**
- Opportunity type (leadership, project, internship, volunteer, committee, other)
- Category (if clubs are categorized: STEM, cultural, professional, etc.)
- Date range (deadline after/before)

---

## 🔒 Security & Privacy

### Security Requirements

#### Authentication
- ✅ UCI email domain restriction enforced at signup (@uci.edu only)
- ✅ Manual whitelist for exceptions (documented in database, founder approves case-by-case)
- ✅ Google OAuth via Supabase (no password storage, delegated to Google)
- ✅ Session management tested (logout, session expiration, protected routes)
- ✅ Password reset tested (if email/password auth enabled)

#### Data Access Control
- ✅ Row Level Security (RLS) policies on all Supabase tables
- ⚠️ RLS policies assumed correct (not penetration tested)
- ✅ Students can only access own applications, RSVPs, messages, bookmarks
- ✅ Clubs can only access applications for their own opportunities
- ✅ File uploads (resumes) only accessible to receiving club (RLS on Supabase Storage)

#### Input Validation
- ✅ Client-side validation via React Hook Form + Zod schemas
- ✅ Server-side validation via Supabase database constraints (NOT NULL, foreign keys, unique constraints)
- ⚠️ XSS prevention assumed via React's built-in escaping (not manually audited)
- ⚠️ No SQL injection risk (Supabase uses parameterized queries)

#### File Upload Security
- ✅ Max file size: 10MB enforced at Supabase Storage level
- ✅ Allowed MIME types: PDF, DOCX, PNG, JPG
- ✅ Forbidden file types: Executables (.exe, .sh, .bat, .js, .html) blocked
- ⚠️ No malware scanning (accepted risk for MVP, rely on Supabase Storage security)
- ✅ Storage quota per club: 1GB total

#### Secrets Management
- ✅ All API keys and secrets in environment variables (not in git)
- ✅ Supabase anon key is public (safe to expose in client-side code)
- ✅ Supabase service role key secured in Lovable environment (never exposed to client)

### Privacy & Compliance

#### Data Collection
**Student Data Visible to Clubs:**
- ✅ Name (required for hiring decisions)
- ✅ Email (allows external communication)
- ✅ Major, year, skills, interests (profile data)
- ✅ Resume/portfolio files (uploaded in applications)

**Data Handling:**
- ✅ Clear disclosure at application time: "Your profile and application will be visible to [Club Name]"
- ✅ No data selling or third-party sharing (except Supabase as processor)
- ❌ No user-initiated account deletion (indefinite retention)
- ❌ No GDPR/CCPA "right to deletion" compliance (must handle manually if requested)

#### Privacy Policy
- ✅ Template-based privacy policy (customized for ZotHub, Supabase, no data selling)
- ✅ Covers: Data collection, usage, retention, third-party processors (Supabase), cookies, user rights
- ❌ Not lawyer-reviewed (acceptable for MVP, revisit if scaling or institutional partnership)
- ✅ Link in footer of all pages + signup flow

#### Email Compliance (CAN-SPAM Act)
- ✅ Unsubscribe link in every notification email (legally required)
- ✅ Email preference management UI (users can control frequency/types)
- ✅ Unsubscribe processed immediately (no delay)
- ✅ Physical address in email footer (use UCI address or Lovable.dev address)

#### Data Retention
- ❌ Indefinite retention (no automatic deletion)
- ❌ No account deletion feature (students/clubs cannot self-delete)
- ⚠️ Manual handling if user requests deletion (founder manually deletes via Supabase)
- ✅ Soft delete for opportunities (hidden from public but applications preserved)

---

## 📊 Analytics & Metrics

### Events to Track

| Event | Data Captured | Purpose |
|-------|---------------|---------|
| **Application Submitted** | `opportunity_id`, `student_id`, `timestamp`, `application_id` | Measure demand for opportunities, track application volume per opportunity |
| **Event RSVP** | `event_id`, `student_id`, `timestamp`, `rsvp_id` | Measure event engagement, track attendance rates |
| **Bookmark/Save** | `item_type` (opportunity/event/club), `item_id`, `student_id`, `timestamp` | Leading indicator of intent, measure top-of-funnel engagement |

### Success Metrics

#### Primary Metric: # of Opportunities Posted
- **Target:** 50-100 opportunities in first 30 days (from 10-30 clubs)
- **Measurement:** `SELECT COUNT(*) FROM opportunities WHERE created_at > '2026-01-XX'`
- **Why Primary:** Supply drives marketplace; without opportunities, students have no reason to visit

#### Secondary Metrics
1. **Application Volume:** `SELECT COUNT(*) FROM applications WHERE created_at > '2026-01-XX'`
   - Target: 200-500 applications in first 30 days
   - Indicates student demand and engagement

2. **Application Rate:** `SELECT AVG(app_count) FROM (SELECT COUNT(*) as app_count FROM applications GROUP BY opportunity_id)`
   - Target: 5-10 applications per opportunity
   - Low ratio = discovery problem; high ratio = healthy demand

3. **Student Retention (WAU):** `SELECT COUNT(DISTINCT student_id) FROM activity WHERE week = X`
   - Target: 30%+ week-over-week return rate
   - Measure: Students who perform any action (apply, RSVP, bookmark, search) in week N and week N+1

4. **Club Satisfaction:** Manual outreach after 30 days
   - Survey question: "Did ZotHub help you find quality candidates?" (Yes/No/Somewhat)
   - Target: 70%+ say "Yes"

### Analytics Implementation

**Platform:** Supabase built-in analytics (free tier)

**Custom Metrics:** Manual SQL queries via Supabase dashboard

**Event Tracking:**
- ⚠️ May need to instrument custom events (applications, RSVPs, bookmarks) if not auto-tracked by Supabase
- Create `analytics_events` table if Supabase analytics doesn't capture custom events:
  ```sql
  CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR NOT NULL, -- 'application_submitted', 'event_rsvp', 'bookmark_added'
    user_id UUID REFERENCES user_roles(id),
    related_id UUID, -- opportunity_id, event_id, etc.
    metadata JSONB, -- additional context
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

**Dashboard:** No custom analytics UI for MVP (manually query Supabase for weekly reports)

---

## 🧪 Quality Assurance

### Pre-Launch Testing Checklist

#### ✅ Complete Student Journey (End-to-End)
1. **Signup & Auth**
   - [ ] Sign up with UCI email via Google OAuth
   - [ ] Role selection (Student) works
   - [ ] Redirected to feed after signup
   - [ ] Profile setup (optional fields) saves correctly
   - [ ] Logout and re-login (session persists)

2. **Opportunity Discovery**
   - [ ] Search "marketing" returns relevant opportunities
   - [ ] Filters (type, date, category) narrow results correctly
   - [ ] Click opportunity → detail page loads with all info
   - [ ] **NEW:** If club enabled "show application count", verify "X applications" displayed
   - [ ] Bookmark opportunity → appears in `/student/dashboard`
   - [ ] Unbookmark → removed from dashboard
   - [ ] **NEW:** Verify expired opportunities (past deadline) NOT visible in search results

3. **Application Submission**
   - [ ] Click "Apply" → custom form loads with club's questions
   - [ ] Fill text input, textarea, select, multi-select, **file upload**
   - [ ] Submit application → confirmation message shown
   - [ ] Application appears in dashboard with "Pending" status
   - [ ] Try to apply again → blocked with error "You already applied"
   - [ ] Receive email confirmation of submission

4. **Application Status Tracking**
   - [ ] Club updates status to "Reviewed" → in-app notification received
   - [ ] Email notification received for status change
   - [ ] Dashboard shows updated status
   - [ ] Club updates status to "Accepted" → in-app + email notification
   - [ ] Dashboard shows "Accepted" status

5. **Event RSVP**
   - [ ] Browse events → click event detail page
   - [ ] Check capacity (e.g., 50/100 spots)
   - [ ] **NEW:** If event has RSVP form, fill out custom questions (dietary restrictions, T-shirt size)
   - [ ] Click "RSVP" → confirmation shown
   - [ ] **NEW:** If event requires approval, status shows "RSVP Pending" until club approves
   - [ ] Event appears in dashboard RSVP list
   - [ ] **NEW:** Receive notification when RSVP approved (if approval required)
   - [ ] Click "Add to Calendar" → .ics file downloads correctly
   - [ ] Import .ics into Google Calendar → event appears with correct details
   - [ ] Receive email reminder 24 hours before event
   - [ ] Click "Cancel RSVP" → removed from RSVP list, capacity freed (49/100)
   - [ ] **NEW:** Verify past events NOT visible in event search results

6. **Messaging**
   - [ ] Send message to club about opportunity
   - [ ] **NEW:** Click team member on club profile → message button opens chat with team member
   - [ ] Receive in-app notification when club replies
   - [ ] Receive email notification of new message
   - [ ] Read message → notification marked as read

7. **Follow Club & Feed**
   - [ ] Click "Follow" on club profile → button changes to "Following"
   - [ ] Club posts new opportunity → receive in-app + email notification
   - [ ] New opportunity appears in personalized feed
   - [ ] Unfollow club → no longer receive updates

#### ✅ Complete Club Journey (End-to-End)
1. **Signup & Approval**
   - [ ] Sign up with UCI email (club officer account)
   - [ ] Role selection (Club) works
   - [ ] Fill out club profile (name, description, logo upload, category, social links)
   - [ ] See "Pending Approval" message after signup
   - [ ] Founder approves via Supabase SQL → club receives "Approved" email
   - [ ] Club can now log in and access dashboard

2. **Post Opportunity**
   - [ ] Navigate to `/club/opportunities/new`
   - [ ] Fill out opportunity form (title, type, description, deadline)
   - [ ] **NEW:** Check "Show application count to students" → verify checkbox works
   - [ ] Upload opportunity image (flyer)
   - [ ] Build custom application form:
     - [ ] Add text input question → preview shows correctly
     - [ ] Add textarea question → preview shows correctly
     - [ ] Add single-select dropdown → preview shows correctly
     - [ ] Add multi-select checkboxes → preview shows correctly
     - [ ] Add file upload question → preview shows correctly
   - [ ] Publish opportunity → appears in public opportunity feed
   - [ ] Verify deadline enforcement: After deadline passes, "Apply" button disabled for students
   - [ ] **NEW:** Verify expired opportunity automatically moved to "Archived" tab in club dashboard

3. **Receive & Review Applications**
   - [ ] Student applies → club receives in-app notification
   - [ ] Club receives email notification of new application
   - [ ] Navigate to `/club/dashboard/applications`
   - [ ] **NEW:** Use dropdown filter to view applications for specific opportunity only
   - [ ] View application details (answers to all questions)
   - [ ] **NEW:** Verify question labels display correctly (NOT "Unknown question")
   - [ ] Download uploaded resume PDF → file opens correctly
   - [ ] Update status to "Reviewed" → student receives notification
   - [ ] Update status to "Accepted" → student receives notification
   - [ ] Update status to "Rejected" → student receives notification

4. **Post Event**
   - [ ] Navigate to `/club/events/new`
   - [ ] Fill out event form (title, date, time, location, description, capacity: 100)
   - [ ] **NEW:** Check "Add RSVP form" → question builder opens
     - [ ] Add text question: "Dietary restrictions?"
     - [ ] Add select question: "T-shirt size?"
   - [ ] **NEW:** Check "Require approval for RSVPs" → verify checkbox works
   - [ ] Upload event flyer
   - [ ] Publish event → appears in public event feed
   - [ ] Verify capacity enforcement: When 100 students RSVP, "RSVP" button shows "Event Full"

5. **Manage Event**
   - [ ] View RSVP list (all students who registered)
   - [ ] **NEW:** If RSVP form enabled, view student answers (dietary restrictions, T-shirt sizes)
   - [ ] **NEW:** If approval required, review pending RSVPs → click Approve/Reject
   - [ ] **NEW:** Verify student receives notification when RSVP approved
   - [ ] Student cancels RSVP → capacity freed (99/100)
   - [ ] Club cancels event → all RSVP'd students receive email notification
   - [ ] Verify event removed from public feed after cancellation
   - [ ] **NEW:** Verify past event automatically moved to "Archived" tab in club dashboard

6. **Messaging**
   - [ ] Message student who applied
   - [ ] Student receives in-app + email notification
   - [ ] Student replies → club receives notification
   - [ ] Conversation thread shows all messages

7. **Team Management**
   - [ ] Add team member to club roster (name, email, role: "President")
   - [ ] **NEW:** Use up/down arrow buttons to reorder team members
   - [ ] **NEW:** Verify team member order reflected on public club profile (President first, etc.)
   - [ ] Team member appears on public club profile
   - [ ] **NEW:** Verify "Message" button appears next to each team member on public profile
   - [ ] Verify team member does NOT receive login access (display-only)

8. **Analytics Dashboard**
   - [ ] Navigate to `/club/dashboard/analytics`
   - [ ] Verify opportunity views, applications, bookmarks tracked correctly
   - [ ] Verify event views, RSVPs tracked correctly
   - [ ] Charts render without errors

#### ✅ Image Upload Functionality
1. **Club Logo Upload**
   - [ ] Upload logo (PNG, 2MB) → preview shows correctly
   - [ ] Upload logo (JPG, 8MB) → preview shows correctly
   - [ ] Try to upload exe file → blocked with error
   - [ ] Try to upload 15MB image → blocked with error "File too large (max 10MB)"
   - [ ] Verify logo appears on club profile page
   - [ ] Verify logo loads quickly via CDN

2. **Event Flyer Upload**
   - [ ] Upload flyer (PNG, 5MB) → preview shows correctly
   - [ ] Verify flyer appears on event detail page
   - [ ] Missing flyer (image URL broken) → placeholder image shown

3. **Resume Upload (Application)**
   - [ ] Upload PDF resume (2MB) → file saved correctly
   - [ ] Upload DOCX resume (1MB) → file saved correctly
   - [ ] Try to upload .js file → blocked with error
   - [ ] Club downloads resume → file downloads correctly with original filename
   - [ ] Verify only receiving club can access resume (RLS enforced)

#### ✅ Cross-Browser Testing
- [ ] **Chrome (latest):** All features work, forms submit, images load
- [ ] **Safari (latest):** All features work, forms submit, images load
- [ ] **Firefox (latest):** All features work, forms submit, images load

#### ✅ Mobile Device Testing
- [ ] **iOS Safari (iPhone):**
  - [ ] Layout responsive (no horizontal scroll)
  - [ ] Touch targets large enough (buttons, links)
  - [ ] Forms usable (keyboard doesn't obscure inputs)
  - [ ] Image uploads work (camera or photo library)
  - [ ] Navigation menu accessible
- [ ] **Android Chrome (Pixel/Samsung):**
  - [ ] Layout responsive
  - [ ] Touch targets usable
  - [ ] Forms usable
  - [ ] Image uploads work
  - [ ] Navigation menu accessible

#### ✅ Error State Handling
1. **Empty States**
   - [ ] Student dashboard (no applications yet) → shows helpful message "You haven't applied to any opportunities yet. Browse opportunities to get started."
   - [ ] Club dashboard (no applications received) → shows "No applications yet. Share your opportunity to get more visibility!"
   - [ ] Event list (no events) → shows "No upcoming events. Check back soon!"
   - [ ] Search results (no matches) → shows "No results for '[query]'. Try different keywords."

2. **Network Errors**
   - [ ] Disconnect internet → try to submit application → error message "Network error. Check your connection and try again." with retry button
   - [ ] Supabase timeout → error message shown (not blank screen)
   - [ ] Retry button re-attempts action successfully

3. **Form Validation Errors**
   - [ ] Submit application with empty required field → error shown "This field is required"
   - [ ] Upload file > 10MB → error shown "File too large (max 10MB)"
   - [ ] Upload forbidden file type → error shown "Invalid file type. Allowed: PDF, DOCX, PNG, JPG"
   - [ ] Submit opportunity with deadline in past → error shown "Deadline must be in the future"

4. **Missing Images**
   - [ ] Club logo fails to load → placeholder logo shown (not broken image icon)
   - [ ] Event flyer fails to load → placeholder image shown
   - [ ] Opportunity image fails to load → placeholder shown

### Post-Launch Monitoring

**Daily Checks (First 7 Days):**
- [ ] Check Supabase logs for errors (application crashes, RLS violations, auth failures)
- [ ] Check browser console for JavaScript errors (via user reports)
- [ ] Monitor email inbox for support requests (respond <24hrs)
- [ ] Query database for stuck jobs (event reminders not sent, notifications not delivered)

**Weekly Metrics (First 30 Days):**
- [ ] # of new signups (students, clubs)
- [ ] # of opportunities posted
- [ ] # of applications submitted
- [ ] # of events posted
- [ ] # of RSVPs
- [ ] Support ticket volume (types of issues)
- [ ] User-reported bugs (severity, frequency)

**Alerts Setup (Manual):**
- [ ] Set daily calendar reminder to check Supabase error logs
- [ ] Forward all support emails to phone (for 24/7 coverage)
- [ ] Create Google Alert for "ZotHub" to catch social media mentions

---

## 🚀 Launch Plan

### Pre-Launch Preparation (Days -7 to -1)

#### Week Before Launch (Must-Build Features)
- [ ] **Automated email event reminders** (cron job, test sends)
- [ ] **Email unsubscribe links** (footer in all emails, test unsubscribe flow)
- [ ] **Add to Calendar links** (.ics generation, test import to Google/Outlook/iCal)
- [ ] **File uploads** (implement Supabase Storage integration, security validation, test uploads/downloads)
- [ ] **Privacy policy** (customize template, add to footer + signup flow)
- [ ] **Email notification system** (4 triggers: application received, status change, new message, followed club post)
- [ ] **Event cancellation emails** (trigger when club cancels event, notify all attendees)
- [ ] **Advanced search** (verify keyword search across title/description/club/category)
- [ ] **Advanced filters** (verify type, date, category filters work)
- [ ] **Error states** (implement empty states, network errors, validation errors, missing images)

#### Day -3: QA Testing
- [ ] Complete manual testing checklist (see QA section above)
- [ ] Test on real devices (iPhone, Android phone, laptop)
- [ ] Test cross-browser (Chrome, Safari, Firefox)
- [ ] Fix all critical bugs (broken signup, failed applications, broken RSVP, broken messaging)
- [ ] Accept minor bugs if non-blocking (defer to post-launch)

#### Day -2: Club Seeding (Parallel with Marketing)
- [ ] Manually reach out to 5-10 anchor clubs (ACM, IEEE, cultural orgs, pre-professional clubs)
- [ ] Offer onboarding call: "We'll help you post your first opportunity"
- [ ] Approve clubs immediately via Supabase
- [ ] Help clubs post 2-5 opportunities each (aim for 10-25 total opportunities before student launch)
- [ ] Verify opportunities look professional (good descriptions, clear requirements, realistic deadlines)

**⚠️ RISK ACKNOWLEDGED:** User chose to launch with zero pre-seeded clubs. This is extremely high risk—students will see empty platform on day one. Founder accepts risk and will rely on clubs posting quickly after launch.

#### Day -1: Marketing Prep
- [ ] **Social media posts ready:**
  - Facebook: Draft post for UCI Class of 2025/2026/2027/2028 groups
  - Reddit: Draft r/UCI post (title: "ZotHub: Find UCI club opportunities in one place")
  - Instagram: Create graphic + caption
  - Discord: Draft messages for popular UCI servers
- [ ] **Campus tabling:** Reserve table at student center, print flyers with QR code to zothub.lovable.app
- [ ] **Student government partnership:** Email ASUCI or club council, request promotion in newsletter/social channels
- [ ] **Mass email:** Draft email to all UCI students (if approved by UCI or purchasing list)

### Launch Day (Day 0)

#### Morning (9:00 AM PST)
- [ ] **Final smoke test:** Signup, post opportunity, apply, RSVP, message (verify all critical paths work)
- [ ] **Deploy privacy policy:** Verify link in footer works
- [ ] **Post on social media:** Publish Facebook, Reddit, Instagram, Discord posts simultaneously
- [ ] **Send email blast** (if ready)

#### Afternoon (12:00 PM PST)
- [ ] **Campus tabling:** Set up table at student center, demo platform to students, collect signups
- [ ] **Monitor errors:** Check Supabase logs every hour for crashes
- [ ] **Respond to support emails:** <1 hour response time for first day

#### Evening (6:00 PM PST)
- [ ] **Check metrics:**
  - [ ] How many students signed up? (Target: 50-100 on day one)
  - [ ] How many clubs signed up? (Target: 5-10 on day one)
  - [ ] How many opportunities posted? (Target: 5-15 on day one)
  - [ ] Any critical bugs reported?
- [ ] **Fix critical bugs immediately** (push hotfix if needed)
- [ ] **Post update on social media:** "50 students joined ZotHub today! 🎉 Check out these new opportunities..."

### Post-Launch (Days 1-7)

#### Daily Tasks
- [ ] **Approve clubs:** Check Supabase for new club signups, manually approve within 12 hours
- [ ] **Monitor support inbox:** Respond to all emails <24 hours
- [ ] **Check error logs:** Supabase dashboard, browser console errors (via user reports)
- [ ] **Engage on social media:** Reply to comments, answer questions, share popular opportunities

#### Weekly Tasks
- [ ] **Metrics report:** Signups, opportunities posted, applications submitted, retention
- [ ] **User interviews:** Call 3-5 clubs, ask "How's ZotHub working for you? What's missing?"
- [ ] **Bug triage:** Prioritize fixes (critical = blocks core journey, minor = annoying but usable)
- [ ] **Feature requests:** Log requests, defer to post-MVP roadmap

### Marketing Channels

| Channel | Effort | Reach | Engagement | Notes |
|---------|--------|-------|------------|-------|
| **Social Media** | Low | High | Medium | Free, fast, but posts buried quickly. Need compelling creative. |
| **Campus Tabling** | High | Medium | Very High | In-person demo drives immediate signups. Labor-intensive but high conversion. |
| **Student Gov Partnership** | Medium | High | Medium | Adds credibility. May require pre-approval (2-4 weeks lead time). |
| **Mass Email** | Medium | Very High | Low | High reach but low open/click rates (~10-20%). Needs compelling subject line. |

**Recommended Order:**
1. **Day 0:** Social media + campus tabling (immediate reach + engagement)
2. **Day 1-3:** Continue tabling, engage on social media, email follow-ups to interested students
3. **Day 4-7:** Student government partnership (if approved), mass email (if acquired list)

---

## 🐛 Known Risks & Mitigation

### CRITICAL RISKS (Potential Launch Blockers)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **⚠️ EXPANDED SCOPE** (8 new UX features added to 1-week timeline) | VERY HIGH | CRITICAL | **RISK FLAGGED:** Original scope + 8 new features (RSVP forms, auto-archive, team sorting, filtering, etc.) significantly increases dev work. Mitigation: Prioritize ruthlessly, cut non-critical features if timeline slips, extend to 2 weeks if needed. |
| **Empty platform on day one** (no clubs/opportunities) | HIGH | CRITICAL | **RISK ACCEPTED by founder.** Mitigation: Aggressive club marketing on day 0, offer free onboarding calls, prioritize club approvals (<12hr turnaround). Fallback: Delay student launch 2-3 days if <5 clubs sign up. |
| **Email reminders don't send** (cron job fails) | MEDIUM | HIGH | **Test thoroughly:** Send test reminder to yourself 24hrs before fake event. Verify cron job logs. Fallback: Manual emails if <10 events/week. |
| **File uploads fail** (storage errors, security holes) | MEDIUM | HIGH | **Test all file types** (PDF, DOCX, PNG, JPG, forbidden types). Test max file size. Verify RLS on storage bucket. Fallback: Disable file uploads if broken, ask students to link external resumes. |
| **Auth breaks** (students can't sign up/login) | LOW | CRITICAL | **Test thoroughly:** Signup, logout, re-login, password reset. Verify Google OAuth callback. Fallback: Fix forward immediately (no rollback capability). |
| **Spam/abuse** (fake clubs, inappropriate opportunities) | MEDIUM | MEDIUM | **Mitigation:** Manual club approval (verify against UCI directory). User reports via email. Founder moderates daily via Supabase. Fallback: Ban fake clubs immediately. |
| **Performance crash** (too many concurrent users) | LOW | HIGH | **Risk accepted:** No load testing. Platform untested at 50+ concurrent users. Mitigation: Monitor Supabase performance dashboard. Fallback: Lovable.dev auto-scales, but database may slow down. Optimize queries if needed. |
| **Critical bug post-launch** (broken RSVP, failed applications) | MEDIUM | HIGH | **Mitigation:** Comprehensive manual QA before launch (see checklist). Fix forward only (push hotfix within 1-2 hours). Communicate with users via social media. |

### MEDIUM RISKS (Annoying But Not Blocking)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Students don't return** (low retention) | MEDIUM | MEDIUM | **Mitigation:** Email notifications drive re-engagement. Weekly digest of new opportunities (post-MVP). Onboard clubs that post regularly (weekly opportunities). |
| **Clubs don't post frequently** (stale content) | MEDIUM | MEDIUM | **Mitigation:** Weekly check-in emails to clubs ("Post a new opportunity this week!"). Showcase top clubs on social media to incentivize posting. |
| **Support overwhelm** (too many tickets) | MEDIUM | MEDIUM | **Mitigation:** Create FAQ doc after first week (common issues). Template responses for common questions. Accept slower response time if >20 tickets/day. |
| **Mobile UX friction** (forms awkward on phone) | MEDIUM | LOW | **Mitigation:** Test on real devices before launch. Accept minor friction for MVP. Fix worst issues post-launch. |
| **Missing features frustrate users** (no waitlist, no app editing) | MEDIUM | LOW | **Risk accepted:** MVP is intentionally minimal. Communicate clearly: "This is version 1, more features coming based on your feedback!" |

### LOW RISKS (Monitor But Not Urgent)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Privacy policy challenged** (template not thorough) | LOW | MEDIUM | **Mitigation:** Use reputable template (Termly, PrivacyPolicies.com). Revisit with lawyer if institutional partnership or >1,000 users. |
| **Storage costs exceed budget** (too many file uploads) | LOW | LOW | **Mitigation:** 1GB quota per club. Supabase free tier = 1GB total, paid tier = $0.021/GB. Acceptable for small scale. |
| **UCI blocks platform** (admin objects to student data) | LOW | HIGH | **Mitigation:** Position as student-led initiative (not official UCI tool). If challenged, offer to partner with UCI or get institutional approval. |
| **Competitor launches** (another team builds similar platform) | LOW | MEDIUM | **Mitigation:** Move fast (1-week launch). Build relationships with key clubs (lock-in effect). Focus on execution quality. |

---

## 📅 Post-MVP Roadmap (Deferred Features)

### Phase 2 (After 30 Days, Validate Product-Market Fit First)
- **Admin dashboard UI** (click-to-approve clubs, review flags, ban users)
- **Email digests** (weekly summary of new opportunities from followed clubs)
- **Waitlist for events** (students join waitlist when event full)
- **Application editing** (students can update submitted applications)
- **Account deletion** (self-service, GDPR/CCPA compliance)
- **Enhanced analytics** (funnel analysis, cohort retention, club leaderboards)
- **E2E automated tests** (Playwright/Cypress for regression prevention)

### Phase 3 (If ZotHub Gains Traction: 100+ Clubs, 2,000+ Students)
- **Custom domain** (zothub.io, professional branding)
- **Error monitoring** (Sentry for proactive bug detection)
- **Personalized recommendations** (AI-powered opportunity matching)
- **Advanced search** (saved searches, alerts for new matching opportunities)
- **Messaging attachments** (send files, images in chat)
- **Video integrations** (Zoom links for virtual events)
- **Multi-campus expansion** (extend to other UC schools)

### Phase 4 (If Monetization Needed)
- **Premium club features** (analytics dashboard, promoted listings, priority support)
- **Paid event tickets** (integrate Stripe for ticketed events)
- **Sponsored opportunities** (clubs pay to boost visibility)

---

## 🔧 Development Checklist (Final Week)

### Must Build Before Launch

#### Email System
- [ ] **Implement automated event reminder cron job**
  - [ ] Create Supabase Edge Function or cron job (runs hourly)
  - [ ] Query events starting in 24-48 hours
  - [ ] Send email to all RSVP'd students (confirmed status)
  - [ ] Track sent reminders in `notifications` table (idempotency)
  - [ ] Test: Create fake event 25 hours in future, RSVP, verify email received
- [ ] **Add unsubscribe link to all emails**
  - [ ] Create `email_preferences` table (user_id, unsubscribed_at)
  - [ ] Add unsubscribe link footer to all email templates
  - [ ] Create `/unsubscribe?token=...` route (updates preferences)
  - [ ] Test: Click unsubscribe, verify no more emails sent
- [ ] **Implement 4 notification triggers**
  - [ ] New application → in-app + email to club
  - [ ] Status change → in-app + email to student
  - [ ] New message → in-app + email to recipient
  - [ ] Followed club posts → in-app + email to followers
  - [ ] Test: Trigger each event, verify notifications arrive
- [ ] **Event cancellation emails**
  - [ ] Trigger when club deletes/cancels event with RSVPs
  - [ ] Send email to all RSVP'd students
  - [ ] Test: Cancel event, verify all attendees emailed

#### File Uploads
- [ ] **Implement file upload in application forms**
  - [ ] Add file input to form builder UI
  - [ ] Upload files to Supabase Storage bucket (`application-files`)
  - [ ] Store file URL in `applications` table (JSONB answers)
  - [ ] Test: Upload PDF resume, verify stored correctly
- [ ] **Add file upload security**
  - [ ] Client-side validation: Max 10MB, allowed MIME types (PDF, DOCX, PNG, JPG)
  - [ ] Server-side validation: Check MIME type, file size
  - [ ] RLS policy: Only receiving club can access file
  - [ ] Test: Upload .exe → blocked; upload 15MB → blocked; upload PDF → only club can download
- [ ] **Club can download application files**
  - [ ] Show download link in application review UI
  - [ ] Test: Click download, verify original filename preserved

#### Calendar Integration
- [ ] **Implement Add to Calendar .ics generation**
  - [ ] Create API route: `GET /api/events/:id/calendar.ics`
  - [ ] Generate .ics file (iCalendar RFC 5545 format)
  - [ ] Include: event name, start/end time (UTC), location, description
  - [ ] Test: Download .ics, import to Google Calendar, verify details correct

#### Search & Filters
- [ ] **Verify advanced search works**
  - [ ] Search queries title, description, club name, category/tags
  - [ ] Test: Search "marketing" → returns relevant opportunities
- [ ] **Verify advanced filters work**
  - [ ] Filter by opportunity type (leadership, internship, etc.)
  - [ ] Filter by date range (deadline after/before)
  - [ ] Filter by category (if implemented)
  - [ ] Test: Filter "internship" + deadline after "2026-02-01" → returns correct results

#### Error States
- [ ] **Implement empty states**
  - [ ] Student dashboard (no applications, no RSVPs, no bookmarks)
  - [ ] Club dashboard (no applications received)
  - [ ] Search results (no matches)
  - [ ] Opportunity/event list (no content)
- [ ] **Implement network error handling**
  - [ ] Show error message when API fails
  - [ ] Show retry button
  - [ ] Test: Disconnect internet, submit form, see error + retry
- [ ] **Implement form validation errors**
  - [ ] Required field errors
  - [ ] File upload errors (too large, wrong type)
  - [ ] Date validation (deadline in past)
- [ ] **Implement missing image placeholders**
  - [ ] Club logo placeholder
  - [ ] Event flyer placeholder
  - [ ] Opportunity image placeholder

#### Documentation
- [ ] **Write privacy policy**
  - [ ] Use template from Termly or PrivacyPolicies.com
  - [ ] Customize for ZotHub (data collected, Supabase processor, no selling)
  - [ ] Add link to footer + signup flow
- [ ] **Document club approval process**
  - [ ] Create `docs/club-approval-process.md`
  - [ ] Include: SQL queries, verification steps (check UCI club directory), approval email
  - [ ] Test: Approve one club using documented process

#### New UX Features (From Manual Testing Feedback)
- [ ] **Team Member Messaging**
  - [ ] Add message button next to each team member on club profile
  - [ ] Clicking message button opens in-app chat with team member's personal account
  - [ ] Test: Message team member, verify chat opens and message sends
- [ ] **Application Count Display Toggle**
  - [ ] Add checkbox in opportunity creation form: "Show application count to students"
  - [ ] If checked, display "X applications" on opportunity detail page
  - [ ] Test: Post opportunity with toggle on → verify count shown; toggle off → verify count hidden
- [ ] **Auto-Archive Expired Content**
  - [ ] Filter opportunities for students: `WHERE deadline > NOW()`
  - [ ] Filter events for students: `WHERE event_date > NOW()`
  - [ ] Add "Archived" tab in club dashboard to view past opportunities/events
  - [ ] Test: Create opportunity with past deadline → verify hidden from students, visible in club archived tab
- [ ] **Event RSVP Forms**
  - [ ] Add checkbox in event creation form: "Add RSVP form"
  - [ ] If checked, show question builder UI (reuse opportunity form builder component)
  - [ ] Store RSVP questions in `events` table JSONB column (similar to opportunities)
  - [ ] Store RSVP answers in `rsvps` table JSONB column (similar to applications)
  - [ ] Display RSVP responses in event management dashboard
  - [ ] Test: Create event with RSVP form (dietary restrictions question) → RSVP as student → club sees answers
- [ ] **RSVP Approval Workflow**
  - [ ] Add checkbox in event creation form: "Require approval for RSVPs"
  - [ ] If checked, RSVPs created with status='pending' instead of 'confirmed'
  - [ ] Add RSVP review page for clubs (similar to application review): Approve/Reject buttons
  - [ ] Student sees "RSVP Pending" in dashboard until club approves
  - [ ] Send notification when RSVP approved/rejected
  - [ ] Test: Create approval-required event → RSVP → verify status='pending' → club approves → verify status='confirmed'
- [ ] **Fix Application Question Labels**
  - [ ] In application review UI, map each answer to corresponding question from `opportunity.custom_questions`
  - [ ] Display question text/label above answer (instead of "Unknown question")
  - [ ] Test: Apply to opportunity with 3 custom questions → club reviews → verify question labels display correctly
- [ ] **Application Filtering by Opportunity**
  - [ ] Add dropdown filter in application review page: "Filter by opportunity: [All | Opportunity A | Opportunity B | ...]"
  - [ ] Filter query: `WHERE opportunity_id = selected_id`
  - [ ] Test: Post 3 opportunities → receive applications for each → filter by Opportunity B → verify only B's applications shown
- [ ] **Team Member Display Order Sorting**
  - [ ] Add `display_order` integer column to `club_team_members` table
  - [ ] Add up/down arrow buttons next to each team member in team management UI
  - [ ] Clicking up → decrement display_order (move higher), down → increment (move lower)
  - [ ] Query team members `ORDER BY display_order ASC` for public profile display
  - [ ] Test: Add 3 team members → reorder President to top using arrows → verify order reflected on public club profile

### Final QA (Day -3)
- [ ] **Run full manual QA checklist** (see QA section above)
- [ ] **Test on real devices** (iPhone, Android, laptop)
- [ ] **Test cross-browser** (Chrome, Safari, Firefox)
- [ ] **Fix all critical bugs** (broken signup, failed applications, broken RSVP, broken messaging)
- [ ] **Deploy to production** (push to main branch, Lovable auto-deploys)

---

## 📞 Support & Operations

### Support Model
- **Owner:** Founder (solo operator)
- **Contact:** Personal email (yourname@gmail.com) for support@ inquiries
- **Response Time:** <24 hours (nights/weekends coverage)
- **Volume Expectation:** 5-20 support tickets/day at 200-500 students
- **Escalation:** No formal escalation (founder handles all issues)

### Common Support Scenarios

| Issue | Response Template | Resolution |
|-------|-------------------|------------|
| **Can't sign up (non-UCI email)** | "ZotHub is currently only available to UCI students and clubs with @uci.edu email addresses. If you're affiliated with UCI but don't have a @uci.edu email, please reply with your name, role, and UCI affiliation for manual whitelist approval." | Add to whitelist if legitimate |
| **Didn't receive email (password reset, notification)** | "Check your spam folder for emails from noreply@zothub.lovable.app. If still missing, confirm your email address is correct in your profile settings. I can resend the email manually if needed." | Resend via Supabase if needed |
| **Application stuck (can't submit)** | "Can you share a screenshot of the error message? Also, check: (1) All required fields filled, (2) File uploads <10MB, (3) Deadline hasn't passed." | Debug via screenshot, check database logs |
| **Club approval taking too long** | "Club approvals are manually reviewed within 12 hours. Your account was created on [date] and is currently pending. I'll prioritize your review and follow up within 2 hours." | Approve via Supabase, send confirmation email |
| **Inappropriate content reported** | "Thanks for reporting. I'll review [opportunity/event/club] within 1 hour and take action if it violates our community guidelines." | Review content, delete via Supabase if violates policy |
| **Feature request** | "Thanks for the suggestion! I'm logging this for our post-MVP roadmap. In the meantime, here's a workaround: [workaround if exists]." | Log in feature request doc |

### Club Approval Process (Detailed)

**Step-by-Step Workflow:**
1. Club signs up via `/signup` → `club_profiles` row created with `status = 'pending'`
2. Founder receives email notification (daily digest or real-time if alert set up)
3. Founder logs into Supabase dashboard → navigates to `club_profiles` table
4. **Verification Steps:**
   - [ ] Club name matches UCI official directory: https://campusorgs.uci.edu/
   - [ ] Email domain is @uci.edu (or whitelisted exception)
   - [ ] Club description is legitimate (not spam: "Free iPhone!", "Make $1000/day", etc.)
   - [ ] Logo is appropriate (no offensive images)
5. **Approve via SQL:**
   ```sql
   UPDATE club_profiles
   SET status = 'active', approved_at = NOW(), approved_by = 'founder-user-id'
   WHERE id = 'club-uuid-here';
   ```
6. **Send approval email** (manual or triggered by status change):
   - Subject: "Your ZotHub club account has been approved!"
   - Body: "Welcome to ZotHub! Your club account is now active. Start posting opportunities at https://zothub.lovable.app/club/dashboard."
7. **If rejected** (fake club, spam):
   ```sql
   UPDATE club_profiles
   SET status = 'rejected', rejected_reason = 'Not found in UCI club directory'
   WHERE id = 'club-uuid-here';
   ```
   - Send rejection email: "Your club account could not be verified. If this is an error, please reply with proof of official UCI club status."

**Approval SLA:** <12 hours (check Supabase 2x per day: morning + evening)

---

## 📝 Appendices

### A. Glossary

| Term | Definition |
|------|------------|
| **Opportunity** | A posted position by a club (leadership role, internship, project, volunteer position, committee role, or other) |
| **Application** | A student's submission to an opportunity, including answers to custom form questions and optional file uploads |
| **RSVP** | Student's registration for an event (confirmed or cancelled status) |
| **Bookmark** | Student's saved opportunity, event, or club for later reference |
| **Follow** | Student's subscription to a club's updates (new opportunities/events appear in personalized feed) |
| **Feed** | Chronological stream of opportunities and events (global feed = all content, personalized feed = followed clubs only) |
| **Hard Deadline** | Application deadline that is automatically enforced (apply button disabled after deadline passes) |
| **Soft Delete** | Hiding content from public view while preserving data in database (opposite of hard delete/permanent removal) |
| **RLS (Row Level Security)** | Supabase database feature that restricts data access based on user role (students see only own data, clubs see only own opportunities) |
| **Cron Job** | Scheduled task that runs automatically at specified intervals (e.g., event reminder emails sent hourly) |
| **.ics File** | iCalendar file format for exporting events to calendar applications (Google Calendar, Outlook, Apple Calendar) |

### B. Key Metrics Dashboard (SQL Queries)

**Weekly Metrics Report:**
```sql
-- Total signups this week
SELECT
  COUNT(*) FILTER (WHERE role = 'student') AS students,
  COUNT(*) FILTER (WHERE role = 'club') AS clubs
FROM user_roles
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Opportunities posted this week
SELECT COUNT(*) FROM opportunities
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Applications submitted this week
SELECT COUNT(*) FROM applications
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Event RSVPs this week
SELECT COUNT(*) FROM rsvps
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND status = 'confirmed';

-- Top opportunities (most applications)
SELECT o.title, c.name AS club, COUNT(a.id) AS applications
FROM opportunities o
JOIN club_profiles c ON o.club_id = c.id
LEFT JOIN applications a ON o.id = a.opportunity_id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY o.id, c.name
ORDER BY applications DESC
LIMIT 10;

-- Student retention (returning students)
SELECT COUNT(DISTINCT student_id) AS returning_students
FROM applications
WHERE student_id IN (
  SELECT DISTINCT student_id FROM applications
  WHERE created_at < NOW() - INTERVAL '7 days'
)
AND created_at >= NOW() - INTERVAL '7 days';
```

### C. Email Templates

#### Event Reminder Email
**Subject:** Reminder: [Event Name] is tomorrow!

**Body:**
```
Hi [Student Name],

This is a reminder that you're registered for:

**[Event Name]**
📅 [Day, Month Date] at [Time]
📍 [Location]

Can't make it? [Cancel RSVP link]

Add to your calendar: [.ics download link]

See you there!
—The [Club Name] Team

---
You're receiving this email because you RSVP'd to this event on ZotHub.
[Unsubscribe from event reminders](unsubscribe link)
```

#### Application Status Update Email
**Subject:** Your application for [Opportunity Title] has been updated

**Body:**
```
Hi [Student Name],

Your application status for **[Opportunity Title]** has been updated:

**New Status:** [Accepted / Rejected]

[If accepted:]
Congratulations! [Club Name] wants to move forward with you. Check your ZotHub messages for next steps from the club.

[If rejected:]
Thank you for your interest in [Club Name]. We received many strong applications and encourage you to apply to other opportunities on ZotHub.

[View your application](link to application details)

---
You're receiving this email because you applied to this opportunity on ZotHub.
[Unsubscribe from application updates](unsubscribe link)
```

#### New Application Notification (to Club)
**Subject:** New application for [Opportunity Title]

**Body:**
```
Hi [Club Name],

You received a new application for **[Opportunity Title]**.

**Applicant:** [Student Name]
**Major:** [Major]
**Year:** [Year]

[View application & review answers](link to application review page)

---
You're receiving this email because you manage this opportunity on ZotHub.
[Manage email preferences](settings link)
```

### D. Privacy Policy (Template Outline)

**ZotHub Privacy Policy**

*Last Updated: [Launch Date]*

**1. Introduction**
ZotHub ("we", "us") is a student-run platform connecting UC Irvine students with club opportunities. We respect your privacy and are committed to protecting your personal data.

**2. Data We Collect**
- **Account Data:** Name, UCI email, role (student/club)
- **Profile Data:** Major, year, skills, interests, resume/portfolio (optional)
- **Activity Data:** Applications submitted, events RSVP'd, bookmarks, messages sent
- **Technical Data:** IP address, browser type, device type (via logs)

**3. How We Use Your Data**
- **Matching:** Connect students with relevant opportunities
- **Communication:** Send notifications, event reminders, application updates
- **Analytics:** Understand platform usage to improve features
- **Security:** Prevent fraud, abuse, and unauthorized access

**4. Data Sharing**
- **With Clubs:** When you apply to an opportunity, your name, email, profile, and application answers are visible to the club
- **With Other Students:** Your profile is visible to clubs when you apply or RSVP (not publicly searchable)
- **Third-Party Processors:** Supabase (database hosting), Lovable.dev (application hosting)
- **We DO NOT sell your data** to advertisers or third parties

**5. Your Rights**
- **Access:** View your data in your profile settings
- **Correction:** Edit your profile anytime
- **Deletion:** Email support@zothub.lovable.app to request account deletion (manual process, 30-day response time)
- **Unsubscribe:** Click unsubscribe links in emails or manage preferences in settings

**6. Data Retention**
We retain your data indefinitely to preserve platform history. If you request deletion, we will remove your data within 30 days (except for legal/audit requirements).

**7. Security**
We use industry-standard security (HTTPS, database encryption, Row Level Security) to protect your data. No system is 100% secure; use strong passwords and report suspicious activity immediately.

**8. Cookies**
We use essential cookies for authentication (session management). We do not use tracking cookies or third-party advertising cookies.

**9. Children's Privacy**
ZotHub is intended for college students (18+). We do not knowingly collect data from anyone under 18.

**10. Changes to This Policy**
We may update this policy as we add features. We'll notify you via email for significant changes.

**11. Contact Us**
Questions? Email [yourpersonalemail@gmail.com]

Physical Address: [Use UCI address or Lovable.dev address for CAN-SPAM compliance]

---

## ✅ Launch Readiness Checklist

### Must-Have Before Launch
- [ ] All features in "Must Build This Week" section implemented and tested
- [ ] Complete manual QA checklist (student journey, club journey, cross-browser, mobile)
- [ ] Privacy policy published and linked in footer
- [ ] Club approval workflow documented
- [ ] Support email set up (personal email forwarding)
- [ ] Marketing materials ready (social media posts, flyers, email drafts)
- [ ] Founder prepared for 24/7 support coverage (phone alerts, calendar reminders)

### Nice-to-Have (Defer If Time-Constrained)
- [ ] Pre-launch club seeding (5-10 clubs with opportunities)
- [ ] FAQ documentation
- [ ] User onboarding tutorial
- [ ] Admin dashboard UI

### Post-Launch (Within 7 Days)
- [ ] Daily error log monitoring
- [ ] Weekly metrics report (signups, opportunities, applications)
- [ ] User interviews (3-5 clubs, 5-10 students)
- [ ] Bug triage and hotfixes

---

**END OF PRD**

---

## Document Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-20 | Initial PRD based on stakeholder interview (18 question batches) | Claude |
| 1.1 | 2026-01-20 | Added 8 UX features from manual testing feedback: team messaging, application count toggle, auto-archive, RSVP forms, RSVP approval, question label fix, application filtering, team sorting | Claude |

---

**Approval Signatures**

**Product Owner:** _____________________ Date: _____
**Tech Lead:** _____________________ Date: _____
**Stakeholder:** _____________________ Date: _____
