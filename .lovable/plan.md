

# Fix Edge Function Error Message Display

When users try to sign up with an email that's already registered, the edge function correctly returns a helpful error message, but the frontend displays a generic error instead.

---

## Problem

The edge function returns:
```json
{"error": "This email is already registered. Please log in instead."}
```

But users see:
```
"Edge Function returned a non-2xx status code"
```

---

## Root Cause

The `supabase.functions.invoke` method doesn't automatically parse error messages from non-2xx responses. When a 400 status is returned, the `error` object contains a generic message while the actual error details are in the response body.

---

## Solution

Update the error handling in `Signup.tsx` to properly extract error messages from edge function responses.

---

## Changes Required

### File: `src/pages/Signup.tsx`

Update the `sendOTP` function error handling:

**Current approach:**
```typescript
const { data, error } = await supabase.functions.invoke("send-otp", { ... });
if (error) {
  throw new Error(error.message);
}
```

**Fixed approach:**
```typescript
const { data, error } = await supabase.functions.invoke("send-otp", { ... });

// Check for error in response data first (edge function custom errors)
if (data?.error) {
  throw new Error(data.error);
}

// Then check for transport/network errors
if (error) {
  throw new Error(error.message);
}
```

The key insight is that even when an edge function returns a non-2xx status, the response body is still parsed into `data`. So we should check `data.error` before checking the generic `error` object.

---

## Technical Details

- The edge function returns proper error messages in the JSON body
- `supabase.functions.invoke` may still populate `data` even on non-2xx responses
- By checking `data.error` first, we capture the meaningful error message

---

## Expected Behavior After Fix

| Scenario | Current Toast | Fixed Toast |
|----------|--------------|-------------|
| Email already registered | "Edge Function returned a non-2xx status code" | "This email is already registered. Please log in instead." |
| Rate limited | Generic error | "Too many verification attempts. Please try again in an hour." |
| Invalid role | Generic error | "Invalid role. Must be 'student' or 'club'" |

