

# Fix Edge Function Error Message Extraction

The error handling for edge function responses needs to use Supabase's built-in error types to properly extract custom error messages from non-2xx responses.

---

## Problem

When `supabase.functions.invoke` receives a non-2xx status:
- The `error` object is populated with a generic message
- The `data` object may be `null` or not contain the response body
- The actual error message is in `error.context` which needs to be parsed as JSON

---

## Solution

Use Supabase's `FunctionsHttpError` class to properly extract error messages from edge function responses.

---

## Changes Required

### File: `src/pages/Signup.tsx`

**Import the error types:**
```typescript
import { FunctionsHttpError } from "@supabase/supabase-js";
```

**Update `sendOTP` function:**
```typescript
const sendOTP = async () => {
  setIsSubmitting(true);
  setErrors({});
  
  try {
    const { data, error } = await supabase.functions.invoke("send-otp", {
      body: {
        email: formData.email,
        password: formData.password,
        role: selectedRole,
      },
    });

    if (error) {
      // Handle HTTP errors from edge function (non-2xx responses)
      if (error instanceof FunctionsHttpError) {
        const errorData = await error.context.json();
        throw new Error(errorData.error || "Request failed");
      }
      throw new Error(error.message);
    }

    // Also check for error in response data (for 2xx responses with error payload)
    if (data?.error) {
      throw new Error(data.error);
    }

    setOtpExpiresAt(data.expiresAt);
    setStep("otp");
    toast({
      title: "Code sent!",
      description: "Check your email for the 6-digit verification code.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send verification code";
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## Technical Explanation

Supabase's functions client provides three error types:

| Error Type | When It Occurs |
|------------|----------------|
| `FunctionsHttpError` | Edge function returns non-2xx status |
| `FunctionsRelayError` | Error in the relay/gateway layer |
| `FunctionsFetchError` | Network/fetch failure |

For `FunctionsHttpError`, the response body is accessible via `error.context.json()` which returns a promise containing the parsed JSON response.

---

## Expected Behavior After Fix

| Scenario | Current | Fixed |
|----------|---------|-------|
| Email already registered | "Edge Function returned a non-2xx status code" | "This email is already registered. Please log in instead." |
| Rate limited | Generic error | "Too many verification attempts. Please try again in an hour." |
| Missing fields | Generic error | "Missing required fields: email, password, role" |

