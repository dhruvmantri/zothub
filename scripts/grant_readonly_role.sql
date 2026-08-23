-- Create a strictly READ-ONLY database role for agent-assisted verification.
--
-- WHY: several backlog items (S6, S7, the ProtectedRoute role-passthrough unknown,
-- MB5-logo counts, D1 targets) cannot be settled from the repo — they are facts about
-- production data. Handing over a superuser connection string would be full write
-- access. This role can SELECT and nothing else.
--
-- ⚠️ RUN BY THE MAINTAINER ONLY. This is the one write in the read-only workflow.
--    Review every line before running. Supabase dashboard → SQL Editor.
--
-- 1. Replace <PICK-A-STRONG-PASSWORD> below with a fresh random password.
-- 2. Run this whole file.
-- 3. Hand over ONLY the connection string, not the password to any other role:
--      postgresql://claude_ro:<PASSWORD>@<HOST>:5432/postgres
--    (Host is in Supabase → Project Settings → Database → Connection string.)
-- 4. To revoke at any time, run the REVOKE block at the bottom.

BEGIN;

-- A login role with NO inherited privileges beyond what we grant explicitly.
-- NOCREATEDB / NOCREATEROLE / NOSUPERUSER / NOBYPASSRLS are the defaults for
-- CREATE ROLE, but they are stated here so the intent is unmistakable.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'claude_ro') THEN
    CREATE ROLE claude_ro LOGIN PASSWORD '<PICK-A-STRONG-PASSWORD>'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

-- Connect + read the public schema only.
GRANT CONNECT ON DATABASE postgres TO claude_ro;
GRANT USAGE ON SCHEMA public TO claude_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claude_ro;

-- Read the cron catalogue — this is what settles S6 (is a service-role JWT sitting
-- in plaintext inside the reminder job definition?).
GRANT USAGE ON SCHEMA cron TO claude_ro;
GRANT SELECT ON cron.job TO claude_ro;

-- Read auth.users for the orphan/role checks. Emails are visible to this role;
-- that is the whole privacy cost of read-only access, and today there are only
-- 3 real accounts.
GRANT USAGE ON SCHEMA auth TO claude_ro;
GRANT SELECT ON auth.users TO claude_ro;

-- Belt and braces: make absolutely sure nothing writeable leaked in.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM claude_ro;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM claude_ro;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM claude_ro;

-- RLS still applies to this role (NOBYPASSRLS), so anything RLS hides stays hidden.

COMMIT;

-- Verify what was granted (run this after, and check the output looks right):
--   SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin
--   FROM pg_roles WHERE rolname = 'claude_ro';
--   SELECT table_schema, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE grantee = 'claude_ro' AND privilege_type <> 'SELECT';
--   -- ^ the second query MUST return zero rows.

-- ---------------------------------------------------------------------------
-- TO REVOKE (run this whenever you want access gone):
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM claude_ro;
--   REVOKE ALL ON SCHEMA public, cron, auth FROM claude_ro;
--   REVOKE ALL ON cron.job, auth.users FROM claude_ro;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM claude_ro;
--   DROP ROLE claude_ro;
-- ---------------------------------------------------------------------------
