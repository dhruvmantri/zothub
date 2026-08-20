# ZotHub

**Your gateway to UCI campus life** - Discover opportunities, connect with clubs, and make the most of your UCI experience.

> 📋 **For engineering work:** [`docs/BACKLOG.md`](./docs/BACKLOG.md) is the **single log of
> everything open** — what to implement, fix, remove, or decide. Start there.
> [`prd.md`](./prd.md) is the product spec; [`plan.md`](./plan.md) is engineering history.
> Superseded planning docs are archived under [`docs/archive/`](./docs/archive/).

## About ZotHub

ZotHub is a comprehensive web platform built for the University of California, Irvine (UCI) campus community. It serves as a centralized hub that connects students with campus clubs, events, and opportunities.

### For Students
- 🔍 **Discover Opportunities** - Browse leadership roles, projects, internships, and volunteer positions
- 📅 **Never Miss Events** - RSVP to workshops, socials, and get automated reminders
- 💬 **Connect with Clubs** - Message clubs directly and stay updated on their activities
- 📊 **Track Applications** - Monitor your application status with real-time updates
- 🔖 **Bookmark & Save** - Save opportunities, events, and clubs for later
- 📈 **Personalized Feed** - Get updates from clubs you follow

### For Clubs
- 📢 **Post Opportunities** - Share leadership roles, projects, and positions
- 🎉 **Create Events** - Manage events, RSVPs, and attendance
- 📝 **Review Applications** - Custom application forms with question builder
- 👥 **Team Management** - Invite and manage team members
- 📊 **Analytics Dashboard** - Track views, applications, and engagement
- 💬 **Messaging** - Communicate with interested students

## Tech Stack

This project is built with modern web technologies:

- **Frontend Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.19 with SWC for fast compilation
- **Styling**: Tailwind CSS 3.4.17 with custom design system
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Routing**: React Router DOM 6.30.1
- **State Management**:
  - React Context (Authentication)
  - TanStack Query v5 (Server state & caching)
- **Backend**: Supabase (PostgreSQL + Real-time + Auth)
- **Authentication**: Supabase Auth with Google OAuth (@uci.edu domain)
- **Animations**: Framer Motion
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Theme**: next-themes (Dark/Light mode support)

## Getting Started

### Prerequisites

