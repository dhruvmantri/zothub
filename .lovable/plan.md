
# Email OTP Verification for Signup

This plan adds a 6-digit OTP code verification step during email/password signup to ensure users actually own the email addresses they register with.

---

## Overview

Before creating a Supabase account, users will:
1. Enter their email, password, and role
2. Receive a 6-digit OTP code via email
3. Enter the code to verify ownership
4. Only then is their account created

**Note**: Google OAuth users skip this step since Google already verifies email ownership via their authentication flow.

---

## Architecture

```text
Current Flow:
Email/Password → Create Account → Add to Waitlist → Done

New Flow:
Email/Password → Send OTP → Verify OTP → Create Account → Add to Waitlist → Done
```

---

## Database Changes

### 1. Create `email_verifications` Table

Store pending OTP codes with expiration:

```sql
CREATE TABLE public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'club')),
  password_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Allow anyone to insert (before auth)
-- RLS policies for unauthenticated access
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert verification" ON public.email_verifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can select by email" ON public.email_verifications
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update verification status" ON public.email_verifications
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete expired verifications" ON public.email_verifications
  FOR DELETE USING (expires_at < now());

-- Auto-cleanup old entries
CREATE INDEX idx_email_verifications_expires ON public.email_verifications(expires_at);
CREATE INDEX idx_email_verifications_email ON public.email_verifications(email);
```

---

## Backend Changes

### 2. Create Edge Function: `send-otp`

Handles OTP generation and email sending:

- Generate a cryptographically secure 6-digit code
- Store in `email_verifications` table with 10-minute expiry
- Hash the password temporarily (not stored in plain text)
- Send OTP via Resend email
- Rate limit: max 3 requests per email per hour

### 3. Create Edge Function: `verify-otp`

Handles OTP verification and account creation:

- Validate the OTP code matches and isn't expired
- Create the Supabase auth user
- Add user to waitlist
- Create profile (student or club)
- Send waitlist confirmation email
- Delete the verification record

### 4. Update `send-email` Function

Add new email template type: `email_otp`

```typescript
case "email_otp":
  return {
    subject: "Your ZotHub Verification Code",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Verify Your Email</h1>
        <p>Use this code to verify your email address:</p>
        <div style="margin: 24px 0; padding: 24px; background: #f4f4f5; border-radius: 8px; text-align: center;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">
            ${data.code}
          </span>
        </div>
        <p style="color: #71717a;">This code expires in 10 minutes.</p>
        <p style="color: #71717a; font-size: 14px;">— The ZotHub Team</p>
      </div>
    `,
  };
```

---

## Frontend Changes

### 5. Update Signup Page (`src/pages/Signup.tsx`)

Add a new step to the signup flow:

**Steps**: `role` → `details` → `otp` → (account created)

- After form validation, call `send-otp` edge function
- Show OTP input UI using the existing `InputOTP` component
- Add "Resend Code" button with 60-second cooldown
- On successful verification, show success toast and redirect

### 6. Create OTP Verification Component

New component: `src/components/OTPVerification.tsx`

- 6-digit OTP input using shadcn's `InputOTP` components
- Loading states and error handling
- Countdown timer for code expiry
- Resend functionality with rate limiting UI

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Brute force OTP | Max 5 attempts per verification, then invalidate |
| Email spam | Rate limit: 3 OTP requests per email per hour |
| Password exposure | Password is hashed before storing temporarily |
| Code guessing | 6 digits = 1 million combinations, 10-min expiry |
| Replay attacks | Code deleted immediately after successful verification |

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/send-otp/index.ts` | Generate and send OTP code |
| `supabase/functions/verify-otp/index.ts` | Verify code and create account |
| `src/components/OTPVerification.tsx` | OTP input UI component |

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-email/index.ts` | Add `email_otp` template |
| `src/pages/Signup.tsx` | Add OTP verification step |
| Database migration | Create `email_verifications` table |

---

## User Experience Flow

1. User selects role (student/club)
2. User enters email and password
3. User clicks "Create Account"
4. Page shows OTP input with message: "Check your email for a 6-digit code"
5. User enters code from email
6. Success: "Account created! Welcome to ZotHub."
7. User is redirected to waitlist page

---

## Admin Emails Exception

For admin-allowed emails (like `zothub.uci@gmail.com`), the OTP verification still applies since it's email/password signup. This ensures even admin accounts verify email ownership.

---

## Google OAuth Flow

No changes needed - Google OAuth already verifies email ownership through their authentication process. The `hd: "uci.edu"` parameter ensures only UCI accounts can use this method.
