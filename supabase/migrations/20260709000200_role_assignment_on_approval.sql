-- Phase 2 fix (Bug Inventory: "[Auth] Admin approval fails for every email/OTP
-- signup" + "[Auth] Pending email/OTP users hit an infinite redirect loop").
--
-- Root cause: verify-otp inserted the user_roles row at signup time, so
-- (a) the admin approval insert hit the (user_id, role) unique key, and
-- (b) pending users had a role, which made /waitlist bounce them back to the
--     dashboard in a loop.
--
-- The companion code change removes the signup-time insert from verify-otp and
-- makes approval assign the role. This migration:
--   1. lets admins insert user_roles rows for other users (approval was
--      otherwise blocked by the insert-own-role-only RLS policy), and
--   2. cleans up roles that were prematurely granted to users whose waitlist
--      entry is still pending (or was rejected) — those users should not hold
--      a role until approved. Only the role matching their waitlist role is
--      removed, so admin roles are never touched.

-- 1. Admin can assign roles (needed by the /admin approval flow)
CREATE POLICY "Admins can insert user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can also read all roles. Without this, an INSERT ... RETURNING (which
-- PostgREST issues whenever a .select() is chained onto the insert/upsert)
-- fails RLS because the freshly inserted row isn't visible to the admin under
-- the view-own-roles SELECT policy. approveUser uses return=minimal today,
-- but this keeps the approval flow from breaking if that ever changes.
CREATE POLICY "Admins can view all user roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Remove prematurely-granted roles for non-approved waitlist users
DELETE FROM public.user_roles ur
USING public.waitlist w
WHERE ur.user_id = w.user_id
  AND w.status IN ('pending', 'rejected')
  AND ur.role::text = w.role;
