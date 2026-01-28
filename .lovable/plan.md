

# Waitlist/Verification System Plan

This plan implements a complete admin approval system where all new signups (students and clubs) require your manual approval before gaining full platform access.

---

## Overview

| Component | Description |
|-----------|-------------|
| New Role | Add `admin` to the `user_role` enum |
| New Table | `waitlist` table to track pending signups |
| Approval Status | Track `pending`, `approved`, `rejected` states |
| Waitlist Page | Show users they're on the waitlist after signup |
| Admin Dashboard | New `/admin` route for you to manage approvals |
| Email Notifications | Notify users when approved/rejected |
| Access Control | Block pending users from accessing protected routes |

---

## Database Changes

### 1. Update user_role Enum

Add `admin` role to the existing enum:

```sql
ALTER TYPE user_role ADD VALUE 'admin';
```

### 2. Create Waitlist Table

Track all pending signups with approval status:

```sql
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'club')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Users can view their own waitlist status
CREATE POLICY "Users can view their own waitlist entry"
  ON public.waitlist FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all waitlist entries
CREATE POLICY "Admins can view all waitlist entries"
  ON public.waitlist FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update waitlist entries
CREATE POLICY "Admins can update waitlist entries"
  ON public.waitlist FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
```

### 3. Create has_role Function for Admin

Update the existing `has_role` function to support the new admin role (already exists, just need enum update).

### 4. Add Index for Performance

```sql
CREATE INDEX idx_waitlist_status ON waitlist(status);
CREATE INDEX idx_waitlist_user_id ON waitlist(user_id);
```

---

## Authentication Flow Changes

### Current Flow:
1. User signs up
2. Role inserted into `user_roles`
3. Profile created
4. Redirect to dashboard

### New Flow:
1. User signs up
2. Entry added to `waitlist` table with status `pending`
3. Profile created (but marked as pending)
4. Redirect to `/waitlist` page
5. Admin reviews and approves
6. On approval: role inserted into `user_roles`, email sent
7. User can now access dashboard

---

## File Changes

### 1. AuthContext Updates (`src/contexts/AuthContext.tsx`)

- Add `waitlistStatus` to context state
- Fetch waitlist status alongside role
- Modify `signUp` to insert into `waitlist` instead of `user_roles`
- Add function to check if user is approved

```typescript
interface AuthContextType {
  // ... existing fields
  waitlistStatus: "pending" | "approved" | "rejected" | null;
  isApproved: boolean;
}
```

### 2. New Waitlist Page (`src/pages/Waitlist.tsx`)

Show users their waitlist status:

- Display "You're on the waitlist!" message
- Show estimated position (optional)
- Explain what happens next
- Check status on interval or page load
- Redirect to dashboard when approved

### 3. New Admin Dashboard (`src/pages/admin/AdminDashboard.tsx`)

Admin-only page to manage waitlist:

- List all pending signups (students and clubs)
- Show signup date, email, role type
- Approve/Reject buttons
- Optional rejection reason field
- Filter by status and role type
- Bulk approve functionality

### 4. Update ProtectedRoute (`src/components/ProtectedRoute.tsx`)

Add waitlist check:

```typescript
// If user is on waitlist (not approved), redirect to waitlist page
if (user && waitlistStatus === "pending") {
  return <Navigate to="/waitlist" replace />;
}

if (user && waitlistStatus === "rejected") {
  return <Navigate to="/waitlist-rejected" replace />;
}
```

### 5. Add Admin Route Guard (`src/components/AdminRoute.tsx`)

New component to protect admin pages:

```typescript
export function AdminRoute({ children }) {
  const { role } = useAuth();
  
  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}
```

### 6. Update App.tsx Routes

Add new routes:

```typescript
<Route path="/waitlist" element={<Waitlist />} />
<Route path="/waitlist-rejected" element={<WaitlistRejected />} />
<Route 
  path="/admin" 
  element={
    <AdminRoute>
      <AdminDashboard />
    </AdminRoute>
  } 
/>
```

### 7. Email Notifications

Add new email types to `send-email` edge function:

- `waitlist_confirmation` - Sent on signup
- `waitlist_approved` - Sent when admin approves
- `waitlist_rejected` - Sent when admin rejects (with reason)

---

## User Experience Flow

### For New Users:

```text
1. Sign up (student or club)
         ↓
2. See "You're on the Waitlist!" page
         ↓
3. Receive confirmation email
         ↓
4. [Wait for admin review]
         ↓
5a. APPROVED → Email notification → Login → Dashboard
         OR
5b. REJECTED → Email notification → Waitlist rejected page
```

### For Admin (You):

```text
1. Log in as admin
         ↓
2. Go to /admin
         ↓
3. See list of pending signups
         ↓
4. Review each signup
         ↓
5. Click Approve or Reject
         ↓
6. System sends email to user
```

---

## Admin Account Setup

You'll need to manually create your admin account:

1. Sign up with your email
2. Run SQL in Cloud View to set your role:

```sql
-- Insert admin role for your user
INSERT INTO user_roles (user_id, role)
VALUES ('<your-user-id>', 'admin');

-- Remove from waitlist if added
DELETE FROM waitlist WHERE user_id = '<your-user-id>';
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Waitlist.tsx` | Waitlist status page for users |
| `src/pages/WaitlistRejected.tsx` | Rejection message page |
| `src/pages/admin/AdminDashboard.tsx` | Admin approval dashboard |
| `src/components/AdminRoute.tsx` | Route guard for admin pages |
| `src/hooks/useWaitlist.ts` | Hook for waitlist operations |

## Files to Modify

| File | Changes |
|------|---------|
| `src/contexts/AuthContext.tsx` | Add waitlist status, modify signup flow |
| `src/components/ProtectedRoute.tsx` | Add waitlist status check |
| `src/App.tsx` | Add new routes |
| `supabase/functions/send-email/index.ts` | Add waitlist email templates |
| `src/lib/emailService.ts` | Add waitlist email functions |

---

## Security Considerations

1. **Admin role stored in database** - Not in localStorage or hardcoded
2. **RLS policies** - Admins can view/update waitlist; users can only view own entry
3. **Server-side validation** - Role checks use `has_role()` function
4. **Profiles created but gated** - Users exist but can't access protected routes

---

## Implementation Order

| Step | Task | Effort |
|------|------|--------|
| 1 | Database migration (enum + waitlist table) | Low |
| 2 | Update AuthContext with waitlist logic | Medium |
| 3 | Create Waitlist page | Low |
| 4 | Update ProtectedRoute | Low |
| 5 | Create AdminRoute component | Low |
| 6 | Create Admin Dashboard | Medium |
| 7 | Add email templates | Low |
| 8 | Update App.tsx routes | Low |
| 9 | Set up your admin account | Manual |

---

## Summary

This system ensures:
- All new signups require manual approval
- Users see a friendly waitlist page while pending
- You have a dedicated admin dashboard to manage approvals
- Email notifications keep users informed
- Security is maintained through proper RLS and role checks

