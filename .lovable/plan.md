# Migrate ZotHub from Lovable Cloud to Your Own Supabase

You've confirmed: new Supabase project already created, migrate everything (schema + all data + auth users + storage files + edge functions + auth config + cron).

---

## ⚠️ Important limitations to know up front

Lovable Cloud hides two things I cannot access programmatically from here:

1. **The Cloud project's `SUPABASE_SERVICE_ROLE_KEY` and database password.** These are needed to (a) dump all data including `auth.users`, and (b) migrate password hashes so existing users keep their passwords.
2. **Direct `pg_dump` / `pg_restore` from Cloud.** Exec-based DB access is select/insert only, and full DB dumps are not offered from chat.

**What this means for you:**
- You'll need to run a few CLI commands locally (I'll give exact commands).
- Auth user migration path options — you pick in Step 3.
- After migration, this project's `.env` gets pointed at your new Supabase and Lovable Cloud is effectively unused (it can't be "disconnected" from this project — that's a Cloud limitation — but nothing will call it).

---

## Migration overview

| Step | What | Who runs it |
|---|---|---|
| 1 | Collect credentials for old Cloud + new Supabase | You |
| 2 | Export schema (14 tables, 15 functions, 40+ RLS policies, enums, triggers) → apply to new project | Me + You |
| 3 | Export & import auth users (choose strategy) | You (CLI) |
| 4 | Export & import table data (all rows) | You (CLI) |
| 5 | Migrate storage buckets + all files (`club-assets`, `student-resumes`) | You (script I write) |
| 6 | Redeploy 4 edge functions to new project + set `RESEND_API_KEY` | You (Supabase CLI) |
| 7 | Reconfigure Auth: Google OAuth (uci.edu `hd`), Site URL, redirect URLs, email templates | You (Supabase dashboard) |
| 8 | Recreate `pg_cron` hourly reminder job | Me (SQL) |
| 9 | Swap `.env` → point client at new Supabase; update `src/integrations/supabase/types.ts` | Me |
| 10 | Full smoke test (signup OTP, login, RSVP, apply, admin, cron, emails) | You + Me |

---

## Step 1 — Credentials I need from you

