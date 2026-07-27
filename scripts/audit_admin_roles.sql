-- ============================================================================
-- audit_admin_roles.sql — READ-ONLY post-hoc admin-role audit
-- Project date: 2026-07-27
-- ============================================================================
-- WHY
--   Until migration 20260723000100_drop_self_insert_user_roles_policy.sql, a
--   permissive INSERT policy ("Users can insert their own role on signup") let
--   ANY authenticated user run
--       insert into user_roles (user_id, role) values (auth.uid(), 'admin')
--   and self-grant the admin role. That migration is now APPLIED to production
--   and the hole is closed.
--
--   Crucially, the migration only DROPs the policy — it deletes NO rows. So any
--   admin row created through the loophole is STILL present and visible. This
--   script surfaces every admin grant for manual review, so we can confirm the
--   only admin is the intended one and nobody escalated while the hole was open.
--
-- SAFETY (strictly read-only)
--   SELECT-only. No INSERT / UPDATE / DELETE, no DDL, no CREATE/DROP/ALTER, no
--   policy or role changes, no repairs. Nothing here modifies the database.
--   Safe to run against production.
--
-- HOW TO RUN
--   Supabase SQL Editor (or psql) as a privileged role — it must read the `auth`
--   schema (same access the existing scripts/audit_auth_orphans.sql needs). The
--   SQL Editor shows only the LAST result set, so run Q1, Q2, Q3 ONE AT A TIME:
--   select a numbered block and press Run.
--
-- SCHEMA — verified against migrations, not assumed:
--   public.user_roles(id uuid, user_id uuid, role user_role, created_at tstz),
--     UNIQUE(user_id, role)                              [20251223013805]
--   user_role enum = 'student' | 'club' | 'admin'        [+ 20260128213952 added 'admin']
--   public.student_profiles(user_id, email, full_name, created_at, …)   [20251223013805]
--   public.club_profiles(user_id, email, club_name, category, created_at, …) [20251223013805]
--   public.waitlist(user_id, email, role text, status, requested_at,
--     reviewed_at, reviewed_by, …)                       [20260128214112]
--   auth.users(id, email, created_at, last_sign_in_at, email_confirmed_at,
--     raw_app_meta_data) — GoTrue-managed standard columns.
--
-- EXPECTED ADMIN (the one value to review against):
--   'zothub.uci@gmail.com' — the sole entry in ADMIN_ALLOWED_EMAILS
--   (src/lib/constants.ts + send-otp + the enforce_uci_email trigger). If the
--   set of legitimate admins ever changes, edit the literal in Q2 to match.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Q1 — EVERY user_roles row. Admins sorted first and flagged, with full context
--      (identity, profile, waitlist standing, and all available timestamps).
-- ----------------------------------------------------------------------------
SELECT
  CASE WHEN ur.role = 'admin' THEN '>>> ADMIN <<<' ELSE '' END              AS flag,
  ur.role,
  ur.user_id,
  au.email                                                                  AS auth_email,
  COALESCE(cp.club_name, sp.full_name)                                      AS profile_name,
  CASE WHEN cp.user_id IS NOT NULL THEN 'club'
       WHEN sp.user_id IS NOT NULL THEN 'student'
       ELSE 'none' END                                                      AS profile_kind,
  wl.role                                                                   AS waitlist_role,
  wl.status                                                                 AS waitlist_status,
  ur.created_at                                                             AS role_granted_at,
  au.created_at                                                             AS account_created_at,
  au.last_sign_in_at,
  au.email_confirmed_at,
  au.raw_app_meta_data ->> 'provider'                                       AS signup_provider,
  (au.id IS NULL)                                                           AS orphaned_no_auth_user
FROM public.user_roles ur
LEFT JOIN auth.users               au ON au.id = ur.user_id
LEFT JOIN public.student_profiles  sp ON sp.user_id = ur.user_id
LEFT JOIN public.club_profiles     cp ON cp.user_id = ur.user_id
LEFT JOIN public.waitlist          wl ON wl.user_id = ur.user_id
ORDER BY (ur.role = 'admin') DESC, ur.created_at;


-- ----------------------------------------------------------------------------
-- Q2 — ADMIN rows only, with a best-effort legitimacy assessment.
--      Self-grant signatures: an admin that is NOT the expected account, or an
--      admin whose waitlist entry is still pending/rejected (admin without human
--      approval), or a normal user who ALSO holds admin. Reviewer makes the call;
--      this only ranks what to look at first.
-- ----------------------------------------------------------------------------
SELECT
  ur.user_id,
  au.email                                                                  AS auth_email,
  (lower(au.email) = 'zothub.uci@gmail.com')                                AS is_expected_admin,
  EXISTS (SELECT 1 FROM public.user_roles r
          WHERE r.user_id = ur.user_id AND r.role <> 'admin')               AS also_has_student_or_club_role,
  wl.status                                                                 AS waitlist_status,
  ur.created_at                                                             AS admin_granted_at,
  au.created_at                                                             AS account_created_at,
  au.last_sign_in_at,
  CASE
    WHEN au.id IS NULL
      THEN 'ORPHAN — admin row for a user_id with no auth.users account; investigate'
    WHEN lower(au.email) = 'zothub.uci@gmail.com'
      THEN 'EXPECTED admin — confirm this is intended'
    WHEN wl.status IN ('pending','rejected')
      THEN 'SUSPECT — admin without approval (self-grant signature)'
    WHEN EXISTS (SELECT 1 FROM public.user_roles r
                 WHERE r.user_id = ur.user_id AND r.role <> 'admin')
      THEN 'SUSPECT — normal user also holding admin (self-grant signature)'
    ELSE 'UNEXPECTED — investigate'
  END                                                                       AS assessment
FROM public.user_roles ur
LEFT JOIN auth.users      au ON au.id = ur.user_id
LEFT JOIN public.waitlist wl ON wl.user_id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY is_expected_admin DESC, waitlist_status NULLS LAST, ur.created_at;


-- ----------------------------------------------------------------------------
-- Q3 — Sanity counts. The prior auth-orphan audit (2026-07-14) ended at
--      valid_user_roles = 3. A healthy result here has admin_roles = 1,
--      distinct_admins = 1, and orphaned_role_rows = 0.
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.user_roles)                                       AS total_role_rows,
  (SELECT count(*) FROM public.user_roles WHERE role = 'student')                AS student_roles,
  (SELECT count(*) FROM public.user_roles WHERE role = 'club')                   AS club_roles,
  (SELECT count(*) FROM public.user_roles WHERE role = 'admin')                  AS admin_roles,
  (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role = 'admin')   AS distinct_admins,
  (SELECT count(*) FROM public.user_roles ur
     WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = ur.user_id))    AS orphaned_role_rows,
  (SELECT count(*) FROM public.user_roles ur
     LEFT JOIN auth.users au ON au.id = ur.user_id
     WHERE ur.role = 'admin' AND lower(au.email) IS DISTINCT FROM 'zothub.uci@gmail.com')
                                                                                 AS unexpected_admin_rows;
