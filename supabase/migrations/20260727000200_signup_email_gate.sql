-- Signup email gate — keep @uci.edu enforcement AUTHORITATIVE at the database,
-- but allow admin-approved clubs (which often lack a uci.edu address) through a
-- service-only, one-time authorization. Also close the wide-open RLS on
-- email_verifications that let anyone forge a code / role / email.
--
-- ⚠️ NOT APPLIED AUTOMATICALLY. Review + back up before `supabase db push`.
--
-- Background: 20260709000300 added a BEFORE INSERT trigger on auth.users that
-- hard-blocks any non-@uci.edu signup. That trigger only ever sees NEW.email (it
-- does NOT — and cannot — see the intended role or app_metadata, which GoTrue
-- writes after the insert), so it can't be made "role-aware." Rather than DROP it
-- (which would remove the only server/DB-level guarantee), we keep it and add an
-- explicit, service-issued escape hatch for the specific non-UCI emails we approve.

BEGIN;

-- 1. Service-only, one-time authorizations for non-UCI signups.
--    A club claim approval (review-club-claim) or a club OTP signup (verify-otp)
--    inserts one row for the exact email right before it calls admin.createUser.
--    The trigger below consumes it. No anon/authenticated access at all — only the
--    service role (edge functions) and the SECURITY DEFINER trigger touch it.
CREATE TABLE IF NOT EXISTS public.signup_email_authorizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  reason      text NOT NULL,                 -- 'club_claim' | 'club_otp_signup'
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,          -- short-lived (issuer sets ~1h)
  consumed_at timestamptz                    -- set when the matching insert fires
);

-- Fast lookup of a live authorization for an email.
CREATE INDEX IF NOT EXISTS signup_email_authorizations_live_idx
  ON public.signup_email_authorizations (lower(email))
  WHERE consumed_at IS NULL;

ALTER TABLE public.signup_email_authorizations ENABLE ROW LEVEL SECURITY;
-- Deliberately NO policies → anon/authenticated get nothing (RLS default-deny).
-- Explicit, exact grants (prod-like): only the service role (edge functions) may
-- touch this table; anon/authenticated get nothing.
REVOKE ALL ON public.signup_email_authorizations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signup_email_authorizations TO service_role;

-- 1b. Atomic, service-only rate-limit ledger. Buckets are '<action>:email:<email>'
--     (normalized email) and — where a TRUSTED platform IP is available — an IP
--     bucket. It is NOT keyed on caller-supplied x-forwarded-for (untrusted). The
--     atomic check lives in rate_limit_hit() below.
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket     text NOT NULL,            -- '<action>:email:<normalized-email>'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_events_bucket_idx
  ON public.rate_limit_events (bucket, created_at);
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_events TO service_role;

-- 1c. ATOMIC rate limit. Serializes concurrent checks for the same bucket with a
--     transaction-scoped advisory lock, so count-then-insert cannot race (the old
--     read-then-write counter could be beaten by concurrent requests). Returns TRUE
--     when the caller is over the limit (and records nothing); FALSE when allowed
--     (and records the event). Service-role only.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_bucket, 0));
  DELETE FROM public.rate_limit_events WHERE bucket = p_bucket AND created_at < v_since;
  SELECT count(*) INTO v_count
    FROM public.rate_limit_events
   WHERE bucket = p_bucket AND created_at >= v_since;
  IF v_count >= p_max THEN
    RETURN true;
  END IF;
  INSERT INTO public.rate_limit_events (bucket) VALUES (p_bucket);
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;

-- 1d. ATOMIC OTP verification-attempt increment. A single UPDATE ... RETURNING so
--     concurrent wrong guesses cannot race past the cap with a lost update (the old
--     read-then-write in verify-otp could). Returns the new attempt count.
CREATE OR REPLACE FUNCTION public.increment_otp_attempt(p_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.email_verifications
     SET attempts = attempts + 1
   WHERE id = p_id
  RETURNING attempts;
$$;
REVOKE ALL ON FUNCTION public.increment_otp_attempt(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_otp_attempt(uuid) TO service_role;

-- 2. Authorization-aware enforcement. UCI addresses and the admin allowlist are
--    always allowed; every other domain must present a live, unconsumed
--    authorization for that exact email, consumed atomically here so it cannot be
--    replayed. This keeps the DB as the authoritative gate: a direct GoTrue
--    signUp, a leaked anon key, or a bug in an edge function still cannot create a
--    non-UCI account without a service-issued grant.
CREATE OR REPLACE FUNCTION public.enforce_uci_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  consumed_id uuid;
BEGIN
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'Signups require an email address';
  END IF;

  IF lower(NEW.email) LIKE '%@uci.edu'
     OR lower(NEW.email) = 'zothub.uci@gmail.com' THEN
    RETURN NEW;
  END IF;

  -- Consume exactly one live authorization for this email (SKIP LOCKED so two
  -- concurrent inserts for the same email can't consume the same row).
  UPDATE public.signup_email_authorizations
     SET consumed_at = now()
   WHERE id = (
           SELECT id
             FROM public.signup_email_authorizations
            WHERE lower(email) = lower(NEW.email)
              AND consumed_at IS NULL
              AND expires_at > now()
            ORDER BY created_at
            LIMIT 1
            FOR UPDATE SKIP LOCKED
         )
  RETURNING id INTO consumed_id;

  IF consumed_id IS NULL THEN
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

-- 3. Lock down email_verifications. The original policies (20260129012302) were
--    WITH CHECK (true) / USING (true) for INSERT/SELECT/UPDATE, i.e. any anon
--    client could read a pending OTP for any email, or forge a verification row
--    (own code + own password_hash + arbitrary role) and then call verify-otp to
--    create an account for an email it does not control, with a role it chose.
--    send-otp / verify-otp use the service role (which bypasses RLS), so removing
--    all public access does not affect the real flow — it only removes the hole.
DROP POLICY IF EXISTS "Anyone can insert verification"          ON public.email_verifications;
DROP POLICY IF EXISTS "Anyone can select by email"              ON public.email_verifications;
DROP POLICY IF EXISTS "Anyone can update verification status"   ON public.email_verifications;
DROP POLICY IF EXISTS "Anyone can delete expired verifications" ON public.email_verifications;
-- RLS stays ENABLED with no policies (default-deny for anon/authenticated).
REVOKE ALL ON public.email_verifications FROM anon, authenticated;

COMMIT;
