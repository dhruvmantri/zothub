-- SECURITY: remove the privilege-escalation path on public.user_roles.
--
-- The problem
-- -----------
-- 20251223013805 created:
--
--   CREATE POLICY "Users can insert their own role on signup"
--   ON public.user_roles FOR INSERT TO authenticated
--   WITH CHECK (user_id = auth.uid());
--
-- 20260709000200 moved role assignment to admin approval and added an
-- admin-only INSERT policy, but never dropped the policy above. Postgres
-- permissive policies are OR'd, so the self-insert path stayed open. Combined
-- with 20260128213952 (which added 'admin' to the user_role enum), ANY
-- authenticated user — including one still pending on the waitlist — could run
--
--   supabase.from('user_roles').insert({ user_id: <own uid>, role: 'admin' })
--
-- and thereby grant themselves the admin role: read every waitlist entry
-- (all signup emails), approve/reject/delete queue entries, and assign roles to
-- other users. AdminRoute gates on this same table, so the client check
-- confirms the escalation rather than preventing it.
--
-- Why dropping it is safe (verified across the whole repo, 2026-07-23)
-- -------------------------------------------------------------------
-- Only three code sites touch user_roles, and none relies on this policy:
--   1. src/contexts/AuthContext.tsx  — SELECT only (governed by SELECT policies).
--   2. src/hooks/useWaitlist.ts (approveUser) — runs in the browser as the
--      admin, but inserts the *approved user's* id, not auth.uid(), so
--      WITH CHECK (user_id = auth.uid()) is false and cannot authorize it. It
--      is carried by "Admins can insert user roles" (20260709000200).
--   3. supabase/functions/verify-otp — uses SUPABASE_SERVICE_ROLE_KEY, which
--      bypasses RLS entirely.
-- All four edge functions build their write clients with the service role. No
-- .rpc() touches roles. handleNewOAuthUser writes to waitlist, never user_roles.
--
-- Scope: deliberately single-purpose. This migration only closes the
-- escalation. The broader authorization work (failing closed on missing
-- role/waitlist records, adding has_role checks to the marketplace write
-- policies, unifying OTP/OAuth signup) is a separate reviewed pass.

-- Guard: this repo has a history of production drifting from its migrations
-- (see the auth-orphan cleanup record in plan.md, where declared FKs were
-- absent in production). If the admin INSERT policy is missing here, dropping
-- the self-insert policy would leave NO client-side path to grant a role and
-- would silently break the /admin approval flow. Fail loudly instead.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_roles'
      AND policyname = 'Admins can insert user roles'
  ) THEN
    RAISE EXCEPTION
      'Refusing to drop the self-insert policy: "Admins can insert user roles" is missing on public.user_roles, so admin approval would break. Restore it (migration 20260709000200) first.';
  END IF;
END
$$;

DROP POLICY IF EXISTS "Users can insert their own role on signup" ON public.user_roles;

-- Post-condition: user_roles rows can be created only by (a) the service role
-- (edge functions, dashboard) or (b) an existing admin. Idempotent — a re-run
-- is a no-op once the policy is gone.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_roles'
      AND policyname = 'Users can insert their own role on signup'
  ) THEN
    RAISE EXCEPTION 'Self-insert policy still present on public.user_roles after DROP.';
  END IF;
END
$$;