From your **new** Supabase project (Settings → API and Settings → Database):
- Project URL (`https://<ref>.supabase.co`)
- `anon` publishable key
- `service_role` key (paste into secret — I'll open the form)
- Database connection string with password
- Project ref (the `<ref>` part)

From your **old** Lovable Cloud (you'll need to fetch these yourself since I can't read them):
- The Cloud DB password → go to Cloud → Advanced settings → Export data to download a full dump (Lovable's official export path).

---

## Step 2 — Schema migration

I already have full visibility into the current schema. I'll generate one consolidated SQL file containing, in order:

1. Extensions: `pg_cron`, `pg_net`, `pgcrypto`
2. Enums: `user_role` (student/club/admin), any others
3. All 14 tables with columns, defaults, FKs, unique constraints
4. All 15 SECURITY DEFINER functions (`has_role`, `is_own_student_profile`, `club_owns_opportunity`, `club_can_view_student`, `get_*_public_profile`, `track_page_view`, `archive_past_events`, notification triggers, etc.)
5. All triggers (notification triggers on applications/messages/opportunities/events/team_members, `update_updated_at_column` triggers, cleanup triggers)
6. `GRANT` statements per table (authenticated + service_role; anon only where public read is intended)
7. Enable RLS + all 40+ policies

You run this file against the new DB via `psql` or the Supabase SQL editor.

## Step 3 — Auth users (pick one, tell me in follow-up)

- **A. Preserve passwords (best UX).** Requires SQL-level insert into `auth.users` copying `encrypted_password`, `email_confirmed_at`, `id`, provider info, `raw_user_meta_data`. Needs the Cloud DB dump from Step 1. Users log in with existing credentials seamlessly.
- **B. Force password reset.** Copy only email + id + metadata; on first login users go through "forgot password". Simpler, safer, but every user must reset.
- **C. Start fresh.** Everyone re-signs up. Rejected because you chose "migrate everything" — listed for completeness.

Regardless of choice, user `id` (UUID) is preserved so all FKs stay valid.

## Step 4 — Table data

Order matters (FKs): `user_roles` → `student_profiles` / `club_profiles` → `club_team_members` / `club_followers` → `opportunities` / `events` → `applications` / `rsvps` / `bookmarks` → `messages` / `notifications` / `notification_preferences` → `page_views` / `reminder_logs` / `email_verifications` / `waitlist`.

I'll give you a bash script that uses `pg_dump --data-only --table=... | psql` per-table in the correct order. Sequences reset afterwards.

## Step 5 — Storage buckets

I'll write a Deno/Node script that:
1. Creates `club-assets` (public) and `student-resumes` (private) in the new project via tool.
2. Lists every object in each old bucket, downloads via signed URL, re-uploads to new bucket at the same path.
3. Applies matching RLS policies on `storage.objects` (public read for club-assets; owner-only for student-resumes).

Because paths are preserved, existing `logo_url` / `banner_url` / `avatar_url` / resume URLs in the DB get rewritten with a single `UPDATE` that swaps the old project ref for the new one.

## Step 6 — Edge functions

Redeploy `send-otp`, `verify-otp`, `send-email`, `send-reminders` to the new project via Supabase CLI (`supabase functions deploy <name>`). Set `RESEND_API_KEY` as a secret in the new project. The functions already use `Deno.env.get("SUPABASE_URL"/"SUPABASE_SERVICE_ROLE_KEY")` which Supabase auto-injects, so no code changes needed.

## Step 7 — Auth configuration

In the new Supabase dashboard:
- Authentication → URL Configuration: Site URL = `https://zothub.app`, add redirect URLs for `https://zothub.app/**`, `https://www.zothub.app/**`, `https://zothub.lovable.app/**`, `http://localhost:8080/**`.
- Providers → Google: enable, paste your existing Google OAuth client ID/secret, set `hd=uci.edu` hosted domain restriction.
- Email templates: since custom OTP flow uses Resend directly, default Supabase auth emails only fire for password reset — restyle those to match ZotHub if desired.
- Disable anonymous sign-ins. Keep email confirmations off (OTP handles it).

## Step 8 — pg_cron

Recreate the hourly reminder job in the new DB pointing at the new function URL + new anon key:

```text
select cron.schedule('send-reminders-hourly', '0 * * * *', $$...net.http_post(url:='https://<NEW_REF>.supabase.co/functions/v1/send-reminders', ...)$$);
```

## Step 9 — Client swap

Update project `.env`:
- `VITE_SUPABASE_URL` → new URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` → new anon key
- `VITE_SUPABASE_PROJECT_ID` → new ref

Regenerate `src/integrations/supabase/types.ts` from the new project (`supabase gen types typescript --project-id=<new_ref>`).

No component code changes expected — all imports go through `@/integrations/supabase/client`, which reads env vars.

## Step 10 — Smoke test checklist

- Landing loads, no console errors
- Sign up with a fresh @uci.edu email → OTP arrives → verify → lands on waitlist
- Admin (`zothub.uci@gmail.com`) can log in and approve
- Existing user can log in (or reset password if Strategy B)
- Student can bookmark, apply, RSVP
- Club can create opportunity → follower gets email
- Cancel event → attendees get cancellation email
- Cron fires within an hour (check `reminder_logs`)
- Storage: existing club logo displays; new resume upload works

---

## Technical Details (for reference)

### Files I will modify
- `.env` (URL/key/project ref swap)
- `src/integrations/supabase/types.ts` (regenerated)
- One consolidated `migration_schema.sql` for you to run manually against new DB
- One `migrate_storage.ts` script for you to run

### Files I will NOT modify
- `src/integrations/supabase/client.ts` (env-driven, no change needed)
- All application code (component imports remain identical)
- All 4 edge function source files (env vars stay the same names)

### Cannot be automated from this chat
- `pg_dump` of old Cloud DB (you run locally with the password from Cloud → Export data)
- `psql` restore into new DB (you run locally)
- Supabase dashboard clicks for Google OAuth secret, email templates, redirect URLs
- Setting `RESEND_API_KEY` in new project (Supabase dashboard or CLI)

### Rollback plan
Keep the old Cloud project alive and un-touched during migration. If Step 10 reveals a problem, revert `.env` to the Cloud values and everything returns to the current state.

---

## Estimated timeline
~2–4 hours of active work, most of it in your terminal running the scripts I provide and clicking through the new Supabase dashboard.

**Confirm which auth-user strategy (A, B, or C) you want in Step 3**, then approve and I'll start with Step 2 (the consolidated schema SQL) and Step 5 (the storage migration script).