- Node.js 18+ and npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- A Supabase account and project - [Create one here](https://supabase.com)

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <YOUR_GIT_URL>
   cd zothub
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**

   Create a \`.env\` file in the root directory:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

   Then fill in your Supabase credentials:
   \`\`\`env
   VITE_SUPABASE_PROJECT_ID=your_project_id
   VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   \`\`\`

4. **Set up the database**

   Run the migrations in the \`supabase/migrations/\` directory in your Supabase project.

   Also deploy the 6 Edge Functions in \`supabase/functions/\` (\`send-email\`, \`send-otp\`, \`verify-otp\`, \`send-reminders\`, \`submit-club-claim\`, \`review-club-claim\`) via the Supabase CLI. Signup (OTP verification), all outbound email, and the club-claim flow depend on these.

   **Required Edge Function secrets** — set these *before* deploying, or signup fails closed:
   - \`RESEND_API_KEY\` — all outbound email.
   - \`TURNSTILE_SECRET_KEY\` — **required.** Without it, \`send-otp\` and \`submit-club-claim\` return **503** by design (fail-closed bot protection). The only supported bypass is \`CAPTCHA_DISABLED=true\`, which is for **local development only — never set it in production**.
   - \`PUBLIC_SITE_URL\` — e.g. \`https://zothub.app\`; used to build password-set links.

   Also allowlist \`<your-site>/reset-password\` under Supabase **Auth → redirect URLs**.

   **Access model:** **students are auto-approved** once they verify their \`@uci.edu\` email by OTP. **Clubs** still go through the \`/admin\` waitlist queue for manual approval, and a pending club's profile stays unpublished (invisible in the public directory) until an admin approves it. See "Access Model" in \`prd.md\`.

5. **Start the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

   The app will be available at \`http://localhost:8080\`

## Available Scripts

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build for production
- \`npm run build:dev\` - Build in development mode
- \`npm run preview\` - Preview production build locally
- \`npm run lint\` - Run ESLint to check code quality

## Project Structure

\`\`\`
zothub/
├── src/
│   ├── components/       # Reusable React components
│   │   ├── ui/          # shadcn/ui components (52 components)
│   │   ├── cards/       # Card components for opportunities, events
│   │   ├── dashboard/   # Club dashboard components
│   │   └── ...
│   ├── pages/           # Page components (24 pages)
│   │   ├── club/        # Club-specific pages
│   │   ├── student/     # Student-specific pages (via components)
│   │   └── ...
│   ├── contexts/        # React Context providers
│   ├── hooks/           # Custom React hooks (8 hooks)
│   ├── integrations/    # Third-party integrations
│   │   └── supabase/   # Supabase client and types
│   ├── types/           # TypeScript type definitions
│   ├── lib/             # Utility functions
│   ├── App.tsx          # Main app with routing
│   └── main.tsx         # App entry point
├── supabase/
│   └── migrations/      # Database migration files
├── public/              # Static assets
└── package.json         # Dependencies and scripts
\`\`\`

## Key Features Implementation

### Authentication
- UCI email-only signup (@uci.edu domain restriction)
- Google OAuth integration (restricted to UCI workspace)
- Role-based access control (Student vs Club)
- Protected routes with automatic redirects

### Real-time Features
- Live notifications using Supabase subscriptions
- Real-time messaging between students and clubs
- Instant RSVP updates for events
- Live application status updates

### Data Management
- Efficient server state caching with TanStack Query
- Optimistic UI updates for better UX
- Automatic data refetching and invalidation
- Error handling and retry logic

## Database Schema

The application uses the following main tables:
- \`user_roles\` - User role assignment (student/club/admin)
- \`student_profiles\` - Student profile information
- \`club_profiles\` - Club profile information
- \`opportunities\` - Posted opportunities
- \`events\` - Campus events
- \`applications\` - Student applications
- \`rsvps\` - Event RSVPs
- \`messages\` - Direct messages
- \`notifications\` - User notifications
- \`notification_preferences\` - Per-user notification settings
- \`bookmarks\` - Saved items
- \`club_team_members\` - Club team management
- \`club_followers\` - Club follow relationships (personalized feed)
- \`waitlist\` - Signup approval queue (see Access Model in \`prd.md\`)
- \`email_verifications\` - OTP signup verification codes
- \`page_views\` - View tracking for club analytics
- \`reminder_logs\` - Sent-reminder ledger (idempotency for the hourly cron job)

## Contributing

1. Create a feature branch from \`main\`
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## Deployment

ZotHub is **live in production** on **Vercel** at [zothub.app](https://zothub.app) (and [www.zothub.app](https://www.zothub.app)) — DNS cutover to Vercel is complete with valid TLS — backed by a self-owned Supabase project. This repo previously ran on Lovable Cloud/Lovable hosting during initial development; that migration is complete, the Supabase migration history has been reconciled (new migrations deploy via the normal `supabase db push` flow), and **Lovable no longer serves production traffic** (kept untouched for a short fallback window; decommission is a future manual step). See \`docs/archive/MIGRATION.md\` for migration history and \`docs/BACKLOG.md\` for current open work.

1. Build the project:
   \`\`\`bash
   npm run build
   \`\`\`

2. Vercel builds and deploys automatically on push to \`main\` (framework preset: Vite, output directory: \`dist\`).

3. Environment variables are set in the Vercel project dashboard (see below).

4. OAuth redirect URLs and Auth settings are configured in the Supabase project dashboard.

Edge Functions (\`supabase/functions/\`) deploy separately via the Supabase CLI — see \`docs/BACKLOG.md\` for current open work.

## Database Migrations

Schema changes use **normal Supabase migration files + the Supabase CLI** (the migration history is reconciled with production, so this is the standard flow — no manual raw SQL, no \`db reset\`):

1. Create a new timestamped migration in \`supabase/migrations/\` (e.g. \`supabase migration new <name>\`), and write idempotent SQL where practical.
2. Test it locally before pushing (the repo is regularly validated by applying **all** migrations to a fresh local Postgres).
3. Apply to the linked project with \`npx supabase db push --linked\`; confirm with \`npx supabase migration list --linked\` (local should match remote) and \`npx supabase db push --linked --dry-run\` ("Remote database is up to date").
4. If the change adds/edits an Edge Function, redeploy it: \`supabase functions deploy <name>\`.

Do **not** hand-apply SQL to production as the normal path, and never run \`supabase db reset\` against production.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
### Client build (Vercel / \`.env\`)

| Variable | Description | Example |
|----------|-------------|---------|
| \`VITE_SUPABASE_PROJECT_ID\` | Your Supabase project ID | \`abc123xyz\` |
| \`VITE_SUPABASE_PUBLISHABLE_KEY\` | Supabase anonymous/public key | \`eyJhbGc...\` |
| \`VITE_SUPABASE_URL\` | Your Supabase project URL | \`https://abc.supabase.co\` |
| \`VITE_TURNSTILE_SITE_KEY\` | Cloudflare Turnstile **site** key. **Required for production builds.** It is inlined at build time, so it must be set *before* the build — a production build without it renders a visible error and **blocks signup and club claims**. Must pair with \`TURNSTILE_SECRET_KEY\`. | \`0x4AAA...\` |

### Edge Functions (Supabase secrets)

| Variable | Description |
|----------|-------------|
| \`RESEND_API_KEY\` | All outbound email. |
| \`TURNSTILE_SECRET_KEY\` | Turnstile **secret** key, from the same widget as the site key. **Required** — without it \`send-otp\` / \`submit-club-claim\` return 503. |
| \`PUBLIC_SITE_URL\` | Public origin, e.g. \`https://zothub.app\`. Used to build password-set links. |
| \`CAPTCHA_DISABLED\` | **Local development only.** \`true\` skips captcha verification. Never set in production. |

## Security

- ⚠️ **Never commit \`.env\` files** to version control
- ✅ Supabase Row Level Security (RLS) policies are enforced
- ✅ Email domain validation for UCI users only
- ✅ Role-based access control for routes and data
- ✅ Input validation using Zod schemas

## License

This project is proprietary software for UCI campus use.

## Support

For issues or questions:
- Create an issue in this repository
- Contact the development team

---

**Built with ❤️ for UCI Anteaters** 🐜🔱
