# ZotHub: Lovable Cloud → Self-Owned Supabase Migration Runbook

All commands run **on your local machine** (not in this chat). You need:

- `psql` and `pg_dump` (Postgres 15+ client tools; `brew install libpq && brew link --force libpq` on macOS)
- `supabase` CLI (`brew install supabase/tap/supabase`)
- `deno` (for the storage migration script) — `brew install deno`

---

## 0. Set up environment variables

Fill these in, then `source env.migration.sh` in every terminal session.

```bash
# env.migration.sh

# --- OLD (Lovable Cloud) ---
# Get DB URL + service role key from Lovable → Cloud → Advanced settings → Export data
export OLD_DB_URL="postgresql://postgres.alpmifyiwwrkolixwyvz:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
export OLD_URL="https://alpmifyiwwrkolixwyvz.supabase.co"
export OLD_SERVICE_KEY="..."   # from Cloud export screen

# --- NEW (your own Supabase) ---
export NEW_REF="xxxxxxxxxxxx"
export NEW_DB_URL="postgresql://postgres.${NEW_REF}:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
export NEW_URL="https://${NEW_REF}.supabase.co"
export NEW_SERVICE_KEY="..."   # Settings → API → service_role
export NEW_ANON_KEY="..."      # Settings → API → anon / publishable
```

Sanity check both connections:

```bash
psql "$OLD_DB_URL" -c "select current_database(), now();"
psql "$NEW_DB_URL" -c "select current_database(), now();"
```

---

## 1. Dump schema from old DB

```bash
pg_dump "$OLD_DB_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file=zothub_schema.sql
```

Then hand-append the GRANT block (Supabase strips privileges without `--no-privileges`, but with it, the app can't read anything until you re-grant). Append to `zothub_schema.sql`:

```sql
-- Grants
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
  END LOOP;
END $$;

-- Anon read where policies allow (public listing pages)
GRANT SELECT ON public.club_profiles, public.opportunities, public.events, public.club_followers TO anon;

-- Extensions (must exist before restore of functions that use them)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

Move the `CREATE EXTENSION` lines to the **top** of `zothub_schema.sql`.

## 2. Apply schema to new DB

```bash
psql "$NEW_DB_URL" -f zothub_schema.sql
```

Expect a handful of `already exists` notices for `auth.*` triggers Supabase pre-creates — ignore them. Any real error, stop and share it with me.

---

## 3. Migrate auth users

**Pick a strategy** (tell me which you want in chat after Step 2 succeeds):

### Strategy A — Preserve passwords (seamless login)

```bash
pg_dump "$OLD_DB_URL" \
  --data-only \
  --table=auth.users \
  --table=auth.identities \
  --column-inserts \
  --file=auth_users.sql

psql "$NEW_DB_URL" -c "TRUNCATE auth.identities, auth.users CASCADE;"
psql "$NEW_DB_URL" -f auth_users.sql
```

### Strategy B — Force password reset (safer, users reset via /forgot-password)

```bash
psql "$OLD_DB_URL" -Atc "COPY (SELECT id, email, raw_user_meta_data, created_at FROM auth.users) TO STDOUT WITH CSV" > users.csv
# Then use the Supabase Admin API to create users with same UUIDs, no password
deno run --allow-net --allow-env --allow-read scripts/import_users_no_password.ts
```

I'll provide `import_users_no_password.ts` after you pick B.

---

## 4. Migrate table data

```bash
# FK-safe order
TABLES=(
  user_roles
  student_profiles club_profiles
  club_team_members club_followers
  opportunities events
  applications rsvps bookmarks
  messages notifications notification_preferences
  page_views reminder_logs email_verifications waitlist
)

for t in "${TABLES[@]}"; do
  echo "=== $t ==="
  pg_dump "$OLD_DB_URL" --data-only --no-owner --table="public.$t" \
    | psql "$NEW_DB_URL" -v ON_ERROR_STOP=1
done

# Reset sequences
psql "$NEW_DB_URL" <<'SQL'
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, sequencename FROM pg_sequences WHERE schemaname='public' LOOP
    EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM %I.%I), 1))',
      r.schemaname||'.'||r.sequencename, r.schemaname,
      replace(r.sequencename, '_id_seq',''));
  END LOOP;
