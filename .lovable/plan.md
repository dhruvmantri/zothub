
# Allow Admin Email Exception

This plan adds `zothub.uci@gmail.com` as an allowed admin email that bypasses the UCI email restriction.

---

## Overview

Create an allowlist for special admin emails that can sign up despite not being `@uci.edu` addresses.

---

## Changes Required

### 1. Create Admin Allowlist Constant

**File**: `src/lib/constants.ts`

Add a constant for allowed admin emails:

```typescript
// Emails allowed to bypass @uci.edu restriction (admin accounts)
export const ADMIN_ALLOWED_EMAILS = ["zothub.uci@gmail.com"];
```

---

### 2. Update Signup Page Validation

**File**: `src/pages/Signup.tsx`

Modify the email validation to allow admin emails:

```typescript
import { ADMIN_ALLOWED_EMAILS } from "@/lib/constants";

// In validateForm():
if (!formData.email) {
  newErrors.email = "Email is required";
} else if (!formData.email.endsWith("@uci.edu") && !ADMIN_ALLOWED_EMAILS.includes(formData.email.toLowerCase())) {
  newErrors.email = "Please use your @uci.edu email";
}
```

---

### 3. Update AuthContext OAuth Handler

**File**: `src/contexts/AuthContext.tsx`

Modify the OAuth email check:

```typescript
import { ADMIN_ALLOWED_EMAILS } from "@/lib/constants";

// In handleNewOAuthUser():
if (!email.endsWith("@uci.edu") && !ADMIN_ALLOWED_EMAILS.includes(email.toLowerCase())) {
  console.error("Non-UCI email attempted to sign up");
  await supabase.auth.signOut();
  return;
}
```

---

### 4. Google OAuth Domain Restriction

**Note**: The `hd: "uci.edu"` parameter in Google OAuth will still block Gmail accounts from using the Google sign-in button. This is a Google-side restriction that cannot be bypassed client-side.

**Solution**: For admin signup with `zothub.uci@gmail.com`, you'll need to use the **email/password signup** method instead of Google OAuth. The Google button will remain restricted to UCI accounts only.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/constants.ts` | Add `ADMIN_ALLOWED_EMAILS` array |
| `src/pages/Signup.tsx` | Update email validation to check allowlist |
| `src/contexts/AuthContext.tsx` | Update OAuth handler to check allowlist |

---

## After Implementation

1. Go to `/signup`
2. Select any role (student or club - doesn't matter for admin)
3. Enter `zothub.uci@gmail.com` and a password
4. Create account - you'll be added to waitlist
5. Use SQL to grant admin role:
   ```sql
   -- Find your user ID
   SELECT id FROM auth.users WHERE email = 'zothub.uci@gmail.com';
   
   -- Grant admin role
   INSERT INTO user_roles (user_id, role) VALUES ('YOUR_USER_ID', 'admin');
   
   -- Remove from waitlist
   DELETE FROM waitlist WHERE user_id = 'YOUR_USER_ID';
   ```
6. Log in and access `/admin`

---

## Security Note

The allowlist is intentionally small and explicit. Only emails in `ADMIN_ALLOWED_EMAILS` can bypass the restriction. This prevents arbitrary non-UCI emails from signing up while allowing specific admin accounts.
