-- Phase 2 fix (Bug Inventory: "[Infra/Security] DB-level @uci.edu enforcement
-- missing" — Known Item #4).
--
-- The @uci.edu restriction was client-side only; a direct call to the
-- send-otp/verify-otp edge functions (or any path that creates an auth user)
-- could register any email. This BEFORE INSERT trigger on auth.users is the
-- authoritative gate.
--
-- Scope kept deliberately narrow:
--   * INSERT only — existing users and updates are never affected.
--   * The admin account (zothub.uci@gmail.com) is allowlisted, matching
--     ADMIN_ALLOWED_EMAILS in src/lib/constants.ts. Keep the two lists in sync.
--   * Comparison is case-insensitive.

CREATE OR REPLACE FUNCTION public.enforce_uci_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL
     OR (
       lower(NEW.email) NOT LIKE '%@uci.edu'
       AND lower(NEW.email) <> 'zothub.uci@gmail.com'
     )
  THEN
    RAISE EXCEPTION 'Signups are restricted to @uci.edu email addresses';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_uci_email_on_signup ON auth.users;
CREATE TRIGGER enforce_uci_email_on_signup
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_uci_email();