END $$;
SQL
```

---

## 5. Migrate storage buckets + files

Run:

```bash
deno run --allow-net --allow-env scripts/migrate_storage.ts
```

Script is at `scripts/migrate_storage.ts` in this repo (created below). It:

1. Creates `club-assets` (public) and `student-resumes` (private) in the new project.
2. Streams every object from old → new bucket, preserving paths.
3. Prints a summary of copied / failed objects.

After it finishes, rewrite stored URLs in the DB so they point to the new project:

```bash
psql "$NEW_DB_URL" <<SQL
UPDATE club_profiles    SET logo_url    = replace(logo_url,   'alpmifyiwwrkolixwyvz', '$NEW_REF') WHERE logo_url   ILIKE '%alpmifyiwwrkolixwyvz%';
UPDATE club_profiles    SET banner_url  = replace(banner_url, 'alpmifyiwwrkolixwyvz', '$NEW_REF') WHERE banner_url ILIKE '%alpmifyiwwrkolixwyvz%';
UPDATE student_profiles SET avatar_url  = replace(avatar_url, 'alpmifyiwwrkolixwyvz', '$NEW_REF') WHERE avatar_url ILIKE '%alpmifyiwwrkolixwyvz%';
-- resume_url (if stored)
UPDATE student_profiles SET resume_url  = replace(resume_url, 'alpmifyiwwrkolixwyvz', '$NEW_REF') WHERE resume_url ILIKE '%alpmifyiwwrkolixwyvz%';
SQL
```

Then add storage RLS policies (they don't come across via pg_dump of `public`):

```sql
-- Public read on club-assets
CREATE POLICY "Public read club-assets"       ON storage.objects FOR SELECT USING (bucket_id = 'club-assets');
CREATE POLICY "Clubs can upload their assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'club-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Clubs can update their assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'club-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Clubs can delete their assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'club-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Private student-resumes: owner-only + club-can-view-applicant
CREATE POLICY "Students manage own resumes" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'student-resumes' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'student-resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
```

If your existing policies differ, dump them from old and paste here — grab with:

```bash
psql "$OLD_DB_URL" -c "\dp storage.objects"
```

---

## 6. Redeploy edge functions

```bash
supabase login
supabase link --project-ref "$NEW_REF"

supabase functions deploy send-otp     --no-verify-jwt
supabase functions deploy verify-otp   --no-verify-jwt
supabase functions deploy send-email   --no-verify-jwt
supabase functions deploy send-reminders --no-verify-jwt

# Set Resend key on the new project
supabase secrets set RESEND_API_KEY="re_..."
```

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are injected automatically by Supabase — do not set them.

---

## 7. Auth configuration (new Supabase dashboard)

**Authentication → URL Configuration:**

- Site URL: `https://zothub.app`
- Redirect URLs:
  - `https://zothub.app/**`
  - `https://www.zothub.app/**`
  - `https://zothub.lovable.app/**`
  - `http://localhost:8080/**`

**Authentication → Providers:**

- **Email**: enable. Turn OFF "Confirm email" (your OTP flow handles verification).
- **Google**: enable, paste OAuth client ID + secret, set `Authorized domains` to include `uci.edu`. (The `hd=uci.edu` parameter in the sign-in call already restricts to UCI Workspace accounts.)
- **Anonymous sign-ins**: OFF.
- **Leaked password protection (HIBP)**: ON (recommended).

---

## 8. Recreate the pg_cron reminder job

```bash
psql "$NEW_DB_URL" <<SQL
SELECT cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  \$\$
  SELECT net.http_post(
    url:='${NEW_URL}/functions/v1/send-reminders',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ${NEW_ANON_KEY}',
      'apikey','${NEW_ANON_KEY}'
    ),
    body:=jsonb_build_object('time', now())
  );
  \$\$
);
SQL
```

---

## 9. Grant your admin account

```bash
psql "$NEW_DB_URL" <<SQL
-- After you sign in once via the app to create the auth.users row for zothub.uci@gmail.com
INSERT INTO user_roles (user_id, role)
  SELECT id, 'admin' FROM auth.users WHERE email='zothub.uci@gmail.com'
  ON CONFLICT DO NOTHING;
DELETE FROM waitlist WHERE email='zothub.uci@gmail.com';
SQL
```

---

## 10. Point the app at the new project

Tell me in chat when Steps 1–9 pass. I will then:

- Update `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`)
- Regenerate `src/integrations/supabase/types.ts`

DO NOT swap `.env` earlier — the app will 500 against an empty new DB.

---

## 11. Smoke test

- Preview loads without console errors
- New signup: OTP email → verify → waitlist page
- Existing user login works (Strategy A) or password-reset flow works (Strategy B)
- Bookmark / apply / RSVP round-trip
- Club posts opportunity → follower gets email
- Cancel event with RSVPs → attendees emailed
- After :00 of the next hour, `select * from reminder_logs order by sent_at desc limit 5;` shows a new row
- Club logo displays; new resume upload succeeds

---

## Rollback

If anything goes wrong at Step 11, revert `.env` to the Lovable Cloud values (I'll keep them commented at the bottom of `.env` when I swap in Step 10). App returns to the current state instantly; the old Cloud project remains untouched throughout.
