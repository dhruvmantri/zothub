-- Exact service-role table grants (production-like).
--
-- ⚠️ NOT APPLIED AUTOMATICALLY. Review + back up before `supabase db push`.
--
-- In production, Supabase already grants the service_role broad access to public
-- tables, so this migration is a NO-OP there (GRANT is idempotent). Locally, a
-- fresh `supabase db reset` does NOT grant service_role on tables created by
-- earlier migrations — which previously forced the E2E runner to issue a blanket
-- `GRANT ... ON ALL TABLES`, masking any genuinely-missing grant.
--
-- Declaring the EXACT grants here instead lets the E2E run with production-like
-- permissions (the runner grants nothing), so a real missing grant surfaces as a
-- test failure. Keep this list in sync with the tables the service-role edge
-- functions (send-email / send-otp / verify-otp / submit-club-claim /
-- review-club-claim) read or write. The MB5 tables created in
-- 20260727000200 / 00300 already grant service_role in their own migrations.

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.club_profiles,
  public.waitlist,
  public.user_roles,
  public.email_verifications,
  public.student_profiles,
  public.applications,
  public.opportunities,
  public.events,
  public.rsvps,
  public.reminder_logs,
  public.notification_preferences,
  public.notifications
TO service_role;

COMMIT;
